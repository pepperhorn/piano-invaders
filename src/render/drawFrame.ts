// Phosphor '78 frame renderer (board panel B stage) with panel-C note badges and
// panel-A pitch-coloured invaders. Pure: never reads window / matchMedia.
import type { LiveNote, Shot } from '../game/shots'
import type { GunshipState } from '../game/gunship'
import { PIANO_KEYS } from '../constants/gameConfig'
import { ALERT_RED, CELLO_BOTTOM, CELLO_TOP, WHITE, pitchColor } from './palette'
import { GUNSHIP, GUNSHIP_KEY_COL0, MOTHERSHIP, drawInvader, spr, sprC, type InvaderKind } from './sprites'
import { drawBadge, halo } from './badge'
import { drawEffects, type Effect } from './effects'
import type { LandStrip } from './LandStrip'

export interface FrameState {
  width: number; height: number; landTop: number; dpr: number
  ufoX: number; ufoDropFlash: number // 0..1
  notes: (LiveNote & { invader: InvaderKind })[]
  gunship: GunshipState; litMidi: number | null
  bolts: { x0: number; y0: number; x1: number; y1: number; t: number; kind: Shot['kind'] }[]
  effects: Effect[]; land: LandStrip; flash: number; shake: { x: number; y: number }
  scanlines: boolean; laneGuides: boolean; keyX: (midi: number) => number
}

/** Mothership and invaders move in 4-px steps (gunship and bolts are exempt). */
export const STEP_PX = 4

/** Integer sprite scale: 1 at the board's 640×324 stage, 2 from 1280×648, … */
export function stageScale(width: number, height: number): number {
  return Math.max(1, Math.floor(Math.min(width / 640, height / 324)))
}

/** Stage geometry in CSS px (board values × scale). The caller uses these to place notes / fire bolts. */
export function stageMetrics(width: number, height: number) {
  const s = stageScale(width, height)
  return {
    s,
    ufoY: 46 * s,
    badgeR: 14 * s,
    invaderDy: -22 * s,
    invaderPx: 3 * s,
    shipY: height - 17 * s,
    /** bolts start here */
    shipTop: height - 29 * s,
    dangerGap: 8 * s,
    /** recommended LandStrip height and landTop (board: strip 260..292 over a 324-px stage) */
    landHeight: 32 * s,
    landTop: height - 64 * s,
  }
}

const step = (v: number) => Math.round(v / STEP_PX) * STEP_PX
const stepDown = (v: number) => Math.floor(v / STEP_PX) * STEP_PX
const lerp = (a: number, b: number, f: number) => a + (b - a) * f

export function drawFrame(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const { width: W, height: H } = f
  const m = stageMetrics(W, H), s = m.s
  ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowBlur = 0
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)

  const notes = f.notes.filter(n => n.alive).map(n => ({ n, x: step(n.x), y: stepDown(n.y) }))

  ctx.save()
  ctx.translate(Math.round(f.shake.x), Math.round(f.shake.y))

  // danger line
  const dangerY = f.landTop - m.dangerGap
  ctx.fillStyle = WHITE
  for (let x = 0; x < W; x += 4 * s) ctx.fillRect(x, dangerY, 2 * s, s)

  f.land.draw(ctx, f.landTop)

  if (f.laneGuides) for (const o of notes) lane(ctx, f, o.n.midi, o.x, o.y, m.badgeR, dangerY, s)

  mothership(ctx, step(f.ufoX), m.ufoY, f.ufoDropFlash, s)

  for (const o of notes) {
    const col = pitchColor(o.n.midi), iy = o.y + m.invaderDy
    halo(ctx, o.x, iy, 26 * s, col, 0.28)
    const frame = ((Math.floor(o.y / 16) + o.n.id) % 2 + 2) % 2 as 0 | 1
    drawInvader(ctx, o.n.invader, frame, o.x, iy, m.invaderPx, col)
  }

  for (const b of f.bolts) bolt(ctx, b, s)

  gunship(ctx, f.gunship.x, m.shipY, f.litMidi, s)

  drawEffects(ctx, f.effects, s, 'under')

  // cellophane bands
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = CELLO_TOP
  ctx.fillRect(0, m.ufoY - 14 * s, W, 44 * s)
  ctx.fillStyle = CELLO_BOTTOM
  ctx.fillRect(0, f.landTop - 14 * s, W, H - (f.landTop - 14 * s))
  ctx.restore()

  for (const o of notes) drawBadge(ctx, o.x, o.y, m.badgeR, o.n.midi)

  drawEffects(ctx, f.effects, s, 'over')
  ctx.restore()

  if (f.flash > 0) {
    ctx.fillStyle = `rgba(255,0,40,${0.28 * Math.min(1, f.flash)})`
    ctx.fillRect(0, 0, W, H)
  }

  crt(ctx, W, H, f.scanlines)
}

