# Piano Invaders modernization: design

Date: 2026-10-22
Status: approved 2026-10-22 (app first; becreative embed is a later round)

## Intent

Piano Invaders is a Space Invaders game for developing keyboardists: notes drop from a patrolling mothership, the student presses the matching key, and the gunship shoots the note. Over a song, the student learns the note progression, and play gradually tightens into playing in time (rhythm). The game was last touched in April 2026 and has fallen behind the current PepperHorn playbook used in tickle-me / ivories / play-me / pepperscore.

This work keeps the game as it is and replaces the technology underneath. It also makes it embeddable in becreative, fed a score from a crf-admin sheet. The key changes:

- MusicXML becomes the default song source. Dottl stays as the alternative, so students can write a song in dottl and play it in Invaders.
- The visuals get an updated arcade-classic look (direction B "Phosphor '78" with C's note badges).

## Goals

1. **Same game.** Keep the current loop, the scoring formula (`Score × (HP% + 1) × (BPM/65) × (1 + minutes) × difficulty`), HP, the bombable land strip, BPM control, difficulty, metronome / count-in, the leaderboard and the QWERTY mapping.
2. **New engine.**
   - TypeScript, Vite 8, React 19 and smplr 1.x on one shared AudioContext.
   - Tone.js is removed.
   - Notes are timed by the audio clock, not by `setTimeout` chains.
3. **MusicXML first.**
   - Load MusicXML (`.musicxml`, `.xml`, `.mxl`) from a URL, text or File.
   - The **first part's grand staff** (staves 1 and 2 of the first `<part>`) is the playable melody.
   - Every other part plays as hidden accompaniment.
4. **Dottl as the alternative.**
   - Read dottl v5, v6 and v7 (spec at github.com/pepperhorn/dottl-spec, currently schema v7: `beatsPerBar`, `timeSigChanges`, `stutter[]`, sub-cell hits).
   - The **top layer** is the playable melody; the remaining layers are hidden accompaniment.
   - Writing dottl (export) emits v7.
5. **Embeddable.**
   - Ship as an ESM npm package with types that becreative can mount as an Astro island.
   - The game sizes itself to its container and has no side effects on the host page.
6. **Visual refresh.** Direction B "Phosphor '78" (mockup: `~/.gstack/projects/piano-invaders/designs/arcade-refresh-20261022/board.html`), using direction C's glowing note-badge circles. The gunship moves smoothly to the struck key.

## Non-goals

- Falling-keys / piano-tiles presentation, notation display, or a timing-judgement system. Hits stay lenient (lowest matching on-screen note), as today.
- Porting the game onto ivories' views or clock UI. ivories is used only as a library (score parsing, audio helpers).
- Web MIDI keyboard input. A later addition, if wanted.
- Changes to the dottl spec itself. We follow the spec and do not edit it.

## Anti-goals (failure even if it "works")

- It feels like piano tiles or a falling-keys trainer instead of Space Invaders.
- Existing `.dottl` songs and the bundled `song_library.json` stop loading.
- Embedding leaks into the host page:
  - global key capture outside the game;
  - writes to `document.documentElement`;
  - `100vh` sizing;
  - fonts injected via `@import`.
- Audio drift between the melody, accompaniment and metronome.

## Constraints and facts

- **Keyboard range.** Stays 18 keys, B2–E4 (`PIANO_KEYS` in `gameConfig`).
- **ivories `0.1.0` is published on npm.**
  - `ivories/core` exports `parseMusicXml`, `parseMidi`, `loadScoreFile`, the audio engine, the scheduler, the metronome, `leadInFor` and the clocks.
  - Its `ScoreDocument` gives `notes[]` with `pitch`, `startTicks/durTicks`, `startSec/endSec`, `velocity` and `voiceId`.
  - Each `Voice.source` is `{kind:'xml-part', partId, staff}` for MusicXML and `{kind:'midi-track', index, channel}` for MIDI. That is enough to select "first part, staves 1+2".
  - Peer deps are `react >=19` and `react-dom >=19`; `pepperscore` is *optional*, so installing ivories does not force pepperscore on hosts.
  - The builder should verify that the `ivories/core` import pulls in no React/zustand side effects. If it does, fall back to deep imports or vendoring `core/io` + `core/model`.
- **crf-admin `sheets`.**
  - Score files live in `content_files` (M2M to directus_files), mixed with PDFs. Detect by extension/MIME.
  - `difficulty` is an integer 1–5.
  - `embed` is a dropdown `pepperscore|crftiles|pdf|none`.
  - becreative's tickle-me branch has `src/lib/sheet-score.ts`, which fetches sheet MusicXML server-side. It rejects `.mxl` and skips `protected_content`.
- **becreative stack.** Astro 7 SSR, React 19, Tailwind 4, pnpm.
  - Islands are hydrated with `client:only="react"` / `client:visible`.
  - CSP is in `src/lib/security-headers.ts`, and the smplr sample host must be allowed.
- **Repo hygiene.**
  - `node_modules` is tracked in git; untrack it.
  - Remove the stale root docs (`CODE_REVIEW.md`, `FIXES_APPLIED.md`, `REFACTORING_GUIDE.md`, etc.), the old monolithic `piano-invaders.html`, and the unused `src/audio/metronome.ts`.

## Decided

### Internal song model (`GameSong`)

The game consumes one beat-based model so the BPM slider keeps working:

```ts
interface GameSong {
  id: string; title: string;
  bpm: number;                   // source tempo
  beatsPerBar: number;           // + timeSigChanges, for metronome accents
  timeSigChanges?: { beat: number; beatsPerBar: number }[];
  difficulty: 'easy' | 'intermediate' | 'advanced';
  targets: { beat: number; midi: number; durBeats: number }[];   // playable, sorted, one per onset
  accompaniment: { beat: number; midi: number; durBeats: number; velocity: number; voice: string }[];
  voices: Record<string, { instrument: string; volume: number; percussion?: boolean }>;
  lengthBeats: number;
  source: 'musicxml' | 'midi' | 'dottl' | 'legacy';
}
```

All converters produce this model: MusicXML, MIDI (a free bonus via ivories, where the first track is the melody), dottl v5–v7, and the legacy built-in default song. Spawning, accompaniment scheduling and looping are rewritten against it.

### Melody extraction rules (MusicXML and dottl)

- **Source.**
  - MusicXML: every note from the first `<part>`, staves 1 and 2. A single-staff first part uses just that staff.
  - Dottl: the first layer.
- **Simultaneous onsets (decided).** When several notes start together (chords, two hands), they form a **chord group** of up to two targets: the highest and the lowest note. Inner voices move to accompaniment so the music still sounds complete.
  - *Capping the group at two (outer notes) is my call.*
  - Group members fall together, on one row. Gameplay for chord groups is under Visuals → Gunship.
- **Out-of-range pitches.** Pitches outside B2–E4 are octave-folded into range for the target. The accompaniment copy keeps the true pitch.
  - Whole-song transposition first, as dottl's `autoTranspose` does today, to minimise folding.
- **Other material.** Rests, tied notes (merged), grace notes (skipped) and repeats (not unrolled) follow ivories' parser behaviour.

### Difficulty

- **Editors choose the repertoire for each level.** Difficulty is whatever the song or sheet is tagged with. There is no automatic thinning or simplification of passages; it stays a score multiplier, as today.
- From the dottl `extensions["piano-invaders"].difficulty`, or from a `difficulty` prop.
- The prop accepts the crf 1–5 scale: 1–2 Easy, 3 Intermediate, 4–5 Advanced.
- Default: Easy.

### Audio

- One lazily-created shared AudioContext. It is resumed on the Start press, which is a user gesture.
- Player notes use smplr `SplendidGrandPiano`. The synth option (today's SYN/PNO toggle) is kept, as a small WebAudio oscillator voice.
- Accompaniment voices use smplr `Soundfont` / `DrumMachine` per voice. Instrument names come from the dottl `smplrPatch`, or from the MusicXML part's MIDI program via ivories.
- Everything is scheduled with a lookahead scheduler on `ctx.currentTime`, and spawn times derive from the same clock. The metronome and count-in run on the same context.
- SFX use the existing mp3/ogg assets or short synthesized blips.

### Package and embed API

- **Build.**
  - ESM-only library build with `.d.ts`; React and react-dom are peer deps.
  - `exports` with a `"source"` condition (ivories pattern).
  - CSS is scoped under `.piano-invaders` in `@layer piano-invaders`, exported as `piano-invaders/style.css` (host imports it).
  - `--pi-*` custom properties for theming, set on the root element only.
- **Fonts.** Press Start 2P (HUD, arcade text) and Poppins (menus, note-badge letters) via `@fontsource`. They are not injected by the library; the host or the standalone app loads them.
- **Component.**

  ```tsx
  <PianoInvaders
    musicXml? | scoreUrl? | file? | midi? | dottl?   // single-song mode; first present wins
    songs?        // GameSong[] or dottl objects → song-picker mode (standalone app default)
    title? difficulty? bpm?
    showSongPicker? allowImport?
    leaderboard?  // adapter { load(), save() }, default localStorage
    plugins?      // existing PluginRegistry hooks kept
    onGameEnd?(stats) onError?({code,message,cause})
    className?
  />
  ```

- **Single-song mode** skips the song barrel and shows Start → Game → Game Over for that piece.
- **Looping (decided).** Songs keep looping until HP reaches 0 or the player quits, as today. There is no end-of-song state for now.
- **Embed-safety rules.**
  - Size from a ResizeObserver on the root, not `window`.
  - Key positions are measured relative to the canvas, which fixes the current offset bug.
  - Keyboard input only while the game root has focus. Inputs and textareas are ignored.
  - No module-scope `window` / `localStorage` access (SSR-safe).
  - Overlays use `position:absolute` inside the root.
  - Plugin theme vars are applied to the root, never to `document.documentElement`.
  - Errors are logged once and reported through `onError`; they are never thrown into the host.
- **Standalone app.** The current site keeps working: song library, `.dottl` import, and now MusicXML import. The PWA files stay app-only.

### Visuals (direction B + C badges)

- **Stage.** Pure black, 1-bit sprites, red cellophane band at the top and green band at the bottom, scanlines and bezel vignette (toggleable). A classic mystery-ship mothership with hatch flash on drop.
- **Notes.** Classic invader silhouettes (squid / crab / octopus) carrying **C-style glowing note badges**: pitch-class-coloured circles with a shaded highlight and bloom.
  - Letters use the standard note-text style: white Poppins 600, `rgba(0,0,0,.35)` stroke drawn before the fill, scaled to badge size.
  - Sharps/flats are spelled per key signature where known.
- **Gunship.**
  - On keypress it glides to the struck key's x with a critically-damped spring (or exponential ease). It reaches the key in about 120 ms with no overshoot and stays frame-rate independent.
  - It fires when it arrives, or immediately if it is already there.
  - It is the one sprite **exempt** from B's 4-px stepped motion.
  - Rapid successive presses retarget mid-glide.
  - **Chord groups (decided).** The gunship glides to the group note **closest** to its current position and fires straight up at it. The other note is destroyed by an **explosive shot** fired from the gunship without moving: an angled bolt with a bigger blast.
    - Each note is still triggered by its own key.
    - If the far note's key is pressed first, the gunship still moves to the closest note's key and fires the explosive shot at the far note.
- **Effects.** Hit: pixel explosion, confetti and "+10". Miss: crater bite in the pixel skyline, red flash, shield segment drop. Small screen shake (off under `prefers-reduced-motion`).
- **Chrome.** The HUD (score, hi, BPM, song, combo, segmented shield) and the keyboard are restyled to the B cabinet look. The start screen and game over are restyled to match.

### HUD stats (my call)

- The existing on-beat **accuracy meter** stays as it is (HUD, game-over stats and decay). It is part of "same game", not a new timing-judgement system.
- **Combo** is new: the count of consecutive hits. It resets when a note reaches the land; wrong keys don't reset it, matching today's lack of a wrong-key penalty.
- Max combo is added to the game-over stats and the leaderboard entry.

### Testing

- **vitest** (jsdom) for:
  - the converters: MusicXML grand-staff extraction, chords → highest, folding, accompaniment split; dottl v5/v6/v7 → `GameSong`; the v7 export round-trip;
  - the scoring formula;
  - difficulty mapping;
  - gunship easing math.
- **Playwright smoke test** on an embed fixture page. It mounts the game in an offset, non-full-page container next to a text input, then:
  - plays notes via keys;
  - asserts typing in the input doesn't trigger the game;
  - checks for no console errors.
- **Lint:** oxlint.

## becreative integration (later round, not in this plan)

- On a becreative branch, add an island on `src/pages/library/sheets/[id].astro` that mounts `<PianoInvaders client:only="react" musicXml=… difficulty={sheet.difficulty} title=… />`.
- Feed it via the tickle-me `sheet-score.ts` approach: server-side fetch of the sheet's first MusicXML file, extended to accept `.mxl` (or a signed same-origin URL).
- Add the smplr sample host to the CSP.

## Left to the builder

- File and module layout, and how to split today's 957-line `PianoInvaders.jsx` (game loop / renderer / input / audio / UI).
- Whether to use ivories' scheduler and metronome directly or write thin equivalents on the shared context.
- Exact sprite pixel art. Port it from the mockup board's drawing code.
- The SFX approach.
- Migration order. The standalone app must keep running at each step.

## Open questions

- **becreative gate** (deferred to the becreative round). What decides whether a sheet shows the game? Options: a new `embed` value in crf-admin, the presence of a MusicXML file, or something else.
