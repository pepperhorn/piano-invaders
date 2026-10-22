import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AudioEngine } from '../audio/AudioEngine'
import { getAudioContext, resumeAudio } from '../audio/context'
import { PIANO_KEYS, QWERTY_MAP, WHITE_KEYS } from '../constants/gameConfig'
import { useGame, type GameEnd, type GameSettings, type GameStats, type HudState, type NoteEvent } from '../game/useGame'
import { useContainerSize } from '../hooks/useContainerSize'
import { useScopedKeys } from '../hooks/useScopedKeys'
import { createPluginRegistry, type PianoInvadersPlugin } from '../plugins/PluginRegistry'
import { SongError } from '../song/errors'
import { loadSong } from '../song/load'
import { toGameSong } from '../song/normalize'
import { loadOpenSong, loadOpenSongsIndex, type OpenSongEntry } from '../song/opensongs'
import type { Difficulty, GameSong, ScoreSource } from '../song/types'
import { legacyToGameSong } from '../song/legacy'
import {
  loadPref, loadPrefString, localStorageLeaderboard, savePref,
  type LeaderboardAdapter, type LeaderboardEntry,
} from '../utils/leaderboard'
import GameOver from './GameOver'
import Hud from './Hud'
import Keyboard from './Keyboard'
import RulesPopup from './RulesPopup'
import StartScreen, { type DifficultyFilter, type ImportStatus, type LibraryStatus, type RollerItem, type ToggleKey } from './StartScreen'
import logoImg from '../assets/PianoInvaders-Logo-Trans.webp'
import '../styles/piano-invaders.css'

export type ErrorCode = 'score-load' | 'score-parse' | 'audio'
export interface PianoInvadersError { code: ErrorCode; message: string; cause?: unknown }

export type { GameStats }

export interface PianoInvadersProps {
  musicXml?: string; scoreUrl?: string; file?: File | Blob; midi?: ArrayBuffer; dottl?: object | string
  /** song-picker mode; dottl / legacy objects are converted */
  songs?: Array<GameSong | object>
  title?: string; difficulty?: Difficulty | number; bpm?: number
  /** default: true when no single-song source is given */
  showSongPicker?: boolean
  /** default true in picker mode; accepts .musicxml/.xml/.mxl/.mid/.dottl */
  allowImport?: boolean
  /** OpenSongs library in the picker roller. Default true in picker mode; ignored in single-song mode. */
  opensongs?: boolean | { baseUrl?: string }
  leaderboard?: LeaderboardAdapter
  plugins?: PianoInvadersPlugin[]
  onGameEnd?(stats: GameStats): void
  onError?(e: PianoInvadersError): void
  className?: string
}

type Screen = 'start' | 'playing' | 'over'
type Voice = 'piano' | 'synth'

const PREF = {
  metronome: 'piano-invaders-metronome',
  countIn: 'piano-invaders-countin',
  accomp: 'piano-invaders-accomp',
  voice: 'piano-invaders-voice',
} as const

const DEFAULT_SONG = {
  name: 'Ode to Joy', bpm: 65,
  melody: ['E3', 'E3', 'F3', 'G3', 'G3', 'F3', 'E3', 'D3', 'C3', 'C3', 'D3', 'E3', 'E3', 'D3', 'D3', null],
}

const AUDIO_LOAD_TIMEOUT_MS = 8000
const SONG_LOAD_TIMEOUT_MS = 15000
const AUDIO_RESUME_TIMEOUT_MS = 2000
const BPM_MIN = 30
const BPM_MAX = 240

function singleSource(p: PianoInvadersProps): ScoreSource | null {
  if (p.musicXml !== undefined) return { musicXml: p.musicXml }
  if (p.scoreUrl !== undefined) return { scoreUrl: p.scoreUrl }
  if (p.file !== undefined) return { file: p.file }
  if (p.midi !== undefined) return { midi: p.midi }
  if (p.dottl !== undefined) return { dottl: p.dottl }
  return null
}

