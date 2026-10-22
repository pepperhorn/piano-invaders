import { useEffect, useRef, useState } from 'react'
import type { GameEnd } from '../game/useGame'
import { DIFFICULTY_MULT } from '../game/scoring'
import { insertEntry, type LeaderboardEntry } from '../utils/leaderboard'

export interface GameOverProps {
  stats: GameEnd
  loadBoard(): Promise<LeaderboardEntry[]>
  saveBoard(entries: LeaderboardEntry[]): Promise<void>
  onRestart(): void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function GameOver({ stats: s, loadBoard, saveBoard, onRestart }: GameOverProps) {
  const [name, setName] = useState('')
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null)
  const [rank, setRank] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(id)
  }, [])

  const submit = async () => {
    const n = name.trim().toUpperCase().slice(0, 6)
    if (!n) return
    const entry: LeaderboardEntry = {
      name: n, total: s.total, score: s.score, bpm: s.bpm, hp: s.hp, time: s.seconds, song: s.song,
      maxCombo: s.maxCombo, date: Date.now(),
    }
    const current = await loadBoard()
    const { entries, rank: r } = insertEntry(current, entry)
    setRank(r)
    setBoard(entries)
    await saveBoard(entries)
  }

  const rows: [string, string, string?][] = [
    ['SONG', s.song, 'pi-stat-song'],
    ['DIFFICULTY', `${s.difficulty.toUpperCase()} ×${DIFFICULTY_MULT[s.difficulty]}`, 'pi-stat-difficulty'],
    ['SCORE', String(s.score)],
    ['SHIELD', `${s.hp}%`],
    ['BPM', String(s.bpm)],
    ['ACCURACY', `${s.accuracy}%`],
    ['MAX COMBO', `x${s.maxCombo}`, 'pi-stat-combo'],
    ['TIME', formatTime(s.seconds)],
  ]

  return (
    <div className="pi-overlay pi-gameover" role="dialog" aria-modal="true" aria-labelledby="pi-gameover-title">
      <div className="pi-band pi-band-top" />
      <div className="pi-gameover-inner">
        <h2 id="pi-gameover-title" className="pi-heading pi-gameover-title">{s.wasQuit ? 'MISSION ABORT' : 'GAME OVER'}</h2>
        <div className="pi-gameover-stats">
          {rows.map(([label, value, cls]) => (
            <div key={label} className={`pi-stat-row ${cls ?? ''}`}>
              <span className="pi-stat-label">{label}</span>
              <span className="pi-stat-value">{value}</span>
            </div>
          ))}
          <div className="pi-stat-row pi-stat-total">
            <span className="pi-stat-label">TOTAL</span>
            <span className="pi-stat-value">{s.total.toLocaleString()}</span>
          </div>
        </div>

        {!board ? (
          <form className="pi-name-entry" onSubmit={e => { e.preventDefault(); void submit() }}>
            <label className="pi-name-prompt" htmlFor="pi-name-input">ENTER YOUR NAME</label>
            <input
              id="pi-name-input"
              ref={inputRef}
              className="pi-name-input"
              type="text"
              maxLength={6}
              value={name}
              onChange={e => setName(e.target.value.toUpperCase())}
              placeholder="______"
              autoComplete="off"
            />
            <button type="submit" className="pi-btn pi-btn-primary pi-btn-submit-name">OK</button>
            <button type="button" className="pi-btn pi-btn-sm pi-btn-skip" onClick={onRestart}>SKIP</button>
          </form>
        ) : (
          <>
            <div className="pi-leaderboard">
              <div className="pi-leaderboard-title">— HIGH SCORES —</div>
              <div className="pi-leaderboard-row pi-leaderboard-head">
                <span className="pi-lb-rank">#</span>
                <span className="pi-lb-name">NAME</span>
                <span className="pi-lb-combo">COMBO</span>
                <span className="pi-lb-score">TOTAL</span>
              </div>
              {board.map((e, i) => (
                <div key={`${e.name}-${i}`} className={`pi-leaderboard-row${i === rank ? ' is-new' : ''}`}>
                  <span className="pi-lb-rank">{i + 1}.</span>
                  <span className="pi-lb-name">{e.name}</span>
                  <span className="pi-lb-combo">{e.maxCombo !== undefined ? `x${e.maxCombo}` : '—'}</span>
                  <span className="pi-lb-score">{e.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <button type="button" className="pi-btn pi-btn-primary pi-btn-play-again" onClick={onRestart} autoFocus>PLAY AGAIN</button>
          </>
        )}
      </div>
      <div className="pi-band pi-band-bottom" />
    </div>
  )
}
