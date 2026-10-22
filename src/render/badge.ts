// Panel C "Neo-Arcade" note badge: glowing pitch-coloured disc, shaded highlight, bloom.
import { pitchColor, pitchName, rgba, shade } from './palette'

/** radial glow; `lighter` = additive */
export function halo(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hex: string, a: number, lighter = false): void {
  if (a <= 0 || r <= 0) return
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, rgba(hex, a))
  g.addColorStop(1, rgba(hex, 0))
  ctx.save()
  if (lighter) ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
  ctx.restore()
}

/** Standard note-letter style (stroke first, then fill), font scaled from the 22-px game radius. */
export function noteText(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, r: number): void {
  const size = Math.round(((20 * r) / 22) * 100) / 100
  ctx.save()
  ctx.shadowBlur = 0
  ctx.globalCompositeOperation = 'source-over'
  ctx.font = `600 ${size}px Poppins, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.strokeText(label, x, y)
  ctx.fillStyle = '#fff'
  ctx.fillText(label, x, y)
  ctx.restore()
}

export function drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, midi: number): void {
  if (r < 4) return
  const col = pitchColor(midi)
  halo(ctx, x, y, r + 10, col, 0.5, true)
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r)
  g.addColorStop(0, shade(col, 0.45))
  g.addColorStop(0.6, col)
  g.addColorStop(1, shade(col, -0.3))
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.stroke()
  noteText(ctx, pitchName(midi), x, y, r)
}
