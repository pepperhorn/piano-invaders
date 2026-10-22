import type { AccompNote, Difficulty, GameSong, Target, VoiceInfo } from './types';
import { SongError } from './errors';
import { addInnerVoice, buildTargets, type RawNote } from './extract';
import { difficultyFromCrf, noteNameToMidi } from './pitch';

export interface DottlNote {
  id: string; name: string; col: number; row: number; octave: number; isRoot: boolean; sustainCells: number;
  velocity?: number; subCol?: number; subCount?: number; stutter?: number[];
}
export interface DottlLayer {
  id: string; name: string; color: string; instrumentCategory: string; smplrPatch: string; volume: number;
  reverb?: number; notes: DottlNote[]; lines: unknown[];
}
export interface DottlV7 {
  version: 7; projectName: string; bpm: number; divisor: 1 | 2 | 3 | 4; beatsPerBar: number; transposition: number;
  difficulty: Difficulty; timeSigChanges?: { id: string; col: number; beatsPerBar: number }[];
  extensions: { 'piano-invaders': { difficulty: Difficulty } }; layers: DottlLayer[];
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

export function isDottl(obj: unknown): boolean {
  if (!isObj(obj) || !Array.isArray(obj.layers)) return false;
  if (obj.version === undefined) return obj.divisor !== undefined;
  return typeof obj.version === 'number' && obj.version >= 5 && obj.version <= 7;
}

const DEFAULT_VELOCITY = 96;
const stutterVelocity = (v: number) => Math.round(16 + (v / 7) * 111);

function resolveDifficulty(...cands: unknown[]): Difficulty {
  for (const c of cands) {
    if (c === 'easy' || c === 'intermediate' || c === 'advanced') return c;
    if (typeof c === 'number') return difficultyFromCrf(c);
  }
  return 'easy';
}

export function dottlToGameSong(input: object | string, opts: { title?: string; difficulty?: Difficulty | number } = {}): GameSong {
  let d: unknown = input;
  if (typeof input === 'string') {
    try {
      d = JSON.parse(input);
    } catch (cause) {
      throw new SongError('score-parse', 'Invalid dottl: not valid JSON.', { cause });
    }
  }
  if (!isObj(d) || !isDottl(d)) throw new SongError('score-parse', 'Not a dottl song (expected version 5-7 with layers).');

  const divisor = typeof d.divisor === 'number' && d.divisor > 0 ? d.divisor : 1;
  const transposition = typeof d.transposition === 'number' ? d.transposition : 0;
  const sig = isObj(d.timeSignature) ? d.timeSignature.numerator : undefined;
  const beatsPerBar =
    typeof d.beatsPerBar === 'number' ? d.beatsPerBar : typeof sig === 'number' && sig > 0 ? sig : 4;
  const layers = d.layers as Obj[];

  const raw: RawNote[] = [];
  const voices: Record<string, VoiceInfo> = {};
  layers.forEach((layer, li) => {
    if (!isObj(layer)) throw new SongError('score-parse', `Layer ${li} is not an object.`);
    const id = String(layer.id ?? `layer-${li}`);
    const category = typeof layer.instrumentCategory === 'string' ? layer.instrumentCategory : undefined;
    voices[id] = {
      instrument: (typeof layer.smplrPatch === 'string' && layer.smplrPatch) || category || 'Keys',
      volume: (typeof layer.volume === 'number' ? layer.volume : 80) / 100,
      percussion: category?.toLowerCase() === 'drums',
    };
    const melody = li === 0;
    for (const n of (Array.isArray(layer.notes) ? layer.notes : []) as DottlNote[]) {
      if (!isObj(n) || typeof n.col !== 'number' || typeof n.name !== 'string' || typeof n.octave !== 'number') {
        throw new SongError('score-parse', `Layer ${li} has a malformed note.`);
      }
      let midi: number;
      try {
        midi = noteNameToMidi(n.name, n.octave) + transposition;
      } catch (cause) {
        throw new SongError('score-parse', `Invalid note name "${n.name}".`, { cause });
      }
      const cellDur = (1 + (n.sustainCells ?? 0)) / divisor;
      const cellBeat = n.col - 1;
      if (Array.isArray(n.stutter) && n.stutter.length > 0) {
        const count = n.stutter.length;
        let first = true;
        n.stutter.forEach((v, k) => {
          if (!(v > 0)) return;
          raw.push({
            beat: (cellBeat + k / count) / divisor, midi, durBeats: cellDur / count,
            velocity: stutterVelocity(v), voice: id, melody: melody && first,
          });
          first = false;
        });
        continue;
      }
      const sub = n.subCount && n.subCount > 0 ? (n.subCol ?? 0) / n.subCount : 0;
      raw.push({
        beat: (cellBeat + sub) / divisor, midi, durBeats: cellDur,
        velocity: n.velocity ?? DEFAULT_VELOCITY, voice: id, melody,
      });
    }
  });

  const rawSigs = (Array.isArray(d.timeSigChanges) ? d.timeSigChanges : []) as { col: number; beatsPerBar: number }[];
  const sigs = rawSigs
    .filter((s) => isObj(s) && typeof s.col === 'number' && typeof s.beatsPerBar === 'number')
    .map((s) => ({ beat: (s.col - 1) / divisor, beatsPerBar: s.beatsPerBar }));

  // Pickup (col 0) notes land at negative beats: shift the whole song by a full bar.
  const minBeat = raw.reduce((m, x) => Math.min(m, x.beat), Infinity);
  const shift = minBeat < -1e-9 ? beatsPerBar : 0;
  if (shift) {
    for (const x of raw) x.beat += shift;
    for (const s of sigs) s.beat += shift;
  }

  const { targets, accompaniment } = buildTargets(raw);
  if (targets.length === 0) throw new SongError('score-parse', 'The first layer has no playable notes.');
  addInnerVoice(voices, voices[String(layers[0].id ?? 'layer-0')]);

  const endBeat = raw.reduce((mx, x) => Math.max(mx, x.beat + x.durBeats), 0);
  const lengthBeats = Math.max(1, Math.ceil(endBeat / beatsPerBar - 1e-9)) * beatsPerBar;

  const ext = isObj(d.extensions) && isObj(d.extensions['piano-invaders']) ? d.extensions['piano-invaders'] : {};
  const title = opts.title ?? (typeof d.projectName === 'string' && d.projectName ? d.projectName : 'Untitled');
  const song: GameSong = {
    id: title,
    title,
    bpm: Math.round(typeof d.bpm === 'number' ? d.bpm : 120),
    beatsPerBar,
    difficulty: resolveDifficulty(opts.difficulty, d.difficulty, ext.difficulty),
    targets,
    accompaniment,
    voices,
    lengthBeats,
    source: 'dottl',
  };
  if (sigs.length) song.timeSigChanges = sigs;
  return song;
}

// ---------------------------------------------------------------- writer

const DOTTL_NAMES = ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'Bb', 'B'];
const EPS = 1e-6;

