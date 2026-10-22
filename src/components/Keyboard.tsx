import { useEffect, useState } from 'react'
import { BLACK_KEYS, MIDI_TO_QWERTY, WHITE_KEYS, type PianoKey } from '../constants/gameConfig'
import { pitchColor } from '../render/palette'

export interface KeyboardProps {
  active: ReadonlySet<number>
  onDown(midi: number): void
  onUp(midi: number): void
  /** registers each key element so the parent can measure key centres relative to the canvas */
  keyRef(midi: number, el: HTMLElement | null): void
}

const WHITE_COUNT = WHITE_KEYS.length

/** left edge (in white-key units) of the white key just right of a black key */
function blackCenter(k: PianoKey): number {
  return WHITE_KEYS.filter(w => w.midi < k.midi).length
}

export default function Keyboard({ active, onDown, onUp, keyRef }: KeyboardProps) {
  const [touch, setTouch] = useState(false)
  useEffect(() => {
    const t = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    if (t) {
      const id = requestAnimationFrame(() => setTouch(true))
      return () => cancelAnimationFrame(id)
    }
  }, [])

  const handlers = (midi: number) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); onDown(midi) },
    onPointerUp: () => onUp(midi),
    onPointerLeave: () => { if (active.has(midi)) onUp(midi) },
    onPointerCancel: () => onUp(midi),
  })

  const label = (k: PianoKey) => (
    <>
      <span className="pi-key-name">{k.name}</span>
      {!touch && MIDI_TO_QWERTY[k.midi] && <span className="pi-key-qwerty">{MIDI_TO_QWERTY[k.midi]}</span>}
    </>
  )

  return (
    <div className="pi-keyboard" role="group" aria-label="Piano keyboard">
      <div className="pi-keyboard-whites">
        {WHITE_KEYS.map(k => {
          const on = active.has(k.midi)
          return (
            <div
              key={k.midi}
              ref={el => keyRef(k.midi, el)}
              className={`pi-key pi-key-white${on ? ' is-active' : ''}${k.name === 'C' ? ' is-c' : ''}`}
              data-midi={k.midi}
              style={on ? { ['--pi-key-lit' as string]: pitchColor(k.midi) } : undefined}
              {...handlers(k.midi)}
            >
              {label(k)}
            </div>
          )
        })}
      </div>
      <div className="pi-keyboard-blacks">
        {BLACK_KEYS.map(k => {
          const on = active.has(k.midi)
          const style: Record<string, string> = { left: `${(blackCenter(k) / WHITE_COUNT) * 100}%` }
          if (on) style['--pi-key-lit'] = pitchColor(k.midi)
          return (
            <div
              key={k.midi}
              ref={el => keyRef(k.midi, el)}
              className={`pi-key pi-key-black${on ? ' is-active' : ''}`}
              data-midi={k.midi}
              style={style}
              {...handlers(k.midi)}
            >
              {label(k)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
