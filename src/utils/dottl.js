/**
 * Convert dottl note names to Piano Invaders MIDI names
 * Dottl uses: C, C#/Db, D, D#/Eb, E, F, F#/Gb, G, G#/Ab, A, Bb, B
 * Piano Invaders uses: C3, C#3, D3, etc.
 */
const DOTTL_TO_MIDI = {
  'C': 'C',
  'C#/Db': 'C#',
  'D': 'D',
  'D#/Eb': 'D#',
  'E': 'E',
  'F': 'F',
  'F#/Gb': 'F#',
  'G': 'G',
  'G#/Ab': 'G#',
  'A': 'A',
  'Bb': 'A#',
  'B': 'B',
};

/**
 * Convert a dottl note object to a MIDI name string (e.g. "C#3")
 */
function dottlNoteToMidi(note, transposition) {
  const pitchName = DOTTL_TO_MIDI[note.name] || note.name;
  let octave = note.octave;
  let semitone = getSemitoneOffset(pitchName);
  semitone += transposition;
  while (semitone >= 12) { semitone -= 12; octave++; }
  while (semitone < 0) { semitone += 12; octave--; }
  return `${SEMITONE_TO_NAME[semitone]}${octave}`;
}

/**
 * Migrate a dottl object from older versions to v5 in-place.
 * Handles v3→v4→v5 field renames and category changes.
 */
function migrateDottl(dottl) {
  if (!dottl.layers) return;
  for (const layer of dottl.layers) {
    // v3→v4: instrumentType → instrumentCategory, instrumentName → smplrPatch
    if (layer.instrumentType && !layer.instrumentCategory) {
      const typeMap = {
        'keys': 'Keys', 'splendid-grand-piano': 'Keys', 'electric-piano': 'Keys',
        'mallet': 'Other', 'mellotron': 'Strings', 'smolken': 'Guitars',
        'drum-machine': 'Drums', 'soundfont': 'Other',
      };
      layer.instrumentCategory = typeMap[layer.instrumentType] || 'Keys';
    }
    if (layer.instrumentName && !layer.smplrPatch) {
      layer.smplrPatch = layer.instrumentName;
    }
    // v4→v5: category renames
    if (layer.instrumentCategory) {
      const catMap = { 'Piano': 'Keys', 'Mallet': 'Other', 'Bass': 'Guitars', 'Soundfont': 'Other' };
      layer.instrumentCategory = catMap[layer.instrumentCategory] || layer.instrumentCategory;
    }
  }
}

/**
 * Convert a .dottl file to a Piano Invaders song object.
 * First layer = melody (game notes), other layers = accompaniment.
 *
 * Melody format:
 *   - string = quarter note (one beat)
 *   - null = quarter rest
 *   - array of N = N equal subdivisions within one beat
 *     e.g. ["E3", "F3"] = two eighth notes
 *          ["C3", null, "D3"] = triplet with rest in middle
 *
 * @param {object} dottl - Parsed .dottl JSON
 * @returns {{ name: string, bpm: number, melody: (string|null|Array)[], divisor: number }}
 */
export function dottlToSong(dottl) {
  migrateDottl(dottl);
  const name = dottl.projectName || 'Untitled';
  const bpm = dottl.bpm || 120;
  const divisor = dottl.divisor || 1;
  const transposition = dottl.transposition || 0;

  const melodyLayer = dottl.layers?.[0];
  if (!melodyLayer || !melodyLayer.notes?.length) {
    return { name, bpm, melody: ['C3'], divisor: 1 };
  }

  const notes = melodyLayer.notes;

  // Find the extent of the grid
  const maxCol = Math.max(...notes.map(n => n.col + (n.sustainCells || 0)));

  // Build column-indexed map
  const colMap = new Map();
  for (const note of notes) {
    if (!colMap.has(note.col)) {
      colMap.set(note.col, note);
    }
  }

  if (divisor === 1) {
    // Simple case: each column = one beat, no subdivision needed
    const melody = [];
    for (let col = 0; col <= maxCol; col++) {
      const note = colMap.get(col);
      if (note) {
        melody.push(dottlNoteToMidi(note, transposition));
        for (let s = 0; s < (note.sustainCells || 0); s++) {
          col++;
          melody.push(null);
        }
      } else {
        melody.push(null);
      }
    }
    trimTrailingNulls(melody);
    autoTranspose(melody);
    const difficulty = dottl.difficulty ?? dottl.extensions?.['piano-invaders']?.difficulty ?? 'easy';
    return { name, bpm, melody, divisor: 1, difficulty };
  }

  // Divisor > 1: group columns into beats, collapse sub-beat columns into arrays
  const melody = [];
  for (let col = 0; col <= maxCol; col += divisor) {
    // Collect all sub-columns for this beat
    const subNotes = [];
    for (let sub = 0; sub < divisor && (col + sub) <= maxCol; sub++) {
      const note = colMap.get(col + sub);
      subNotes.push(note ? dottlNoteToMidi(note, transposition) : null);
    }

    // Check if all subs are null (full rest)
    if (subNotes.every(n => n === null)) {
      melody.push(null);
      continue;
    }

    // Check if only the first sub has a note and rest are null (simple quarter note)
    if (subNotes[0] !== null && subNotes.slice(1).every(n => n === null)) {
      melody.push(subNotes[0]);
      continue;
    }

    // Mixed: use array for subdivision
    melody.push(subNotes);
  }

  trimTrailingNulls(melody);
  autoTranspose(melody);

  const difficulty = dottl.difficulty ?? dottl.extensions?.['piano-invaders']?.difficulty ?? 'easy';
  return { name, bpm, melody, divisor: 1, difficulty };
}

