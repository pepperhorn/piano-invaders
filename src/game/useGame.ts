// Game loop: spawning from the beat Transport, collisions, HP, combo, accuracy, gunship/bolts,
// and lookahead audio scheduling (metronome, count-in, accompaniment) on the same clock.
// GameSession is plain TS (testable without React/DOM); useGame drives it with requestAnimationFrame.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Transport } from '../audio/Transport'
import { GAME_CONFIG } from '../constants/gameConfig'
import type { Difficulty, GameSong, Target } from '../song/types'
import { GUNSHIP_SETTLE_MS, isSettled, stepGunship, type GunshipState } from './gunship'
import { onHit, onLandHit, totalScore, type ComboState } from './scoring'
import { resolvePress, type LiveNote, type Shot } from './shots'
import { drawFrame, stageMetrics, type FrameState } from '../render/drawFrame'
import { LandStrip } from '../render/LandStrip'
import { stepEffects, type Effect } from '../render/effects'
import { ALERT_RED, WHITE, pitchColor } from '../render/palette'
import type { InvaderKind } from '../render/sprites'

// ------------------------------------------------------------------ clock

export interface Clock {
  /** game seconds (audio clock minus time spent paused / hidden) */
  now(): number
  /** game seconds -> AudioContext seconds, for scheduling */
  toAudio(sec: number): number
  /** call once per frame; long gaps (hidden tab) are skipped instead of fast-forwarded */
  tick(): void
}

const MAX_FRAME_GAP = 0.25

export function makeClock(audio: { currentTime: number; state?: string } | null): Clock {
  const useAudio = !!audio && audio.state === 'running'
  const raw = () => (useAudio ? audio!.currentTime : performance.now() / 1000)
  let offset = 0
  let last = raw()
  return {
    now: () => raw() - offset,
    toAudio(sec) {
      const a = audio ? audio.currentTime : 0
      return a + (sec - (raw() - offset))
    },
    tick() {
      const r = raw()
      const gap = r - last
      if (gap > MAX_FRAME_GAP) offset += gap - 1 / 60
      last = r
    },
  }
}

// ------------------------------------------------------------------ audio surface used by the game

export interface GameAudio {
  playPlayer(midi: number, whenSec?: number, durSec?: number): void
  scheduleAccomp(n: GameSong['accompaniment'][number], whenSec: number, durSec: number): void
  metronomeTick(whenSec: number, accent: boolean, volume: number): void
  sfx(kind: 'hit' | 'miss' | 'explode' | 'fire'): void
  stopAll(): void
}

export interface GameSettings { metronome: boolean; countIn: boolean; accomp: boolean; reducedMotion: boolean; scanlines: boolean }

export interface HudState {
  score: number; hp: number; combo: number; maxCombo: number; bpm: number; accuracy: number
  countIn: { label: string; bar: number; idx: number } | null
}

export interface GameStats {
  score: number; total: number; hp: number; bpm: number; seconds: number; accuracy: number
  maxCombo: number; difficulty: Difficulty; song: string
}

export interface GameEnd extends GameStats { wasQuit: boolean }

export interface NoteEvent { midi: number; x: number; y: number }

// ------------------------------------------------------------------ tuning

/** today's fall speed: NOTE_BASE_SPEED px/frame at 60 fps at 65 bpm, expressed per beat */
export const PX_PER_BEAT = (GAME_CONFIG.NOTE_BASE_SPEED * 60 * 60) / 65
/** px above the miss line where a note sits on its beat (legacy fire line ≈ 70 px above the land) */
const HIT_GRACE_PX = 70
const LOOKAHEAD_SEC = 0.15
const BOLT_SPEED = 1500 // px/s at scale 1
const FLASH_SEC = 0.45
const SHAKE_SEC = 0.3
const DROP_FLASH_SEC = 0.3
const LIT_SEC = 0.18
const INVADERS: InvaderKind[] = ['squid', 'crab', 'octopus']

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const easeOut = (f: number) => 1 - (1 - f) * (1 - f)

