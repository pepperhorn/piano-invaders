import * as Tone from 'tone';
import { SplendidGrandPiano } from 'smplr';

export class AudioManager {
  constructor() {
    this.synth = null;
    this.piano = null;
    this.pianoReady = false;
    this.initialized = false;
    this.usePiano = false; // default to synth
  }

  async init() {
    if (this.initialized) return;

    try {
      await Tone.start();

      // Default synth for SFX (hit, miss, game over)
      this.synth = new Tone.PolySynth(Tone.Synth, {
        envelope: {
          attack: 0.02,
          decay: 0.1,
          sustain: 0.3,
          release: 1
        },
        volume: -10
      }).toDestination();

      // Load smplr piano in the background — notes fall back to synth until ready
      const ctx = Tone.getContext().rawContext;
      this.piano = new SplendidGrandPiano(ctx, { volume: 100 });
      this.piano.loaded().then(() => {
        this.pianoReady = true;
        console.log('Sampled piano loaded');
      }).catch(err => {
        console.warn('Sampled piano failed to load, using synth:', err);
      });

      this.initialized = true;
      console.log('Audio initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  setUsePiano(value) {
    this.usePiano = value;
  }

  playNote(midi, duration = '8n') {
    if (!this.initialized) return;

    try {
      if (this.usePiano && this.pianoReady && this.piano) {
        const noteName = midi.charAt(0).toUpperCase() + midi.slice(1);
        this.piano.start({ note: noteName, velocity: 80 });
      } else if (this.synth) {
        this.synth.triggerAttackRelease(midi, duration);
      }
    } catch (error) {
      console.error('Error playing note:', midi, error);
    }
  }

  playHit() {
    if (!this.initialized || !this.synth) return;

    try {
      this.synth.triggerAttackRelease('C5', '32n');
    } catch (error) {
      console.error('Error playing hit sound:', error);
    }
  }

  playMiss() {
    if (!this.initialized || !this.synth) return;

    try {
      this.synth.triggerAttackRelease('C2', '16n');
    } catch (error) {
      console.error('Error playing miss sound:', error);
    }
  }

  playWin() {
    if (!this.initialized || !this.synth) return;

    try {
      const now = Tone.now();
      ['C4', 'E4', 'G4', 'C5'].forEach((note, i) => {
        this.synth.triggerAttackRelease(note, '8n', now + i * 0.1);
      });
    } catch (error) {
      console.error('Error playing win sound:', error);
    }
  }

  playGameOver() {
    if (!this.initialized || !this.synth) return;

    try {
      const now = Tone.now();
      ['C4', 'B3', 'A3', 'G3'].forEach((note, i) => {
        this.synth.triggerAttackRelease(note, '8n', now + i * 0.15);
      });
    } catch (error) {
      console.error('Error playing game over sound:', error);
    }
  }

  dispose() {
    if (this.synth) {
      this.synth.dispose();
      this.synth = null;
    }
    if (this.piano) {
      this.piano.stop();
      this.piano = null;
      this.pianoReady = false;
    }
    this.initialized = false;
  }
}
