// Pixel grids (data) + grid blitters. '#' = filled cell, '.' = empty.
import { PIANO_KEYS } from '../constants/gameConfig'
import { shade } from './palette'

export type Grid = readonly string[]
export type InvaderKind = 'squid' | 'crab' | 'octopus'
type Pal = Record<string, string | ((col: number, row: number) => string | null | undefined) | undefined>

/** Two animation frames per invader (board INV). */
export const INVADERS: Record<InvaderKind, readonly [Grid, Grid]> = {
  squid: [
    ['...##...', '..####..', '.######.', '##.##.##', '########', '..#..#..', '.#.##.#.', '#.#..#.#'],
    ['...##...', '..####..', '.######.', '##.##.##', '########', '.#.##.#.', '#......#', '.#....#.'],
  ],
  crab: [
    ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...'],
    ['..#.....#..', '#..#...#..#', '#.#######.#', '###.###.###', '###########', '.#########.', '..#.....#..', '.#.......#.'],
  ],
  octopus: [
    ['....####....', '.##########.', '############', '###..##..###', '############', '...##..##...', '..##.##.##..', '##........##'],
    ['....####....', '.##########.', '############', '###..##..###', '############', '..###..###..', '.##..##..##.', '..##....##..'],
  ],
}

/** Phosphor '78 mothership (board UFO_B). */
export const MOTHERSHIP: Grid = [
  '.....######.....', '...##########...', '..############..', '.##.##.##.##.##.',
  '################', '..###..##..###..', '...#........#...',
]

/** 18-key strip used inside the gunship: 'i' = white key, 'k' = black key */
const KEYS18 = PIANO_KEYS.map(k => (k.type === 'white' ? 'i' : 'k')).join('')
/** Column offset of key 0 inside the GUNSHIP keyboard rows */
export const GUNSHIP_KEY_COL0 = 1
export const GUNSHIP_KEY_ROWS = [6, 7] as const

/** Phosphor '78 gunship (board SHIP_B); rows 6–7 carry the 18-key strip ('i'/'k'). */
export const GUNSHIP: Grid = [
  '..........#..........', '.........###.........', '.........###.........', '..#################..',
  '.###################.', '#####################', '#' + KEYS18 + '##', '#' + KEYS18 + '##', '#####################',
]

export const EXPLOSION: Grid = [
  '....#...#....', '.#...#.#...#.', '..#.......#..', '...#.....#...',
  '##.........##', '...#.....#...', '..#..#.#..#..', '.#..#...#..#.',
]

export const BOMB_BURST: Grid = ['..#..#..', '#..##..#', '.######.', '##.##.##', '.######.', '#..##..#', '..#..#..']

/** pixel grid -> fillRect, merging horizontal runs; palette values may be fn(col,row) */
export function spr(ctx: CanvasRenderingContext2D, rows: Grid, pal: Pal, x: number, y: number, px: number): void {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    let c = 0
    while (c < row.length) {
      const ch = row[c], col = pal[ch]
      if (ch === '.' || col == null) { c++; continue }
      if (typeof col === 'function') {
        const v = col(c, r)
        if (v) { ctx.fillStyle = v; ctx.fillRect(x + c * px, y + r * px, px, px) }
        c++
        continue
      }
      let e = c + 1
      while (e < row.length && row[e] === ch) e++
      ctx.fillStyle = col
      ctx.fillRect(x + c * px, y + r * px, (e - c) * px, px)
      c = e
    }
  }
}

/** centred blit, top-left snapped to whole pixels */
export function sprC(ctx: CanvasRenderingContext2D, rows: Grid, pal: Pal, cx: number, cy: number, px: number): void {
  spr(ctx, rows, pal, Math.round(cx - (rows[0].length * px) / 2), Math.round(cy - (rows.length * px) / 2), px)
}

/** Panel A "Marquee" invader: pitch-tinted body, lit top rows, shaded bottom rows, 1-px outline. */
export function drawInvader(
  ctx: CanvasRenderingContext2D, kind: InvaderKind, frame: 0 | 1, cx: number, cy: number, px: number, base: string,
): void {
  const rows = INVADERS[kind][frame]
  const x = Math.round(cx - (rows[0].length * px) / 2), y = Math.round(cy - (rows.length * px) / 2)
  const o = { '#': '#0a0c22' }
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) spr(ctx, rows, o, x + dx, y + dy, px)
  const hi = shade(base, 0.45), lo = shade(base, -0.3), last = rows.length - 2
  // row bands, so the base colour is a merged solid run like the board's
  const bands: [number, number, string][] = [[0, 2, hi], [2, last, base], [last, rows.length, lo]]
  for (const [r0, r1, col] of bands) spr(ctx, rows.slice(r0, r1), { '#': col }, x, y + r0 * px, px)
}
