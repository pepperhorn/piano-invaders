import { describe, it, expect, vi, afterEach } from 'vitest'
import { useRef } from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { useScopedKeys } from '../../src/hooks/useScopedKeys'

afterEach(cleanup)

function Harness({ onDown, onUp }: { onDown: (e: KeyboardEvent) => void; onUp?: (e: KeyboardEvent) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useScopedKeys(ref, { onKeyDown: onDown, onKeyUp: onUp })
  return (
    <div className="harness">
      <div ref={ref} tabIndex={0} data-testid="root" className="harness-root">
        <input data-testid="inner-input" className="harness-inner-input" />
        <div data-testid="editable" className="harness-editable" contentEditable suppressContentEditableWarning>x</div>
      </div>
      <input data-testid="outer-input" className="harness-outer-input" />
      <button data-testid="outer-button" className="harness-outer-button">b</button>
    </div>
  )
}

/** Dispatch a key event at whatever currently has focus, like a real browser does. */
function press(key: string) {
  const target = (document.activeElement ?? document.body) as HTMLElement
  fireEvent.keyDown(target, { key })
  fireEvent.keyUp(target, { key })
}

describe('useScopedKeys', () => {
  it('keys fire only when root has focus', () => {
    const onDown = vi.fn()
    const onUp = vi.fn()
    const { getByTestId } = render(<Harness onDown={onDown} onUp={onUp} />)
    press('a')
    expect(onDown).not.toHaveBeenCalled()
    getByTestId('outer-button').focus()
    press('a')
    expect(onDown).not.toHaveBeenCalled()
    getByTestId('root').focus()
    press('a')
    expect(onDown).toHaveBeenCalledTimes(1)
    expect(onUp).toHaveBeenCalledTimes(1)
    expect(onDown.mock.calls[0][0].key).toBe('a')
  })

  it('typing in an <input> inside or outside the root does not fire', () => {
    const onDown = vi.fn()
    const { getByTestId } = render(<Harness onDown={onDown} />)
    getByTestId('inner-input').focus()
    press('s')
    getByTestId('outer-input').focus()
    press('s')
    getByTestId('editable').focus()
    fireEvent.keyDown(getByTestId('editable'), { key: 's' })
    expect(onDown).not.toHaveBeenCalled()
  })

  it('listeners are removed on unmount', () => {
    const onDown = vi.fn()
    const { getByTestId, unmount } = render(<Harness onDown={onDown} />)
    const root = getByTestId('root')
    const remove = vi.spyOn(root, 'removeEventListener')
    unmount()
    const removed = remove.mock.calls.map(c => c[0])
    expect(removed).toContain('keydown')
    expect(removed).toContain('keyup')
    fireEvent.keyDown(root, { key: 'a' })
    expect(onDown).not.toHaveBeenCalled()
  })
})
