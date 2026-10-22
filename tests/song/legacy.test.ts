import { describe, it, expect } from 'vitest';
import { isLegacySong, legacyToGameSong } from '../../src/song/legacy';

describe('legacy converter', () => {
  it('sub-array beat splits into two targets at beat+0 and beat+0.5; null is a rest', () => {
    const s = legacyToGameSong({ name: 'T', bpm: 80, melody: ['C3', null, ['E3', 'G3'], 'D3', 'C3'], difficulty: 'advanced' });
    expect(s.targets.map((t) => t.beat)).toEqual([0, 2, 2.5, 3, 4]);
    expect(s.targets[0].durBeats).toBe(1);
    expect(s.targets[1].durBeats).toBe(0.5);
    expect(s.source).toBe('legacy');
    expect(s.difficulty).toBe('advanced');
    expect(s.beatsPerBar).toBe(4);
    expect(s.lengthBeats).toBe(8);
  });
  it('defaults to easy; detection', () => {
    expect(legacyToGameSong({ name: 'T', bpm: 80, melody: ['C#3'] }).difficulty).toBe('easy');
    expect(isLegacySong({ name: 'x', bpm: 1, melody: [] })).toBe(true);
    expect(isLegacySong({ name: 'x', bpm: 1, melody: [], layers: [] })).toBe(false);
    expect(isLegacySong({})).toBe(false);
  });
});
