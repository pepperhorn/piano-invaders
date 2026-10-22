import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import GameOver from '../../src/components/GameOver'
import type { GameEnd } from '../../src/game/useGame'

afterEach(() => cleanup())

const stats = {
  score: 100, hp: 50, bpm: 65, seconds: 60, total: 600, song: 'Tune', difficulty: 'easy', accuracy: 90, maxCombo: 4, wasQuit: false,
} as unknown as GameEnd

describe('GameOver', () => {
  it('double-submitting the name inserts one leaderboard entry', async () => {
    let release: (() => void) | null = null
    const loadBoard = vi.fn(() => new Promise<[]>(r => { release = () => r([]) }))
    const saveBoard = vi.fn(async () => {})
    const { container } = render(<GameOver stats={stats} loadBoard={loadBoard} saveBoard={saveBoard} onRestart={() => {}} />)
    fireEvent.change(container.querySelector('.pi-name-input') as HTMLInputElement, { target: { value: 'abc' } })
    const form = container.querySelector('.pi-name-entry') as HTMLFormElement
    fireEvent.submit(form)
    fireEvent.submit(form)
    await act(async () => { release?.(); await Promise.resolve() })
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    expect(loadBoard).toHaveBeenCalledTimes(1)
    expect(saveBoard).toHaveBeenCalledTimes(1)
    expect((saveBoard.mock.calls[0] as unknown[])[0]).toHaveLength(1)
  })
})