/** Beat-in-bar for a song-local beat, honouring time-signature changes (assumed on bar lines). */
export function beatInBar(song: Pick<GameSong, 'beatsPerBar' | 'timeSigChanges'>, localBeat: number): { idx: number; bpb: number } {
  let from = 0
  let bpb = song.beatsPerBar || 4
  for (const c of song.timeSigChanges ?? []) {
    if (c.beat <= localBeat + 1e-9) { from = c.beat; bpb = c.beatsPerBar } else break
  }
  const idx = ((Math.round(localBeat - from) % bpb) + bpb) % bpb
  return { idx, bpb }
}

interface NoteRt {
  id: number; target: Target; absBeat: number; midi: number; group?: number
  spawnX: number; x: number; y: number; invader: InvaderKind
  shot: boolean; dead: boolean
}

interface Pending { shot: Shot; at: number; waitsForShip: boolean }
interface Bolt { noteId: number; kind: Shot['kind']; x0: number; y0: number; x1: number; y1: number; t: number; dur: number }

export interface SessionOpts {
  song: GameSong
  bpm: number
  clock: Clock
  audio: GameAudio
  settings: () => GameSettings
  keyX: (midi: number) => number
  width: number
  height: number
  land?: LandStrip
  random?: () => number
  onHit?(e: NoteEvent): void
  onMiss?(e: NoteEvent): void
}

/** One play-through of a (looping) song. Advance it with step(); feed it presses. */
export class GameSession {
  readonly song: GameSong
  readonly transport: Transport
  readonly leadInBeats: number
  land: LandStrip
  width: number
  height: number
  notes: NoteRt[] = []
  bolts: Bolt[] = []
  effects: Effect[] = []
  pending: Pending[] = []
  gun: GunshipState
  score = 0
  hp: number = GAME_CONFIG.MAX_HEALTH
  combo: ComboState = { combo: 0, maxCombo: 0 }
  accuracy = 100
  ended = false
  ufoX: number
  private ufoDir = 1
  private dropFlash = 0
  private flash = 0
  private shakeT = 0
  private lit: { midi: number; t: number } | null = null
  private last: number
  private nextId = 1
  private spawnedTo = 0
  private schedTo: number
  private lastHitBeat = -Infinity
  private decayChecked = 0
  private playStart: number | null = null
  private nextBpmBump = GAME_CONFIG.BPM_INCREASE_DELAY / 1000 + GAME_CONFIG.BPM_INCREASE_INTERVAL / 1000
  private readonly o: SessionOpts
  private readonly rnd: () => number

  constructor(o: SessionOpts) {
    this.o = o
    this.song = o.song
    this.width = o.width
    this.height = o.height
    this.rnd = o.random ?? Math.random
    const m = stageMetrics(o.width, o.height)
    this.land = o.land ?? new LandStrip(o.width, m.landHeight)
    this.ufoX = o.width / 2
    this.gun = { x: o.width / 2, v: 0, targetX: o.width / 2 }
    const bpb = o.song.beatsPerBar || 4
    const countIn = o.settings().countIn ? 2 * bpb : 0
    this.leadInBeats = Math.max(countIn, Math.ceil(this.fallBeats() + 0.5))
    this.transport = new Transport({ get currentTime() { return o.clock.now() } }, {
      bpm: o.bpm, lengthBeats: Math.max(1, o.song.lengthBeats), leadInBeats: this.leadInBeats,
    })
    this.last = o.clock.now()
    this.transport.start(this.last)
    this.schedTo = -this.leadInBeats
  }

  // ---------------------------------------------------------------- geometry

  private metrics() { return stageMetrics(this.width, this.height) }

  private geom() {
    const m = this.metrics()
    const spawnY = m.ufoY + 34 * m.s
    const missY = this.landTop() - m.badgeR
    const grace = Math.min(HIT_GRACE_PX, Math.max(0, (missY - spawnY) * 0.35))
    const hitY = missY - grace
    return { m, spawnY, missY, hitY }
  }

  landTop(): number { return this.metrics().landTop }

