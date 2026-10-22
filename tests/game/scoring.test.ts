import { describe, it, expect } from 'vitest'
import { totalScore, onHit, onLandHit } from '../../src/game/scoring'

describe('scoring', () => {
  it('totalScore matches the formula for a fixed case', () => {
    expect(totalScore({ score: 100, hp: 50, bpm: 65, seconds: 60, difficulty: 'intermediate' })).toBe(600)
  })
  it('combo increments on hit, resets on land hit, keeps max', () => {
    let c = { combo: 0, maxCombo: 0 }
    c = onHit(onHit(onHit(c)))
    expect(c).toEqual({ combo: 3, maxCombo: 3 })
    c = onLandHit(c)
    expect(c).toEqual({ combo: 0, maxCombo: 3 })
    c = onHit(c)
    expect(c).toEqual({ combo: 1, maxCombo: 3 })
  })
})
