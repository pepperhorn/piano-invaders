import { describe, it, expect, vi } from 'vitest'
import { GameSession, PX_PER_BEAT, beatInBar, type Clock, type GameAudio, type GameSettings } from '../../src/game/useGame'
import { LandStrip } from '../../src/render/LandStrip'
import type { GameSong, Target } from '../../src/song/types'

function fakeClock() {
  let t = 0
  const clock: Clock = { now: () => t, toAudio: s => s, tick: () => {} }
  return { clock, set: (v: number) => { t = v }, get: () => t }
}
const audio = (): GameAudio & Record<string, ReturnType<typeof vi.fn>> => ({
  playPlayer: vi.fn(), scheduleAccomp: vi.fn(), metronomeTick: vi.fn(), sfx: vi.fn(), stopAll: vi.fn(),
})
const settings = (o: Partial<GameSettings> = {}) => () => ({ metronome: true, countIn: true, accomp: true, reducedMotion: true, scanlines: false, ...o })
const keyX = (m: number) => (m - 47) * 30 + 20

function song(targets: Target[], extra: Partial<GameSong> = {}): GameSong {
  return {
    id: 't', title: 'T', bpm: 60, beatsPerBar: 4, difficulty: 'easy', targets, source: 'dottl', lengthBeats: 8,
    accompaniment: [{ beat: 0, midi: 40, durBeats: 1, velocity: 80, voice: 'b' }], voices: {}, ...extra,
  }
}

function session(targets: Target[], o: { countIn?: boolean; width?: number; height?: number } = {}) {
  const c = fakeClock()
  const a = audio()
  const s = new GameSession({
    song: song(targets), bpm: 60, clock: c.clock, audio: a, settings: settings({ countIn: o.countIn ?? true }), keyX,
    width: o.width ?? 640, height: o.height ?? 600, land: new LandStrip(o.width ?? 640, 32, 1), random: () => 0.5,
  })
  /** advance to absolute song beat b (60 bpm: 1 beat = 1 s) in small frames */
  const toBeat = (b: number) => {
    const target = b + s.leadInBeats
    while (c.get() < target - 1e-9) { c.set(Math.min(target, c.get() + 1 / 60)); s.step() }
  }
  return { s, c, a, toBeat }
}

