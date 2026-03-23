import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'piano-invaders-leaderboard';
const MAX_ENTRIES = 10;

const DEFAULT_SCORES = [
  { name: 'MOE', total: 5200, score: 320, bpm: 71, hp: 45, time: 180, song: 'Ode to Joy' },
  { name: 'CURLY', total: 4100, score: 280, bpm: 69, hp: 30, time: 150, song: 'Twinkle Twinkle' },
  { name: 'LARRY', total: 3600, score: 250, bpm: 67, hp: 55, time: 120, song: 'Happy Birthday' },
  { name: 'BUZZ', total: 2900, score: 200, bpm: 73, hp: 20, time: 140, song: 'Fur Elise' },
  { name: 'WOODY', total: 2400, score: 180, bpm: 68, hp: 40, time: 110, song: 'Blue Danube' },
  { name: 'DRAKE', total: 1800, score: 150, bpm: 67, hp: 35, time: 90, song: 'Frere Jacques' },
  { name: 'PEACH', total: 1400, score: 120, bpm: 66, hp: 25, time: 80, song: 'Mary Had a Lamb' },
  { name: 'TOAD', total: 900, score: 90, bpm: 65, hp: 15, time: 60, song: 'Ode to Joy' },
  { name: 'YOSHI', total: 500, score: 60, bpm: 65, hp: 10, time: 45, song: 'Twinkle Twinkle' },
  { name: 'GOOMBA', total: 200, score: 30, bpm: 65, hp: 5, time: 30, song: 'Happy Birthday' },
];

function loadLeaderboard() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && stored.length > 0) return stored;
    return [...DEFAULT_SCORES];
  } catch {
    return [...DEFAULT_SCORES];
  }
}

function saveLeaderboard(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const GameOver = ({ stats, onRestart }) => {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [leaderboard, setLeaderboard] = useState(loadLeaderboard);
  const [newEntryRank, setNewEntryRank] = useState(-1);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  if (!stats) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    const entry = {
      name: name.trim().toUpperCase().slice(0, 6),
      total: stats.total,
      score: stats.score,
      bpm: stats.bpm,
      hp: stats.health,
      time: stats.time,
      song: stats.song,
      date: Date.now(),
    };
    const updated = [...leaderboard, entry].sort((a, b) => b.total - a.total).slice(0, MAX_ENTRIES);
    const rank = updated.findIndex(e => e.date === entry.date);
    setNewEntryRank(rank);
    setLeaderboard(updated);
    saveLeaderboard(updated);
    setSubmitted(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
    // Prevent game keyboard from firing
    e.stopPropagation();
  };

  return (
    <div className="game-over show">
      <h2>{stats.wasQuit ? 'MISSION ABORT' : 'GAME OVER'}</h2>

      <div className="game-over-stats">
        <div className="stat-row">
          <span className="stat-label">SONG</span>
          <span className="stat-value stat-song">{stats.song}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">SCORE</span>
          <span className="stat-value">{stats.score}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">HP</span>
          <span className="stat-value">{stats.health}%</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">BPM</span>
          <span className="stat-value">{stats.bpm}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">TIME</span>
          <span className="stat-value">{formatTime(stats.time)}</span>
        </div>
        <div className="stat-row stat-total">
          <span className="stat-label">TOTAL</span>
          <span className="stat-value">{stats.total.toLocaleString()}</span>
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
          <button className="start-btn" onClick={handleSubmit}>OK</button>
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
          <button className="start-btn" onClick={onRestart}>PLAY AGAIN</button>
        </>
      )}
    </div>
  );
};

export default GameOver;
