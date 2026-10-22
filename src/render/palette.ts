// Phosphor '78 palette + the shared 12-colour pitch-class map (arcade-refresh board).

export const WHITE = '#f2f2f2'
export const BLACK = '#000'
/** red cellophane band (top) */
export const CELLO_TOP = '#ff2d6a'
/** green cellophane band (bottom) */
export const CELLO_BOTTOM = '#33ff66'
export const ALERT_RED = '#ff3040'

export const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export const PITCH_COLORS: Record<(typeof PITCH_NAMES)[number], string> = {
  C: '#ff4141', 'C#': '#ff7633', D: '#ffa424', 'D#': '#ffcf26', E: '#c9e02a', F: '#45d866',
  'F#': '#1fcfa6', G: '#26bdf2', 'G#': '#3f86ff', A: '#6d62ff', 'A#': '#a54cff', B: '#f24fc6',
}

const pc = (midi: number) => ((Math.round(midi) % 12) + 12) % 12

export function pitchName(midi: number): string {
  return PITCH_NAMES[pc(midi)]
}

export function pitchColor(midi: number): string {
  return PITCH_COLORS[PITCH_NAMES[pc(midi)]]
}

export function hex2rgb(h: string): [number, number, number] {
  const s = h.replace('#', '')
  const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)]
}

/** f > 0 lightens toward white, f < 0 darkens toward black */
export function shade(h: string, f: number): string {
  const [r, g, b] = hex2rgb(h)
  const m = f >= 0 ? (c: number) => Math.round(c + (255 - c) * f) : (c: number) => Math.round(c * (1 + f))
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

export function rgba(h: string, a: number): string {
  const [r, g, b] = hex2rgb(h)
  return `rgba(${r},${g},${b},${a})`
}
