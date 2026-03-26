import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GAME_CONFIG, PIANO_KEYS, WHITE_KEYS, BLACK_KEYS, MIDI_TO_KEY } from '../constants/gameConfig.js';
import { AudioManager } from '../utils/AudioManager.js';
import { Note } from '../utils/Note.js';
import { LandStrip } from '../utils/LandStrip.js';
import Keyboard from './Keyboard.jsx';
import StartScreen from './StartScreen.jsx';
import GameOver from './GameOver.jsx';
import RulesPopup from './RulesPopup.jsx';
import { dottlToSong, isDottlFile } from '../utils/dottl.js';
import { loadLeaderboard, saveLeaderboard } from '../utils/leaderboard.js';
import { createPluginRegistry } from '../plugins/PluginRegistry.js';
import { playCountIn, initMetronome, playMetronomeTick } from '../utils/metronome.js';
import backgroundImg from '../assets/piano-invaders-background.webp';
import '../styles/PianoInvaders.css';

// Compute responsive layout values based on window size
function getLayout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isLandscapeMobile = w <= 1024 && w > h;
  const isPortraitMobile = w <= 1024 && h >= w;
  const isMobile = w <= 1024;
  // Only shrink keyboard in landscape mobile; portrait has plenty of vertical space
  const keyboardHeight = isLandscapeMobile ? 120 : 160;
  const toggleHeight = 20;
  const landOffset = keyboardHeight + toggleHeight + 30;
  const tankOffset = keyboardHeight + toggleHeight + 7;
  return { isMobile, isLandscapeMobile, isPortraitMobile, keyboardHeight, landOffset, tankOffset };
}