function layoutFor(w: number, h: number) {
  const isMobile = w > 0 && w <= 1024
  const isLandscapeMobile = isMobile && w > h
  const isNarrow = w > 0 && w < 520
  // portrait mobile keeps the full 160 px keyboard; landscape phones get 120; short embeds give the stage room
  const keyboardHeight = Math.min(isLandscapeMobile ? 120 : 160, Math.max(70, Math.round((h || 640) * 0.25)))
  return { isMobile, isLandscapeMobile, isNarrow, keyboardHeight }
}

/** Even spacing fallback until the DOM keys have been measured. */
function fallbackKeyX(midi: number, width: number): number {
  const k = PIANO_KEYS.find(p => p.midi === midi)
  const ww = width / WHITE_KEYS.length
  if (!k) return width / 2
  const whitesLeft = WHITE_KEYS.filter(w => w.midi < midi).length
  return k.type === 'white' ? (whitesLeft + 0.5) * ww : whitesLeft * ww
}

/** Resolve with `p`, or reject with a score-load SongError after `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SongError('score-load', `Timed out loading ${what}.`)), ms)
  })
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer))
}

/** Cheap, identity-independent signature of a value (FNV-1a over bytes / JSON text). */
function hashBytes(bytes: Uint8Array): string {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) }
  return `${bytes.length}:${(h >>> 0).toString(36)}`
}
function sourceSignature(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return `s:${v.length}:${hashBytes(new TextEncoder().encode(v))}`
  if (v instanceof ArrayBuffer) return `b:${hashBytes(new Uint8Array(v))}`
  if (typeof Blob !== 'undefined' && v instanceof Blob) {
    const f = v as Blob & { name?: string; lastModified?: number }
    return `f:${f.name ?? ''}:${f.size}:${f.type}:${f.lastModified ?? ''}`
  }
  try { return `j:${hashBytes(new TextEncoder().encode(JSON.stringify(v)))}` } catch { return `x:${String(v)}` }
}
/** Songs-prop signature: length plus each entry's id / title / name. */
function songsSignature(list: ReadonlyArray<unknown> | undefined): string {
  if (!list) return ''
  return `${list.length}|` + list.map(x => {
    if (typeof x === 'string') return `s${x.length}`
    const o = (x ?? {}) as Record<string, unknown>
    const label = [o.id, o.title, o.name, o.projectName].find(v => typeof v === 'string' || typeof v === 'number')
    const size = Array.isArray(o.targets) ? o.targets.length : Array.isArray(o.melody) ? o.melody.length : Array.isArray(o.layers) ? o.layers.length : ''
    return `${String(label ?? '?')}#${size}`
  }).join('\u0001')
}

function codeOf(e: unknown, fallback: ErrorCode): ErrorCode {
  return e instanceof SongError ? e.code : fallback
}
const msgOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

