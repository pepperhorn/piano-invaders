import { PITCH_COLORS } from '../render/palette'

export default function RulesPopup({ onClose }: { onClose(): void }) {
  return (
    <div className="pi-overlay pi-rules" role="dialog" aria-modal="true" aria-labelledby="pi-rules-title">
      <div className="pi-panel pi-rules-panel">
        <div className="pi-band pi-band-top" />
        <h2 id="pi-rules-title" className="pi-heading pi-rules-title">HOW TO PLAY</h2>
        <section className="pi-rules-section">
          <h3 className="pi-rules-subhead">Objective</h3>
          <p className="pi-rules-text">
            Invaders drop from the mothership carrying a note. Press the matching piano key and your gunship glides
            to it and shoots it down. Missed notes bomb your city and drain your shield. The song loops until your
            shield is gone or you quit.
          </p>
        </section>
        <section className="pi-rules-section">
          <h3 className="pi-rules-subhead">Notes</h3>
          <p className="pi-rules-text">Every note name has its own colour, matching the key that lights up:</p>
          <div className="pi-rules-swatches">
            {Object.entries(PITCH_COLORS).map(([name, col]) => (
              <span key={name} className="pi-rules-swatch" style={{ background: col }}>{name}</span>
            ))}
          </div>
          <p className="pi-rules-text">
            Two invaders on one row are a chord: press both keys. The gunship moves to the closer one and fires an
            explosive shot at the other.
          </p>
        </section>
        <section className="pi-rules-section">
          <h3 className="pi-rules-subhead">Scoring</h3>
          <p className="pi-rules-text">
            +10 per hit, −5 shield per missed note. Combo counts hits in a row and resets when a note lands.
            Accuracy rises when you play on the beat.
            <br />
            TOTAL = score × (shield% + 1) × (BPM ÷ 65) × (1 + minutes) × difficulty (easy ×1, intermediate ×2,
            advanced ×3).
          </p>
        </section>
        <section className="pi-rules-section">
          <h3 className="pi-rules-subhead">Tempo</h3>
          <p className="pi-rules-text">The BPM creeps up as you survive. Use the BPM slider to set your own pace.</p>
        </section>
        <section className="pi-rules-section">
          <h3 className="pi-rules-subhead">Controls</h3>
          <p className="pi-rules-text">
            Click or tap the piano keys. On a computer keyboard: A S D F G H J K L ; &apos; are B C D E F G A B C D E,
            and E R Y U I P [ are the sharps.
          </p>
        </section>
        <button type="button" className="pi-btn pi-btn-primary pi-btn-close" onClick={onClose} autoFocus>
          GOT IT!
        </button>
      </div>
    </div>
  )
}