function lane(ctx: CanvasRenderingContext2D, f: FrameState, midi: number, x: number, y: number, r: number, dangerY: number, s: number): void {
  const tx = f.keyX(midi), y0 = y + r + 3 * s, len = f.height - y0
  if (len <= 0) return
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  for (let d = 0; d < len; d += 6 * s) ctx.fillRect(Math.round(lerp(x, tx, d / len)), Math.round(y0 + d), s, 2 * s)
  ctx.fillStyle = WHITE
  const ax = Math.round(tx)
  ctx.fillRect(ax - 2 * s, dangerY - 4 * s, 5 * s, s)
  ctx.fillRect(ax - s, dangerY - 3 * s, 3 * s, s)
  ctx.fillRect(ax, dangerY - 2 * s, s, s)
}

function mothership(ctx: CanvasRenderingContext2D, x: number, y: number, drop: number, s: number): void {
  sprC(ctx, MOTHERSHIP, { '#': WHITE }, x, y, 3 * s)
  if (drop <= 0) return
  ctx.save()
  ctx.globalAlpha = Math.min(1, drop)
  ctx.fillStyle = WHITE
  ctx.fillRect(x - 6 * s, y + 11 * s, 12 * s, 3 * s)
  // tractor-beam dashes, widening below the hatch
  const L = 36 * s * Math.min(1, drop + 0.4)
  for (let k = 0; k < 1; k += 0.12) {
    const yy = Math.round(y + 15 * s + k * L)
    ctx.fillRect(Math.round(x - (8 + 6 * k) * s), yy, 2 * s, 2 * s)
    ctx.fillRect(Math.round(x + (6 + 6 * k) * s), yy, 2 * s, 2 * s)
  }
  ctx.restore()
}

function bolt(ctx: CanvasRenderingContext2D, b: FrameState['bolts'][number], s: number): void {
  const t = Math.min(1, Math.max(0, b.t)), hx = lerp(b.x0, b.x1, t), hy = lerp(b.y0, b.y1, t)
  ctx.fillStyle = WHITE
  if (t < 0.15) { // muzzle flash
    ctx.fillRect(b.x0 - s, b.y0 - 4 * s, 2 * s, 6 * s)
    ctx.fillRect(b.x0 - 3 * s, b.y0 - 2 * s, 6 * s, 2 * s)
  }
  if (b.kind === 'straight') { ctx.fillRect(hx - s, hy, 2 * s, 8 * s); return }
  // explosive: angled, thicker bolt with a dashed tail
  const ang = Math.atan2(b.y1 - b.y0, b.x1 - b.x0), ux = Math.cos(ang), uy = Math.sin(ang)
  ctx.save()
  ctx.strokeStyle = WHITE
  ctx.lineCap = 'butt'
  ctx.lineWidth = 4 * s
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - ux * 12 * s, hy - uy * 12 * s); ctx.stroke()
  ctx.strokeStyle = ALERT_RED
  ctx.lineWidth = 2 * s
  ctx.beginPath(); ctx.moveTo(hx - ux * 16 * s, hy - uy * 16 * s); ctx.lineTo(hx - ux * 22 * s, hy - uy * 22 * s); ctx.stroke()
  ctx.restore()
}

function gunship(ctx: CanvasRenderingContext2D, x: number, y: number, litMidi: number | null, s: number): void {
  const px = 2 * s
  const lit = litMidi == null ? -1 : PIANO_KEYS.findIndex(k => k.midi === litMidi)
  const lc = litMidi == null ? WHITE : pitchColor(litMidi)
  const keyAt = (c: number) => c - GUNSHIP_KEY_COL0 === lit
  // exact sub-pixel x: no rounding (exempt from 4-px stepping)
  spr(ctx, GUNSHIP, {
    '#': WHITE,
    i: c => (keyAt(c) ? lc : WHITE),
    k: c => (keyAt(c) ? lc : null),
  }, x - (GUNSHIP[0].length * px) / 2, Math.round(y - (GUNSHIP.length * px) / 2), px)
}

function crt(ctx: CanvasRenderingContext2D, W: number, H: number, scanlines: boolean): void {
  if (scanlines) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y + 2, W, 1)
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, Math.max(W, H) * 0.9)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.6)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, W, H)
  // bezel: black outside a rounded screen
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.rect(0, 0, W, H)
  // old Safari (< 16) has no roundRect: fall back to a square bezel instead of throwing in the frame loop
  if (typeof ctx.roundRect === 'function') ctx.roundRect(1, 1, W - 2, H - 2, 10)
  else ctx.rect(1, 1, W - 2, H - 2)
  ctx.fill('evenodd')
}

export { drawBadge } from './badge'
export { pitchColor } from './palette'
export { LandStrip } from './LandStrip'
export { stepEffects, type Effect } from './effects'
