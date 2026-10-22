// Leaderboard adapter. The default stores to localStorage, touched only when load/save
// are called (inside effects/handlers), never at module scope.

export interface LeaderboardEntry {
  name: string; total: number; score: number; bpm: number; hp: number; time: number; song: string
  maxCombo?: number; date?: number
}

export interface LeaderboardAdapter {
  load(): LeaderboardEntry[] | Promise<LeaderboardEntry[]>
  save(entries: LeaderboardEntry[]): void | Promise<void>
}

export const STORAGE_KEY = 'piano-invaders-leaderboard'
export const MAX_ENTRIES = 10

export const DEFAULT_SCORES: readonly LeaderboardEntry[] = [
  { name: 'MOE', total: 5200, score: 320, bpm: 71, hp: 45, time: 180, song: 'Ode to Joy' },
  { name: 'CURLY', total: 4100, score: 280, bpm: 69, hp: 30, time: 150, song: 'Twinkle Twinkle' },
  { name: 'LARRY', total: 3600, score: 250, bpm: 67, hp: 55, time: 120, song: 'Happy Birthday' },
  { name: 'BUZZ', total: 2900, score: 200, bpm: 73, hp: 20, time: 140, song: 'Fur Elise' },
  { name: 'WOODY', total: 2400, score: 180, bpm: 68, hp: 40, time: 110, song: 'Blue Danube' },
  { name: 'DRAKE', total: 1800, score: 150, bpm: 67, hp: 35, time: 90, song: 'Frere Jacques' },
  { name: 'PEACH', total: 1400, score: 120, bpm: 66, hp: 25, time: 80, song: 'Mary Had a Lamb' },
  { name: 'TOAD', total: 900, score: 90, bpm: 65, hp: 15, time: 60, song: 'Ode to Joy' },
  { name: 'YOSHI', total: 500, score: 60, bpm: 65, hp: 10, time: 45, song: 'Twinkle Twinkle' },
  { name: 'GOOMBA', total: 200, score: 30, bpm: 65, hp: 5, time: 30, song: 'Happy Birthday' },
]

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = storage()?.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as LeaderboardEntry[]
  } catch { /* corrupt or unavailable: defaults */ }
  return DEFAULT_SCORES.map(e => ({ ...e }))
}

export function saveLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch { /* quota / privacy mode: ignore */ }
}

export const localStorageLeaderboard: LeaderboardAdapter = { load: loadLeaderboard, save: saveLeaderboard }

/** Insert an entry, keep the top MAX_ENTRIES by total; returns the list and the new entry's rank (-1 if cut). */
export function insertEntry(list: readonly LeaderboardEntry[], entry: LeaderboardEntry): { entries: LeaderboardEntry[]; rank: number } {
  const entries = [...list, entry].sort((a, b) => b.total - a.total).slice(0, MAX_ENTRIES)
  return { entries, rank: entries.indexOf(entry) }
}

/** Small persisted boolean prefs (metronome, count-in, ...). Safe outside the browser. */
export function loadPref(key: string, fallback: boolean): boolean {
  try {
    const v = storage()?.getItem(key)
    return v === null || v === undefined ? fallback : v === 'true'
  } catch {
    return fallback
  }
}

export function savePref(key: string, value: boolean | string): void {
  try { storage()?.setItem(key, String(value)) } catch { /* ignore */ }
}

export function loadPrefString(key: string): string | null {
  try { return storage()?.getItem(key) ?? null } catch { return null }
}
