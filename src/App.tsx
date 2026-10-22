import { useEffect, useState } from 'react'
import PianoInvaders from './components/PianoInvaders'
import { loadSong } from './song/load'

/** MusicXML samples bundled with the standalone app (public/songs). */
const BUNDLED_MUSICXML = ['/songs/ode-to-joy.musicxml']

/** Standalone site: the bundled song library (+ MusicXML samples) feeds the song picker. */
export default function App() {
  const [songs, setSongs] = useState<object[] | null>(null)

  useEffect(() => {
    let live = true
    const library = fetch('/song_library.json')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { songs?: object[] }) => (Array.isArray(d.songs) ? d.songs : []))
      .catch(e => {
        console.warn('[piano-invaders] could not load song_library.json; using the built-in song', e)
        return [] as object[]
      })
    const samples = Promise.all(BUNDLED_MUSICXML.map(url =>
      loadSong({ scoreUrl: url }).catch(e => {
        console.warn(`[piano-invaders] could not load ${url}`, e)
        return null
      })))
    Promise.all([library, samples]).then(([lib, xml]) => {
      if (live) setSongs([...lib, ...xml.filter((s): s is NonNullable<typeof s> => s !== null)])
    })
    return () => { live = false }
  }, [])

  return (
    <div className="app-shell" style={{ width: '100%', height: '100%' }}>
      {songs && <PianoInvaders songs={songs} />}
    </div>
  )
}
