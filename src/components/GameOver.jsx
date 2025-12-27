import React from 'react';

const GameOver = ({ score, won, onRestart }) => {
  return (
    <div className={`game-over show ${won ? 'win' : ''}`}>
      <h2>{won ? 'YOU WIN!' : 'GAME OVER'}</h2>
      <div className="final-score">SCORE: {score}</div>
      <button className="start-btn" onClick={onRestart}>
        PLAY AGAIN
      </button>
    </div>
  );
};

export default GameOver;
