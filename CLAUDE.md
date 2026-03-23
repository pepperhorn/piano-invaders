# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Piano Invaders is a retro-styled rhythm game combining Space Invaders with piano mechanics. Built as a React component designed for easy embedding. Players hit falling musical notes by pressing the correct piano keys.

## Commands

- **Dev server:** `npm run dev -- --host 0.0.0.0`
- **Production build:** `npm run build`
- **Library build:** `npm run build:lib` (outputs ES/UMD bundles with React externalized)
- **Preview build:** `npm run preview`

No test framework is configured.

## Architecture

React + Vite app using Tone.js for audio synthesis. No TypeScript, no CSS framework — plain CSS.

### Key modules

- `src/components/PianoInvaders.jsx` — Main game component. Owns all game state (score, BPM, notes, bases) via useState/useRef. Runs the canvas game loop via requestAnimationFrame and note spawning via setTimeout. Also serves as the library entry point (`vite.config.js` `build.lib.entry`).
- `src/components/Keyboard.jsx` — Piano keyboard UI (18 keys, B2–E4). Reports key positions back to PianoInvaders via `onPositionsCalculated` callback so notes can align to keys.
- `src/components/StartScreen.jsx` — Song selection barrel scroller.
- `src/components/GameOver.jsx` / `RulesPopup.jsx` — Overlay screens.
- `src/utils/AudioManager.js` — Wraps Tone.js Synth for note playback and sound effects.
- `src/utils/Note.js` — Note class with position, speed, draw logic, and color based on queue position.
- `src/constants/gameConfig.js` — All tunable game parameters (speeds, scoring, colors, piano key definitions, MIDI mappings).
- `src/styles/PianoInvaders.css` — All styling. Retro green-on-black theme using 'Press Start 2P' font.

### Game loop flow

1. `startGame()` initializes state, bases, and sets `gameRunning = true`
2. useEffect triggers `spawnNote()` (setTimeout chain at BPM-derived intervals) and `gameLoop()` (requestAnimationFrame)
3. `gameLoop()` updates note positions, checks base collisions, draws to canvas
4. `handleKeyPress()` matches input against the lowest active note in the target zone

### Song data

Songs loaded from `/song_library.json` at runtime (or passed via `songs` prop). Format: `{ name, bpm, melody: ["C3", "D3", null, ...] }` where `null` = rest. Notes use MIDI naming (B2–E4).

### Embedding

The component accepts an optional `songs` prop. The Vite library build (`build:lib`) externalizes React/ReactDOM for use as an embeddable widget.
