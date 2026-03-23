import React from 'react';

const RulesPopup = ({ onClose }) => {
  return (
    <div className="rules-popup show">
      <div className="rules-content">
        <h2>// HOW TO PLAY</h2>

        <p>
          <span className="highlight">▸ OBJECTIVE</span>
          <br />
          Notes fall from the UFO above. Press the matching piano key to shoot them down. Missed notes bomb your land and drain HP. Survive as long as you can and rack up the highest score!
        </p>

        <p>
          <span className="highlight">▸ NOTE COLORS</span>
          <br />
          <span style={{ color: '#0f0' }}>GREEN</span> = Next note to hit
          <br />
          <span style={{ color: '#ff0' }}>YELLOW</span> = Coming soon
          <br />
          <span style={{ color: '#f80' }}>ORANGE</span> = Further away
          <br />
          <span style={{ color: '#888' }}>GRAY</span> = In queue
        </p>

        <p>
          <span className="highlight">▸ SCORING</span>
          <br />
          +10 points per correct hit
          <br />
          -5 HP per missed note
          <br />
          Game ends when HP reaches 0
          <br />
          TOTAL = Score x HP x BPM x Time
        </p>

        <p>
          <span className="highlight">▸ DIFFICULTY</span>
          <br />
          BPM increases after 30 seconds, then every 60 seconds. Notes fall faster as BPM rises.
        </p>

        <p>
          <span className="highlight">▸ CONTROLS</span>
          <br />
          Click/tap piano keys to shoot
          <br />
          Desktop: use keyboard (A=B, S=C, D=D, F=E, G=F, H=G, J=A, K=B, L=C)
          <br />
          Black keys: E=C#, R=D#, Y=F#, U=G#, I=A#, P=C#, [=D#
        </p>

        <button className="close-btn" onClick={onClose}>
          GOT IT!
        </button>
      </div>
    </div>
  );
};

export default RulesPopup;
