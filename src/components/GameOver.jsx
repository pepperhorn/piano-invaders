import React, { useState, useEffect, useRef } from 'react';
import { loadLeaderboard as defaultLoad, saveLeaderboard as defaultSave, MAX_ENTRIES } from '../utils/leaderboard.js';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const GameOver = ({ stats, show, onRestart, leaderboard: lbProvider }) => {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [newEntryRank, setNewEntryRank] = useState(-1);
  const inputRef = useRef(null);

  const lbLoad = lbProvider?.load || (async () => defaultLoad());
  const lbSave = lbProvider?.save || (async (e) => defaultSave(e));

  // Reset state when shown with new stats
  useEffect(() => {
    if (show && stats) {
      setName('');
      setSubmitted(false);
      setNewEntryRank(-1);
      lbLoad().then(entries => setLeaderboard(entries));
      setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 600);
    }
  }, [show, stats]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    const entry = {
      name: name.trim().toUpperCase().slice(0, 6),
      total: s.total,
      score: s.score,
      bpm: s.bpm,
      hp: s.health,
      time: s.time,
      song: s.song,
      date: Date.now(),
    };
    const updated = [...leaderboard, entry].sort((a, b) => b.total - a.total).slice(0, MAX_ENTRIES);
    const rank = updated.findIndex(e => e.date === entry.date);
    setNewEntryRank(rank);
    setLeaderboard(updated);
    lbSave(updated);
    setSubmitted(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
    // Prevent game keyboard from firing
    e.stopPropagation();
  };

  if (!stats && !show) return <div className="game-over" />;
  const s = stats || {};

  return (
    <div className={`game-over ${show ? 'show' : ''}`}>
      <h2 className="game-over-title">{s.wasQuit ? 'MISSION ABORT' : 'GAME OVER'}</h2>

      <div className="game-over-stats">
        <div className="stat-row">
          <span className="stat-label">SONG</span>
          <span className="stat-value stat-song">{s.song}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">DIFFICULTY</span>
          <span className="stat-value stat-difficulty">{(s.difficulty || 'intermediate').toUpperCase()} x{s.diffMultiplier || 2}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">SCORE</span>
          <span className="stat-value">{s.score}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">HP</span>
          <span className="stat-value">{s.health}%</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">BPM</span>
          <span className="stat-value">{s.bpm}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">ACCUR</span>
          <span className="stat-value">{s.accuracy ?? 100}%</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">TIME</span>
          <span className="stat-value">{formatTime(s.time)}</span>
        </div>
        <div className="stat-row stat-total">
          <span className="stat-label">TOTAL</span>
          <span className="stat-value">{(s.total || 0).toLocaleString()}</span>
        </div>
      </div>

      {!submitted ? (
        <div className="name-entry">
          <div className="name-prompt">ENTER YOUR NAME</div>
          <input
            ref={inputRef}
            className="name-input"
            type="text"
            maxLength={6}
            value={name}
            onChange={e => setName(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="______"
            autoComplete="off"
          />
          <button className="start-btn start-btn-primary btn-submit-name" onClick={handleSubmit}>OK</button>
        </div>
      ) : (
        <>
          <div className="leaderboard">
            <div className="leaderboard-title">--- HIGH SCORES ---</div>
            <div className="leaderboard-header">
              <span className="lb-rank">#</span>
              <span className="lb-name">NAME</span>
              <span className="lb-score">TOTAL</span>
            </div>
            {leaderboard.map((entry, idx) => (
              <div
                key={idx}
                className={`leaderboard-row ${idx === newEntryRank ? 'new-entry' : ''}`}
              >
                <span className="lb-rank">{idx + 1}.</span>
                <span className="lb-name">{entry.name}</span>
                <span className="lb-score">{entry.total.toLocaleString()}</span>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <div className="leaderboard-row">
                <span className="lb-name">NO SCORES YET</span>
              </div>
            )}
          </div>
          <button className="start-btn start-btn-primary btn-play-again" onClick={onRestart}>PLAY AGAIN</button>
        </>
      )}
    </div>
  );
};

export default GameOver;
