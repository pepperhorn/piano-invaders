import type { Difficulty } from '../song/types'

export const DIFFICULTY_MULT: Record<Difficulty, number> = { easy: 1, intermediate: 2, advanced: 3 }

export function totalScore(s: { score: number; hp: number; bpm: number; seconds: number; difficulty: Difficulty }): number {
  return Math.round(s.score * (s.hp / 100 + 1) * (s.bpm / 65) * (1 + s.seconds / 60) * DIFFICULTY_MULT[s.difficulty])
}

export interface ComboState { combo: number; maxCombo: number }

export function onHit(c: ComboState): ComboState {
  const combo = c.combo + 1
  return { combo, maxCombo: Math.max(c.maxCombo, combo) }
}

export function onLandHit(c: ComboState): ComboState {
  return { combo: 0, maxCombo: c.maxCombo }
}
