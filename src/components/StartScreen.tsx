import { useEffect, useRef, useState } from 'react'
import type { Difficulty } from '../song/types'
import type { LeaderboardEntry } from '../utils/leaderboard'
import { DIFFICULTY_MULT } from '../game/scoring'

export interface ImportStatus { type: 'loading' | 'success' | 'error'; message: string }
export type ToggleKey = 'metronome' | 'countIn' | 'accomp'

/** One roller row (bundled song, imported song or OpenSongs entry). */
export interface RollerItem { key: string; title: string; difficulty: Difficulty; hasAccomp: boolean }
export type DifficultyFilter = 'all' | Difficulty
export type LibraryStatus = 'off' | 'loading' | 'ready' | 'error'

export const FILTERS: Array<{ id: DifficultyFilter; label: string }> = [
  { id: 'all', label: 'ALL' }, { id: 'easy', label: 'EASY' },
  { id: 'intermediate', label: 'INTER' }, { id: 'advanced', label: 'ADV' },
]

export interface StartScreenProps {
  mode: 'picker' | 'single'
  songs: RollerItem[]
  filter?: DifficultyFilter
  onFilter?(f: DifficultyFilter): void
  library?: LibraryStatus
  pickError?: string | null
  index: number
  onIndex(i: number): void
  bpm: number
  ready: boolean
  busy: string | null
  onStart(): void
  onRandom(): void
  onRules(): void
  onImport?: (file: File) => void
  importStatus: ImportStatus | null
  leaderboard: LeaderboardEntry[]
  toggles: Record<ToggleKey, boolean>
  onToggle(k: ToggleKey): void
  logo?: string
}

const ITEM_H = 40
const BARREL_H = 130
const offsetFor = (i: number) => -(i + 1) * ITEM_H + (BARREL_H - ITEM_H) / 2
/** rows rendered either side of the selected one (the barrel shows ~3 at a time) */
const WINDOW = 6

export const IMPORT_ACCEPT = '.musicxml,.xml,.mxl,.mid,.midi,.dottl,.json'

function DifficultyTag({ d }: { d: Difficulty }) {
  return <span className={`pi-diff-tag pi-diff-${d}`}>{d[0].toUpperCase()}</span>
}