const PianoInvaders = ({ songs: customSongs, plugins = [] }) => {
  const [gameRunning, setGameRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [bpm, setBpm] = useState(65);
  const [health, setHealth] = useState(GAME_CONFIG.MAX_HEALTH);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [keyPositions, setKeyPositions] = useState({});
  const [layout, setLayout] = useState(getLayout);
  const [accuracy, setAccuracy] = useState(100);
  const accuracyRef = useRef(100);
  const beatTimesRef = useRef([]); // timestamps of recent beat ticks
  const lastHitBeatRef = useRef(-1); // index of last beat the user hit on
  const [countingIn, setCountingIn] = useState(false);
  const countingInRef = useRef(false);
  const [metronomeOn, setMetronomeOn] = useState(() => {
    const stored = localStorage.getItem('piano-invaders-metronome');
    return stored !== null ? stored === 'true' : true;
  });
  const [countIn, setCountIn] = useState(null);
  const metronomeOnRef = useRef(metronomeOn);

  const canvasRef = useRef(null);
  const bgImageRef = useRef(null);
  const registryRef = useRef(null);
  if (!registryRef.current) registryRef.current = createPluginRegistry(plugins);
  const audioManagerRef = useRef(null);
  if (!audioManagerRef.current) audioManagerRef.current = new AudioManager();
  const notesRef = useRef([]);
  const landStripRef = useRef(null);
  const bombEffectsRef = useRef([]);
  const hitEffectsRef = useRef([]);
  const ufoXRef = useRef(window.innerWidth / 2);
  const ufoDirectionRef = useRef(1);
  const melodyIndexRef = useRef(0);
  const gameStartTimeRef = useRef(0);
  const spawnTimerRef = useRef(null);
  const gameLoopIdRef = useRef(null);
  const [songs, setSongs] = useState([]);
  const songsRef = useRef([]);
  // Refs to avoid stale closures in game loop and spawn timer
  const bpmRef = useRef(bpm);
  const gameRunningRef = useRef(gameRunning);
  const currentSongIndexRef = useRef(currentSongIndex);
  const keyPositionsRef = useRef(keyPositions);
  const healthRef = useRef(health);
  const scoreRef = useRef(score);
  const layoutRef = useRef(layout);

  // Load background image
  useEffect(() => {
    const img = new Image();
    img.src = backgroundImg;
    img.onload = () => { bgImageRef.current = img; };
  }, []);

  // Keep refs in sync with state
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { gameRunningRef.current = gameRunning; }, [gameRunning]);
  useEffect(() => { currentSongIndexRef.current = currentSongIndex; }, [currentSongIndex]);
  useEffect(() => { keyPositionsRef.current = keyPositions; }, [keyPositions]);
  useEffect(() => { healthRef.current = health; }, [health]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { layoutRef.current = layout; }, [layout]);

  // Load songs from props or default
  useEffect(() => {
    const loadSongs = async () => {
      let loadedSongs;
      if (customSongs && customSongs.length > 0) {
        loadedSongs = customSongs;
      } else {
        try {
          const response = await fetch('/song_library.json');
          const data = await response.json();
          // Support both dottl format and legacy format
          loadedSongs = data.songs.map(song => {
            if (isDottlFile(song)) {
              return dottlToSong(song);
            }
            return song;
          });
        } catch (error) {
          console.error('Failed to load songs, using defaults:', error);
          loadedSongs = getDefaultSongs();
        }
      }
      // Append songs from plugins
      const pluginSongs = await registryRef.current.getSongs();
      loadedSongs = [...loadedSongs, ...pluginSongs];

      songsRef.current = loadedSongs;
      setSongs(loadedSongs);
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
    setScore(prev => prev + points);
  }, []);

  // Check loss condition when health reaches 0
  useEffect(() => {
    if (gameRunning && health <= 0) {
      endGame(false);
    }
  }, [health, gameRunning]);

  const [endStats, setEndStats] = useState(null);

  const endGame = useCallback((wasQuit) => {
    setGameRunning(false);
    setShowGameOver(true);

    const elapsed = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
    const finalBpm = bpmRef.current;
    const finalHealth = healthRef.current;
    const finalScore = scoreRef.current;

    // Difficulty multiplier: easy x1, intermediate x2, advanced x3
    const currentSong = songsRef.current[currentSongIndexRef.current];
    const difficultyMap = { easy: 1, intermediate: 2, advanced: 3 };
    const difficulty = currentSong?.difficulty ?? 'easy';
    const diffMultiplier = difficultyMap[difficulty] ?? 1;

    // TOTAL = score × (HP% + 1) × (BPM / base BPM) × time multiplier × difficulty
    const hpMultiplier = (finalHealth / GAME_CONFIG.MAX_HEALTH) + 1;
    const bpmMultiplier = finalBpm / 65;
    const timeMultiplier = 1 + (elapsed / 60);
    const total = Math.floor(finalScore * hpMultiplier * bpmMultiplier * timeMultiplier * diffMultiplier);

    setEndStats({
      score: finalScore,
      health: finalHealth,
      bpm: finalBpm,
      time: elapsed,
      total,
      wasQuit,
      difficulty,
      diffMultiplier,
      accuracy: accuracyRef.current,
      song: currentSong?.name || '',
    });

    registryRef.current.emit('onGameEnd', { song: currentSong?.name, score: finalScore, health: finalHealth, bpm: finalBpm, elapsed, total, wasQuit });
    audioManagerRef.current.playGameOver();

    if (spawnTimerRef.current) {
      clearTimeout(spawnTimerRef.current);
    }
    if (gameLoopIdRef.current) {
      cancelAnimationFrame(gameLoopIdRef.current);
    }
  }, []);

  const initLandStrip = useCallback(() => {
    const canvas = canvasRef.current;
    const h = canvas ? canvas.height : window.innerHeight;
    const w = canvas ? canvas.width : window.innerWidth;
    const landY = h - layoutRef.current.landOffset;
    landStripRef.current = new LandStrip(w, landY);
  }, []);

  const spawnBeatRef = useRef(0);
  const nextSpawnTimeRef = useRef(0);

  const spawnNote = useCallback(() => {
    if (!gameRunningRef.current) return;

    const song = songsRef.current[currentSongIndexRef.current];
    if (!song) return;

    // Every melody entry = one beat
    const beatInBar = spawnBeatRef.current % 4;

    // Record beat timestamp for accuracy tracking
    beatTimesRef.current.push(performance.now());
    if (beatTimesRef.current.length > 16) beatTimesRef.current.shift();

    if (metronomeOnRef.current) {
      playMetronomeTick(beatInBar, 0.6);
    }

    // Decay accuracy if user missed the previous beat
    const beatIdx = beatTimesRef.current.length - 1;
    if (!countingInRef.current && beatIdx > 0 && lastHitBeatRef.current < beatIdx - 1) {
      accuracyRef.current = Math.max(0, accuracyRef.current - 3);
      setAccuracy(accuracyRef.current);
    }

    spawnBeatRef.current++;

    const noteData = song.melody[melodyIndexRef.current];

    if (Array.isArray(noteData)) {
      // Subdivision: schedule sub-notes within this beat
      const subCount = noteData.length;
      const beatInterval = 60000 / bpmRef.current;
      const subInterval = beatInterval / subCount;

      noteData.forEach((subNote, idx) => {
        if (subNote !== null && typeof subNote === 'string') {
          const delay = idx * subInterval;
          setTimeout(() => {
            if (!gameRunningRef.current) return;
            const midiLower = subNote.toLowerCase();
            const x = keyPositionsRef.current[midiLower];
            if (x !== undefined) {
              const keyData = MIDI_TO_KEY[midiLower];
              notesRef.current.push(new Note(subNote, x, keyData, ufoXRef.current));
            }
          }, delay);
        }
      });
    } else if (noteData !== null && typeof noteData === 'string') {
      const midiLower = noteData.toLowerCase();
      const x = keyPositionsRef.current[midiLower];

      if (x !== undefined) {
        const keyData = MIDI_TO_KEY[midiLower];
        notesRef.current.push(new Note(noteData, x, keyData, ufoXRef.current));
      }
    }

    melodyIndexRef.current++;
    if (melodyIndexRef.current >= song.melody.length) {
      melodyIndexRef.current = 0;
    }

    // One beat per melody entry (subdivisions are handled within the beat)
    const beatInterval = 60000 / bpmRef.current;
    nextSpawnTimeRef.current += beatInterval;
    const drift = nextSpawnTimeRef.current - performance.now();
    spawnTimerRef.current = setTimeout(spawnNote, Math.max(0, drift));
  }, []);

  const updateBpm = useCallback(() => {
    const now = Date.now();
    const elapsed = now - gameStartTimeRef.current;

    if (elapsed > GAME_CONFIG.BPM_INCREASE_DELAY) {
      const timeSinceFirstMinute = elapsed - GAME_CONFIG.BPM_INCREASE_DELAY;
      const expectedIncreases = Math.floor(timeSinceFirstMinute / GAME_CONFIG.BPM_INCREASE_INTERVAL);
      const song = songsRef.current[currentSongIndexRef.current];
      const targetBpm = song.bpm + expectedIncreases * GAME_CONFIG.BPM_INCREASE_AMOUNT;

      if (targetBpm > bpmRef.current) {
        setBpm(targetBpm);
        bpmRef.current = targetBpm;
      }
    }
  }, []);

  const gameLoop = useCallback(() => {
    if (!gameRunningRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image covering the full area behind and below the ground
    const curLayout = layoutRef.current;
    const bgLandY = canvas.height - curLayout.landOffset;
    if (bgImageRef.current) {
      const img = bgImageRef.current;
      // Cover from top of canvas to bottom, maintaining aspect ratio
      const imgAspect = img.width / img.height;
      const canvasAspect = canvas.width / canvas.height;
      let drawW, drawH, drawX, drawY;
      if (canvasAspect > imgAspect) {
        drawW = canvas.width;
        drawH = drawW / imgAspect;
      } else {
        drawH = canvas.height;
        drawW = drawH * imgAspect;
      }
      drawX = (canvas.width - drawW) / 2;
      drawY = canvas.height - drawH;
      ctx.globalAlpha = 0.4;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.globalAlpha = 1;
    }

    updateBpm();

    // Animate UFO back and forth
    const ufoMargin = 80;
    ufoXRef.current += GAME_CONFIG.UFO_SPEED * ufoDirectionRef.current;
    if (ufoXRef.current > canvas.width - ufoMargin) {
      ufoXRef.current = canvas.width - ufoMargin;
      ufoDirectionRef.current = -1;
    } else if (ufoXRef.current < ufoMargin) {
      ufoXRef.current = ufoMargin;
      ufoDirectionRef.current = 1;
    }

    // Update UFO DOM element position
    const ufoEl = canvas.parentElement?.querySelector('.ufo');
    if (ufoEl) {
      ufoEl.style.left = `${ufoXRef.current}px`;
    }

    // Update notes
    const landY = bgLandY;
    const bpmMultiplier = bpmRef.current / 65;
    notesRef.current.forEach(note => note.update(bpmMultiplier, landY));

    // Draw target zone indicator
    const zoneTop = landY - GAME_CONFIG.TARGET_ZONE_TOP;
    const zoneBottom = landY - GAME_CONFIG.TARGET_ZONE_BOTTOM;
    ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
    ctx.fillRect(0, zoneTop, canvas.width, zoneBottom - zoneTop);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.15)';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, zoneTop);
    ctx.lineTo(canvas.width, zoneTop);
    ctx.moveTo(0, zoneBottom);
    ctx.lineTo(canvas.width, zoneBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw beat grid lines when metronome is on
    if (metronomeOnRef.current && beatTimesRef.current.length > 0) {
      const now = performance.now();
      const msPerBeat = 60000 / bpmRef.current;
      // Note speed: px per frame at 60fps, scaled by bpm
      const pxPerFrame = GAME_CONFIG.NOTE_BASE_SPEED * bpmMultiplier;
      const pxPerMs = pxPerFrame * 60 / 1000;

      ctx.setLineDash([4, 8]);
      ctx.lineWidth = 1;

      // Walk through beats — use most recent beat as anchor
      const lastBeatTime = beatTimesRef.current[beatTimesRef.current.length - 1];
      for (let i = -20; i <= 20; i++) {
        const beatTime = lastBeatTime + (i * msPerBeat);
        const msAgo = now - beatTime;
        const y = GAME_CONFIG.NOTE_START_Y + msAgo * pxPerMs;
        if (y < 0 || y > landY + 10) continue;
        const inZone = y > zoneTop && y < zoneBottom;
        ctx.strokeStyle = inZone
          ? 'rgba(0, 255, 0, 0.35)'
          : 'rgba(0, 255, 0, 0.12)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw bright "FIRE" line — shows where the first note should be hit
      // Positioned at the midpoint of the target zone
      const fireLine = (zoneTop + zoneBottom) / 2;
      ctx.setLineDash([]);
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#0f0';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, fireLine);
      ctx.lineTo(canvas.width, fireLine);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
    }

    // Check collisions with land strip
    const landStrip = landStripRef.current;

    notesRef.current.forEach(note => {
      if (!note.active) return;

      // Note reaches the land — bomb it
      if (note.y >= landY - 20 && !note.hitLand) {
        note.hitLand = true;
        // Bomb the land strip visually
        if (landStrip) {
          landStrip.bomb(note.x, GAME_CONFIG.BOMB_RADIUS);
        }
        // Add bomb effect
        bombEffectsRef.current.push({
          x: note.x,
          y: landY,
          frame: 0,
          maxFrames: 15,
        });
        // Damage health
        setHealth(prev => Math.max(0, prev - GAME_CONFIG.DAMAGE_PER_BOMB));
        audioManagerRef.current.playMiss();
        registryRef.current.emit('onNoteMiss', { midi: note.midi, x: note.x, y: note.y });
        note.active = false;
      }

      if (note.active && note.isOffScreen(canvas.height)) {
        note.active = false;
      }
    });

    // Draw bomb effects
    bombEffectsRef.current = bombEffectsRef.current.filter(effect => {
      effect.frame++;
      if (effect.frame > effect.maxFrames) return false;

      const progress = effect.frame / effect.maxFrames;
      const radius = GAME_CONFIG.BOMB_RADIUS * (0.5 + progress);
      const alpha = 1 - progress;

      // Expanding ring
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, ${Math.floor(100 * (1 - progress))}, 0, ${alpha})`;
      ctx.lineWidth = 3 * (1 - progress);
      ctx.stroke();

      // Flash at center
      if (effect.frame < 5) {
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 6 * (1 - progress), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      }

      return true;
    });

    // Draw hit confetti
    hitEffectsRef.current = hitEffectsRef.current.filter(p => {
      p.frame++;
      if (p.frame > p.maxFrames) return false;

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.vx *= 0.98; // drag

      const alpha = 1 - p.frame / p.maxFrames;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(
        Math.round(p.x) - Math.floor(p.size / 2),
        Math.round(p.y) - Math.floor(p.size / 2),
        p.size,
        p.size
      );
      ctx.globalAlpha = 1;
      return true;
    });

    // Draw land strip
    if (landStrip) {
      landStrip.draw(ctx);
    }

    // Draw notes
    const activeNotes = notesRef.current.filter(n => n.active);

    // Sort notes by Y position (descending) so the note closest to the target is first
    // This ensures the lowest note (highest Y) is position 0 = GREEN
    const sortedNotes = [...activeNotes].sort((a, b) => b.y - a.y);

    sortedNotes.forEach((note, idx) => {
      note.draw(ctx, idx);
    });

    notesRef.current = notesRef.current.filter(n => n.active);

    gameLoopIdRef.current = requestAnimationFrame(gameLoop);
  }, [endGame, updateBpm]);

  const handleKeyPress = useCallback((midi) => {
    if (!gameRunningRef.current) return;

    // Play the note sound
    audioManagerRef.current.playNote(midi, '8n');

    const activeNotes = notesRef.current.filter(n => n.active);
    if (activeNotes.length === 0) return;

    // Sort by Y position to get the note closest to the target (highest Y = furthest down)
    const sortedNotes = [...activeNotes].sort((a, b) => b.y - a.y);
    const nextNote = sortedNotes[0];

    // Match the correct note anywhere on screen — no zone restriction
    if (nextNote.midi.toLowerCase() === midi.toLowerCase()) {
      // Spawn confetti explosion at the note's position
      const colors = ['#f00', '#0f0', '#00f', '#f00', '#0f0', '#00f'];
      for (let i = 0; i < 16; i++) {
        const angle = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.4;
        const speed = 2 + Math.random() * 4;
        hitEffectsRef.current.push({
          x: nextNote.x,
          y: nextNote.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          size: 3 + Math.floor(Math.random() * 4),
          color: colors[Math.floor(Math.random() * colors.length)],
          frame: 0,
          maxFrames: 25 + Math.floor(Math.random() * 15),
        });
      }
      nextNote.active = false;
      updateScore(GAME_CONFIG.POINTS_PER_NOTE);
      audioManagerRef.current.playHit();
      registryRef.current.emit('onNoteHit', { midi, x: nextNote.x, y: nextNote.y });

      // Accuracy: measure how close this hit is to the nearest beat
      const now = performance.now();
      const beats = beatTimesRef.current;
      if (beats.length > 0) {
        const msPerBeat = 60000 / bpmRef.current;
        // Find nearest beat (past or future)
        let minOffset = Infinity;
        let nearestIdx = -1;
        for (let i = beats.length - 1; i >= Math.max(0, beats.length - 4); i--) {
          const offset = Math.abs(now - beats[i]);
          if (offset < minOffset) { minOffset = offset; nearestIdx = i; }
        }
        // Also check next expected beat
        const nextBeatTime = beats[beats.length - 1] + msPerBeat;
        const nextOffset = Math.abs(now - nextBeatTime);
        if (nextOffset < minOffset) { minOffset = nextOffset; }

        // Within 25% of beat interval = on beat, gain accuracy
        // 25-50% = slightly off, no change
        // >50% = off beat, lose accuracy
        const ratio = minOffset / msPerBeat;
        if (ratio < 0.25) {
          accuracyRef.current = Math.min(100, accuracyRef.current + 2);
        } else if (ratio > 0.4) {
          accuracyRef.current = Math.max(0, accuracyRef.current - 4);
        }
        setAccuracy(accuracyRef.current);
        lastHitBeatRef.current = beats.length - 1;
      }
    }
  }, [updateScore]);

  const startGame = useCallback(async (songIndex) => {
    // Use provided index or fall back to current state
    const idx = songIndex !== undefined ? songIndex : currentSongIndexRef.current;

    // Initialize audio
    await audioManagerRef.current.init();

    const song = songsRef.current[idx];
    if (!song) return;

    // Clear any existing timers
    if (spawnTimerRef.current) {
      clearTimeout(spawnTimerRef.current);
      spawnTimerRef.current = null;
    }
    if (gameLoopIdRef.current) {
      cancelAnimationFrame(gameLoopIdRef.current);
      gameLoopIdRef.current = null;
    }

    setCurrentSongIndex(idx);
    setBpm(song.bpm);
    bpmRef.current = song.bpm;
    setScore(0);
    setHealth(GAME_CONFIG.MAX_HEALTH);
    healthRef.current = GAME_CONFIG.MAX_HEALTH;
    setShowStartScreen(false);
    setShowGameOver(false);

    melodyIndexRef.current = 0;
    spawnBeatRef.current = 0;
    beatTimesRef.current = [];
    lastHitBeatRef.current = -1;
    accuracyRef.current = 100;
    setAccuracy(100);
    notesRef.current = [];
    bombEffectsRef.current = [];
    hitEffectsRef.current = [];
    gameStartTimeRef.current = Date.now();

    initLandStrip();

    gameStartTimeRef.current = Date.now();

    // Start the game loop immediately (shows UFO, land, background)
    setGameRunning(true);
    registryRef.current.emit('onGameStart', { song: song.name, bpm: song.bpm, difficulty: song.difficulty });

    // 2-bar count-in: "1 - 2 - | 1 2 3 4"
    // Notes start dropping at bar 2 beat 1 so player sees them during "1 2 3 4"
    setCountingIn(true);
    countingInRef.current = true;
    await initMetronome();
    let notesStarted = false;
    await playCountIn(song.bpm, ({ bar, beat, label }) => {
      setCountIn(label ? { beat: label, bar } : null);
      // Start dropping notes at bar 2 beat 1
      if (bar === 2 && beat === 1 && !notesStarted) {
        notesStarted = true;
        nextSpawnTimeRef.current = performance.now();
        spawnNote();
      }
    });
    setCountIn(null);
    setCountingIn(false);
    countingInRef.current = false;
    gameStartTimeRef.current = Date.now();
    if (!notesStarted) {
      nextSpawnTimeRef.current = performance.now();
      spawnNote();
    }
  }, [initLandStrip, spawnNote]);

  const [importStatus, setImportStatus] = useState(null);

  const handleImportDottl = useCallback((file) => {
    setImportStatus({ type: 'loading', message: 'LOADING...' });
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        // Try plugin parsers first, then dottl
        const pluginSong = registryRef.current.parseSong(data);
        let song = null;
        if (pluginSong) {
          song = pluginSong;
        } else if (isDottlFile(data)) {
          song = dottlToSong(data);
        }
        if (song) {
          if (!song.melody || song.melody.length === 0) {
            setImportStatus({ type: 'error', message: 'NO NOTES FOUND' });
            return;
          }
          const newSongs = [...songsRef.current, song];
          songsRef.current = newSongs;
          setSongs(newSongs);
          setCurrentSongIndex(newSongs.length - 1);
          setImportStatus({ type: 'success', message: `LOADED: ${song.name}` });
        } else {
          setImportStatus({ type: 'error', message: 'INVALID FILE FORMAT' });
        }
      } catch (err) {
        console.error('Failed to import .dottl file:', err);
        setImportStatus({ type: 'error', message: 'FAILED TO PARSE FILE' });
      }
    };
    reader.onerror = () => {
      setImportStatus({ type: 'error', message: 'FAILED TO READ FILE' });
    };
    reader.readAsText(file);
  }, []);

  const toggleMetronome = useCallback(() => {
    const next = !metronomeOnRef.current;
    setMetronomeOn(next);
    metronomeOnRef.current = next;
    localStorage.setItem('piano-invaders-metronome', String(next));
  }, []);

  const startRandomGame = useCallback(async () => {
    const randomIndex = Math.floor(Math.random() * songsRef.current.length);
    startGame(randomIndex);
  }, [startGame]);

  const restartGame = useCallback(() => {
    setShowGameOver(false);
    setShowStartScreen(true);
    setGameRunning(false);
  }, []);

  const quitGame = useCallback(() => {
    endGame(true);
  }, [endGame]);

  const handleResize = useCallback(() => {
    const newLayout = getLayout();
    setLayout(newLayout);
    layoutRef.current = newLayout;
    if (canvasRef.current) {
      // Use the canvas element's actual rendered size so pixel coords match DOM coords
      const rect = canvasRef.current.getBoundingClientRect();
      canvasRef.current.width = rect.width;
      canvasRef.current.height = rect.height;
    }
    // Only regenerate land when the game is not running to prevent
    // restoring destroyed terrain mid-game
    if (!gameRunningRef.current) {
      initLandStrip();
    }
  }, [initLandStrip]);

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
  }, [gameRunning]);

  // Cleanup spawn timer when game stops (spawning is started by startGame directly)
  useEffect(() => {
    return () => {
      if (spawnTimerRef.current) {
        clearTimeout(spawnTimerRef.current);
      }
    };
  }, [gameRunning]);

  useEffect(() => {
    return () => {
      audioManagerRef.current.dispose();
    };
  }, []);

  // Plugin lifecycle: init, theme, dispose
  useEffect(() => {
    const registry = registryRef.current;
    registry.init();

    // Apply theme CSS variable overrides
    const theme = registry.getTheme();
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.cssVars)) {
      root.style.setProperty(key, value);
    }

    return () => {
      for (const key of Object.keys(theme.cssVars)) {
        root.style.removeProperty(key);
      }
      registry.dispose();
    };
  }, []);

  const currentSong = songs[currentSongIndex];
  const healthPct = (health / GAME_CONFIG.MAX_HEALTH) * 100;
  const healthColor = healthPct > 60 ? '#0f0' : healthPct > 30 ? '#ff0' : '#f00';

  // Leaderboard provider: plugin override or default localStorage
  const leaderboardProvider = registryRef.current.getLeaderboard() || {
    load: async () => loadLeaderboard(),
    save: async (entries) => saveLeaderboard(entries),
  };

  return (
    <div className={`piano-invaders-game ${layout.isMobile ? 'is-mobile' : ''}`}
         style={{ '--keyboard-height': `${layout.keyboardHeight}px` }}>
      <div className="game-container">
        <canvas ref={canvasRef} className="game-canvas" />

        <div className="header">
          <div className="header-left">
            <div className="score">SCORE: {score}</div>
            <div className="bpm">BPM: {bpm}</div>
          </div>
          <div className="header-center">
            {gameRunning && (
              <>
                <div className="health-bar-container">
                  <div className="health-bar-label">HP</div>
                  <div className="health-bar-track">
                    <div
                      className="health-bar-fill"
                      style={{ width: `${healthPct}%`, backgroundColor: healthColor }}
                    />
                  </div>
                </div>
                <div className="health-bar-container accuracy-bar">
                  <div className="health-bar-label">ACC</div>
                  <div className="health-bar-track">
                    <div
                      className="health-bar-fill"
                      style={{
                        width: `${accuracy}%`,
                        backgroundColor: accuracy > 70 ? '#0ff' : accuracy > 40 ? '#ff0' : '#f00',
                      }}
                    />
                  </div>
                </div>
              </>
            )}
            <div className="song-title">{currentSong?.name || 'Loading...'}</div>
          </div>
          {gameRunning && (
            <button className="quit-btn" onClick={quitGame}>
              ✕ QUIT
            </button>
          )}
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

        <div className="tank" style={{ left: '50%', bottom: `${layout.tankOffset}px` }}></div>

        <Keyboard onKeyPress={handleKeyPress} onPositionsCalculated={setKeyPositions} />

        <div className="metronome-toggle">
          <button
            className={`sound-toggle-btn ${metronomeOn ? 'active' : ''}`}
            onClick={toggleMetronome}
          >MET</button>
        </div>

        <div className="sound-toggle">
          <button
            className={`sound-toggle-btn ${!audioManagerRef.current.usePiano ? 'active' : ''}`}
            onClick={() => { audioManagerRef.current.setUsePiano(false); setScore(s => s); }}
          >SYN</button>
          <button
            className={`sound-toggle-btn ${audioManagerRef.current.usePiano ? 'active' : ''}`}
            onClick={() => {
              if (audioManagerRef.current.pianoReady) {
                audioManagerRef.current.setUsePiano(true);
                setScore(s => s);
              }
            }}
            disabled={!audioManagerRef.current.pianoReady}
          >PNO</button>
        </div>

        {showStartScreen && (
          <StartScreen
            songs={songs}
            currentSongIndex={currentSongIndex}
            onSongChange={setCurrentSongIndex}
            onStart={startGame}
            onRandom={startRandomGame}
            onShowRules={() => setShowRules(true)}
            onImportDottl={handleImportDottl}
            importStatus={importStatus}
            leaderboard={leaderboardProvider}
            metronomeOn={metronomeOn}
            onToggleMetronome={toggleMetronome}
          />
        )}

        <GameOver stats={endStats} show={showGameOver} onRestart={restartGame} leaderboard={leaderboardProvider} />

        {showRules && <RulesPopup onClose={() => setShowRules(false)} />}

        {countingIn && (
          <div className={`count-in-overlay ${countIn?.bar === 2 ? 'count-in-bar2' : ''}`}>
            {countIn && (
              <div className="count-in-beat" key={`${countIn.bar}-${countIn.beat}`}>{countIn.beat}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PianoInvaders;
