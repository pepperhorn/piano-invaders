import type { Difficulty } from './types';

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Accepts 'C#/Db', 'C#', 'Db', 'E'. Middle C (C4) = 60. */
export function noteNameToMidi(name: string, octave: number): number {
  const first = name.split('/')[0].trim();
  const letter = first.charAt(0).toUpperCase();
  const base = SEMITONE[letter];
  if (base === undefined) throw new Error(`Invalid note name: ${name}`);
  let semis = base;
  for (const ch of first.slice(1)) {
    if (ch === '#') semis += 1;
    else if (ch === 'b') semis -= 1;
  }
  return 12 * (octave + 1) + semis;
}

export function midiToName(midi: number, preferFlats = false): string {
  const pc = ((midi % 12) + 12) % 12;
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[pc];
}

/** Shift by whole octaves into [lo, hi]. */
export function foldIntoRange(midi: number, lo = 47, hi = 64): number {
  let m = midi;
  while (m > hi && m - 12 >= lo) m -= 12;
  while (m < lo && m + 12 <= hi) m += 12;
  return m;
}

/** Whole-octave shift (multiple of 12) maximising pitches in range; ties go to shift closest to 0. */
export function bestTransposition(pitches: number[], lo = 47, hi = 64): number {
  let best = 0;
  let bestCount = -1;
  for (let k = -10; k <= 10; k++) {
    const shift = k * 12;
    const count = pitches.reduce((n, p) => (p + shift >= lo && p + shift <= hi ? n + 1 : n), 0);
    if (count > bestCount || (count === bestCount && Math.abs(shift) < Math.abs(best))) {
      best = shift;
      bestCount = count;
    }
  }
  return best === 0 ? 0 : best;
}

export function difficultyFromCrf(n: number | null | undefined): Difficulty {
  if (n == null || Number.isNaN(n)) return 'easy';
  const r = Math.round(n);
  if (r <= 2) return 'easy';
  if (r === 3) return 'intermediate';
  return 'advanced';
}
