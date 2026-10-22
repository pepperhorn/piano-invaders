/**
 * Piano Invaders plugin registry. Merges contributions from an array of plugin
 * objects (songs, theme, leaderboard backend, song parsers, event listeners).
 * The game works identically with zero plugins. Plugin failures are logged, never thrown.
 */
import type { LeaderboardAdapter } from '../utils/leaderboard'

export interface PluginTheme { cssVars?: Record<string, string>; backgroundImage?: string; className?: string }

export interface PianoInvadersPlugin {
  name?: string
  init?(): void | Promise<void>
  songs?(): unknown[] | Promise<unknown[]>
  leaderboard?: LeaderboardAdapter
  theme?(): PluginTheme
  parseSong?(data: unknown): unknown
  onGameStart?(e: { song: string; bpm: number; difficulty: string }): void
  onGameEnd?(e: Record<string, unknown>): void
  onNoteHit?(e: { midi: number; x: number; y: number }): void
  onNoteMiss?(e: { midi: number; x: number; y: number }): void
  dispose?(): void
}

type EventName = 'onGameStart' | 'onGameEnd' | 'onNoteHit' | 'onNoteMiss'

export interface PluginRegistry {
  init(): Promise<void>
  getSongs(): Promise<unknown[]>
  getLeaderboard(): LeaderboardAdapter | null
  getTheme(): { cssVars: Record<string, string>; backgroundImage?: string; className: string }
  parseSong(data: unknown): unknown
  emit(name: EventName, data: unknown): void
  dispose(): void
}

const warn = (p: PianoInvadersPlugin, what: string, e: unknown) =>
  console.warn(`[piano-invaders] plugin ${p.name ?? '(unnamed)'} ${what} error:`, e)

/** Map a theme key to a scoped custom property: 'accent' / '--accent' / '--pi-accent' → '--pi-accent'. */
export function themeVarName(key: string): string {
  const bare = key.replace(/^--/, '').replace(/^pi-/, '')
  return `--pi-${bare}`
}

export function createPluginRegistry(plugins: readonly PianoInvadersPlugin[] = []): PluginRegistry {
  const list = [...plugins]
  let disposed = false
  return {
    async init() {
      disposed = false
      for (const p of list) {
        if (!p.init) continue
        try { await p.init() } catch (e) { warn(p, 'init', e) }
      }
    },
    async getSongs() {
      const all: unknown[] = []
      for (const p of list) {
        if (!p.songs) continue
        try { all.push(...(await p.songs())) } catch (e) { warn(p, 'songs', e) }
      }
      return all
    },
    getLeaderboard() {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].leaderboard) return list[i].leaderboard!
      return null
    },
    getTheme() {
      const merged: { cssVars: Record<string, string>; backgroundImage?: string; className: string } = { cssVars: {}, className: '' }
      for (const p of list) {
        if (!p.theme) continue
        try {
          const t = p.theme()
          for (const [k, v] of Object.entries(t.cssVars ?? {})) merged.cssVars[themeVarName(k)] = v
          if (t.backgroundImage) merged.backgroundImage = t.backgroundImage
          if (t.className) merged.className = `${merged.className} ${t.className}`.trim()
        } catch (e) { warn(p, 'theme', e) }
      }
      return merged
    },
    parseSong(data) {
      for (const p of list) {
        if (!p.parseSong) continue
        try {
          const r = p.parseSong(data)
          if (r) return r
        } catch (e) { warn(p, 'parseSong', e) }
      }
      return null
    },
    emit(name, data) {
      for (const p of list) {
        const fn = p[name] as ((d: unknown) => void) | undefined
        if (!fn) continue
        try { fn.call(p, data) } catch (e) { warn(p, name, e) }
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const p of list) {
        if (!p.dispose) continue
        try { p.dispose() } catch (e) { warn(p, 'dispose', e) }
      }
    },
  }
}
