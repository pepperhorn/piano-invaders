import React, { useEffect, useRef, useState } from 'react';
import headerImg from '../assets/PianoInvaders-Header.webp';
import logoImg from '../assets/PianoInvaders-Logo-Trans.webp';

const STORAGE_KEY = 'piano-invaders-leaderboard';

const StartScreen = ({ songs, currentSongIndex, onSongChange, onStart, onRandom, onShowRules }) => {
  const scrollRef = useRef(null);
  const containerRef = useRef(null);
  const dragStateRef = useRef({
    isDragging: false,
    startY: 0,
    currentY: 0,
    startIndex: 0,
    velocity: 0,
    lastTime: 0,
    lastY: 0
  });
  // Refs to avoid stale closures in global event listeners
  const currentSongIndexRef = useRef(currentSongIndex);
  const songsLengthRef = useRef(songs.length);
  const onSongChangeRef = useRef(onSongChange);
  useEffect(() => { currentSongIndexRef.current = currentSongIndex; }, [currentSongIndex]);
  useEffect(() => { songsLengthRef.current = songs.length; }, [songs.length]);
  useEffect(() => { onSongChangeRef.current = onSongChange; }, [onSongChange]);

  const [isDragging, setIsDragging] = useState(false);

  const getLeaderboard = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    if (scrollRef.current && !dragStateRef.current.isDragging) {
      const offset = -(currentSongIndex + 1) * 40 + 55;
      scrollRef.current.style.transform = `translateY(${offset}px)`;
    }
  }, [currentSongIndex]);

  const scrollSong = (direction) => {
    const newIndex = (currentSongIndex + direction + songs.length) % songs.length;
    onSongChange(newIndex);
  };

  const handleSongClick = (index) => {
    if (!isDragging) {
      onSongChange(index);
    }
  };

  const getClientY = (e) => {
    return e.touches ? e.touches[0].clientY : e.clientY;
  };

  const handleDragStart = (e) => {
    const clientY = getClientY(e);
    const now = Date.now();

    dragStateRef.current = {
      isDragging: true,
      startY: clientY,
      currentY: clientY,
      startIndex: currentSongIndex,
      velocity: 0,
      lastTime: now,
      lastY: clientY
    };

    setIsDragging(true);

    // Prevent text selection on desktop
    if (!e.touches) {
      e.preventDefault();
    }
  };

  const handleDragMove = (e) => {
    if (!dragStateRef.current.isDragging) return;

    const clientY = getClientY(e);
    const now = Date.now();
    const deltaY = clientY - dragStateRef.current.startY;
    const deltaTime = now - dragStateRef.current.lastTime;

    // Calculate velocity for momentum
    if (deltaTime > 0) {
      const velocityY = (clientY - dragStateRef.current.lastY) / deltaTime;
      dragStateRef.current.velocity = velocityY;
    }

    dragStateRef.current.currentY = clientY;
    dragStateRef.current.lastY = clientY;
    dragStateRef.current.lastTime = now;

    // Update visual position immediately for smooth dragging
    const baseOffset = -(dragStateRef.current.startIndex + 1) * 40 + 55;
    const newOffset = baseOffset + deltaY;

    if (scrollRef.current) {
      scrollRef.current.style.transform = `translateY(${newOffset}px)`;
      scrollRef.current.style.transition = 'none';
    }

    // Calculate which song we're closest to
    const itemsScrolled = -deltaY / 40;
    const targetIndex = Math.round(dragStateRef.current.startIndex + itemsScrolled);
    const len = songsLengthRef.current;
    const boundedIndex = ((targetIndex % len) + len) % len;

    // Update highlighted song during drag
    if (boundedIndex !== currentSongIndexRef.current) {
      onSongChangeRef.current(boundedIndex);
    }
  };

  const handleDragEnd = () => {
    if (!dragStateRef.current.isDragging) return;

    const deltaY = dragStateRef.current.currentY - dragStateRef.current.startY;
    const velocity = dragStateRef.current.velocity;

    // Add momentum based on velocity
    const momentum = velocity * 50; // Adjust multiplier for feel
    const totalDelta = deltaY + momentum;

    // Calculate final position
    const itemsScrolled = -totalDelta / 40;
    const len = songsLengthRef.current;
    let targetIndex = Math.round(dragStateRef.current.startIndex + itemsScrolled);
    targetIndex = ((targetIndex % len) + len) % len;

    // Update to final position
    onSongChangeRef.current(targetIndex);

    // Re-enable transition for snap effect
    if (scrollRef.current) {
      scrollRef.current.style.transition = 'transform 0.3s ease-out';
    }

    dragStateRef.current.isDragging = false;
    setTimeout(() => setIsDragging(false), 100);
  };

  // Set up mouse/touch event listeners
  useEffect(() => {
    const handleGlobalMove = (e) => {
      if (dragStateRef.current.isDragging) {
        e.preventDefault();
        handleDragMove(e);
      }
    };

    const handleGlobalEnd = () => {
      handleDragEnd();
    };

    // Add listeners for desktop mouse drag
    document.addEventListener('mousemove', handleGlobalMove);
    document.addEventListener('mouseup', handleGlobalEnd);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('mouseup', handleGlobalEnd);
    };
  }, []);

  return (
    <div className="start-screen">
      <div className="start-header-logo">
        <img src={headerImg} alt="Piano Invaders" className="start-header-img start-header-desktop" />
        <img src={logoImg} alt="Piano Invaders" className="start-header-img start-header-mobile" />
      </div>

      <div
        className="barrel-container"
        ref={containerRef}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
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
        <button className="start-btn" onClick={() => onStart()}>
          START
        </button>
        <button className="start-btn" onClick={onRandom}>
          RANDOM
        </button>
      </div>

      <button className="start-btn start-btn-sm" onClick={onShowRules}>
        [?] RULES
      </button>

      <div className="marquee-container">
        <div className="marquee-text">
          {getLeaderboard().map((entry, idx) => (
            <span key={idx} className="marquee-entry">
              #{idx + 1} {entry.name} {entry.total.toLocaleString()}
              <span className="marquee-sep">///</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StartScreen;
