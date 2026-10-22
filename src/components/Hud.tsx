import { GAME_CONFIG } from '../constants/gameConfig'

export interface HudProps {
  score: number; hi: number; bpm: number | null; song: string; combo: number; hp: number; accuracy: number
  running: boolean
  onQuit(): void
}

const SEGMENTS = GAME_CONFIG.MAX_HEALTH / GAME_CONFIG.DAMAGE_PER_BOMB // 20 × 5 HP
const pad = (n: number, l: number) => String(Math.max(0, Math.floor(n))).padStart(l, '0')

export default function Hud({ score, hi, bpm, song, combo, hp, accuracy, running, onQuit }: HudProps) {
  const lit = Math.ceil(hp / GAME_CONFIG.DAMAGE_PER_BOMB)
  const accLevel = accuracy > 70 ? 'is-good' : accuracy > 40 ? 'is-warn' : 'is-bad'
  return (
    <div className="pi-hud">
      <div className="pi-hud-field pi-hud-score">
        <span className="pi-hud-label">SCORE&lt;1&gt;</span>
        <span className="pi-hud-value">{pad(score, 6)}</span>
      </div>
      <div className="pi-hud-field pi-hud-hi">
        <span className="pi-hud-label">HI-SCORE</span>
        <span className="pi-hud-value">{pad(Math.max(hi, score), 6)}</span>
      </div>
      <div className="pi-hud-field pi-hud-bpm">
        <span className="pi-hud-label">BPM</span>
        <span className="pi-hud-value">{bpm ? pad(bpm, 3) : '—'}</span>
      </div>
      <div className="pi-hud-field pi-hud-song">
        <span className="pi-hud-label">SONG</span>
        <span className="pi-hud-value pi-hud-song-title">{song}</span>
      </div>
      <div className="pi-hud-field pi-hud-combo">
        <span className="pi-hud-label">COMBO</span>
        <span className={`pi-hud-value${combo === 0 ? ' is-zero' : ''}`}>x{combo}</span>
      </div>
      <div className="pi-hud-field pi-hud-shield" aria-label={`Shield ${hp} of ${GAME_CONFIG.MAX_HEALTH}`}>
        <span className="pi-hud-label">SHIELD</span>
        <span className="pi-hud-segments">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span key={i} className={`pi-hud-segment${i < lit ? ' is-on' : ''}`} />
          ))}
        </span>
      </div>
      <div className="pi-hud-field pi-hud-accuracy" aria-label={`Accuracy ${accuracy}%`}>
        <span className="pi-hud-label">ACC</span>
        <span className="pi-hud-meter">
          <span className={`pi-hud-meter-fill ${accLevel}`} style={{ width: `${accuracy}%` }} />
        </span>
      </div>
      {running && (
        <button type="button" className="pi-btn pi-btn-quit" onClick={onQuit}>
          QUIT
        </button>
      )}
    </div>
  )
}
