import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { render, cleanup, screen, waitFor, act, within } from '@testing-library/react'

vi.mock('smplr', () => {
  const inst = () => ({ ready: Promise.resolve(), start: vi.fn(), stop: vi.fn() })
  return {
    SplendidGrandPiano: vi.fn(inst), Soundfont: vi.fn(inst), DrumMachine: vi.fn(inst),
    getDrumMachineNames: () => [], getSoundfontNames: () => [],
  }
})

vi.mock('../../src/audio/AudioEngine', () => ({
  AudioEngine: class {
    onError?: unknown
    load = vi.fn(async () => {})
    setPlayerVoice = vi.fn()
    playPlayer = vi.fn()
    scheduleAccomp = vi.fn()
    metronomeTick = vi.fn()
    sfx = vi.fn()
    stopAll = vi.fn()
    dispose = vi.fn()
  },
}))

import PianoInvaders from '../../src/components/PianoInvaders'

const fx = (n: string) => path.join(__dirname, '../fixtures', n)

class FakeResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe(target: Element) {
    this.cb([{ target, contentRect: { width: 600, height: 400 } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const legacy = { name: 'Tiny Tune', bpm: 70, melody: ['C3', 'D3', 'E3', 'F3'] }

describe('PianoInvaders', () => {
  it('renders in a 600×400 container without touching document.documentElement.style', async () => {
    const before = document.documentElement.style.cssText
    const setProp = vi.spyOn(document.documentElement.style, 'setProperty')
    const { container } = render(
      <div className="host" style={{ width: 600, height: 400 }}>
        <PianoInvaders songs={[legacy]} />
      </div>,
    )
    const root = container.querySelector('.piano-invaders') as HTMLElement
    expect(root).toBeTruthy()
    expect(root.tabIndex).toBe(0)
    expect(root.querySelector('canvas')).toBeTruthy()
    expect(root.querySelectorAll('[data-midi]')).toHaveLength(18)
    await waitFor(() => expect(within(root.querySelector('.pi-start') as HTMLElement).getByText('Tiny Tune')).toBeTruthy())
    expect(setProp).not.toHaveBeenCalled()
    expect(document.documentElement.style.cssText).toBe(before)
  })

  it('musicXml prop → single-song start screen shows the title from the file', async () => {
    const xml = fs.readFileSync(fx('grand-staff-plus-violin.musicxml'), 'utf8')
      .replace('<score-partwise version="4.0">', '<score-partwise version="4.0"><work><work-title>Test Tune</work-title></work>')
    const { container } = render(<PianoInvaders musicXml={xml} difficulty={3} />)
    await waitFor(() => expect(container.querySelector('.pi-start-single-title')?.textContent).toBe('Test Tune'))
    expect(container.querySelector('.pi-barrel')).toBeNull()
    expect(container.querySelector('.pi-btn-import')).toBeNull()
    expect(screen.getByText(/intermediate/i)).toBeTruthy()
    expect(container.querySelector('.pi-btn-start')).toBeTruthy()
    expect(container.querySelector('.pi-btn-rules')).toBeTruthy()
  })

  it('invalid musicXml → onError called once with score-parse and an error panel, no throw', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onError = vi.fn()
    render(<PianoInvaders musicXml="this is not a score" onError={onError} />)
    await screen.findByText(/Couldn't load this score/i)
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toMatchObject({ code: 'score-parse' })
    expect(typeof onError.mock.calls[0][0].message).toBe('string')
    expect(warn.mock.calls.filter(c => String(c[0]).startsWith('[piano-invaders] score-parse:'))).toHaveLength(1)
  })

  it('songs prop with a dottl object shows it in the picker', async () => {
    const dottl = JSON.parse(fs.readFileSync(fx('odetojoy-accomp-v5-3.dottl'), 'utf8'))
    const { container } = render(<PianoInvaders songs={[legacy, dottl]} />)
    await waitFor(() => expect(within(container.querySelector('.pi-barrel') as HTMLElement).getByText('Ode To Joy')).toBeTruthy())
    expect(container.querySelector('.pi-barrel')).toBeTruthy()
    await waitFor(() => expect(container.querySelectorAll('.pi-barrel-item.is-song')).toHaveLength(2))
  })
})
