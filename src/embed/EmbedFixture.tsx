import { useEffect, useState } from 'react'
import PianoInvaders from '../components/PianoInvaders'

interface FixtureNote { midi: number; x: number; y: number }
declare global {
  interface Window {
    __piFixture?: { keyX(midi: number): number; noteXs(): FixtureNote[] }
  }
}

/** Dev-only host page content: the game in a fixed box, single-song mode, no network. */
export default function EmbedFixture() {
  const [xml, setXml] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    fetch('/songs/ode-to-joy.musicxml').then(r => r.text()).then(t => { if (live) setXml(t) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    // page-space x of a key centre / of each falling note, for the e2e tests
    window.__piFixture = {
      keyX(midi) {
        const el = document.querySelector(`.piano-invaders .pi-key[data-midi="${midi}"]`)
        if (!el) return NaN
        const r = el.getBoundingClientRect()
        return r.left + r.width / 2
      },
      noteXs() {
        const c = document.querySelector('.piano-invaders .pi-canvas') as (HTMLCanvasElement & { __piNotes?: FixtureNote[] }) | null
        if (!c) return []
        const left = c.getBoundingClientRect().left
        return (c.__piNotes ?? []).map(n => ({ midi: n.midi, x: left + n.x, y: n.y }))
      },
    }
    return () => { delete window.__piFixture }
  }, [])

  return (
    <div className="embed-fixture-game" style={{ width: 720, height: 480 }}>
      {xml && <PianoInvaders musicXml={xml} title="Ode to Joy" opensongs={false} />}
    </div>
  )
}
