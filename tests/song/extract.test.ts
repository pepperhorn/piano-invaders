import { describe, it, expect } from 'vitest';
import { buildTargets, type RawNote } from '../../src/song/extract';

const n = (beat: number, midi: number, melody = true, voice = 'v1'): RawNote =>
  ({ beat, midi, durBeats: 1, velocity: 0.8, voice, melody });

describe('buildTargets', () => {
  it('single notes become targets in beat order', () => {
    const r = buildTargets([n(1, 62), n(0, 60), n(2, 64)]);
    expect(r.targets.map((t) => [t.id, t.beat, t.midi])).toEqual([[0, 0, 60], [1, 1, 62], [2, 2, 64]]);
    expect(r.targets.every((t) => t.group === undefined)).toBe(true);
    expect(r.accompaniment).toEqual([]);
    expect(r.transpose).toBe(0);
  });

  it('three-note chord → two grouped targets (high, low) + one inner accompaniment note', () => {
    const r = buildTargets([n(0, 60), n(0, 52), n(0, 55)]);
    expect(r.targets).toHaveLength(2);
    expect(r.targets[0]).toMatchObject({ id: 0, midi: 60 });
    expect(r.targets[1]).toMatchObject({ id: 1, midi: 52 });
    expect(r.targets[0].group).toBeDefined();
    expect(r.targets[0].group).toBe(r.targets[1].group);
    expect(r.accompaniment).toHaveLength(1);
    expect(r.accompaniment[0]).toMatchObject({ beat: 0, midi: 55, voice: 'melody-inner' });
  });

  it('two-hand onset C5+C3 → targets folded into 47–64 and grouped', () => {
    const r = buildTargets([n(0, 72), n(0, 48)]);
    expect(r.targets).toHaveLength(2);
    for (const t of r.targets) {
      expect(t.midi).toBeGreaterThanOrEqual(47);
      expect(t.midi).toBeLessThanOrEqual(64);
    }
    expect(r.targets[0].group).toBe(r.targets[1].group);
    expect(r.targets[0].group).toBeDefined();
  });

  it('fold collision keeps the higher only', () => {
    // C4/D4/E4 keep transpose 0; C1 (24) and C2 (36) both fold to 48.
    const r = buildTargets([n(0, 60), n(1, 62), n(2, 64), n(3, 36), n(3, 24)]);
    expect(r.transpose).toBe(0);
    const at3 = r.targets.filter((t) => t.beat === 3);
    expect(at3).toHaveLength(1);
    expect(at3[0].midi).toBe(48);
    expect(at3[0].group).toBeUndefined();
  });

  it('non-melody notes pass through as accompaniment with their voice', () => {
    const r = buildTargets([n(0, 60), n(0, 40, false, 'bass'), n(1, 43, false, 'bass')]);
    expect(r.targets).toHaveLength(1);
    expect(r.accompaniment.map((a) => [a.beat, a.midi, a.voice])).toEqual([[0, 40, 'bass'], [1, 43, 'bass']]);
  });

  it('empty melody → targets []', () => {
    const r = buildTargets([n(0, 40, false, 'bass')]);
    expect(r.targets).toEqual([]);
    expect(r.accompaniment).toHaveLength(1);
  });
});
