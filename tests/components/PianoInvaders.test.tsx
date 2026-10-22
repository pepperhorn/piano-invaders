import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { render, cleanup, screen, waitFor, act, within, fireEvent } from '@testing-library/react'

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

vi.mock('../../src/audio/context', async (orig) => ({
  ...(await orig<typeof import('../../src/audio/context')>()),
  resumeAudio: vi.fn(async () => {}),
}))

import PianoInvaders from '../../src/components/PianoInvaders'
import { resumeAudio } from '../../src/audio/context'

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
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))) // no network in tests; OpenSongs index stays pending unless a test overrides
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

  describe('OpenSongs roller', () => {
    const index = JSON.parse(fs.readFileSync(fx('opensongs-index.json'), 'utf8'))
    const stubIndex = (body: unknown) =>
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })))
    const titles = (c: HTMLElement) => [...c.querySelectorAll('.pi-barrel-item.is-song .pi-barrel-name')].map(n => n.textContent)

    it('picker shows bundled songs then OpenSongs titles', async () => {
      stubIndex(index)
      const { container } = render(<PianoInvaders songs={[legacy]} />)
      await waitFor(() => expect(titles(container)).toHaveLength(5))
      expect(titles(container)).toEqual([
        'Tiny Tune', 'Hot Cross Buns', 'Old MacDonald Had a Farm', 'Scarborough Fair', 'Caprice No. 24 (theme)',
      ])
    })

    it('shows a loading row while the index loads', async () => {
      const { container } = render(<PianoInvaders songs={[legacy]} />)
      await waitFor(() => expect(container.querySelector('.pi-barrel-loading')).toBeTruthy())
      expect(titles(container)).toEqual(['Tiny Tune'])
    })

    it('difficulty filter narrows the roller', async () => {
      stubIndex(index)
      const { container } = render(<PianoInvaders songs={[legacy]} />)
      await waitFor(() => expect(titles(container)).toHaveLength(5))
      const pill = (n: string) => container.querySelector(`.pi-filter-${n}`) as HTMLElement
      act(() => pill('advanced').click())
      expect(titles(container)).toEqual(['Caprice No. 24 (theme)'])
      expect(pill('advanced').getAttribute('aria-pressed')).toBe('true')
      expect(pill('all').getAttribute('aria-pressed')).toBe('false')
      act(() => pill('intermediate').click())
      expect(titles(container)).toEqual(['Scarborough Fair'])
      act(() => pill('easy').click())
      expect(titles(container)).toEqual(['Tiny Tune', 'Hot Cross Buns', 'Old MacDonald Had a Farm'])
      act(() => pill('all').click())
      expect(titles(container)).toHaveLength(5)
    })

    it('opensongs={false} shows bundled only and never fetches', async () => {
      stubIndex(index)
      const { container } = render(<PianoInvaders songs={[legacy]} opensongs={false} />)
      await waitFor(() => expect(titles(container)).toEqual(['Tiny Tune']))
      expect(fetch).not.toHaveBeenCalled()
    })

    it('opensongs baseUrl is passed to the index fetch', async () => {
      stubIndex(index)
      render(<PianoInvaders songs={[legacy]} opensongs={{ baseUrl: 'https://example.test/os/' }} />)
      await waitFor(() => expect(fetch).toHaveBeenCalledWith('https://example.test/os/index.json'))
    })

    it('index failure → onError once, bundled songs still selectable', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
      const onError = vi.fn()
      const { container } = render(<PianoInvaders songs={[legacy]} onError={onError} />)
      await waitFor(() => expect(onError).toHaveBeenCalled())
      await act(async () => { await new Promise(r => setTimeout(r, 20)) })
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0][0]).toMatchObject({ code: 'score-load' })
      expect(titles(container)).toEqual(['Tiny Tune'])
      await waitFor(() => expect((container.querySelector('.pi-btn-start') as HTMLButtonElement).disabled).toBe(false))
    })

    it('picking an OpenSongs entry fetches its musicxml; a failed load reports onError and keeps the roller usable', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.stubGlobal('fetch', vi.fn(async (url: string) =>
        url.endsWith('index.json') ? new Response(JSON.stringify(index), { status: 200 }) : new Response('nope', { status: 404 })))
      const onError = vi.fn()
      const { container } = render(<PianoInvaders songs={[legacy]} onError={onError} />)
      await waitFor(() => expect(titles(container)).toHaveLength(5))
      act(() => (container.querySelectorAll('.pi-barrel-item.is-song')[1] as HTMLElement).click())
      await waitFor(() => expect((container.querySelector('.pi-btn-start') as HTMLButtonElement).disabled).toBe(false))
      act(() => (container.querySelector('.pi-btn-start') as HTMLElement).click())
      await waitFor(() => expect(container.querySelector('.pi-pick-error')).toBeTruthy())
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0][0]).toMatchObject({ code: 'score-load' })
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('songs/hot-cross-buns/song.musicxml'))
      expect((container.querySelector('.pi-btn-start') as HTMLButtonElement).textContent).toBe('START')
      expect(titles(container)).toHaveLength(5)
    })

    it('roller renders a bounded number of DOM rows with 460 entries', async () => {
      const big = {
        count: 460,
        songs: Array.from({ length: 460 }, (_, i) => ({
          id: `s${i}`, title: `Song ${String(i).padStart(3, '0')}`, difficulty: (i % 5) + 1, files: { musicxml: `songs/s${i}/song.musicxml` },
        })),
      }
      stubIndex(big)
      const { container } = render(<PianoInvaders songs={[legacy]} />)
      await waitFor(() => expect(container.querySelectorAll('.pi-barrel-item.is-song').length).toBeGreaterThan(5))
      const n = container.querySelectorAll('.pi-barrel-item.is-song').length
      expect(n).toBeLessThanOrEqual(20)
      act(() => (container.querySelector('.pi-btn-barrel-up') as HTMLElement).click()) // wraps to the last of 461
      expect(container.querySelectorAll('.pi-barrel-item.is-song').length).toBeLessThanOrEqual(20)
      expect(titles(container)).toContain('Song 459')
    })
  })

  describe('final review fixes', () => {
    const index = JSON.parse(fs.readFileSync(fx('opensongs-index.json'), 'utf8'))
    const titles = (c: HTMLElement) => [...c.querySelectorAll('.pi-barrel-item.is-song .pi-barrel-name')].map(n => n.textContent)
    const selectedTitle = (c: HTMLElement) => c.querySelector('.pi-barrel-item.is-selected .pi-barrel-name')?.textContent
    const startBtn = (c: HTMLElement) => c.querySelector('.pi-btn-start') as HTMLButtonElement

    it('resumeAudio is called synchronously in the Start click, before the OpenSongs fetch resolves', async () => {
      let resolveSong: ((r: Response) => void) | null = null
      vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('index.json')
        ? Promise.resolve(new Response(JSON.stringify(index), { status: 200 }))
        : new Promise<Response>(r => { resolveSong = r })))
      const { container } = render(<PianoInvaders songs={[legacy]} />)
      await waitFor(() => expect(titles(container)).toHaveLength(5))
      act(() => (container.querySelectorAll('.pi-barrel-item.is-song')[1] as HTMLElement).click())
      await waitFor(() => expect(startBtn(container).disabled).toBe(false))
      vi.mocked(resumeAudio).mockClear()
      act(() => startBtn(container).click())
      expect(resumeAudio).toHaveBeenCalledTimes(1)
      expect(resolveSong).not.toBeNull() // the song fetch is in flight, still unresolved
    })

    it('a hung OpenSongs fetch times out: pick error shown, START no longer stuck on LOADING', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('index.json')
        ? Promise.resolve(new Response(JSON.stringify(index), { status: 200 }))
        : new Promise<Response>(() => {})))
      const onError = vi.fn()
      const { container } = render(<PianoInvaders songs={[legacy]} onError={onError} />)
      await waitFor(() => expect(titles(container)).toHaveLength(5))
      act(() => (container.querySelectorAll('.pi-barrel-item.is-song')[1] as HTMLElement).click())
      await waitFor(() => expect(startBtn(container).disabled).toBe(false))
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      try {
        act(() => startBtn(container).click())
        expect(startBtn(container).textContent).toMatch(/LOADING/)
        await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
      } finally {
        vi.useRealTimers()
      }
      await waitFor(() => expect(container.querySelector('.pi-pick-error')).toBeTruthy())
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'score-load' }))
      expect(startBtn(container).textContent).toBe('START')
    })

    it('re-render with an equal-but-new songs array keeps the selection and imported songs; plugin songs() not re-called', async () => {
      const other = { name: 'Other Tune', bpm: 80, melody: ['E3', 'D3', 'C3'] }
      const pluginSongs = vi.fn(() => [])
      const plugins = [{ name: 'p', songs: pluginSongs }]
      const { container, rerender } = render(<PianoInvaders songs={[legacy, other]} opensongs={false} plugins={plugins} />)
      await waitFor(() => expect(titles(container)).toEqual(['Tiny Tune', 'Other Tune']))
      const imported = new File([JSON.stringify({ name: 'Imported Tune', bpm: 90, melody: ['C3', 'E3'] })], 'mine.json', { type: 'application/json' })
      fireEvent.change(container.querySelector('.pi-import-input') as HTMLInputElement, { target: { files: [imported] } })
      await waitFor(() => expect(container.querySelector('.pi-import-status')?.textContent).toMatch(/LOADED/))
      await waitFor(() => expect(titles(container)).toEqual(['Tiny Tune', 'Other Tune', 'Imported Tune']))
      act(() => (container.querySelectorAll('.pi-barrel-item.is-song')[1] as HTMLElement).click())
      expect(selectedTitle(container)).toBe('Other Tune')
      rerender(<PianoInvaders songs={[{ ...legacy }, { ...other }]} opensongs={false} plugins={plugins} />)
      await act(async () => { await new Promise(r => setTimeout(r, 20)) })
      expect(titles(container)).toEqual(['Tiny Tune', 'Other Tune', 'Imported Tune'])
      expect(selectedTitle(container)).toBe('Other Tune')
      expect(pluginSongs).toHaveBeenCalledTimes(1)
      // a genuinely different list reloads, but imported songs survive
      rerender(<PianoInvaders songs={[other]} opensongs={false} plugins={plugins} />)
      await waitFor(() => expect(titles(container)).toEqual(['Other Tune', 'Imported Tune']))
    })

    it('held keys are cleared when focus leaves the game', async () => {
      const { container } = render(<><PianoInvaders songs={[legacy]} opensongs={false} /><input className="host-input" /></>)
      const root = container.querySelector('.piano-invaders') as HTMLElement
      const hostInput = container.querySelector('.host-input') as HTMLElement
      root.focus()
      fireEvent.keyDown(root, { key: 'a' })
      expect(container.querySelectorAll('.pi-key.is-active')).toHaveLength(1)
      fireEvent.focusOut(root, { relatedTarget: hostInput })
      expect(container.querySelectorAll('.pi-key.is-active')).toHaveLength(0)
      root.focus()
      fireEvent.keyDown(root, { key: 'a' }) // the next press is not swallowed as "still held"
      expect(container.querySelectorAll('.pi-key.is-active')).toHaveLength(1)
      // focus moving within the game (e.g. to a button) keeps held keys
      fireEvent.focusOut(root, { relatedTarget: container.querySelector('.pi-btn-start') })
      expect(container.querySelectorAll('.pi-key.is-active')).toHaveLength(1)
    })

    it('HUD and roller show — instead of BPM 0 for an unloaded OpenSongs entry', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(index), { status: 200 })))
      const { container } = render(<PianoInvaders songs={[legacy]} />)
      await waitFor(() => expect(titles(container)).toHaveLength(5))
      expect(container.querySelector('.pi-hud-bpm .pi-hud-value')?.textContent).toBe('070')
      act(() => (container.querySelectorAll('.pi-barrel-item.is-song')[1] as HTMLElement).click())
      expect(container.querySelector('.pi-hud-bpm .pi-hud-value')?.textContent).toBe('—')
      expect(container.querySelector('.pi-barrel-bpm')?.textContent).not.toMatch(/\b0 BPM/)
    })
  })
})
