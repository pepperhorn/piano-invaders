import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import Keyboard from '../../src/components/Keyboard'

afterEach(() => cleanup())

describe('Keyboard', () => {
  it('pointerEnter on a key calls onHover with its midi (white and black)', () => {
    const onHover = vi.fn()
    const { container } = render(<Keyboard active={new Set()} onDown={() => {}} onUp={() => {}} keyRef={() => {}} onHover={onHover} />)
    const white = container.querySelector('.pi-key-white') as HTMLElement
    fireEvent.pointerEnter(white)
    expect(onHover).toHaveBeenCalledWith(Number(white.dataset.midi))
    const black = container.querySelector('.pi-key-black') as HTMLElement
    fireEvent.pointerEnter(black)
    expect(onHover).toHaveBeenLastCalledWith(Number(black.dataset.midi))
  })
})
