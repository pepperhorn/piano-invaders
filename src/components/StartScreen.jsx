import React, { useEffect, useRef, useState } from 'react';

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

  const [isDragging, setIsDragging] = useState(false);

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
    const boundedIndex = ((targetIndex % songs.length) + songs.length) % songs.length;

    // Update highlighted song during drag
    if (boundedIndex !== currentSongIndex) {
      onSongChange(boundedIndex);
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
    let targetIndex = Math.round(dragStateRef.current.startIndex + itemsScrolled);
    targetIndex = ((targetIndex % songs.length) + songs.length) % songs.length;

    // Update to final position
    onSongChange(targetIndex);

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
  }, [currentSongIndex, songs.length]);

  return (
    <div className="start-screen">
      <h1>🎹 PIANO INVADERS 👾</h1>

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
