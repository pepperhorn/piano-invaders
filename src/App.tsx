import { useEffect, useState } from 'react'
import PianoInvaders from './components/PianoInvaders'

/** Standalone site: the bundled song library feeds the song picker. */
export default function App() {
  const [songs, setSongs] = useState<object[] | null>(null)

  useEffect(() => {
    let live = true
    fetch('/song_library.json')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { songs?: object[] }) => { if (live) setSongs(Array.isArray(d.songs) ? d.songs : []) })
      .catch(e => {
        console.warn('[piano-invaders] could not load song_library.json; using the built-in song', e)
        if (live) setSongs([])
      })
    return () => { live = false }
  }, [])

  return (
    <div className="app-shell" style={{ width: '100%', height: '100%' }}>
      {songs && <PianoInvaders songs={songs} />}
    </div>
  )
}
