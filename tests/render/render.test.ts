import { describe, it, expect } from 'vitest'
import { drawFrame, type FrameState } from '../../src/render/drawFrame'
import { drawBadge } from '../../src/render/badge'
import { pitchColor } from '../../src/render/palette'
import { LandStrip } from '../../src/render/LandStrip'
import { stepEffects, type Effect } from '../../src/render/effects'

type MockCtx = CanvasRenderingContext2D & {
  __getEvents(): { type: string; props: Record<string, unknown> }[]
  __getDrawCalls(): { type: string; props: Record<string, unknown> }[]
  __clearEvents(): void
}

function makeCtx(w = 640, h = 400): MockCtx {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return c.getContext('2d') as MockCtx
}

const keyX = (m: number) => 20 + (m - 47) * 34

function frame(over: Partial<FrameState> = {}): FrameState {
  return {
    width: 640, height: 324, landTop: 260, dpr: 1,
    ufoX: 320, ufoDropFlash: 0,
    notes: [],
    gunship: { x: 320, v: 0, targetX: 320 }, litMidi: null,
    bolts: [], effects: [], land: new LandStrip(640, 32, 1), flash: 0, shake: { x: 0, y: 0 },
    scanlines: true, laneGuides: true, keyX,
    ...over,
  }
}

/** fillStyle value in effect at each fillRect, in order */
function fillRectColors(ctx: MockCtx): string[] {
  const out: string[] = []
  let cur = ''
  for (const e of ctx.__getEvents()) {
    if (e.type === 'fillStyle') cur = String(e.props.value)
    if (e.type === 'fillRect') out.push(cur)
  }
  return out
}

describe('drawFrame', () => {
  it('runs without throwing for an empty and a busy frame', () => {
    const ctx = makeCtx()
    expect(() => drawFrame(ctx, frame())).not.toThrow()
    const land = new LandStrip(640, 32, 3)
    land.bomb(200, 20)
    const effects: Effect[] = [
      { kind: 'explosion', x: 100, y: 150, t: 0.1, color: pitchColor(60) },
      { kind: 'explosion', x: 140, y: 150, t: 0.2, color: pitchColor(61), big: true },
      { kind: 'confetti', x: 100, y: 150, t: 0.3, color: pitchColor(60) },
      { kind: 'text', x: 100, y: 120, t: 0.2, text: '+10', color: '#fff' },
      { kind: 'crater-flash', x: 200, y: 262, t: 0.05 },
    ]
    const busy = frame({
      dpr: 2, ufoX: 133.7, ufoDropFlash: 0.6, litMidi: 60, flash: 0.5, shake: { x: 2, y: -1 }, land, effects,
      gunship: { x: 211.3, v: 40, targetX: 250 },
      notes: [
        { id: 1, midi: 60, x: 90.5, y: 120.2, alive: true, invader: 'squid' },
        { id: 2, midi: 54, x: 300, y: 200, alive: true, invader: 'crab', group: 3 },
        { id: 3, midi: 52, x: 400, y: 80, alive: true, invader: 'octopus', group: 3 },
      ],
      bolts: [
        { x0: 300, y0: 290, x1: 300, y1: 210, t: 0.5, kind: 'straight' },
        { x0: 300, y0: 290, x1: 400, y1: 90, t: 0.05, kind: 'explosive' },
      ],
    })
    expect(() => drawFrame(ctx, busy)).not.toThrow()
    expect(() => drawFrame(ctx, { ...busy, scanlines: false, laneGuides: false })).not.toThrow()
  })

  it('invader sprite fill uses pitchColor(midi)', () => {
    const ctx = makeCtx()
    drawFrame(ctx, frame({ notes: [{ id: 1, midi: 60, x: 200, y: 150, alive: true, invader: 'squid' }] }))
    expect(fillRectColors(ctx)).toContain(pitchColor(60))
    // and a different pitch class does not leak in
    expect(fillRectColors(ctx)).not.toContain(pitchColor(54))
  })
})

