import { describe, it, expect } from 'vitest'
import { stepGunship, isSettled, GUNSHIP_SETTLE_MS, type GunshipState } from '../../src/game/gunship'

function run(s: GunshipState, totalSec: number, dt: number): GunshipState {
  const n = Math.round(totalSec / dt)
  for (let i = 0; i < n; i++) s = stepGunship(s, dt)
  return s
}

describe('gunship spring', () => {
  for (const fps of [60, 144]) {
    it(`settles within ${GUNSHIP_SETTLE_MS} ms from 300 px away at ${fps} fps, no overshoot`, () => {
      const dt = 1 / fps
      let s: GunshipState = { x: 0, v: 0, targetX: 300 }
      const steps = Math.ceil((GUNSHIP_SETTLE_MS / 1000) / dt)
      for (let i = 0; i < steps; i++) {
        s = stepGunship(s, dt)
        expect(s.x).toBeLessThanOrEqual(300 + 1e-9)
      }
      expect(isSettled(s)).toBe(true)
    })
  }
  it('same total time with dt=1/30 vs 1/240 gives the same x within 0.5 px', () => {
    const a = run({ x: 0, v: 0, targetX: 300 }, 0.05, 1 / 30 * 1.5)
    const b = run({ x: 0, v: 0, targetX: 300 }, 0.05, 1 / 240 * 1.2)
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.5)
    const c = run({ x: 0, v: 0, targetX: 300 }, 1 / 3, 1 / 30)
    const d = run({ x: 0, v: 0, targetX: 300 }, 1 / 3, 1 / 240)
    expect(Math.abs(c.x - d.x)).toBeLessThan(0.5)
    const e = run({ x: 0, v: 0, targetX: 300 }, 0.1, 1 / 30 * 0.6)
    const f = run({ x: 0, v: 0, targetX: 300 }, 0.1, 1 / 240 * 1.2)
    expect(Math.abs(e.x - f.x)).toBeLessThan(0.5)
  })
  it('retarget mid-glide moves smoothly (v continuous)', () => {
    let s: GunshipState = { x: 0, v: 0, targetX: 300 }
    s = run(s, 0.03, 1 / 240)
    const before = s
    expect(before.v).toBeGreaterThan(0)
    const after = stepGunship({ ...s, targetX: 100 }, 1 / 1000)
    expect(Math.abs(after.v - before.v)).toBeLessThan(Math.abs(before.v) * 0.5)
    expect(Math.abs(after.x - before.x - before.v / 1000)).toBeLessThan(1)
  })
  it('dt=0 is a no-op', () => {
    const s = { x: 5, v: 3, targetX: 9 }
    expect(stepGunship(s, 0)).toEqual(s)
  })
})
