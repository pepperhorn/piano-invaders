# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Piano Invaders is a retro-styled rhythm game combining Space Invaders with piano mechanics. Built as a React component designed for easy embedding. Players hit falling musical notes by pressing the correct piano keys. Notes drop from a moving UFO, and missed notes bomb a procedural land strip and drain HP.

## Commands

- **Dev server:** `npm run dev -- --host 0.0.0.0` (standalone app at `/`, embed fixture at `/embed.html`)
- **App build:** `npm run build` -> `dist/` (nixpacks serves this)
- **Library build:** `npm run build:lib` -> `lib/index.js`, `lib/types/`, `lib/style.css` (vite `--mode lib`, ESM only, every bare import external)
- **Unit tests:** `npm test` (vitest + jsdom + canvas mock)
- **E2E:** `npm run test:e2e` (Playwright/Chromium against the embed fixture; starts vite on port 5199)
- **Typecheck / lint:** `npm run typecheck`, `npm run lint` (oxlint)

## Stack

React 19 + Vite 8 + TypeScript (strict). Plain CSS, no framework. Audio via smplr (Tone.js is gone). Score parsing via `ivories/core` (MusicXML, MXL, MIDI). Every JSX element gets a contextual class name (`pi-*`).

## Architecture

Layers, bottom to top:

- `src/song/` - everything that turns input into a `GameSong` (`types.ts`): `load.ts` (musicXml/scoreUrl/file/midi/dottl), `fromScore.ts` + `extract.ts` (melody extraction, folding into B2-E4), `dottl.ts` (dottl v5-v7 read, v7 write), `legacy.ts`, `normalize.ts`, `opensongs.ts` (OpenSongs index + on-demand song fetch), `pitch.ts`, `errors.ts` (`SongError` with code `score-load | score-parse | audio`).
- `src/audio/` - `AudioEngine` (smplr piano / soundfont / drum voices with synth fallback), `Transport` (beat clock), `metronome`, `sfx`, shared `context` (AudioContext created on first user gesture).
- `src/game/` - `GameSession` + `useGame` (beat-clock spawning, shots, combo, accuracy, HP, scoring in `scoring.ts`, gunship, looping songs).
- `src/render/` - canvas drawing: `drawFrame`, `LandStrip`, sprites, effects, note badges, palette.
- `src/components/` - `PianoInvaders` (the library component; owns screens, songs, OpenSongs, prefs), `Hud`, `Keyboard`, `StartScreen` (song roller), `GameOver`, `RulesPopup`.
- `src/hooks/` - `useContainerSize` (ResizeObserver on the game root; the game sizes to its container, not the viewport), `useScopedKeys` (QWERTY input only while the game element has focus).
- `src/plugins/` - plugin registry (songs, leaderboard, theme, parseSong, events).
- `src/index.ts` - library entry. `src/main.tsx` + `src/App.tsx` - standalone app (bundled `public/song_library.json` + `public/songs/ode-to-joy.musicxml`). `src/embed/` + `embed.html` - dev-only host-page fixture for e2e.

Scoring: +10 per hit, -5 HP per land hit (max 100); TOTAL = score x (hp/100 + 1) x (bpm/65) x (1 + minutes) x mult (easy 1, intermediate 2, advanced 3). Combo resets on a land hit, not on a wrong key. Songs loop until HP = 0 or quit; no automatic thinning (difficulty is a tag plus multiplier; crf 1-2 easy, 3 intermediate, 4-5 advanced, default easy). Keyboard is 18 keys B2-E4 (MIDI 47-64).

## Embed rules (do not break)

- No module-scope `window` / `document` / `localStorage` access; no writes to `document.documentElement`.
- No `100vh` / `100dvh` in `src/styles/piano-invaders.css`; no CSS `@import` of fonts (the host loads Press Start 2P and Poppins 400/600).
- Library CSS is scoped under `.piano-invaders` inside `@layer piano-invaders`; theme vars are `--pi-*`. `scripts/build-lib-css.mjs` checks this when building `lib/style.css`.
- Keys are scoped to the game element: typing in host inputs must not trigger the game.
- Errors go to `onError({code, message, cause})` and are logged once with `console.warn('[piano-invaders] <code>: <message>')`; never thrown into the host.
- The game fills its container; embeds test at 720x480 (`e2e/embed.spec.ts`).

## Songs

MusicXML is the default source (`musicXml`, `scoreUrl`, `file`, `midi`); dottl is the alternative. The OpenSongs library (`https://cdn.jsdelivr.net/gh/pepperhorn/opensongs-json@master/index.json`) is **on by default in picker mode** (`opensongs` prop; `false` disables, `{baseUrl}` overrides). OpenSongs scores start on beat 1, so `loadOpenSong` runs `padCountIn` (`src/song/pad.ts`): two bars of rest at the top, marked `countInBeats`; the session counts in over that rest on every loop instead of adding its own lead-in. We read **dottl v5-v7** and write **v7**; the spec lives at https://github.com/pepperhorn/dottl-spec (check it before touching `src/song/dottl.ts`; do not edit the spec). Game-specific extension: `extensions["piano-invaders"].difficulty`. Docs for hosts: `EMBEDDING_GUIDE.md`.
