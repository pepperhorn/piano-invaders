// Procedural 1-bit land strip (Phosphor '78): ground line, buildings with punched windows,
// trees and antennas on a 4-px cell grid. Ported from the board's genSkyline (B palette)
// and src/utils/LandStrip.js (bomb destruction). The strip is always LAND_ROWS cells tall;
// the cell size follows the height (32 px -> 4-px cells, 64 px -> 8-px cells).
import { WHITE } from './palette'

/** default strip height (board: 8 rows of 4-px cells) */
export const LAND_HEIGHT = 32
export const LAND_ROWS = 8

/** mulberry32 */
export function rng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generate(seed: number, cols: number, rows: number): boolean[][] {
  const R = rng(seed), base = rows - 2
  const g = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false))
  const set = (r: number, c: number, on = true) => { if (r >= 0 && r < rows && c >= 0 && c < cols) g[r][c] = on }
  const WIN = [false, false, true] // board B: win [null, null, 0] -> 2/3 punched holes
  const bld = (c0: number, bw: number, bh: number) => {
    for (let x = 0; x < bw; x++) for (let y = 0; y < bh; y++) {
      let on = true
      if (y !== bh - 1 && x > 0 && x < bw - 1 && y % 2 === 1) on = WIN[Math.floor(R() * WIN.length)]
      set(base - y, c0 + x, on)
    }
    if (bh >= 5 && R() < 0.45) set(base - bh, c0 + (bw >> 1))
  }
  const tree = (c: number) => {
    set(base, c + 1)
    for (let x = 0; x < 3; x++) { set(base - 1, c + x); set(base - 2, c + x) }
    set(base - 3, c + 1)
    return 4
  }
  for (let c = 0; c < cols; c++) set(rows - 1, c)
  let c = 0
  while (c < cols) {
    const r = R()
    if (r < 0.2) c += tree(c)
    else if (r < 0.28) c += 1 + ((R() * 2) | 0)
    else {
      const bw = 3 + ((R() * 5) | 0), bh = Math.min(base, 2 + ((R() * 5) | 0))
      bld(c, bw, bh)
      c += bw + (R() < 0.5 ? 1 : 0)
    }
  }
  return g
}

export class LandStrip {
  readonly cellSize: number
  readonly height: number
  readonly seed: number
  private width: number
  private rows: number
  private cols = 0
  private cells: boolean[][] = []
  /** cells destroyed by bombs (kept across resize) */
  private holes: boolean[][] = []

  constructor(width: number, height: number = LAND_HEIGHT, seed?: number) {
    this.width = width
    this.height = height
    this.rows = LAND_ROWS
    this.cellSize = Math.max(1, Math.round(height / LAND_ROWS))
    this.seed = seed ?? Math.floor(Math.random() * 0x7fffffff)
    this.build()
  }

  private build(): void {
    const cols = Math.max(1, Math.ceil(this.width / this.cellSize))
    const fresh = generate(this.seed, cols, this.rows)
    const holes = Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => (c < this.cols ? this.holes[r][c] : false)))
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < cols; c++) if (holes[r][c]) fresh[r][c] = false
    this.cols = cols
    this.cells = fresh
    this.holes = holes
  }

  resize(width: number): void {
    if (width === this.width) return
    this.width = width
    this.build()
  }

  /** Where a bomb dropped at `x` lands, in strip-local px: top edge of the column's highest solid cell. */
  impactPoint(x: number): { x: number; y: number } {
    const col = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cellSize)))
    for (let r = 0; r < this.rows; r++) if (this.cells[r][col]) return { x, y: r * this.cellSize }
    return { x, y: this.rows * this.cellSize }
  }

  /** Blast a crater: removes every cell whose centre is within `radius` px of the impact point. */
  bomb(x: number, radius: number): void {
    const p = this.impactPoint(x), h = this.cellSize / 2
    const c0 = Math.max(0, Math.floor((x - radius) / this.cellSize)), c1 = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize))
    for (let r = 0; r < this.rows; r++) for (let c = c0; c <= c1; c++) {
      if (Math.hypot(c * this.cellSize + h - p.x, r * this.cellSize + h - p.y) <= radius) {
        this.cells[r][c] = false
        this.holes[r][c] = true
      }
    }
  }

  snapshot(): boolean[][] {
    return this.cells.map(row => row.slice())
  }

  activeCount(): number {
    let n = 0
    for (const row of this.cells) for (const v of row) if (v) n++
    return n
  }

  draw(ctx: CanvasRenderingContext2D, top: number): void {
    ctx.fillStyle = WHITE
    for (let r = 0; r < this.rows; r++) {
      const row = this.cells[r]
      let c = 0
      while (c < this.cols) {
        if (!row[c]) { c++; continue }
        let e = c + 1
        while (e < this.cols && row[e]) e++
        ctx.fillRect(c * this.cellSize, top + r * this.cellSize, (e - c) * this.cellSize, this.cellSize)
        c = e
      }
    }
  }
}
