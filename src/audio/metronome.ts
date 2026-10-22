import highMp3 from './high.mp3';
import lowMp3 from './low.mp3';
import { synthTone } from './sfx';

async function decode(ctx: BaseAudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Click player on the shared context: sampled high/low ticks, synth click if they can't load. */
export class Metronome {
  private high: AudioBuffer | null = null;
  private low: AudioBuffer | null = null;

  constructor(private readonly ctx: BaseAudioContext, private readonly dest: AudioNode) {}

  async load(): Promise<void> {
    [this.high, this.low] = await Promise.all([decode(this.ctx, highMp3), decode(this.ctx, lowMp3)]);
  }

  tick(whenSec: number, accent: boolean, volume: number): void {
    const buffer = accent ? this.high : this.low;
    if (!buffer) {
      synthTone(this.ctx, this.dest, { freq: accent ? 1500 : 1000, when: whenSec, dur: 0.04, gain: 0.3 * volume, type: 'square' });
      return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, whenSec);
    src.connect(g);
    g.connect(this.dest);
    src.start(whenSec);
  }
}
