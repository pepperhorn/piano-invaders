import { SplendidGrandPiano, Soundfont, DrumMachine } from 'smplr';

/**
 * Manages accompaniment instrument loading and beat-by-beat playback.
 * Each accompaniment layer gets its own smplr instrument instance.
 */
export class AccompanimentManager {
  constructor() {
    this.layers = [];       // { instrument, notesByCol, ready, maxCol }
    this.muted = false;
    this.initialized = false;
  }

  /**
   * Load instruments for all accompaniment layers.
   * Resolves when all instruments have attempted to load.
   */
  async init(audioContext, accompanimentLayers) {
    this.dispose();

    this.layers = accompanimentLayers.map(layer => {
      const instrument = createInstrument(audioContext, layer);
      const maxCol = Math.max(0, ...layer.notesByCol.keys());
      return {
        instrument,
        notesByCol: layer.notesByCol,
        maxCol,
        ready: false,
      };
    });

    // Load all instruments in parallel
    const results = await Promise.allSettled(
      this.layers.map((layer, i) =>
        layer.instrument.loaded().then(() => {
          layer.ready = true;
          console.log(`Accompaniment layer ${i + 1} loaded`);
        })
      )
    );

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`Accompaniment layer ${i + 1} failed to load:`, r.reason);
      }
    });

    this.initialized = true;
  }

  /**
   * Play all accompaniment notes for one beat.
   * @param {number} colStart - Starting column in the dottl grid
   * @param {number} divisor - Number of columns per beat
   * @param {number} bpm - Current BPM
   */
  playBeat(colStart, divisor, bpm) {
    if (this.muted) return;

    const subInterval = 60000 / bpm / divisor;

    for (const layer of this.layers) {
      if (!layer.ready) continue;

      for (let sub = 0; sub < divisor; sub++) {
        const col = colStart + sub;
        const notes = layer.notesByCol.get(col);
        if (!notes) continue;

        if (sub === 0) {
          // Play immediately for first sub-column
          playLayerNotes(layer.instrument, notes, subInterval);
        } else {
          // Schedule sub-beat notes
          const delay = sub * subInterval;
          setTimeout(() => {
            playLayerNotes(layer.instrument, notes, subInterval);
          }, delay);
        }
      }
    }
  }

  setMuted(value) {
    this.muted = value;
  }

  dispose() {
    for (const layer of this.layers) {
      try {
        layer.instrument?.stop?.();
        layer.instrument?.disconnect?.();
      } catch (e) {
        // ignore cleanup errors
      }
    }
    this.layers = [];
    this.initialized = false;
  }
}

/**
 * Create the appropriate smplr instrument for a layer.
 */
function createInstrument(audioContext, layer) {
  const { instrumentCategory, smplrPatch, smplrLibrary, volume } = layer;
  // Scale 0-127 MIDI volume to 0-127 for smplr
  const vol = volume ?? 70;

  if (instrumentCategory === 'Drums') {
    return new DrumMachine(audioContext, {
      instrument: smplrPatch || 'LM-2',
      volume: vol,
    });
  }

  if (smplrLibrary === 'SplendidGrandPiano') {
    return new SplendidGrandPiano(audioContext, { volume: vol });
  }

  // Default: Soundfont (covers synth_bass_1, percussive_organ, etc.)
  return new Soundfont(audioContext, {
    instrument: smplrPatch || 'acoustic_grand_piano',
    volume: vol,
  });
}

/**
 * Play an array of notes on a given instrument.
 */
function playLayerNotes(instrument, notes, subIntervalMs) {
  for (const { midi, sustainCells } of notes) {
    try {
      const duration = sustainCells > 0 ? (sustainCells * subIntervalMs) / 1000 : undefined;
      instrument.start({ note: midi, velocity: 80, duration });
    } catch (e) {
      // Silently skip notes that fail (e.g. out of range for instrument)
    }
  }
}
