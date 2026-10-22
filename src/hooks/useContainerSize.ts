import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

export interface Size { width: number; height: number }

/** Content-box size of an element via ResizeObserver (no window listeners). {0,0} until measured. */
export function useContainerSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const apply = (width: number, height: number) => {
      const w = Math.round(width), hh = Math.round(height)
      setSize(prev => (prev.width === w && prev.height === hh ? prev : { width: w, height: hh }))
    }
    if (typeof ResizeObserver === 'undefined') {
      const r = el.getBoundingClientRect()
      const id = requestAnimationFrame(() => apply(r.width, r.height))
      return () => cancelAnimationFrame(id)
    }
    const ro = new ResizeObserver(entries => {
      const e = entries[entries.length - 1]
      if (e) apply(e.contentRect.width, e.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}