function pickDivisor(song: GameSong): 1 | 2 | 3 | 4 {
  const beats = [...song.targets, ...song.accompaniment].map((n) => n.beat);
  for (const s of song.timeSigChanges ?? []) beats.push(s.beat);
  for (const div of [1, 2, 3, 4] as const) {
    if (beats.every((b) => Math.abs(b * div - Math.round(b * div)) < EPS)) return div;
  }
  return 4;
}

export function gameSongToDottl(song: GameSong): DottlV7 {
  const divisor = pickDivisor(song);
  const mkNote = (n: Target | AccompNote, i: number, velocity?: number): DottlNote => {
    const pc = ((n.midi % 12) + 12) % 12;
    const note: DottlNote = {
      id: `n${i}`, name: DOTTL_NAMES[pc], col: Math.round(n.beat * divisor) + 1,
      row: Math.max(0, 96 - n.midi), octave: Math.floor(n.midi / 12) - 1, isRoot: false,
      sustainCells: Math.max(0, Math.round(n.durBeats * divisor) - 1),
    };
    if (velocity !== undefined) note.velocity = velocity;
    return note;
  };
  const layerOf = (id: string, name: string, notes: DottlNote[], info?: VoiceInfo): DottlLayer => ({
    id, name, color: '',
    instrumentCategory: info?.percussion ? 'Drums' : 'Keys',
    smplrPatch: info?.instrument ?? 'Splendid Grand Piano',
    volume: Math.round((info?.volume ?? 0.7) * 100),
    reverb: 0, notes, lines: [],
  });

  const melodyNotes: DottlNote[] = [
    ...song.targets.map((t, i) => mkNote(t, i)),
    ...song.accompaniment.filter((a) => a.voice === 'melody-inner').map((a, i) => mkNote(a, song.targets.length + i, a.velocity)),
  ];
  const layers: DottlLayer[] = [layerOf('melody', 'Melody', melodyNotes, song.voices.melody)];
  const byVoice = new Map<string, AccompNote[]>();
  for (const a of song.accompaniment) {
    if (a.voice === 'melody-inner') continue;
    byVoice.set(a.voice, [...(byVoice.get(a.voice) ?? []), a]);
  }
  for (const [voice, notes] of byVoice) {
    layers.push(layerOf(voice, voice, notes.map((a, i) => mkNote(a, i, a.velocity)), song.voices[voice]));
  }

  const out: DottlV7 = {
    version: 7, projectName: song.title, bpm: song.bpm, divisor, beatsPerBar: song.beatsPerBar, transposition: 0,
    difficulty: song.difficulty,
    extensions: { 'piano-invaders': { difficulty: song.difficulty } },
    layers,
  };
  if (song.timeSigChanges?.length) {
    out.timeSigChanges = song.timeSigChanges.map((s, i) => ({
      id: `ts${i + 1}`, col: Math.round(s.beat * divisor) + 1, beatsPerBar: s.beatsPerBar,
    }));
  }
  return out;
}
