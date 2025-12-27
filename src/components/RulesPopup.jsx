import React from 'react';

const RulesPopup = ({ onClose }) => {
  return (
    <div className="rules-popup show">
      <div className="rules-content">
        <h2>📜 HOW TO PLAY</h2>

        <p>
          <span className="highlight">▸ OBJECTIVE</span>
          <br />
          Shoot falling notes by pressing the correct piano keys. Protect your bases!
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
          +10 points for each correct hit
          <br />
          Reach 1000 points to WIN!
        </p>

        <p>
          <span className="highlight">▸ CONTROLS</span>
          <br />
          Click/tap piano keys to shoot
          <br />
          Hit the GREEN note first!
        </p>

        <button className="close-btn" onClick={onClose}>
          GOT IT!
        </button>
      </div>
    </div>
  );
};

export default RulesPopup;
