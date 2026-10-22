import { dottlToGameSong, isDottl } from './dottl'
import { isLegacySong, legacyToGameSong, type LegacySong } from './legacy'
import type { GameSong } from './types'

export function isGameSong(x: unknown): x is GameSong {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return typeof o.title === 'string' && typeof o.bpm === 'number' && Array.isArray(o.targets) && Array.isArray(o.accompaniment)
}

/** GameSong, dottl (object or JSON text) or legacy {name,bpm,melody} → GameSong. Throws SongError on bad input. */
export function toGameSong(x: unknown): GameSong | null {
  if (isGameSong(x)) return x
  if (typeof x === 'string') return dottlToGameSong(x)
  if (isDottl(x)) return dottlToGameSong(x as object)
  if (isLegacySong(x)) return legacyToGameSong(x as LegacySong)
  return null
}