  /** beats a note is on screen before its beat (spawn → hit line) */
  fallBeats(): number {
    const g = this.geom()
    return Math.max(0.5, (g.hitY - g.spawnY) / PX_PER_BEAT)
  }

  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    this.land.resize(width, stageMetrics(width, height).landHeight)
  }

  get bpm(): number { return this.transport.getBpm() }

  setBpm(bpm: number): void {
    const b = clamp(Math.round(bpm), 20, 300)
    if (b !== this.transport.getBpm()) this.transport.setBpm(b)
  }

  seconds(): number {
    return this.playStart === null ? 0 : Math.max(0, this.o.clock.now() - this.playStart)
  }

  // ---------------------------------------------------------------- per-frame

  step(): void {
    if (this.ended) return
    // skip long gaps (hidden tab: rAF paused, audio clock kept running) so the beat doesn't jump
    this.o.clock.tick()
    const now = this.o.clock.now()
    const dt = clamp(now - this.last, 0, MAX_FRAME_GAP)
    this.last = now
    const beat = this.transport.beatAt(now)
    const m = this.metrics()

    if (beat >= 0 && this.playStart === null) this.playStart = now - (beat * 60) / this.bpm
    this.autoBpm()
    this.schedule(now)
    this.patrol(dt, m.s)
    this.spawn(beat)
    this.moveNotes(beat)
    this.fire(now, m)
    this.moveBolts(dt)
    this.landings()
    this.decay(beat)
    this.prune()

    this.gun = stepGunship(this.gun, dt)
    this.effects = stepEffects(this.effects, dt)
    this.flash = Math.max(0, this.flash - dt / FLASH_SEC)
    this.shakeT = Math.max(0, this.shakeT - dt)
    this.dropFlash = Math.max(0, this.dropFlash - dt / DROP_FLASH_SEC)
    if (this.lit && (this.lit.t -= dt) <= 0) this.lit = null
  }

  private autoBpm(): void {
    if (this.seconds() >= this.nextBpmBump) {
      this.setBpm(this.bpm + GAME_CONFIG.BPM_INCREASE_AMOUNT)
      this.nextBpmBump += GAME_CONFIG.BPM_INCREASE_INTERVAL / 1000
    }
  }

  /** Lookahead scheduling of count-in / metronome ticks and accompaniment on the audio clock. */
  private schedule(now: number): void {
    const horizon = this.transport.beatAt(now + LOOKAHEAD_SEC)
    if (horizon <= this.schedTo) return
    const s = this.o.settings()
    const bpb = this.song.beatsPerBar || 4
    const at = (b: number) => this.o.clock.toAudio(this.transport.secAt(b))
    for (let b = Math.ceil(this.schedTo - 1e-9); b < horizon; b++) {
      if (b < this.schedTo - 1e-9) continue
      if (b < 0) {
        const idx = b + 2 * bpb
        if (!s.countIn || idx < 0) continue
        const bar1 = idx < bpb
        if (bar1 && idx % 2 !== 0) continue
        const inBar = idx % bpb
        this.o.audio.metronomeTick(at(b), inBar === 0, inBar === 0 ? 0.8 : inBar * 2 === bpb ? 0.55 : 0.3)
      } else if (s.metronome) {
        const len = Math.max(1, this.song.lengthBeats)
        const { idx, bpb: barLen } = beatInBar(this.song, b % len)
        const vol = idx === 0 ? 0.8 : idx * 2 === barLen ? 0.55 : 0.3
        this.o.audio.metronomeTick(at(b), idx === 0, vol * 0.6)
      }
    }
    if (s.accomp && horizon > 0) {
      const spb = 60 / this.bpm
      for (const { ev, absBeat } of this.transport.window(this.song.accompaniment, Math.max(0, this.schedTo), horizon)) {
        this.o.audio.scheduleAccomp(ev, at(absBeat), Math.max(0.05, ev.durBeats * spb))
      }
    }
    this.schedTo = horizon
  }

  private patrol(dt: number, s: number): void {
    const margin = 30 * s
    this.ufoX += GAME_CONFIG.UFO_SPEED * 60 * s * this.ufoDir * dt
    if (this.ufoX > this.width - margin) { this.ufoX = this.width - margin; this.ufoDir = -1 }
    else if (this.ufoX < margin) { this.ufoX = margin; this.ufoDir = 1 }
  }

  private spawn(beat: number): void {
    const to = beat + this.fallBeats()
    if (to <= this.spawnedTo) return
    const LOOP_IDS = 1_000_000
    for (const { ev, absBeat, loop } of this.transport.window(this.song.targets, this.spawnedTo, to)) {
      this.notes.push({
        id: this.nextId++, target: ev, absBeat, midi: ev.midi,
        group: ev.group === undefined ? undefined : loop * LOOP_IDS + ev.group,
        spawnX: this.ufoX, x: this.ufoX, y: -1000, invader: INVADERS[((ev.id % 3) + 3) % 3],
        shot: false, dead: false,
      })
      this.dropFlash = 1
    }
    this.spawnedTo = to
  }

  private moveNotes(beat: number): void {
    const g = this.geom()
    const span = Math.max(1, (g.hitY - g.spawnY) * 0.6)
    for (const n of this.notes) {
      n.y = g.hitY - (n.absBeat - beat) * PX_PER_BEAT
      const p = easeOut(clamp((n.y - g.spawnY) / span, 0, 1))
      n.x = n.spawnX + (this.o.keyX(n.midi) - n.spawnX) * p
    }
  }

  private landings(): void {
    const g = this.geom()
    const s = g.m.s
    const keep: NoteRt[] = []
    for (const n of this.notes) {
      if (n.shot || n.y < g.missY) { keep.push(n); continue }
      // a miss: the note reaches the land (R10: landed notes leave the live list at once)
      this.land.bomb(n.x, GAME_CONFIG.BOMB_RADIUS * s)
      const top = this.landTop()
      const ip = this.land.impactPoint(n.x)
      this.effects.push({ kind: 'crater-flash', x: n.x, y: top + ip.y, t: 0 })
      this.effects.push({ kind: 'text', x: n.x, y: top - 4 * s, t: 0, text: 'MISS -5', color: ALERT_RED })
      this.hp = Math.max(0, this.hp - GAME_CONFIG.DAMAGE_PER_BOMB)
      this.combo = onLandHit(this.combo)
      this.flash = 1
      if (!this.o.settings().reducedMotion) this.shakeT = SHAKE_SEC
      this.o.audio.sfx('miss')
      this.o.onMiss?.({ midi: n.midi, x: n.x, y: n.y })
    }
    this.notes = keep
    if (this.hp <= 0) this.ended = true
  }

  /** R9: shot notes stay (alive=false for resolvePress) until their chord group is resolved. */
  private prune(): void {
    this.notes = this.notes.filter(n => {
      if (!n.dead) return true
      if (n.group === undefined) return false
      return this.notes.some(o => o !== n && o.group === n.group && !o.shot)
    })
  }

  private decay(beat: number): void {
    const cur = Math.floor(beat)
    while (this.decayChecked < cur) {
      const k = ++this.decayChecked
      if (k < 1 || this.lastHitBeat >= k - 1) continue
      // a note was due in the beat just completed and nothing was hit on it
      const due = this.transport.window(this.song.targets, k - 1, k).length > 0
      if (due) this.accuracy = Math.max(0, this.accuracy - 3)
    }
  }

  // ---------------------------------------------------------------- input

  /** Player pressed `midi`. Returns the shots fired (empty for a wrong key). */
  press(midi: number): Shot[] {
    if (this.ended) return []
    const now = this.o.clock.now()
    this.o.audio.playPlayer(midi)
    this.lit = { midi, t: LIT_SEC }
    const live: LiveNote[] = this.notes.map(n => ({ id: n.id, midi: n.midi, x: n.x, y: n.y, group: n.group, alive: !n.shot }))
    const { moveTo, shots } = resolvePress(midi, this.gun.x, this.o.keyX, live)
    if (shots.length === 0) {
      this.aim(midi)
      return shots
    }
    if (moveTo !== null) {
      if (Math.abs(moveTo - this.gun.targetX) > 0.5) this.flushPending()
      this.gun = { ...this.gun, targetX: moveTo }
    }
    let rated: NoteRt | undefined
    for (const shot of shots) {
      const n = this.notes.find(x => x.id === shot.noteId)
      if (!n) continue
      if (!rated || (n.midi === midi && rated.midi !== midi)) rated = n
      n.shot = true
      this.score += GAME_CONFIG.POINTS_PER_NOTE
      this.combo = onHit(this.combo)
      this.pending.push({ shot, at: now, waitsForShip: moveTo !== null })
      this.o.onHit?.({ midi: n.midi, x: n.x, y: n.y })
    }
    if (rated) this.rateTiming(this.transport.beatAt(now), rated.absBeat)
    return shots
  }

  /** Glide the gunship to `midi`'s key (hover or any press) without firing. */
  aim(midi: number): void {
    if (this.ended) return
    const x = this.o.keyX(midi)
    if (!Number.isFinite(x)) return
    if (Math.abs(x - this.gun.targetX) > 0.5) this.flushPending()
    this.gun = { ...this.gun, targetX: x }
  }

  /** Rate a hit against the struck note's own beat (off-beat notes included). */
  private rateTiming(beat: number, noteBeat: number): void {
    const off = Math.abs(beat - noteBeat)
    if (off < 0.25) this.accuracy = Math.min(100, this.accuracy + 2)
    else if (off > 0.4) this.accuracy = Math.max(0, this.accuracy - 4)
    // decay() checks whole beats [k-1, k): mark the one that holds the struck note
    this.lastHitBeat = Math.max(this.lastHitBeat, Math.floor(noteBeat + 1e-9))
  }

  /** The gunship was retargeted mid-glide: shots still waiting fire now from where it is. */
  private flushPending(): void {
    const m = this.metrics()
    for (const p of this.pending) this.launch(p.shot, m)
    this.pending = []
  }

  private fire(now: number, m: ReturnType<typeof stageMetrics>): void {
    if (this.pending.length === 0) return
    const settled = isSettled(this.gun, 2)
    const rest: Pending[] = []
    for (const p of this.pending) {
      if (!p.waitsForShip || settled || (now - p.at) * 1000 >= GUNSHIP_SETTLE_MS) this.launch(p.shot, m)
      else rest.push(p)
    }
    this.pending = rest
  }

  private launch(shot: Shot, m: ReturnType<typeof stageMetrics>): void {
    const n = this.notes.find(x => x.id === shot.noteId)
    if (!n) return
    const x0 = this.gun.x, y0 = m.shipTop
    const dist = Math.hypot(n.x - x0, n.y - y0)
    this.bolts.push({ noteId: n.id, kind: shot.kind, x0, y0, x1: n.x, y1: n.y + m.badgeR, t: 0, dur: clamp(dist / (BOLT_SPEED * m.s), 0.06, 0.4) })
    this.o.audio.sfx('fire')
  }

  private moveBolts(dt: number): void {
    const m = this.metrics()
    const keep: Bolt[] = []
    for (const b of this.bolts) {
      const n = this.notes.find(x => x.id === b.noteId)
      if (!n) continue
      // homing: the head tracks the falling note so every shot connects
      b.x1 = n.x
      b.y1 = n.y + m.badgeR
      b.t += dt / b.dur
      if (b.t < 1) { keep.push(b); continue }
      n.dead = true
      const big = b.kind === 'explosive'
      const col = pitchColor(n.midi)
      this.effects.push({ kind: 'explosion', x: n.x, y: n.y, t: 0, color: col, big })
      this.effects.push({ kind: 'confetti', x: n.x, y: n.y, t: 0, color: col, big })
      this.effects.push({ kind: 'text', x: n.x, y: n.y, t: 0, text: `+${GAME_CONFIG.POINTS_PER_NOTE}`, color: WHITE })
      this.o.audio.sfx(big ? 'explode' : 'hit')
    }
    this.bolts = keep
  }

  // ---------------------------------------------------------------- outputs

  hud(): HudState {
    const beat = this.transport.beatAt(this.o.clock.now())
    let countIn: HudState['countIn'] = null
    if (beat < 0 && this.o.settings().countIn) {
      const bpb = this.song.beatsPerBar || 4
      const idx = Math.floor(beat) + 2 * bpb
      if (idx >= 0) {
        const bar = idx < bpb ? 1 : 2
        const label = bar === 1 ? (idx % 2 === 0 ? String(idx / 2 + 1) : '') : String(idx - bpb + 1)
        countIn = { label, bar, idx }
      }
    }
    return {
      score: this.score, hp: this.hp, combo: this.combo.combo, maxCombo: this.combo.maxCombo,
      bpm: this.bpm, accuracy: this.accuracy, countIn,
    }
  }

  frame(dpr: number): FrameState {
    const m = this.metrics()
    const amp = this.shakeT > 0 ? 2 * m.s * (this.shakeT / SHAKE_SEC) : 0
    return {
      width: this.width, height: this.height, landTop: m.landTop, dpr,
      ufoX: this.ufoX, ufoDropFlash: this.dropFlash,
      notes: this.notes.filter(n => !n.dead && n.y > -100).map(n => ({ id: n.id, midi: n.midi, x: n.x, y: n.y, group: n.group, alive: true, invader: n.invader })),
      gunship: this.gun, litMidi: this.lit?.midi ?? null,
      bolts: this.bolts.map(b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, t: b.t, kind: b.kind })),
      effects: this.effects, land: this.land, flash: this.flash,
      shake: amp ? { x: (this.rnd() - 0.5) * 2 * amp, y: (this.rnd() - 0.5) * 2 * amp } : { x: 0, y: 0 },
      scanlines: this.o.settings().scanlines, laneGuides: true, keyX: this.o.keyX,
    }
  }

  /** silence everything that is scheduled or sounding */
  endAudio(): void {
    try { this.o.audio.stopAll() } catch { /* ignore */ }
  }

  stats(wasQuit: boolean): GameEnd {
    const seconds = Math.floor(this.seconds())
    const base = { score: this.score, hp: this.hp, bpm: this.bpm, seconds, difficulty: this.song.difficulty }
    return {
      ...base, total: totalScore(base), accuracy: Math.round(this.accuracy), maxCombo: this.combo.maxCombo,
      song: this.song.title, wasQuit,
    }
  }
}

