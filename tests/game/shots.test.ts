import { describe, it, expect } from 'vitest'
import { resolvePress, type LiveNote } from '../../src/game/shots'

const keyX = (m: number) => (m - 47) * 40
const n = (id: number, midi: number, y: number, group?: number, alive = true): LiveNote => ({ id, midi, x: keyX(midi), y, group, alive })

describe('resolvePress', () => {
  it('single note press -> move + straight', () => {
    const r = resolvePress(50, 0, keyX, [n(1, 50, 10)])
    expect(r).toEqual({ moveTo: keyX(50), shots: [{ noteId: 1, kind: 'straight', fromX: keyX(50) }] })
  })
  it('targets the lowest on screen (largest y) matching note', () => {
    const r = resolvePress(50, 0, keyX, [n(1, 50, 10), n(2, 50, 200)])
    expect(r.shots[0].noteId).toBe(2)
  })
  it('group, press near note -> straight at near', () => {
    const live = [n(1, 50, 10, 7), n(2, 60, 10, 7)]
    const r = resolvePress(50, keyX(50), keyX, live)
    expect(r.moveTo).toBe(keyX(50))
    expect(r.shots).toEqual([{ noteId: 1, kind: 'straight', fromX: keyX(50) }])
  })
  it('group, press far note first -> moveTo near key, explosive at far, near still alive', () => {
    const live = [n(1, 50, 10, 7), n(2, 60, 10, 7)]
    const r = resolvePress(60, keyX(50) + 5, keyX, live)
    expect(r.moveTo).toBe(keyX(50))
    expect(r.shots).toEqual([{ noteId: 2, kind: 'explosive', fromX: keyX(50) }])
    expect(live[0].alive).toBe(true)
    expect(r.shots.some(s => s.noteId === 1)).toBe(false)
  })
  it('group, near already shot, press far -> explosive from gunX, moveTo null', () => {
    const live = [n(1, 50, 10, 7, false), n(2, 60, 10, 7)]
    const r = resolvePress(60, 123, keyX, live)
    expect(r.moveTo).toBeNull()
    expect(r.shots).toEqual([{ noteId: 2, kind: 'explosive', fromX: 123 }])
  })
  it('wrong key -> no shots', () => {
    expect(resolvePress(55, 0, keyX, [n(1, 50, 10)])).toEqual({ moveTo: null, shots: [] })
  })
})
