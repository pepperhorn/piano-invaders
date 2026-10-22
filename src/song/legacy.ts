import type { Difficulty, GameSong } from './types';
import { SongError } from './errors';
import { addInnerVoice, buildTargets, type RawNote } from './extract';
import { noteNameToMidi } from './pitch';

type Slot = string | null;
export interface LegacySong { name: string; bpm: number; melody: (Slot | Slot[])[]; difficulty?: string }

export function isLegacySong(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const o = obj as Record<string, unknown>;
  return typeof o.name === 'string' && typeof o.bpm === 'number' && Array.isArray(o.melody) && !('layers' in o);
}

function parseNote(s: string): number {
  const m = /^([A-Ga-g][#b]?)(-?\d+)$/.exec(s.trim());
  if (!m) throw new SongError('score-parse', `Invalid legacy note "${s}".`);
  return noteNameToMidi(m[1], Number(m[2]));
}

export function legacyToGameSong(song: LegacySong): GameSong {
  if (!isLegacySong(song)) throw new SongError('score-parse', 'Not a legacy song (expected name, bpm, melody).');
  const raw: RawNote[] = [];
  const push = (n: Slot, beat: number, dur: number) => {
    if (typeof n === 'string') raw.push({ beat, midi: parseNote(n), durBeats: dur, velocity: 96, voice: 'melody', melody: true });
  };
  song.melody.forEach((slot, i) => {
    if (Array.isArray(slot)) slot.forEach((n, k) => push(n, i + k / slot.length, 1 / slot.length));
    else push(slot, i, 1);
  });
  const { targets, accompaniment } = buildTargets(raw);
  if (targets.length === 0) throw new SongError('score-parse', 'The legacy song has no notes.');
  const d = song.difficulty;
  const difficulty: Difficulty = d === 'easy' || d === 'intermediate' || d === 'advanced' ? d : 'easy';
  return {
    id: song.name, title: song.name, bpm: Math.round(song.bpm), beatsPerBar: 4, difficulty, targets, accompaniment,
    voices: addInnerVoice({ melody: { instrument: 'Splendid Grand Piano', volume: 0.7 } }, { instrument: 'Splendid Grand Piano', volume: 0.7 }),
    lengthBeats: Math.max(1, Math.ceil(song.melody.length / 4 - 1e-9)) * 4,
    source: 'legacy',
  };
}