export default function PianoInvaders(props: PianoInvadersProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rootSize = useContainerSize(rootRef)
  const stageSize = useContainerSize(stageRef)
  const layout = layoutFor(rootSize.width, rootSize.height)

  const propsRef = useRef(props)
  useEffect(() => { propsRef.current = props })

  // ---------------------------------------------------------------- errors (logged once, never thrown)
  const reported = useRef(new Set<string>())
  const report = useCallback((code: ErrorCode, message: string, cause?: unknown) => {
    const key = `${code}:${message}`
    if (reported.current.has(key)) return
    reported.current.add(key)
    if (code !== 'audio') console.warn(`[piano-invaders] ${code}: ${message}`) // AudioEngine logs its own
    try { propsRef.current.onError?.({ code, message, cause }) } catch { /* host handler threw: ignore */ }
  }, [])

  // ---------------------------------------------------------------- plugins
  const [registry] = useState(() => createPluginRegistry(props.plugins ?? []))
  const theme = useMemo(() => registry.getTheme(), [registry])
  const [pluginsReady, setPluginsReady] = useState(false)
  useEffect(() => {
    let live = true
    registry.init().then(() => { if (live) setPluginsReady(true) })
    return () => { live = false; registry.dispose() }
  }, [registry])

  // ---------------------------------------------------------------- songs
  const src = singleSource(props)
  const srcKey = src ? Object.keys(src)[0] : null
  const srcVal = src ? (Object.values(src)[0] as unknown) : null
  // reload only when the content changes, not when the host re-renders with a new-but-equal object
  const srcSig = useMemo(() => sourceSignature(srcVal), [srcVal])
  const songsSig = useMemo(() => songsSignature(props.songs), [props.songs])
  const mode: 'picker' | 'single' = src || props.showSongPicker === false ? 'single' : 'picker'
  const allowImport = mode === 'picker' && props.allowImport !== false

  const [baseSongs, setBaseSongs] = useState<GameSong[]>([])
  const [imported, setImported] = useState<GameSong[]>([]) // user imports survive a reload of baseSongs
  const songs = useMemo(() => [...baseSongs, ...imported], [baseSongs, imported])
  const [songsLoaded, setSongsLoaded] = useState(false)
  const [index, setIndex] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const p = propsRef.current
    const run = async () => {
      const single = singleSource(p)
      if (single) {
        try {
          const song = await loadSong(single, { title: p.title, difficulty: p.difficulty })
          if (!live) return
          setBaseSongs([song]); setIndex(0); setLoadError(null); setSongsLoaded(true)
        } catch (e) {
          if (!live) return
          report(codeOf(e, 'score-load'), msgOf(e), e)
          setBaseSongs([]); setLoadError(msgOf(e)); setSongsLoaded(true)
        }
        return
      }
      const out: GameSong[] = []
      const add = (x: unknown) => {
        try {
          const s = toGameSong(registry.parseSong(x) ?? x)
          if (s && s.targets.length > 0) out.push(s)
        } catch (e) {
          report(codeOf(e, 'score-parse'), msgOf(e), e)
        }
      }
      for (const s of p.songs ?? []) add(s)
      for (const s of await registry.getSongs()) add(s)
      if (!live) return
      if (out.length === 0) out.push(legacyToGameSong(DEFAULT_SONG))
      setBaseSongs(out); setIndex(0); setLoadError(null); setSongsLoaded(true)
    }
    void run()
    return () => { live = false }
  }, [srcKey, srcSig, songsSig, props.title, props.difficulty, registry, report])

  // ---------------------------------------------------------------- OpenSongs library (own effect: runs once per baseUrl)
  const osEnabled = mode === 'picker' && props.opensongs !== false
  const osBaseUrl = typeof props.opensongs === 'object' ? props.opensongs.baseUrl : undefined
  const osKey = osBaseUrl ?? ''
  const [osResult, setOsResult] = useState<{ key: string; entries: OpenSongEntry[]; failed: boolean } | null>(null)
  useEffect(() => {
    if (!osEnabled) return
    let live = true
    loadOpenSongsIndex({ baseUrl: osBaseUrl }).then(
      list => { if (live) setOsResult({ key: osKey, entries: list, failed: false }) },
      e => { if (live) { report(codeOf(e, 'score-load'), msgOf(e), e); setOsResult({ key: osKey, entries: [], failed: true }) } },
    )
    return () => { live = false }
  }, [osEnabled, osBaseUrl, osKey, report])
  const osCurrent = osEnabled && osResult?.key === osKey ? osResult : null
  const entries = useMemo(() => osCurrent?.entries ?? [], [osCurrent])
  const library: LibraryStatus = !osEnabled ? 'off' : !osCurrent ? 'loading' : osCurrent.failed ? 'error' : 'ready'
  const osCache = useRef(new Map<string, Promise<GameSong>>())
  useEffect(() => { osCache.current.clear() }, [osBaseUrl])
  // fetched OpenSongs songs, keyed by library + entry id, so the selection reflects them once loaded
  const [osLoaded, setOsLoaded] = useState<ReadonlyMap<string, GameSong>>(() => new Map())
  const osSong = useCallback((e: OpenSongEntry | undefined) => (e ? osLoaded.get(`${osKey}\u0001${e.id}`) : undefined), [osLoaded, osKey])

  // roller = bundled/imported songs, then OpenSongs entries; `index` addresses this combined list
  const [filter, setFilter] = useState<DifficultyFilter>('all')
  const [playingTitle, setPlayingTitle] = useState('')
  const [pickError, setPickError] = useState<string | null>(null)
  const all = useMemo(() => [
    ...songs.map((s, i): RollerItem & { all: number } => ({ all: i, key: `s${i}-${s.id}`, title: s.title, difficulty: s.difficulty, hasAccomp: s.accompaniment.length > 0 })),
    ...entries.map((e, i): RollerItem & { all: number } => ({ all: songs.length + i, key: `o-${e.id}`, title: e.title, difficulty: e.difficulty, hasAccomp: (osSong(e)?.accompaniment.length ?? 0) > 0 })),
  ], [songs, entries, osSong])
  const visible = useMemo(() => (filter === 'all' ? all : all.filter(r => r.difficulty === filter)), [all, filter])
  const visIndex = Math.max(0, visible.findIndex(r => r.all === index))
  const selected = visible[visIndex]
  const selAll = selected ? selected.all : -1
  const onRollerIndex = useCallback((vi: number) => {
    const r = visible[vi]
    if (r) { setIndex(r.all); setPickError(null) }
  }, [visible])
  const onFilter = useCallback((f: DifficultyFilter) => {
    setFilter(f)
    setPickError(null)
    const first = (f === 'all' ? all : all.filter(r => r.difficulty === f))
    if (!first.some(r => r.all === index) && first[0]) setIndex(first[0].all)
  }, [all, index])

  // one source of truth: the song behind the visible roller selection (what START plays)
  const song: GameSong | undefined = selAll < 0 ? undefined : selAll < songs.length ? songs[selAll] : osSong(entries[selAll - songs.length])
  // null = not known yet (e.g. an OpenSongs entry that has not been fetched): shown as '—', never 0
  const baseBpm: number | null = song ? (mode === 'single' && props.bpm ? props.bpm : song.bpm) : null

  // ---------------------------------------------------------------- leaderboard
  const adapter: LeaderboardAdapter = props.leaderboard ?? registry.getLeaderboard() ?? localStorageLeaderboard
  const adapterRef = useRef(adapter)
  useEffect(() => { adapterRef.current = adapter })
  const loadBoard = useCallback(async (): Promise<LeaderboardEntry[]> => {
    try { return [...(await adapterRef.current.load())] } catch (e) {
      console.warn('[piano-invaders] leaderboard load failed:', e)
      return []
    }
  }, [])
  const saveBoard = useCallback(async (entries: LeaderboardEntry[]) => {
    try { await adapterRef.current.save(entries) } catch (e) { console.warn('[piano-invaders] leaderboard save failed:', e) }
  }, [])
  const [board, setBoard] = useState<LeaderboardEntry[]>([])
  const [screen, setScreen] = useState<Screen>('start')
  useEffect(() => {
    if (screen !== 'start') return
    let live = true
    loadBoard().then(b => { if (live) setBoard(b) })
    return () => { live = false }
  }, [screen, loadBoard])
  const hi = board.reduce((m, e) => Math.max(m, e.score ?? 0), 0)

  // ---------------------------------------------------------------- prefs (storage read after mount only)
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({ metronome: true, countIn: true, accomp: true })
  const [voice, setVoice] = useState<Voice>('piano')
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setToggles({ metronome: loadPref(PREF.metronome, true), countIn: loadPref(PREF.countIn, true), accomp: loadPref(PREF.accomp, true) })
      setVoice(loadPrefString(PREF.voice) === 'synth' ? 'synth' : 'piano')
      try { setReducedMotion(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) } catch { /* no matchMedia */ }
    })
    return () => cancelAnimationFrame(id)
  }, [])
  const settingsRef = useRef<GameSettings>({ metronome: true, countIn: true, accomp: true, reducedMotion: false, scanlines: true })
  useEffect(() => {
    settingsRef.current = { ...toggles, reducedMotion, scanlines: true }
  }, [toggles, reducedMotion])
  const getSettings = useCallback(() => settingsRef.current, [])

  const onToggle = useCallback((k: ToggleKey) => {
    setToggles(t => {
      const next = { ...t, [k]: !t[k] }
      savePref(PREF[k], next[k])
      return next
    })
  }, [])

  // ---------------------------------------------------------------- audio
  const engineRef = useRef<AudioEngine | null>(null)
  const engine = useCallback((): AudioEngine => {
    if (!engineRef.current) {
      const e = new AudioEngine()
      e.onError = err => report('audio', err.message, err.cause)
      engineRef.current = e
    }
    return engineRef.current
  }, [report])
  useEffect(() => () => { engineRef.current?.dispose(); engineRef.current = null }, [])

  const chooseVoice = useCallback((v: Voice) => {
    setVoice(v)
    savePref(PREF.voice, v)
    engineRef.current?.setPlayerVoice(v)
  }, [])

  // ---------------------------------------------------------------- key geometry (relative to the canvas)
  const keyEls = useRef(new Map<number, HTMLElement>())
  const keyXs = useRef(new Map<number, number>())
  const stageW = useRef(0)
  const keyRef = useCallback((midi: number, el: HTMLElement | null) => {
    if (el) keyEls.current.set(midi, el)
    else keyEls.current.delete(midi)
  }, [])
  const measure = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const cr = c.getBoundingClientRect()
    const xs = new Map<number, number>()
    for (const [midi, el] of keyEls.current) {
      const r = el.getBoundingClientRect()
      if (r.width > 0) xs.set(midi, r.left - cr.left + r.width / 2)
    }
    keyXs.current = xs
  }, [])
  useEffect(() => {
    stageW.current = stageSize.width
    measure()
    const id = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(id)
  }, [stageSize.width, stageSize.height, rootSize.width, rootSize.height, layout.keyboardHeight, screen, measure])
  const keyX = useCallback((midi: number) => keyXs.current.get(midi) ?? fallbackKeyX(midi, stageW.current), [])

  // ---------------------------------------------------------------- game
  const [hud, setHud] = useState<HudState>({ score: 0, hp: 100, combo: 0, maxCombo: 0, bpm: 0, accuracy: 100, countIn: null })
  const [endStats, setEndStats] = useState<GameEnd | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [active, setActive] = useState<ReadonlySet<number>>(() => new Set())
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null)

  const onEnd = useCallback((e: GameEnd) => {
    setEndStats(e)
    setScreen('over')
    engineRef.current?.sfx('explode')
    const { wasQuit, ...stats } = e
    registry.emit('onGameEnd', { ...stats, wasQuit, elapsed: stats.seconds, health: stats.hp })
    try { propsRef.current.onGameEnd?.(stats) } catch { /* host handler threw: ignore */ }
  }, [registry])
  const onHit = useCallback((e: NoteEvent) => registry.emit('onNoteHit', e), [registry])
  const onMiss = useCallback((e: NoteEvent) => registry.emit('onNoteMiss', e), [registry])

  const game = useGame({
    canvasRef, width: stageSize.width, height: stageSize.height, keyX, settings: getSettings,
    onHud: setHud, onEnd, onHit, onMiss,
  })
  const { abort } = game
  useEffect(() => () => abort(), [abort])

  const startSong = useCallback(async (i: number) => {
    if (busy || i < 0) return
    // Resume inside the click itself: Safari/iOS only unlock audio during the user gesture,
    // which is lost after the first await (e.g. the OpenSongs fetch below).
    void resumeAudio()
    let s: GameSong | undefined = songs[i]
    if (!s && i >= songs.length) {
      const entry = entries[i - songs.length]
      if (!entry) return
      setIndex(i)
      setBusy('LOADING…')
      setPickError(null)
      let pending = osCache.current.get(entry.id)
      if (!pending) {
        pending = loadOpenSong(entry)
        osCache.current.set(entry.id, pending)
      }
      try {
        s = await withTimeout(pending, SONG_LOAD_TIMEOUT_MS, `"${entry.title}"`)
        const loaded = s
        setOsLoaded(m => new Map(m).set(`${osKey}\u0001${entry.id}`, loaded))
      } catch (e) {
        osCache.current.delete(entry.id)
        report(codeOf(e, 'score-load'), msgOf(e), e)
        setPickError(`COULD NOT LOAD "${entry.title.toUpperCase()}"`)
        setBusy(null)
        return
      }
    }
    if (!s) return
    setIndex(i)
    setBusy('LOADING…')
    rootRef.current?.focus()
    const eng = engine()
    let resumeTimer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([resumeAudio(), new Promise<void>(r => { resumeTimer = setTimeout(r, AUDIO_RESUME_TIMEOUT_MS) })])
    clearTimeout(resumeTimer)
    let ctx: AudioContext | null = null
    try { ctx = getAudioContext() } catch { ctx = null }
    let timer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      eng.load(s, voice).catch(e => report('audio', msgOf(e), e)),
      new Promise<void>(r => { timer = setTimeout(r, AUDIO_LOAD_TIMEOUT_MS) }),
    ])
    clearTimeout(timer)
    eng.setPlayerVoice(voice)
    const bpm = mode === 'single' && propsRef.current.bpm ? propsRef.current.bpm : s.bpm
    measure()
    setPlayingTitle(s.title)
    game.start({ song: s, bpm, audio: eng, audioContext: ctx })
    registry.emit('onGameStart', { song: s.title, bpm, difficulty: s.difficulty })
    setEndStats(null)
    setShowRules(false)
    setScreen('playing')
    setBusy(null)
    rootRef.current?.focus()
  }, [songs, entries, osKey, busy, engine, voice, mode, measure, game, registry, report])

  const press = useCallback((midi: number) => {
    setActive(a => new Set(a).add(midi))
    if (screen === 'playing') game.press(midi)
  }, [screen, game])
  const hover = useCallback((midi: number) => {
    if (screen === 'playing') game.aim(midi)
  }, [screen, game])
  const release = useCallback((midi: number) => {
    setActive(a => {
      if (!a.has(midi)) return a
      const n = new Set(a)
      n.delete(midi)
      return n
    })
  }, [])

  const held = useRef(new Set<string>())
  // Focus leaving the game (Alt-Tab, clicking a host input) never delivers the keyups: drop held keys.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null
      if (next && el.contains(next)) return
      held.current.clear()
      setActive(a => (a.size === 0 ? a : new Set()))
    }
    el.addEventListener('focusout', onFocusOut)
    return () => el.removeEventListener('focusout', onFocusOut)
  }, [])
  useScopedKeys(rootRef, {
    onKeyDown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      const midi = QWERTY_MAP[k]
      if (midi === undefined) return
      e.preventDefault()
      if (e.repeat || held.current.has(k)) return
      held.current.add(k)
      press(midi)
    },
    onKeyUp(e) {
      const k = e.key.toLowerCase()
      const midi = QWERTY_MAP[k]
      if (midi === undefined) return
      held.current.delete(k)
      release(midi)
    },
  })

  const restart = useCallback(() => {
    setScreen('start')
    setEndStats(null)
    rootRef.current?.focus()
  }, [])

  const onImport = useCallback(async (file: File) => {
    setImportStatus({ type: 'loading', message: 'LOADING…' })
    const ext = (file.name.split('.').pop() ?? '').toLowerCase()
    try {
      let s: GameSong | null
      if (ext === 'dottl' || ext === 'json') {
        const text = typeof file.text === 'function' ? await file.text() : await new Response(file).text()
        let data: unknown
        try { data = JSON.parse(text) } catch (cause) { throw new SongError('score-parse', 'Invalid dottl: not valid JSON.', { cause }) }
        s = toGameSong(registry.parseSong(data) ?? data)
      } else {
        s = await loadSong({ file })
      }
      if (!s) throw new SongError('score-parse', 'Unrecognised song file.')
      if (s.targets.length === 0) { setImportStatus({ type: 'error', message: 'NO NOTES FOUND' }); return }
      const added = s
      setImported(prev => [...prev, added])
      setFilter('all')
      setIndex(songs.length)
      setImportStatus({ type: 'success', message: `LOADED: ${s.title}` })
    } catch (e) {
      report(codeOf(e, 'score-load'), msgOf(e), e)
      setImportStatus({ type: 'error', message: 'COULD NOT LOAD THAT FILE' })
    }
  }, [registry, report, songs.length])

  // ---------------------------------------------------------------- render
  const rootStyle = {
    ...theme.cssVars,
    '--pi-keyboard-height': `${layout.keyboardHeight}px`,
    ...(theme.backgroundImage ? { backgroundImage: `url(${theme.backgroundImage})` } : {}),
  } as CSSProperties
  const playing = screen === 'playing'
  const rootClass = [
    'piano-invaders', props.className, theme.className,
    layout.isMobile ? 'is-mobile' : '', layout.isLandscapeMobile ? 'is-landscape' : '', layout.isNarrow ? 'is-narrow' : '', playing ? 'is-playing' : '',
  ].filter(Boolean).join(' ')
  const countIn = playing ? hud.countIn : null

  return (
    <div ref={rootRef} className={rootClass} style={rootStyle} tabIndex={0} aria-label="Piano Invaders game">
      <Hud
        score={hud.score} hi={hi} bpm={playing ? hud.bpm : baseBpm} song={playing ? playingTitle : (selected?.title ?? '')} combo={hud.combo}
        hp={playing ? hud.hp : 100} accuracy={playing ? hud.accuracy : 100} running={playing} onQuit={game.quit}
      />
      <div className="pi-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="pi-canvas" />
        {countIn && (
          <div className={`pi-countin${countIn.bar === 2 ? ' is-bar2' : ''}`} aria-live="polite">
            {countIn.label && <div key={countIn.idx} className="pi-countin-beat">{countIn.label}</div>}
          </div>
        )}
      </div>
      <div className="pi-cabinet-strip">
        <span className="pi-strip-text pi-strip-coin">INSERT COIN</span>
        <div className="pi-strip-controls">
          <button type="button" className={`pi-chip pi-chip-metronome${toggles.metronome ? ' is-on' : ''}`} aria-pressed={toggles.metronome} onClick={() => onToggle('metronome')}>MET</button>
          {song && song.accompaniment.length > 0 && (
            <button type="button" className={`pi-chip pi-chip-accomp${toggles.accomp ? ' is-on' : ''}`} aria-pressed={toggles.accomp} onClick={() => onToggle('accomp')}>ACC</button>
          )}
          <span className="pi-chip-group pi-voice-group">
            <button type="button" className={`pi-chip pi-chip-synth${voice === 'synth' ? ' is-on' : ''}`} aria-pressed={voice === 'synth'} onClick={() => chooseVoice('synth')}>SYN</button>
            <button type="button" className={`pi-chip pi-chip-piano${voice === 'piano' ? ' is-on' : ''}`} aria-pressed={voice === 'piano'} onClick={() => chooseVoice('piano')}>PNO</button>
          </span>
          {playing && (
            <label className="pi-bpm-control">
              <span className="pi-bpm-label">BPM</span>
              <input
                className="pi-bpm-slider"
                type="range"
                min={BPM_MIN}
                max={BPM_MAX}
                step={1}
                value={hud.bpm || baseBpm || BPM_MIN}
                onChange={e => game.setBpm(Number(e.target.value))}
                onPointerUp={() => rootRef.current?.focus()}
              />
            </label>
          )}
        </div>
        <span className="pi-strip-text pi-strip-players">1 OR 2 PLAYERS</span>
      </div>
      <Keyboard active={active} onDown={press} onUp={release} onHover={hover} keyRef={keyRef} />

      {screen === 'start' && loadError && (
        <div className="pi-overlay pi-error" role="alert">
          <div className="pi-band pi-band-top" />
          <div className="pi-panel pi-error-panel">
            <h2 className="pi-heading pi-error-title">Couldn&apos;t load this score</h2>
            <p className="pi-error-detail">{loadError}</p>
          </div>
        </div>
      )}
      {screen === 'start' && !loadError && (
        <StartScreen
          mode={mode}
          songs={mode === 'single' ? all : visible}
          index={mode === 'single' ? 0 : visIndex}
          onIndex={onRollerIndex}
          filter={filter}
          onFilter={onFilter}
          library={library}
          pickError={pickError}
          bpm={baseBpm}
          ready={pluginsReady && songsLoaded && selAll >= 0}
          busy={busy ?? (songsLoaded ? null : 'LOADING…')}
          onStart={() => void startSong(selAll)}
          onRandom={() => { if (visible.length) void startSong(visible[Math.floor(Math.random() * visible.length)].all) }}
          onRules={() => setShowRules(true)}
          onImport={allowImport ? f => void onImport(f) : undefined}
          importStatus={importStatus}
          leaderboard={board}
          toggles={toggles}
          onToggle={onToggle}
          logo={logoImg}
        />
      )}
      {screen === 'over' && endStats && (
        <GameOver stats={endStats} loadBoard={loadBoard} saveBoard={saveBoard} onRestart={restart} />
      )}
      {showRules && <RulesPopup onClose={() => { setShowRules(false); rootRef.current?.focus() }} />}
    </div>
  )
}

