export interface TimeSource { readonly currentTime: number }

/**
 * Beat clock with no WebAudio inside. Beat 0 of the song sits `leadInBeats`
 * after start(); beatAt() is unwrapped (monotonic), loops are applied in window().
 */
export class Transport {
  private bpm: number;
  private readonly lengthBeats: number;
  private readonly leadInBeats: number;
  private anchorSec = 0;
  private anchorBeat = 0;

  constructor(private readonly time: TimeSource, opts: { bpm: number; lengthBeats: number; leadInBeats?: number }) {
    this.bpm = opts.bpm;
    this.lengthBeats = opts.lengthBeats;
    this.leadInBeats = opts.leadInBeats ?? 0;
    this.anchorBeat = -this.leadInBeats;
    this.anchorSec = time.currentTime;
  }

  /** The beat at atSec is -leadInBeats, so beat 0 lands leadInBeats later. */
  start(atSec: number = this.time.currentTime): void {
    this.anchorSec = atSec;
    this.anchorBeat = -this.leadInBeats;
  }

  beatAt(sec: number): number {
    return this.anchorBeat + ((sec - this.anchorSec) * this.bpm) / 60;
  }

  secAt(beat: number): number {
    return this.anchorSec + ((beat - this.anchorBeat) * 60) / this.bpm;
  }

  getBpm(): number { return this.bpm; }

  /** Re-anchors at "now" so beatAt(now) is unchanged; only the rate changes. */
  setBpm(bpm: number): void {
    const now = this.time.currentTime;
    this.anchorBeat = this.beatAt(now);
    this.anchorSec = now;
    this.bpm = bpm;
  }

  /** Events with absBeat in [fromBeat, toBeat) for the looped song, ordered by absBeat. */
  window<T extends { beat: number }>(
    events: T[], fromBeat: number, toBeat: number,
  ): Array<{ ev: T; absBeat: number; loop: number }> {
    const out: Array<{ ev: T; absBeat: number; loop: number }> = [];
    const len = this.lengthBeats;
    if (!(len > 0) || toBeat <= fromBeat) return out;
    const first = Math.max(0, Math.floor(fromBeat / len));
    const last = Math.floor(toBeat / len);
    for (let loop = first; loop <= last; loop++) {
      for (const ev of events) {
        const absBeat = loop * len + ev.beat;
        if (absBeat >= fromBeat && absBeat < toBeat) out.push({ ev, absBeat, loop });
      }
    }
    return out.sort((a, b) => a.absBeat - b.absBeat);
  }
}