function trimTrailingNulls(melody) {
  while (melody.length > 1 && melody[melody.length - 1] === null) {
    melody.pop();
  }
}

/**
 * Recursively extract all note strings from a melody (handles nested arrays)
 */
function extractNotes(melody) {
  const notes = [];
  for (const entry of melody) {
    if (typeof entry === 'string') notes.push(entry);
    else if (Array.isArray(entry)) {
      for (const sub of entry) {
        if (typeof sub === 'string') notes.push(sub);
      }
    }
  }
  return notes;
}

/**
 * Auto-transpose melody to fit keyboard range (B2–E4)
 */
function autoTranspose(melody) {
  const MIN_SEMI = noteToAbsolute('B2');
  const MAX_SEMI = noteToAbsolute('E4');
  const actualNotes = extractNotes(melody);
  if (actualNotes.length === 0) return;

  const semitones = actualNotes.map(noteToAbsolute);
  const minNote = Math.min(...semitones);
  const maxNote = Math.max(...semitones);

  if (minNote < MIN_SEMI || maxNote > MAX_SEMI) {
    const midMelody = (minNote + maxNote) / 2;
    const midKeyboard = (MIN_SEMI + MAX_SEMI) / 2;
    const octaveShift = Math.round((midKeyboard - midMelody) / 12);

    if (octaveShift !== 0) {
      for (let i = 0; i < melody.length; i++) {
        if (typeof melody[i] === 'string') {
          melody[i] = transposeNote(melody[i], octaveShift * 12);
        } else if (Array.isArray(melody[i])) {
          for (let j = 0; j < melody[i].length; j++) {
            if (typeof melody[i][j] === 'string') {
              melody[i][j] = transposeNote(melody[i][j], octaveShift * 12);
            }
          }
        }
      }
    }
  }
}

/** Convert a note string like "C#4" to an absolute semitone number */
function noteToAbsolute(note) {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return 0;
  return parseInt(match[2]) * 12 + getSemitoneOffset(match[1]);
}

/** Transpose a note string by a number of semitones */
function transposeNote(note, semitones) {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return note;
  let abs = parseInt(match[2]) * 12 + getSemitoneOffset(match[1]) + semitones;
  const octave = Math.floor(abs / 12);
  const pitchIdx = ((abs % 12) + 12) % 12;
  return `${SEMITONE_TO_NAME[pitchIdx]}${octave}`;
}

function getSemitoneOffset(name) {
  const map = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
  return map[name] ?? 0;
}

const SEMITONE_TO_NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert a Piano Invaders song to .dottl format.
 * Expands subdivision arrays into multiple columns.
 */
export function songToDottl(song) {
  const notes = [];
  let col = 0;

  for (const entry of song.melody) {
    if (Array.isArray(entry)) {
      // Subdivision: each element gets its own column
      const subDiv = entry.length;
      for (let s = 0; s < subDiv; s++) {
        const subNote = entry[s];
        if (subNote !== null && typeof subNote === 'string') {
          const match = subNote.match(/^([A-G]#?)(\d)$/);
          if (match) {
            notes.push({
              id: `n${col}`,
              name: MIDI_TO_DOTTL[match[1]] || match[1],
              col,
              row: getSemitoneOffset(match[1]),
              octave: parseInt(match[2]),
              isRoot: false,
              sustainCells: 0,
            });
          }
        }
        col++;
      }
    } else if (entry !== null && typeof entry === 'string') {
      const match = entry.match(/^([A-G]#?)(\d)$/);
      if (match) {
        notes.push({
          id: `n${col}`,
          name: MIDI_TO_DOTTL[match[1]] || match[1],
          col,
          row: getSemitoneOffset(match[1]),
          octave: parseInt(match[2]),
          isRoot: false,
          sustainCells: 0,
        });
      }
      col++;
    } else {
      // null = rest, one column
      col++;
    }
  }

  // Determine the effective divisor: find max subdivision length
  let maxDiv = 1;
  for (const entry of song.melody) {
    if (Array.isArray(entry) && entry.length > maxDiv) {
      maxDiv = entry.length;
    }
  }

  return {
    version: 5,
    projectName: song.name,
    bpm: song.bpm,
    divisor: maxDiv > 1 ? maxDiv : (song.divisor || 1),
    transposition: 0,
    difficulty: song.difficulty || 'easy',
    chords: [],
    layers: [{
      id: 'layer-melody',
      name: 'Melody',
      color: '#00ff00',
      instrumentCategory: 'Keys',
      smplrLibrary: 'SplendidGrandPiano',
      smplrPatch: 'Splendid Grand Piano',
      volume: 70,
      reverb: 20,
      notes,
      lines: [],
    }],
  };
}

const MIDI_TO_DOTTL = {
  'C': 'C', 'C#': 'C#/Db', 'D': 'D', 'D#': 'D#/Eb', 'E': 'E',
  'F': 'F', 'F#': 'F#/Gb', 'G': 'G', 'G#': 'G#/Ab', 'A': 'A',
  'A#': 'Bb', 'B': 'B',
};

/**
 * Validate a parsed object as a .dottl file
 */
export function isDottlFile(obj) {
  return obj && typeof obj === 'object' && obj.version && Array.isArray(obj.layers) && obj.layers.length > 0;
}