describe('drawBadge', () => {
  it("sets font '600 20px Poppins, sans-serif' at r=22 and strokes before fill", () => {
    const ctx = makeCtx()
    ctx.__clearEvents()
    drawBadge(ctx, 50, 50, 22, 60)
    const ev = ctx.__getEvents()
    const fontEv = ev.filter(e => e.type === 'font')
    expect(fontEv.length).toBeGreaterThan(0)
    expect(String(fontEv[fontEv.length - 1].props.value)).toMatch(/^600 20px Poppins, sans-serif$/)
    const strokeIdx = ev.findIndex(e => e.type === 'strokeText')
    const fillIdx = ev.findIndex(e => e.type === 'fillText')
    expect(strokeIdx).toBeGreaterThan(-1)
    expect(fillIdx).toBeGreaterThan(strokeIdx)
    expect(ev[strokeIdx].props.text).toBe('C')
    expect(ev[fillIdx].props.text).toBe('C')
    // style at the moment of the text calls
    const before = (i: number, type: string) => { for (let k = i; k >= 0; k--) if (ev[k].type === type) return ev[k].props.value; return undefined }
    expect(before(strokeIdx, 'lineWidth')).toBe(3)
    expect(before(strokeIdx, 'strokeStyle')).toBe('rgba(0, 0, 0, 0.35)')
    expect(before(fillIdx, 'fillStyle')).toBe('#ffffff')
    expect(before(fillIdx, 'textAlign')).toBe('center')
    expect(before(fillIdx, 'textBaseline')).toBe('middle')
  })

  it('scales font size with radius (20 * r / 22)', () => {
    const ctx = makeCtx()
    drawBadge(ctx, 50, 50, 11, 61)
    const fontEv = ctx.__getEvents().filter(e => e.type === 'font')
    expect(String(fontEv[fontEv.length - 1].props.value)).toMatch(/^600 10px Poppins, sans-serif$/)
  })
})

describe('pitchColor', () => {
  it('pitchColor(60) === pitchColor(72)', () => {
    expect(pitchColor(60)).toBe(pitchColor(72))
    expect(pitchColor(60)).not.toBe(pitchColor(61))
  })
})

describe('LandStrip', () => {
  it('bomb removes pixels within radius only', () => {
    const land = new LandStrip(320, 32, 7)
    const before = land.snapshot()
    const x = 160, r = 20
    const impact = land.impactPoint(x)
    land.bomb(x, r)
    const after = land.snapshot()
    const cell = land.cellSize
    let removed = 0
    for (let row = 0; row < before.length; row++) {
      for (let col = 0; col < before[row].length; col++) {
        const cx = col * cell + cell / 2, cy = row * cell + cell / 2
        const inside = Math.hypot(cx - impact.x, cy - impact.y) <= r
        if (inside) { expect(after[row][col]).toBe(false); if (before[row][col]) removed++ }
        else expect(after[row][col]).toBe(before[row][col])
      }
    }
    expect(removed).toBeGreaterThan(0)
  })

  it('repeat bombs dig deeper (impact follows the surface)', () => {
    const land = new LandStrip(320, 32, 7)
    const y0 = land.impactPoint(160).y
    land.bomb(160, 12)
    expect(land.impactPoint(160).y).toBeGreaterThan(y0)
  })

  it('resize keeps craters in the overlapping columns', () => {
    const land = new LandStrip(320, 32, 7)
    land.bomb(100, 16)
    const a = land.snapshot()
    land.resize(480)
    const b = land.snapshot()
    expect(b[0].length).toBe(120)
    for (let row = 0; row < a.length; row++) for (let col = 0; col < a[row].length; col++) expect(b[row][col]).toBe(a[row][col])
  })
})

describe('stepEffects', () => {
  it('drops finished effects', () => {
    const fx: Effect[] = [
      { kind: 'explosion', x: 0, y: 0, t: 0 },
      { kind: 'text', x: 0, y: 0, t: 0, text: '+10' },
      { kind: 'crater-flash', x: 0, y: 0, t: 0 },
      { kind: 'confetti', x: 0, y: 0, t: 0 },
    ]
    const a = stepEffects(fx, 0.1)
    expect(a).toHaveLength(4)
    expect(a[0].t).toBeCloseTo(0.1)
    expect(fx[0].t).toBe(0) // pure
    const b = stepEffects(a, 5)
    expect(b).toHaveLength(0)
  })
})
