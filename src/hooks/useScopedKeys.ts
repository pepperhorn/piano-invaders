import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export interface ScopedKeyHandlers {
  onKeyDown?(e: KeyboardEvent): void
  onKeyUp?(e: KeyboardEvent): void
}

/** <input> types that take typed text; range / checkbox / radio / button etc. leave keys to the game. */
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])

/** True when the event comes from a text-entry element, whose keystrokes belong to the user, not the game. */
export function isTypingTarget(t: EventTarget | null): boolean {
  if (!t || typeof (t as Element).tagName !== 'string') return false
  const el = t as HTMLElement
  const tag = el.tagName.toLowerCase()
  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? 'text').trim().toLowerCase() || 'text'
    return TEXT_INPUT_TYPES.has(type)
  }
  if (tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  const ce = el.getAttribute?.('contenteditable')
  return ce !== null && ce !== undefined && ce !== 'false'
}

/**
 * Focus-scoped keyboard input: listeners live on the root element (never window/document),
 * so keys reach the game only while focus is inside it. Text-entry targets are ignored.
 */
export function useScopedKeys(ref: RefObject<HTMLElement | null>, handlers: ScopedKeyHandlers, enabled = true): void {
  const h = useRef(handlers)
  useEffect(() => { h.current = handlers })

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const down = (e: KeyboardEvent) => { if (!isTypingTarget(e.target)) h.current.onKeyDown?.(e) }
    const up = (e: KeyboardEvent) => { if (!isTypingTarget(e.target)) h.current.onKeyUp?.(e) }
    el.addEventListener('keydown', down)
    el.addEventListener('keyup', up)
    return () => {
      el.removeEventListener('keydown', down)
      el.removeEventListener('keyup', up)
    }
  }, [ref, enabled])
}
