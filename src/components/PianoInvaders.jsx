import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GAME_CONFIG, PIANO_KEYS, WHITE_KEYS, BLACK_KEYS, MIDI_TO_KEY } from '../constants/gameConfig.js';
import { AudioManager } from '../utils/AudioManager.js';
import { Note } from '../utils/Note.js';
import Keyboard from './Keyboard.jsx';
import StartScreen from './StartScreen.jsx';
import GameOver from './GameOver.jsx';
import RulesPopup from './RulesPopup.jsx';
import '../styles/PianoInvaders.css';

const PianoInvaders = ({ songs: customSongs }) => {
  const [gameRunning, setGameRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [bpm, setBpm] = useState(65);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [keyPositions, setKeyPositions] = useState({});

  const canvasRef = useRef(null);
  const audioManagerRef = useRef(new AudioManager());
  const notesRef = useRef([]);
  const basesRef = useRef([]);
  const melodyIndexRef = useRef(0);
  const gameStartTimeRef = useRef(0);
  const spawnTimerRef = useRef(null);
  const gameLoopIdRef = useRef(null);
  const songsRef = useRef([]);

  // Load songs from props or default
  useEffect(() => {
    const loadSongs = async () => {
      if (customSongs && customSongs.length > 0) {
        songsRef.current = customSongs;
      } else {
        try {
          const response = await fetch('/song_library.json');
          const data = await response.json();
          songsRef.current = data.songs;
        } catch (error) {
          console.error('Failed to load songs, using defaults:', error);
          songsRef.current = getDefaultSongs();
        }
      }
    };
    loadSongs();
  }, [customSongs]);

  const getDefaultSongs = () => [
    {
      name: 'Ode to Joy',
      bpm: 65,
      melody: ['E3', 'E3', 'F3', 'G3', 'G3', 'F3', 'E3', 'D3', 'C3', 'C3', 'D3', 'E3', 'E3', 'D3', 'D3']
    }
  ];

  const updateScore = useCallback((points) => {
    setScore(prev => {
      const newScore = prev + points;
      if (newScore >= GAME_CONFIG.WIN_SCORE) {
        endGame(true);
      }
      return newScore;
    });
  }, []);

  const endGame = useCallback((won) => {
    setGameRunning(false);
    setGameWon(won);
    setShowGameOver(true);

    if (won) {
      audioManagerRef.current.playWin();
    } else {
      audioManagerRef.current.playGameOver();
    }

    if (spawnTimerRef.current) {
      clearTimeout(spawnTimerRef.current);
    }
    if (gameLoopIdRef.current) {
      cancelAnimationFrame(gameLoopIdRef.current);
    }
  }, []);

  const initBases = useCallback(() => {
    const bases = [];
    const basePositions = [0.15, 0.38, 0.62, 0.85];

    basePositions.forEach((pos) => {
      const base = {
        x: window.innerWidth * pos - 25,
        y: window.innerHeight - GAME_CONFIG.BASE_BOTTOM_OFFSET - 35,
        width: 50,
        height: 35,
        pixels: []
      };

      const pattern = [
        '  ########  ',
        ' ########## ',
        '############',
        '############',
        '############',
        '###  ##  ###',
        '##   ##   ##'
      ];

      pattern.forEach((row, y) => {
        [...row].forEach((char, x) => {
          if (char === '#') {
            base.pixels.push({
              x: base.x + x * 4,
              y: base.y + y * 5,
              active: true
            });
          }
        });
      });

      bases.push(base);
    });

    basesRef.current = bases;
  }, []);

  const spawnNote = useCallback(() => {
    if (!gameRunning) return;

    const song = songsRef.current[currentSongIndex];
    if (!song) return;

    const noteData = song.melody[melodyIndexRef.current];

    if (noteData !== null) {
      const midiLower = noteData.toLowerCase();
      const x = keyPositions[midiLower];

      if (x !== undefined) {
        const keyData = MIDI_TO_KEY[midiLower];
        notesRef.current.push(new Note(noteData, x, keyData));
      }
    }

    melodyIndexRef.current++;
    if (melodyIndexRef.current >= song.melody.length) {
      melodyIndexRef.current = 0;
    }

    const interval = 60000 / bpm;
    spawnTimerRef.current = setTimeout(spawnNote, interval);
  }, [gameRunning, currentSongIndex, bpm, keyPositions]);

  const updateBpm = useCallback(() => {
    const now = Date.now();
    const elapsed = now - gameStartTimeRef.current;

    if (elapsed > GAME_CONFIG.BPM_INCREASE_DELAY) {
      const timeSinceFirstMinute = elapsed - GAME_CONFIG.BPM_INCREASE_DELAY;
      const expectedIncreases = Math.floor(timeSinceFirstMinute / GAME_CONFIG.BPM_INCREASE_INTERVAL);
      const song = songsRef.current[currentSongIndex];
      const targetBpm = song.bpm + expectedIncreases * GAME_CONFIG.BPM_INCREASE_AMOUNT;

      if (targetBpm > bpm) {
        setBpm(targetBpm);
      }
    }
  }, [bpm, currentSongIndex]);

  const gameLoop = useCallback(() => {
    if (!gameRunning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateBpm();

    // Update notes
    const bpmMultiplier = bpm / 65;
    notesRef.current.forEach(note => note.update(bpmMultiplier));

    // Check collisions with bases
    const baseY = window.innerHeight - GAME_CONFIG.BASE_BOTTOM_OFFSET;
    notesRef.current.forEach(note => {
      if (!note.active) return;

      if (note.y >= baseY - 35 && note.y <= baseY) {
        basesRef.current.forEach(base => {
          const activePixels = base.pixels.filter(p => p.active);
          if (activePixels.length > 0 && note.x >= base.x && note.x <= base.x + 50) {
            const pixel = activePixels[Math.floor(Math.random() * activePixels.length)];
            pixel.active = false;
            note.active = false;
            audioManagerRef.current.playMiss();
          }
        });
      }

      if (note.isOffScreen(window.innerHeight)) {
        note.active = false;
      }
    });

    // Check game over
    const totalPixels = basesRef.current.reduce(
      (sum, base) => sum + base.pixels.filter(p => p.active).length,
      0
    );
    if (totalPixels === 0) {
      endGame(false);
      return;
    }

    // Draw bases
    basesRef.current.forEach(base => {
      base.pixels.forEach(pixel => {
        if (pixel.active) {
          ctx.fillStyle = '#0f0';
          ctx.fillRect(pixel.x, pixel.y, 5, 5);
        }
      });
    });

    // Draw notes
    const activeNotes = notesRef.current.filter(n => n.active);
    activeNotes.forEach((note, idx) => {
      note.draw(ctx, idx);
    });

    notesRef.current = notesRef.current.filter(n => n.active);

    gameLoopIdRef.current = requestAnimationFrame(gameLoop);
  }, [gameRunning, bpm, endGame, updateBpm]);

  const handleKeyPress = useCallback((midi) => {
    if (!gameRunning) return;

    // Play the note sound
    audioManagerRef.current.playNote(midi, '8n');

    const activeNotes = notesRef.current.filter(n => n.active);
    if (activeNotes.length === 0) return;

    const nextNote = activeNotes[0];

    if (nextNote.midi.toLowerCase() === midi.toLowerCase() && nextNote.isInTargetZone(window.innerHeight)) {
      nextNote.active = false;
      updateScore(GAME_CONFIG.POINTS_PER_NOTE);
      audioManagerRef.current.playHit();
    }
  }, [gameRunning, updateScore]);

  const startGame = useCallback(async () => {
    // Initialize audio
    await audioManagerRef.current.init();

    const song = songsRef.current[currentSongIndex];
    if (!song) return;

    setBpm(song.bpm);
    setScore(0);
    setGameRunning(true);
    setShowStartScreen(false);
    setShowGameOver(false);

    melodyIndexRef.current = 0;
    notesRef.current = [];
    gameStartTimeRef.current = Date.now();

    initBases();
    spawnNote();
    gameLoop();
  }, [currentSongIndex, initBases, spawnNote, gameLoop]);

  const startRandomGame = useCallback(async () => {
    const randomIndex = Math.floor(Math.random() * songsRef.current.length);
    setCurrentSongIndex(randomIndex);
    setTimeout(() => startGame(), 100);
  }, [startGame]);

  const restartGame = useCallback(() => {
    setShowGameOver(false);
    setShowStartScreen(true);
    setGameRunning(false);
  }, []);

  const handleResize = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    }
    initBases();
  }, [initBases]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    if (gameRunning) {
      gameLoop();
    }
    return () => {
      if (gameLoopIdRef.current) {
        cancelAnimationFrame(gameLoopIdRef.current);
      }
    };
  }, [gameRunning, gameLoop]);

  useEffect(() => {
    return () => {
      if (spawnTimerRef.current) {
        clearTimeout(spawnTimerRef.current);
      }
      audioManagerRef.current.dispose();
    };
  }, []);

  const currentSong = songsRef.current[currentSongIndex];

  return (
    <div className="piano-invaders-game">
      <div className="game-container">
        <canvas ref={canvasRef} className="game-canvas" />

        <div className="header">
          <div className="header-left">
            <div className="score">SCORE: {score}</div>
            <div className="bpm">BPM: {bpm}</div>
          </div>
          <div className="song-title">{currentSong?.name || 'Loading...'}</div>
        </div>

        <div className="ufo">
          <div className="ufo-container">
            <div className="ufo-dome"></div>
            <div className="ufo-body"></div>
            <div className="ufo-lights">
              <div className="ufo-light"></div>
              <div className="ufo-light"></div>
              <div className="ufo-light"></div>
            </div>
          </div>
        </div>

        <div className="tank" style={{ left: '50%' }}></div>

        <Keyboard onKeyPress={handleKeyPress} onPositionsCalculated={setKeyPositions} />

        {showStartScreen && (
          <StartScreen
            songs={songsRef.current}
            currentSongIndex={currentSongIndex}
            onSongChange={setCurrentSongIndex}
            onStart={startGame}
            onRandom={startRandomGame}
            onShowRules={() => setShowRules(true)}
          />
        )}

        {showGameOver && <GameOver score={score} won={gameWon} onRestart={restartGame} />}

        {showRules && <RulesPopup onClose={() => setShowRules(false)} />}
      </div>
    </div>
  );
};

export default PianoInvaders;
