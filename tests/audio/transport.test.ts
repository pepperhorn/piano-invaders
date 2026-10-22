import { describe, it, expect } from 'vitest';
import { Transport } from '../../src/audio/Transport';

const mk = (opts: { bpm: number; lengthBeats: number; leadInBeats?: number }, t = { currentTime: 0 }) =>
  ({ t, tr: new Transport(t, opts) });

describe('Transport', () => {
  it('beatAt/secAt inverse at 120 bpm', () => {
    const { tr } = mk({ bpm: 120, lengthBeats: 8 });
    tr.start(10);
    expect(tr.beatAt(10)).toBeCloseTo(0);
    expect(tr.beatAt(11)).toBeCloseTo(2);
    expect(tr.secAt(4)).toBeCloseTo(12);
    for (const b of [0, 1.5, 7, 20]) expect(tr.beatAt(tr.secAt(b))).toBeCloseTo(b);
  });

  it('setBpm mid-song keeps current beat and changes rate', () => {
    const { t, tr } = mk({ bpm: 120, lengthBeats: 8 });
    tr.start(0);
    t.currentTime = 2; // beat 4
    const before = tr.beatAt(2);
    tr.setBpm(60);
    expect(tr.beatAt(2)).toBeCloseTo(before);
    expect(tr.beatAt(3)).toBeCloseTo(5); // 1 beat per second now
    expect(tr.secAt(6)).toBeCloseTo(4);
  });

  it('window over a loop boundary yields events from both loops with correct absBeat', () => {
    const { tr } = mk({ bpm: 120, lengthBeats: 4 });
    const evs = [{ beat: 0 }, { beat: 1 }, { beat: 3 }];
    const w = tr.window(evs, 3, 5.5);
    expect(w.map((x) => [x.loop, x.absBeat])).toEqual([[0, 3], [1, 4], [1, 5]]);
  });

  it('consecutive windows [a,b) [b,c) never duplicate or skip an event', () => {
    const { t, tr } = mk({ bpm: 100, lengthBeats: 4 });
    tr.start(0);
    const evs = [{ beat: 0 }, { beat: 0.5 }, { beat: 1 }, { beat: 2.25 }, { beat: 3.5 }];
    let from = tr.beatAt(0);
    const seen: number[] = [];
    // 25ms ticks, 0.15s lookahead, with a BPM change midway
    for (let i = 0; i < 400; i++) {
      t.currentTime = i * 0.025;
      if (i === 150) tr.setBpm(173);
      if (i === 300) tr.setBpm(70);
      const to = tr.beatAt(t.currentTime + 0.15);
      for (const w of tr.window(evs, from, to)) seen.push(w.absBeat);
      from = to;
    }
    const expected: number[] = [];
    for (let loop = 0; loop * 4 < from; loop++) for (const e of evs) if (loop * 4 + e.beat < from) expected.push(loop * 4 + e.beat);
    expect(seen).toEqual(expected);
    // accompaniment stays on the same beat grid: absBeats are exact loop*len+beat
    for (const b of seen) expect(evs.some((e) => (b - e.beat) % 4 === 0)).toBe(true);
  });

  it('lead-in: beat 0 lands at start + leadInBeats x 60/bpm', () => {
    const { tr } = mk({ bpm: 90, lengthBeats: 8, leadInBeats: 4 });
    tr.start(5);
    expect(tr.secAt(0)).toBeCloseTo(5 + 4 * (60 / 90));
    expect(tr.beatAt(5)).toBeCloseTo(-4);
    expect(tr.window([{ beat: 0 }], -4, 0)).toEqual([]);
  });
});