describe('GameSession', () => {
  it('a note spawns fallBeats before its beat and is on the hit line at its beat', () => {
    const { s, toBeat } = session([{ id: 0, beat: 4, midi: 50, durBeats: 1 }])
    const fall = s.fallBeats()
    toBeat(4 - fall - 0.1)
    expect(s.notes).toHaveLength(0)
    toBeat(4 - fall + 0.05)
    expect(s.notes).toHaveLength(1)
    const y0 = s.notes[0].y
    toBeat(4)
    const y1 = s.notes[0].y
    expect(y1 - y0).toBeCloseTo((fall - 0.05) * PX_PER_BEAT, 0)
  })

  it('count-in: leads in two bars and ticks bar 1 on 1 and 3, bar 2 on every beat', () => {
    const { s, a, toBeat } = session([{ id: 0, beat: 0, midi: 50, durBeats: 1 }], { height: 400 })
    expect(s.leadInBeats).toBe(8)
    toBeat(-0.5)
    expect(a.metronomeTick).toHaveBeenCalledTimes(6)
  })

  it('a missed note bombs the land, costs 5 HP, resets combo and leaves the live list at once (R10)', () => {
    const { s, toBeat } = session([{ id: 0, beat: 0, midi: 50, durBeats: 1 }, { id: 1, beat: 1, midi: 52, durBeats: 1 }])
    toBeat(-0.2)
    s.press(50)
    expect(s.combo.combo).toBe(1)
    toBeat(4)
    expect(s.hp).toBe(95)
    expect(s.combo).toEqual({ combo: 0, maxCombo: 1 })
    expect(s.notes.find(n => n.midi === 52)).toBeUndefined()
    expect(s.land.activeCount()).toBeLessThan(new LandStrip(640, 32, 1).activeCount())
  })

  it('chord: second press is explosive only when its anchor was actually shot (R9)', () => {
    // gun starts at x=320: keyX(57)=320 is the anchor, 47 is the far note
    const { s, toBeat } = session([{ id: 0, beat: 0, midi: 47, durBeats: 1, group: 1 }, { id: 1, beat: 0, midi: 57, durBeats: 1, group: 1 }])
    toBeat(-0.3)
    const first = s.press(57)
    expect(first).toEqual([{ noteId: expect.any(Number), kind: 'straight', fromX: 320 }])
    toBeat(-0.1) // the bolt has arrived: anchor is dead but kept for its group
    expect(s.notes.filter(n => n.midi === 57)).toHaveLength(1)
    const second = s.press(47)
    expect(second[0].kind).toBe('explosive')
    toBeat(0.2)
    expect(s.notes).toHaveLength(0)
    expect(s.score).toBe(20)
  })

  it('chord: if the anchor landed, the other member is a plain straight shot', () => {
    const { s, toBeat } = session([
      { id: 0, beat: 0, midi: 47, durBeats: 1, group: 1 }, { id: 1, beat: 0, midi: 57, durBeats: 1, group: 1 },
    ])
    toBeat(-0.3)
    // shoot the far note first: gunship goes to the anchor key and fires explosive at the far note
    const first = s.press(47)
    expect(first[0].kind).toBe('explosive')
    expect(s.gun.targetX).toBe(keyX(57))
  })

  it('wrong keys play but score nothing and keep the combo', () => {
    const { s, a, toBeat } = session([{ id: 0, beat: 0, midi: 50, durBeats: 1 }, { id: 1, beat: 1, midi: 50, durBeats: 1 }])
    toBeat(-0.2)
    s.press(50)
    expect(s.press(60)).toEqual([])
    expect(a.playPlayer).toHaveBeenCalledWith(60)
    expect(s.combo.combo).toBe(1)
  })

  it('setBpm mid-song keeps the beat continuous', () => {
    const { s, c, toBeat } = session([{ id: 0, beat: 6, midi: 50, durBeats: 1 }])
    toBeat(2)
    const before = s.transport.beatAt(c.get())
    s.setBpm(120)
    expect(s.transport.beatAt(c.get())).toBeCloseTo(before, 6)
    expect(s.bpm).toBe(120)
  })

  it('HP 0 ends the session; stats carry max combo and the TOTAL formula', () => {
    const t: Target[] = Array.from({ length: 8 }, (_, i) => ({ id: i, beat: i, midi: 50, durBeats: 1 }))
    const { s, toBeat } = session(t)
    for (let b = 0; b < 200 && !s.ended; b++) toBeat(b)
    expect(s.ended).toBe(true)
    expect(s.hp).toBe(0)
    const st = s.stats(false)
    expect(st.total).toBe(0)
    expect(st.maxCombo).toBe(0)
  })

  it('beatInBar honours time-signature changes', () => {
    const sg = { beatsPerBar: 4, timeSigChanges: [{ beat: 8, beatsPerBar: 3 }] }
    expect(beatInBar(sg, 4)).toEqual({ idx: 0, bpb: 4 })
    expect(beatInBar(sg, 11)).toEqual({ idx: 0, bpb: 3 })
    expect(beatInBar(sg, 13)).toEqual({ idx: 2, bpb: 3 })
  })
})

describe('GameSession clock gaps', () => {
  it('a 20 s jump (hidden tab) is skipped: no HP loss, no note burst, no past-time audio', async () => {
    const { makeClock } = await import('../../src/game/useGame')
    const ctx = { currentTime: 0, state: 'running' }
    const clock = makeClock(ctx)
    const a = audio()
    const t: Target[] = Array.from({ length: 8 }, (_, i) => ({ id: i, beat: i, midi: 50, durBeats: 1 }))
    const s = new GameSession({
      song: song(t), bpm: 60, clock, audio: a, settings: settings({ countIn: false }), keyX,
      width: 640, height: 600, land: new LandStrip(640, 32, 1), random: () => 0.5,
    })
    const frame = () => { ctx.currentTime += 1 / 60; s.step() }
    for (let i = 0; i < 30; i++) frame()
    const beatBefore = s.transport.beatAt(clock.now())
    const notesBefore = s.notes.length
    vi.mocked(a.metronomeTick).mockClear(); vi.mocked(a.scheduleAccomp).mockClear()
    ctx.currentTime += 20 // tab hidden for 20 s
    frame()
    expect(s.hp).toBe(100)
    expect(s.ended).toBe(false)
    expect(s.transport.beatAt(clock.now()) - beatBefore).toBeLessThan(0.1)
    expect(s.notes.length - notesBefore).toBeLessThanOrEqual(1)
    const times = [...vi.mocked(a.metronomeTick).mock.calls.map(c => c[0]), ...vi.mocked(a.scheduleAccomp).mock.calls.map(c => c[1])]
    expect(times.length).toBeLessThanOrEqual(2)
    for (const w of times) expect(w).toBeGreaterThanOrEqual(ctx.currentTime - 1e-6)
  })
})
