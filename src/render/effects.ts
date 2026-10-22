// Transient effects: B-style stepped explosions / bomb bursts, confetti, floating text.
import { BOMB_BURST, EXPLOSION, sprC } from './sprites'
import { CELLO_BOTTOM, CELLO_TOP, WHITE } from './palette'
import { rng } from './LandStrip'

export type Effect = {
  kind: 'explosion' | 'confetti' | 'text' | 'crater-flash'
  x: number; y: number
  /** age in seconds */
  t: number
  text?: string; color?: string
  /** explosive-bolt variant: larger explosion / extra confetti */
  big?: boolean
}

/** lifetime in seconds per kind */
export const EFFECT_LIFE: Record<Effect['kind'], number> = {
  explosion: 0.9,
  confetti: 1.3,
  text: 1.0,
  'crater-flash': 0.7,
}

export function stepEffects(effects: Effect[], dtSec: number): Effect[] {
  const out: Effect[] = []
  for (const e of effects) {
    const t = e.t + dtSec
    if (t < EFFECT_LIFE[e.kind]) out.push({ ...e, t })
  }
  return out
}

const GRAV = 300
const TAU = Math.PI * 2
const seedOf = (e: Effect) => (Math.round(e.x) * 73856093) ^ (Math.round(e.y) * 19349663)

function explosion(ctx: CanvasRenderingContext2D, e: Effect, s: number): void {
  const a = e.t, R = rng(seedOf(e)), big = !!e.big
  if (a < 0.35) sprC(ctx, EXPLOSION, { '#': WHITE }, e.x, e.y - 6 * s, (big ? 5 : 3) * s)
  if (a >= 0.9) return
  const q = Math.floor(a * 12) / 12, k = (big ? 1 : 0.7) * s, n = big ? 22 : 12, col = e.color ?? WHITE
  for (let i = 0; i < n; i++) {
    const ang = R() * TAU, sp = 40 + R() * 90, w = R()
    const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp - 20
    ctx.fillStyle = w < 0.5 ? WHITE : col
    ctx.fillRect(Math.round(e.x + vx * q * k), Math.round(e.y + vy * q * k + 120 * q * q * s), 2 * s, 2 * s)
  }
}

function craterFlash(ctx: CanvasRenderingContext2D, e: Effect, s: number): void {
  const a = e.t, R = rng(seedOf(e))
  if (a < 0.3) sprC(ctx, BOMB_BURST, { '#': WHITE }, e.x, e.y - 2 * s, 3 * s)
  if (a >= 0.7) return
  const q = Math.floor(a * 12) / 12
  ctx.fillStyle = WHITE
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (R() - 0.5) * 2.2, sp = 50 + R() * 110
    const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp
    ctx.fillRect(Math.round(e.x + vx * q * 0.6 * s), Math.round(e.y + vy * q * 0.6 * s + 140 * q * q * s), 2 * s, 2 * s)
  }
}

function confetti(ctx: CanvasRenderingContext2D, e: Effect, s: number): void {
  const a = e.t, life = EFFECT_LIFE.confetti
  if (a >= life) return
  const R = rng(seedOf(e) + 1), n = e.big ? 32 : 16
  const cols = [e.color ?? WHITE, WHITE, CELLO_TOP, CELLO_BOTTOM]
  ctx.save()
  ctx.globalAlpha = a > life * 0.6 ? 1 - (a - life * 0.6) / (life * 0.4) : 1
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (R() - 0.5) * 2.4, sp = (60 + R() * 110) * (e.big ? 1.3 : 1)
    const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp
    const rot0 = R() * TAU, spin = (R() - 0.5) * 18, ci = (R() * 6) | 0, pw = 2 + R() * 2, ph = 4 + R() * 4
    const px = e.x + vx * a * s, py = e.y + (vy * a + 0.5 * GRAV * a * a) * s, rot = rot0 + spin * a
    const w = pw * (0.35 + 0.65 * Math.abs(Math.cos(rot * 1.7))) * s
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(rot)
    ctx.fillStyle = cols[ci % cols.length]
    ctx.fillRect(-w / 2, (-ph * s) / 2, w, ph * s)
    ctx.restore()
  }
  ctx.restore()
}

function floatText(ctx: CanvasRenderingContext2D, e: Effect, s: number): void {
  if (!e.text || e.t >= EFFECT_LIFE.text) return
  const q = Math.floor(e.t * 10) / 10, y = Math.round(e.y - (30 + q * 22) * s)
  const lines = e.text.split('\n')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = e.color ?? WHITE
  lines.forEach((line, i) => {
    ctx.font = `${(i === 0 ? 10 : 7) * s}px "Press Start 2P", monospace`
    ctx.fillText(line, Math.round(e.x), y + (i === 0 ? 0 : (13 + (i - 1) * 10) * s))
  })
}

/** 'under' = drawn beneath the cellophane bands (bursts, debris, confetti); 'over' = floating text */
export function drawEffects(ctx: CanvasRenderingContext2D, effects: readonly Effect[], s: number, layer: 'under' | 'over'): void {
  for (const e of effects) {
    if (layer === 'over') { if (e.kind === 'text') floatText(ctx, e, s); continue }
    if (e.kind === 'explosion') explosion(ctx, e, s)
    else if (e.kind === 'crater-flash') craterFlash(ctx, e, s)
    else if (e.kind === 'confetti') confetti(ctx, e, s)
  }
}
