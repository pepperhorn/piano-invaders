import { describe, it, expect } from 'vitest'
import { padCountIn } from '../../src/song/pad'
import type { GameSong } from '../../src/song/types'

const song = (o: Partial<GameSong> = {}): GameSong => ({
  id: 's', title: 'S', bpm: 80, beatsPerBar: 4, difficulty: 'easy', source: 'musicxml', voices: {}, lengthBeats: 16,
  targets: [{ id: 0, beat: 0, midi: 60, durBeats: 1 }, { id: 1, beat: 14, midi: 62, durBeats: 2 }],
  accompaniment: [{ beat: 0, midi: 48, durBeats: 4, velocity: 80, voice: 'lh' }],
  ...o,
})

describe('padCountIn', () => {
  it('shifts a beat-1 song two bars later and marks the rest as its count-in', () => {
    const p = padCountIn(song())
    expect(p.targets.map(t => t.beat)).toEqual([8, 22])
    expect(p.accompaniment[0].beat).toBe(8)
    expect(p.lengthBeats).toBe(24)
    expect(p.countInBeats).toBe(8)
  })

  it('tops up a one-bar rest to two whole bars', () => {
    const p = padCountIn(song({ targets: [{ id: 0, beat: 5, midi: 60, durBeats: 1 }], accompaniment: [] }))
    expect(p.targets[0].beat).toBe(9)
    expect(p.lengthBeats).toBe(20)
  })

  it('leaves a song that already rests two bars alone', () => {
    const s = song({ targets: [{ id: 0, beat: 8, midi: 60, durBeats: 1 }], accompaniment: [] })
    const p = padCountIn(s)
    expect(p.targets).toEqual(s.targets)
    expect(p.lengthBeats).toBe(16)
    expect(p.countInBeats).toBe(8)
  })

  it('pads in the opening metre and shifts later time-signature changes', () => {
    const p = padCountIn(song({ beatsPerBar: 3, timeSigChanges: [{ beat: 0, beatsPerBar: 3 }, { beat: 12, beatsPerBar: 4 }] }))
    expect(p.targets[0].beat).toBe(6)
    expect(p.countInBeats).toBe(6)
    expect(p.timeSigChanges).toEqual([{ beat: 0, beatsPerBar: 3 }, { beat: 6, beatsPerBar: 3 }, { beat: 18, beatsPerBar: 4 }])
  })
})
