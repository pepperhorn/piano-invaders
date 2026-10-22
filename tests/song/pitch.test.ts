import { describe, it, expect } from 'vitest';
import { noteNameToMidi, midiToName, foldIntoRange, bestTransposition, difficultyFromCrf } from '../../src/song/pitch';

describe('pitch', () => {
  it('noteNameToMidi', () => {
    expect(noteNameToMidi('C', 4)).toBe(60);
    expect(noteNameToMidi('C#/Db', 4)).toBe(61);
    expect(noteNameToMidi('C#', 4)).toBe(61);
    expect(noteNameToMidi('Db', 4)).toBe(61);
    expect(noteNameToMidi('E', 4)).toBe(64);
    expect(noteNameToMidi('B', 2)).toBe(47);
  });
  it('midiToName', () => {
    expect(midiToName(66)).toBe('F#');
    expect(midiToName(61, true)).toBe('Db');
  });
  it('foldIntoRange', () => {
    expect(foldIntoRange(72)).toBe(60);
    expect(foldIntoRange(40)).toBe(52);
    expect(foldIntoRange(55)).toBe(55);
  });
  it('bestTransposition', () => {
    expect(bestTransposition([72, 74, 76, 77, 79])).toBe(-24);
    expect(bestTransposition([50, 52])).toBe(0);
  });
  it('difficultyFromCrf', () => {
    expect(difficultyFromCrf(1)).toBe('easy');
    expect(difficultyFromCrf(2)).toBe('easy');
    expect(difficultyFromCrf(3)).toBe('intermediate');
    expect(difficultyFromCrf(4)).toBe('advanced');
    expect(difficultyFromCrf(5)).toBe('advanced');
    expect(difficultyFromCrf(2.4)).toBe('easy');
    expect(difficultyFromCrf(2.5)).toBe('intermediate');
    expect(difficultyFromCrf(3.4)).toBe('intermediate');
    expect(difficultyFromCrf(3.5)).toBe('advanced');
    expect(difficultyFromCrf(null)).toBe('easy');
    expect(difficultyFromCrf(undefined)).toBe('easy');
  });
});
