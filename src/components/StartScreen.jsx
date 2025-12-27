import React, { useEffect, useRef } from 'react';

const StartScreen = ({ songs, currentSongIndex, onSongChange, onStart, onRandom, onShowRules }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const offset = -(currentSongIndex + 1) * 40 + 55;
      scrollRef.current.style.transform = `translateY(${offset}px)`;
    }
  }, [currentSongIndex]);

  const scrollSong = (direction) => {
    const newIndex = (currentSongIndex + direction + songs.length) % songs.length;
    onSongChange(newIndex);
  };

  const handleSongClick = (index) => {
    onSongChange(index);
  };

  return (
    <div className="start-screen">
      <h1>🎹 PIANO INVADERS 👾</h1>

      <div className="barrel-container">
        <div className="barrel-window"></div>
        <div className="barrel-scroll" ref={scrollRef}>
          <div className="barrel-item">&nbsp;</div>
          {songs.map((song, idx) => (
            <div
              key={idx}
              className={`barrel-item ${idx === currentSongIndex ? 'selected' : ''}`}
              onClick={() => handleSongClick(idx)}
            >
              {song.name}
            </div>
          ))}
          <div className="barrel-item">&nbsp;</div>
        </div>
      </div>

      <div className="barrel-controls">
        <button className="barrel-btn" onClick={() => scrollSong(-1)}>
          ▲
        </button>
        <button className="barrel-btn" onClick={() => scrollSong(1)}>
          ▼
        </button>
      </div>

      <div className="btn-row">
        <button className="start-btn" onClick={onStart}>
          START
        </button>
        <button className="start-btn" onClick={onRandom}>
          RANDOM
        </button>
      </div>

      <button className="start-btn" onClick={onShowRules}>
        📜 RULES
      </button>
    </div>
  );
};

export default StartScreen;