export default function StartScreen(p: StartScreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const drag = useRef({ active: false, moved: false, startY: 0, lastY: 0, lastT: 0, v: 0, startIndex: 0, id: -1 })
  const [dragging, setDragging] = useState(false)
  const len = p.songs.length
  const song = p.songs[p.index]
  const libLoading = p.library === 'loading'
  const prevIndex = useRef(p.index)

  useEffect(() => {
    const el = scrollRef.current
    if (el && !drag.current.active) {
      // long jumps (wrap-around, filter change) snap instead of sweeping through unrendered rows
      const far = Math.abs(p.index - prevIndex.current) > WINDOW
      el.style.transition = far ? 'none' : 'transform 0.3s ease-out'
      el.style.transform = `translateY(${offsetFor(p.index)}px)`
    }
    prevIndex.current = p.index
  }, [p.index, len])

  const wrap = (i: number) => ((i % len) + len) % len

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (len === 0) return
    drag.current = { active: true, moved: false, startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0, startIndex: p.index, id: e.pointerId }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not supported */ }
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d.active) return
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt
    d.lastY = e.clientY
    d.lastT = e.timeStamp
    const dy = e.clientY - d.startY
    if (Math.abs(dy) > 4) d.moved = true
    const el = scrollRef.current
    if (el) {
      el.style.transition = 'none'
      el.style.transform = `translateY(${offsetFor(d.startIndex) + dy}px)`
    }
    const i = wrap(Math.round(d.startIndex - dy / ITEM_H))
    if (i !== p.index) p.onIndex(i)
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d.active) return
    d.active = false
    try { e.currentTarget.releasePointerCapture(d.id) } catch { /* ignore */ }
    const total = e.clientY - d.startY + d.v * 50
    const i = wrap(Math.round(d.startIndex - total / ITEM_H))
    const el = scrollRef.current
    if (el) {
      el.style.transition = 'transform 0.3s ease-out'
      el.style.transform = `translateY(${offsetFor(i)}px)`
    }
    p.onIndex(i)
    setDragging(false)
  }

  const toggle = (k: ToggleKey, label: string) => (
    <button
      type="button"
      className={`pi-btn pi-btn-sm pi-btn-toggle pi-btn-toggle-${k}${p.toggles[k] ? ' is-on' : ''}`}
      aria-pressed={p.toggles[k]}
      onClick={() => p.onToggle(k)}
    >
      {label}
    </button>
  )

  const startLabel = p.busy ?? 'START'
  const startDisabled = !p.ready || !!p.busy || !song

  return (
    <div className="pi-overlay pi-start">
      <div className="pi-band pi-band-top pi-start-band-top" />
      <div className="pi-start-inner">
        <h1 className="pi-heading pi-start-title">
          {p.logo ? <img className="pi-start-logo" src={p.logo} alt="Piano Invaders" /> : <>PIANO<br />INVADERS</>}
        </h1>

        {p.mode === 'single' ? (
          <div className="pi-start-single">
            <div className="pi-start-single-title">{song?.title ?? 'Loading…'}</div>
            {song && (
              <div className="pi-start-single-meta">
                <span className={`pi-start-meta-diff pi-diff-${song.difficulty}`}>{song.difficulty}</span>
                <span className="pi-start-meta-mult">×{DIFFICULTY_MULT[song.difficulty]}</span>
                <span className="pi-start-meta-bpm">{p.bpm} BPM</span>
              </div>
            )}
          </div>
        ) : (
          <div className="pi-start-picker">
            <div
              className={`pi-barrel${dragging ? ' is-dragging' : ''}`}
              style={{ height: BARREL_H }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div className="pi-barrel-window" />
              <div className="pi-barrel-scroll" ref={scrollRef} style={{ height: (len + 2 + (libLoading ? 1 : 0)) * ITEM_H }}>
                {p.songs.map((s, i) => {
                  if (Math.abs(i - p.index) > WINDOW) return null
                  return (
                    <div
                      key={s.key}
                      className={`pi-barrel-item is-song${i === p.index ? ' is-selected' : ''}`}
                      style={{ height: ITEM_H, top: (i + 1) * ITEM_H }}
                      onClick={() => { if (!drag.current.moved) p.onIndex(i) }}
                    >
                      <span className="pi-barrel-name">{s.title}</span>
                      <DifficultyTag d={s.difficulty} />
                    </div>
                  )
                })}
                {libLoading && (
                  <div className="pi-barrel-item pi-barrel-loading" style={{ height: ITEM_H, top: (len + 1) * ITEM_H }}>
                    <span className="pi-barrel-name">Loading library…</span>
                  </div>
                )}
                {len === 0 && !libLoading && (
                  <div className="pi-barrel-item pi-barrel-empty" style={{ height: ITEM_H, top: ITEM_H }}>
                    <span className="pi-barrel-name">No songs</span>
                  </div>
                )}
              </div>
            </div>
            <div className="pi-barrel-controls">
              <button type="button" className="pi-btn pi-btn-sm pi-btn-barrel-up" aria-label="Previous song" onClick={() => len && p.onIndex(wrap(p.index - 1))}>▲</button>
              <span className="pi-barrel-bpm">{song && p.bpm > 0 ? `${p.bpm} BPM` : ''}</span>
              <button type="button" className="pi-btn pi-btn-sm pi-btn-barrel-down" aria-label="Next song" onClick={() => len && p.onIndex(wrap(p.index + 1))}>▼</button>
            </div>
            {p.onFilter && (
              <div className="pi-filter-row" role="group" aria-label="Filter by difficulty">
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className={`pi-filter-pill pi-filter-${f.id}${(p.filter ?? 'all') === f.id ? ' is-on' : ''}`}
                    aria-pressed={(p.filter ?? 'all') === f.id}
                    onClick={() => p.onFilter?.(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pi-btn-row pi-start-main-row">
          <button type="button" className="pi-btn pi-btn-primary pi-btn-start" disabled={startDisabled} onClick={p.onStart}>
            {startLabel}
          </button>
          {p.mode === 'picker' && (
            <button type="button" className="pi-btn pi-btn-random" disabled={startDisabled} onClick={p.onRandom}>
              RANDOM
            </button>
          )}
        </div>

        <div className="pi-btn-row pi-start-sub-row">
          <button type="button" className="pi-btn pi-btn-sm pi-btn-rules" onClick={p.onRules}>[?] RULES</button>
          {p.mode === 'picker' && p.onImport && (
            <>
              <button type="button" className="pi-btn pi-btn-sm pi-btn-import" onClick={() => fileRef.current?.click()}>[+] IMPORT</button>
              <input
                ref={fileRef}
                className="pi-import-input"
                type="file"
                accept={IMPORT_ACCEPT}
                hidden
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) p.onImport?.(f)
                  e.target.value = ''
                }}
              />
            </>
          )}
        </div>

        <div className="pi-btn-row pi-start-toggle-row">
          {toggle('metronome', 'METRONOME')}
          {toggle('countIn', 'COUNT-IN')}
          {song && song.hasAccomp && toggle('accomp', 'ACCOMP')}
        </div>

        {p.pickError && <div className="pi-pick-error" role="alert">{p.pickError}</div>}
        {p.importStatus && (
          <div className={`pi-import-status is-${p.importStatus.type}`} role="status">{p.importStatus.message}</div>
        )}
      </div>

      <div className="pi-band pi-band-bottom pi-start-band-bottom" />
      <div className="pi-marquee" aria-label="High scores">
        <div className="pi-marquee-text">
          {p.leaderboard.map((e, i) => (
            <span key={`${e.name}-${i}`} className="pi-marquee-entry">
              #{i + 1} {e.name} {e.total.toLocaleString()}
              <span className="pi-marquee-sep">///</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
