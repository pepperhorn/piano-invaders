// Placeholder: Task 5 replaces this with the real Dottl -> GameSong converter.
import type { Difficulty, GameSong } from './types';
import { SongError } from './errors';

export function dottlToGameSong(_dottl: object | string, _opts?: { title?: string; difficulty?: Difficulty | number }): GameSong {
  throw new SongError('score-parse', 'dottl support not yet implemented');
}
