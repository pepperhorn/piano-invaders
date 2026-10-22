import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent, createEvent } from '@testing-library/react'
import StartScreen, { type RollerItem, type StartScreenProps } from '../../src/components/StartScreen'

const songs: RollerItem[] = ['One', 'Two', 'Three', 'Four', 'Five'].map((t, i) => ({ key: `k${i}`, title: t, difficulty: 'easy', hasAccomp: false }))

function props(o: Partial<StartScreenProps> = {}): StartScreenProps {
  return {
    mode: 'picker', songs, index: 2, onIndex: () => {}, bpm: 100, ready: true, busy: null,
    onStart: () => {}, onRandom: () => {}, onRules: () => {}, importStatus: null, leaderboard: [],
    toggles: { metronome: true, countIn: true, accomp: true }, onToggle: () => {}, ...o,
  }
}

// jsdom has no pointer capture; model the browser: once captured, the click is retargeted to the capturing element.
let captured: Element | null = null
beforeEach(() => {
  captured = null
  Object.assign(Element.prototype, {
    setPointerCapture: vi.fn(function capture(this: Element) { captured = this as Element }),
    releasePointerCapture() {},
  })
})
afterEach(() => {
  cleanup()
  delete (Element.prototype as Partial<Element>).setPointerCapture
  delete (Element.prototype as Partial<Element>).releasePointerCapture
})

/** pointerdown / moves / pointerup on `el`, then the click the browser would dispatch */
function gesture(el: Element, ys: number[]) {
  let t = 1000
  const at = (ev: Event) => { Object.defineProperty(ev, 'timeStamp', { value: (t += 100) }); return ev }
  fireEvent(el, at(createEvent.pointerDown(el, { pointerId: 1, clientY: ys[0] })))
  for (const y of ys.slice(1)) fireEvent(captured ?? el, at(createEvent.pointerMove(captured ?? el, { pointerId: 1, clientY: y })))
  fireEvent(captured ?? el, at(createEvent.pointerUp(captured ?? el, { pointerId: 1, clientY: ys[ys.length - 1] })))
  fireEvent.click(captured ?? el)
}

describe('StartScreen barrel', () => {
  it('clicking a visible, non-selected row selects it', () => {
    const onIndex = vi.fn()
    const { container } = render(<StartScreen {...props({ onIndex })} />)
    const row = [...container.querySelectorAll('.pi-barrel-item.is-song')].find(r => r.textContent?.includes('Four'))!
    gesture(row, [100, 100])
    expect(onIndex).toHaveBeenLastCalledWith(3)
  })

  it('dragging still scrolls the roller and captures the pointer', () => {
    const onIndex = vi.fn()
    const { container } = render(<StartScreen {...props({ onIndex })} />)
    const row = [...container.querySelectorAll('.pi-barrel-item.is-song')].find(r => r.textContent?.includes('Four'))!
    gesture(row, [200, 180, 150, 120]) // dragged up 80 px = 2 rows forward
    expect(captured).toBe(container.querySelector('.pi-barrel'))
    expect(onIndex).toHaveBeenLastCalledWith(4)
  })
})
