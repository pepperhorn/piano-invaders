# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Piano Invaders is a retro-styled rhythm game combining Space Invaders with piano mechanics. Built as a React component designed for easy embedding. Players hit falling musical notes by pressing the correct piano keys. Notes drop from a moving UFO, and missed notes bomb a procedural land strip and drain HP.

## Commands

- **Dev server:** `npm run dev -- --host 0.0.0.0`
- **Production build:** `npm run build` (note: vite.config.js is set to library mode, so this builds as a lib — use dev server for app testing)
- **Library build:** `npm run build:lib` (outputs ES/UMD bundles with React externalized)
- **Preview build:** `npm run preview`

No test framework is configured.

## Architecture

React + Vite app using Tone.js for audio synthesis. No TypeScript, no CSS framework — plain CSS.

### Key modules

- `src/components/PianoInvaders.jsx` — Main game component. Owns all game state (score, BPM, health, notes, land strip) via useState/useRef. Runs the canvas game loop via requestAnimationFrame and note spawning via setTimeout. Uses refs to avoid stale closures in callbacks. Also serves as the library entry point.
- `src/components/Keyboard.jsx` — Piano keyboard UI (18 keys, B2–E4) with QWERTY keyboard support (Ableton-style mapping). Reports key positions back via `onPositionsCalculated` callback.
- `src/components/StartScreen.jsx` — Song selection barrel scroller, .dottl file import, scrolling leaderboard marquee.
- `src/components/GameOver.jsx` — Stats display, 6-character name entry, top-10 leaderboard (localStorage).
- `src/components/RulesPopup.jsx` — Rules overlay.
- `src/utils/AudioManager.js` — Wraps Tone.js Synth for note playback and sound effects.
- `src/utils/Note.js` — Note class. Notes spawn at UFO position and lerp X toward target key as they fall.
- `src/utils/LandStrip.js` — Procedural terrain generator (trees, buildings) with bomb destruction.
- `src/utils/dottl.js` — Converter between .dottl song format and game format. Handles note names, octaves, transposition, difficulty extraction.
- `src/utils/leaderboard.js` — Shared leaderboard load/save with default scores.
- `src/constants/gameConfig.js` — All tunable game parameters (speeds, scoring, health, colors, piano key definitions).
- `src/styles/PianoInvaders.css` — All styling. Retro green-on-black theme using 'Press Start 2P' font. Uses CSS custom properties for responsive keyboard height.

### Game loop flow

1. `startGame()` initializes state, land strip, and sets `gameRunning = true`
2. useEffect triggers `spawnNote()` (setTimeout chain at BPM-derived intervals) and `gameLoop()` (requestAnimationFrame)
3. `gameLoop()` animates UFO, updates note positions, checks land collisions (bomb + HP damage), draws background/land/notes/effects to canvas
4. `handleKeyPress()` matches input against the lowest active note — correct hits spawn confetti, update score

### Scoring system

- +10 points per correct note hit
- -5 HP per missed note (hits land strip)
- Game ends when HP reaches 0 or player quits
- **TOTAL** = Score × (HP% + 1) × (BPM / 65) × (1 + minutes) × difficulty multiplier
- Difficulty multiplier: Easy x1, Intermediate x2, Advanced x3

### Song data / Dottl format

Songs are stored in `public/song_library.json` using the **Dottl song format** (`.dottl` v3). The spec is maintained at: **https://github.com/pepperhorn/dottl-spec**

When working with song data, always check the spec for the latest format. Key points:
- `.dottl` files are JSON with layers, grid-based notes, timing via `divisor` + `bpm`
- First layer = game melody, additional layers = accompaniment
- Game-specific extensions stored in `extensions["piano-invaders"]` (e.g., difficulty)
- `src/utils/dottl.js` handles conversion: `dottlToSong()` and `songToDottl()`
- Users can import `.dottl` files via the start screen

### Responsive layout

Layout is computed by `getLayout()` which returns keyboard height, land offset, and tank offset based on screen dimensions. Portrait mobile uses full 160px keyboard; landscape mobile uses 120px. Canvas pixel dimensions are set from `getBoundingClientRect()` to match DOM coordinates.

### Embedding

The component accepts an optional `songs` prop. The Vite library build (`build:lib`) externalizes React/ReactDOM for use as an embeddable widget.