/** Static attract-mode frame (behind the start / game-over screens). */
export function idleFrame(width: number, height: number, land: LandStrip, keyX: (m: number) => number, dpr: number, scanlines: boolean): FrameState {
  const m = stageMetrics(width, height)
  return {
    width, height, landTop: m.landTop, dpr, ufoX: width / 2, ufoDropFlash: 0, notes: [],
    gunship: { x: width / 2, v: 0, targetX: width / 2 }, litMidi: null, bolts: [], effects: [], land,
    flash: 0, shake: { x: 0, y: 0 }, scanlines, laneGuides: false, keyX,
  }
}

// ------------------------------------------------------------------ React driver

export interface UseGameOpts {
  canvasRef: RefObject<HTMLCanvasElement | null>
  width: number
  height: number
  keyX: (midi: number) => number
  settings: () => GameSettings
  onHud(h: HudState): void
  onEnd(e: GameEnd): void
  onHit?(e: NoteEvent): void
  onMiss?(e: NoteEvent): void
}

export interface StartArgs { song: GameSong; bpm: number; audio: GameAudio; audioContext: { currentTime: number; state?: string } | null }

function dprOf(): number {
  return typeof window !== 'undefined' && window.devicePixelRatio ? Math.min(3, window.devicePixelRatio) : 1
}

