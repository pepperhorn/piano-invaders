import * as Tone from 'tone';

export class AudioManager {
  constructor() {
    this.synth = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    try {
      await Tone.start();

      this.synth = new Tone.PolySynth(Tone.Synth, {
        envelope: {
          attack: 0.02,
          decay: 0.1,
          sustain: 0.3,
          release: 1
        },
        volume: -10
      }).toDestination();

      this.initialized = true;
      console.log('Audio initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  playNote(midi, duration = '8n') {
    if (!this.initialized || !this.synth) return;

    try {
      this.synth.triggerAttackRelease(midi, duration);
    } catch (error) {
      console.error('Error playing note:', midi, error);
    }
  }

  playHit() {
    if (!this.initialized || !this.synth) return;

    try {
      // Higher pitched success sound
      this.synth.triggerAttackRelease('C5', '32n');
    } catch (error) {
      console.error('Error playing hit sound:', error);
    }
  }

  playMiss() {
    if (!this.initialized || !this.synth) return;

    try {
      // Lower pitched miss sound
      this.synth.triggerAttackRelease('C2', '16n');
    } catch (error) {
      console.error('Error playing miss sound:', error);
    }
  }

  playWin() {
    if (!this.initialized || !this.synth) return;

    try {
      // Ascending victory fanfare
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
      // Descending sad trombone
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
    this.initialized = false;
  }
}