function sizeCanvas(c: HTMLCanvasElement, w: number, h: number, dpr: number): void {
  const bw = Math.round(w * dpr), bh = Math.round(h * dpr)
  if (c.width !== bw) c.width = bw
  if (c.height !== bh) c.height = bh
}

/** Draw a frame; a renderer failure must never escape the frame loop into the host. */
function paint(c: HTMLCanvasElement, f: FrameState): void {
  try {
    const ctx = c.getContext('2d')
    if (ctx) drawFrame(ctx, f)
    // dev-only: lets the embed e2e tests read note positions (stripped from production builds)
    if (import.meta.env.DEV) (c as HTMLCanvasElement & { __piNotes?: unknown }).__piNotes = f.notes.map(n => ({ midi: n.midi, x: n.x, y: n.y }))
  } catch { /* skip this frame */ }
}

function sameHud(a: HudState | null, b: HudState): boolean {
  if (!a) return false
  return a.score === b.score && a.hp === b.hp && a.combo === b.combo && a.maxCombo === b.maxCombo && a.bpm === b.bpm &&
    a.accuracy === b.accuracy && a.countIn?.idx === b.countIn?.idx && a.countIn?.label === b.countIn?.label
}

export function useGame(o: UseGameOpts) {
  const opts = useRef(o)
  useEffect(() => { opts.current = o })
  const session = useRef<GameSession | null>(null)
  const idleLand = useRef<LandStrip | null>(null)
  const lastHud = useRef<HudState | null>(null)
  const [running, setRunning] = useState(false)

  // keep the canvas backing store in step with its CSS size; draw an idle stage when not playing
  const { canvasRef, width, height } = o
  useEffect(() => {
    const c = canvasRef.current
    if (!c || width <= 0 || height <= 0) return
    const dpr = dprOf()
    sizeCanvas(c, width, height, dpr)
    const s = session.current
    s?.resize(width, height)
    if (s && !s.ended) return
    const m = stageMetrics(width, height)
    if (!idleLand.current || idleLand.current.height !== m.landHeight) idleLand.current = new LandStrip(width, m.landHeight)
    else idleLand.current.resize(width)
    const p = opts.current
    paint(c, s ? s.frame(dpr) : idleFrame(width, height, idleLand.current, p.keyX, dpr, p.settings().scanlines))
  }, [canvasRef, width, height])

  useEffect(() => {
    if (!running) return
    let id = 0
    const loop = () => {
      const s = session.current
      const c = opts.current.canvasRef.current
      if (!s || s.ended) return
      s.step()
      if (c) paint(c, s.frame(dprOf()))
      const h = s.hud()
      if (!sameHud(lastHud.current, h)) { lastHud.current = h; opts.current.onHud(h) }
      if (s.ended) {
        s.endAudio()
        setRunning(false)
        opts.current.onEnd(s.stats(false))
        return
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [running])

  const start = useCallback((a: StartArgs) => {
    const p = opts.current
    const clock = makeClock(a.audioContext)
    session.current = new GameSession({
      song: a.song, bpm: a.bpm, clock, audio: a.audio, settings: p.settings,
      keyX: m => opts.current.keyX(m), width: Math.max(1, p.width), height: Math.max(1, p.height),
      onHit: e => opts.current.onHit?.(e), onMiss: e => opts.current.onMiss?.(e),
    })
    lastHud.current = null
    p.onHud(session.current.hud())
    setRunning(true)
  }, [])

  const press = useCallback((midi: number) => { session.current?.press(midi) }, [])

  const aim = useCallback((midi: number) => { session.current?.aim(midi) }, [])

  const quit = useCallback(() => {
    const s = session.current
    if (!s || s.ended) return
    s.ended = true
    s.endAudio()
    setRunning(false)
    opts.current.onEnd(s.stats(true))
  }, [])

  const setBpm = useCallback((bpm: number) => {
    const s = session.current
    if (!s || s.ended) return
    s.setBpm(bpm)
  }, [])

  /** stop without reporting (unmount / leaving the game) */
  const abort = useCallback(() => {
    const s = session.current
    if (s && !s.ended) { s.ended = true; s.endAudio() }
    setRunning(false)
  }, [])

  return { running, start, press, aim, quit, setBpm, abort }
}
