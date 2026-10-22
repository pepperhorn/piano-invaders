# Piano Invaders Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-engine Piano Invaders (same Space Invaders gameplay) on TypeScript + smplr 1.x with an audio-clock transport. MusicXML becomes the default song source and dottl v5–v7 the alternative. The result is an embed-safe ESM package with the "Phosphor '78" arcade look.

**Architecture:**
- **Song model.** Every song source converts to one beat-based `GameSong`:
  - MusicXML/MIDI go through `ivories/core` parsers, then `scoreToGameSong`.
  - dottl goes through `dottlToGameSong`.
  - A pure extraction step picks the playable targets: the first part's grand staff (or dottl's top layer), with chord groups of at most 2.
- **Audio and timing.** A pure `Transport` maps beats↔`AudioContext.currentTime` and drives spawning, accompaniment and metronome. Game rules (scoring, gunship spring, shot resolution, matching) are pure modules.
- **Rendering.** A canvas renderer draws direction-B sprites ported from the mockup board.
- **React.** React owns only the shell: layout via ResizeObserver, focus-scoped input, and the screens.

**Tech Stack:**
- React 19, TypeScript ~6.0, Vite 8, vitest 5 (jsdom) + @testing-library/react, @playwright/test, oxlint.
- smplr ^1.0.0, ivories ^0.1.0 (`ivories/core` only).
- @fontsource/press-start-2p, @fontsource/poppins.

**Spec:** `docs/superpowers/specs/2026-10-22-piano-invaders-modernization-design.md` (read it before any task).

**Visual reference:** `~/.gstack/projects/piano-invaders/designs/arcade-refresh-20261022/board.html`. Panel B is the stage, sprites and HUD. Panel C supplies the note badges (`drawBadge` for variant C).

## Global Constraints

- **Dependencies and build.**
  - Tone.js is removed entirely: no `tone` import anywhere when done.
  - smplr `^1.0.0`. React/react-dom `>=19` are **peer** deps of the library build.
  - ESM-only library output with `.d.ts`; no UMD.
  - `package.json` `exports` has `"."` and `"./style.css"`, each with a `"source"` condition (ivories pattern).
- **Keyboard and scoring.**
  - The keyboard stays 18 keys, B2–E4 (MIDI 47–64), with the existing QWERTY mapping.
  - Scoring stays: +10 per hit, −5 HP per land hit, HP max 100. TOTAL = `score × (hp/100 + 1) × (bpm/65) × (1 + minutes) × mult`, with mult easy 1, intermediate 2, advanced 3.
  - The existing on-beat accuracy meter stays.
  - Combo = consecutive hits. It resets when a note reaches the land; wrong keys don't reset it. Max combo goes into game-over stats and leaderboard entries.
- **Songs.**
  - Songs loop until HP = 0 or quit. There is no end-of-song state.
  - No automatic thinning: difficulty is only the tag plus the multiplier. The crf 1–5 scale maps 1–2 easy, 3 intermediate, 4–5 advanced; the default is easy.
- **Embed safety.**
  - No module-scope `window`, `document` or `localStorage` access.
  - No writes to `document.documentElement`. No `100vh`/`100dvh` inside the library CSS. No CSS `@import` of fonts in the library.
  - Library CSS is scoped under `.piano-invaders` inside `@layer piano-invaders`, with theme vars prefixed `--pi-`.
  - Errors go to `onError({code, message, cause})` with code ∈ `'score-load' | 'score-parse' | 'audio'`. Each is logged once via `console.warn('[piano-invaders] <code>: <message>')` and never thrown into the host.
- **Note badges.** Letters are white Poppins 600, stroke `rgba(0,0,0,0.35)` lineWidth 3 drawn before the fill, centered, at a font size of `20 × radius / 22`.
- **Class names.** Every JSX element gets a contextual class name (e.g. `pi-hud-score`).
- **Dev server:** `npm run dev -- --host 0.0.0.0`.

## Review Focus

1. **MusicXML whose first part has one staff** (lead sheet) plus a piano part second. Targets come only from part 1 staff 1; the piano part is accompaniment. *Test in Task 4.*
2. **Score with no playable notes** (empty first part, or a percussion-only first part). Expect `onError` code `score-parse` with a readable message, the start screen stays usable, and nothing throws. *Tests in Tasks 4 and 9.*
3. **Game mounted in an offset container next to a text `<input>`.** Typing in the input doesn't fire notes, and falling notes line up with their keys. *Playwright test in Task 10.*
4. **BPM change mid-song (the BPM slider and the auto BPM increase).** No target is spawned twice or skipped, and accompaniment stays aligned to the same beat. *Test in Task 6.*
5. **Chord group where the far note's key is pressed first.** The gunship still glides to the closer note's key; the far note gets the explosive shot, the near note stays alive until its own key. *Test in Task 7.*

---

### Task 1: TypeScript/Vite 8 toolchain and repo hygiene

**Files:**
- Modify: `package.json`, `.gitignore`, `index.html`, `src/main.jsx` → `src/main.tsx`, `src/App.jsx` → `src/App.tsx`
- Create: `tsconfig.json`, `vite.config.ts` (replaces `vite.config.js`), `vitest.config.ts` (or the `test` block in vite config), `src/test-setup.ts`, `.oxlintrc.json`, `tests/sanity.test.ts`
- Delete: `CODE_REVIEW.md`, `FIXES_APPLIED.md`, `IMPLEMENTATION_SUMMARY.md`, `REFACTORING_GUIDE.md`, `REACT_README.md`, `QUICKSTART.md`, `piano-invaders.html`, every `*:Zone.Identifier`, `src/audio/metronome.ts`, root `song_library.json` (`public/song_library.json` is the copy in use; verify with `grep -rn song_library src` first)
- Untrack: `node_modules/` (`git rm -r --cached node_modules`; add it to `.gitignore`), `dist/`

**Interfaces:**
- Produces: scripts `dev`, `build` (app → `dist/`), `build:lib` (library → `lib/`, created in Task 10), `test` (`vitest run`), `test:e2e` (`playwright test`), `lint` (`oxlint`), `typecheck` (`tsc --noEmit`).
- tsconfig: `strict: true`, `allowJs: true` (so the remaining `.jsx` keeps compiling until later tasks convert it), `jsx: react-jsx`, `moduleResolution: bundler`, `customConditions: ["source"]`.

- [ ] **Step 1:** Install the deps.
  - Dev: `typescript@~6.0 vite@^8 @vitejs/plugin-react vitest@^5 jsdom @testing-library/react @playwright/test oxlint @types/react @types/react-dom vitest-canvas-mock`.
  - Runtime: `smplr@^1.0.0 ivories@^0.1.0 @fontsource/press-start-2p @fontsource/poppins`.
  - Keep `tone` for now; it is removed in Task 9.
- [ ] **Step 2:** Write `tests/sanity.test.ts` asserting `expect(1 + 1).toBe(2)`, and confirm vitest picks it up. `src/test-setup.ts` imports `vitest-canvas-mock`.
- [ ] **Step 3:** Run `npm test && npm run typecheck && npm run lint && npm run build`. Expected: all exit 0, and `dist/index.html` exists.
- [ ] **Step 4:** Run the `npm run dev -- --host 0.0.0.0` smoke check. The start screen renders and a song plays with the old code path (manual check, or Playwright `page.goto` with no console errors).
- [ ] **Step 5:** Commit: `chore: TypeScript + Vite 8 + vitest toolchain, untrack node_modules, drop stale docs`.

---

### Task 2: GameSong model and pitch utilities

**Files:**
- Create: `src/song/types.ts`, `src/song/pitch.ts`, `tests/song/pitch.test.ts`
- Modify: `src/constants/gameConfig.js` → `src/constants/gameConfig.ts`. Add `midi: number` to each `PIANO_KEYS` entry, keeping the old string as `name`/`label` fields. Add `KEY_MIDI_LOW = 47` and `KEY_MIDI_HIGH = 64`.

**Interfaces:**
- Produces (`src/song/types.ts`):

```ts
export type Difficulty = 'easy' | 'intermediate' | 'advanced';
export interface Target { id: number; beat: number; midi: number; durBeats: number; group?: number } // group = chord-group id shared by ≤2 targets
export interface AccompNote { beat: number; midi: number; durBeats: number; velocity: number; voice: string }
export interface VoiceInfo { instrument: string; volume: number; percussion?: boolean }
export interface GameSong {
  id: string; title: string; bpm: number; beatsPerBar: number;
  timeSigChanges?: { beat: number; beatsPerBar: number }[];
  difficulty: Difficulty; targets: Target[]; accompaniment: AccompNote[];
  voices: Record<string, VoiceInfo>; lengthBeats: number;
  source: 'musicxml' | 'midi' | 'dottl' | 'legacy';
}
export type ScoreSource =
  | { musicXml: string } | { scoreUrl: string } | { file: File | Blob; name?: string }
  | { midi: ArrayBuffer } | { dottl: object | string };
```

- Produces (`src/song/pitch.ts`):
  - `noteNameToMidi(name: string, octave: number): number` accepts `'C#/Db'`, `'C#'`, `'Db'` and `'E'`.
  - `midiToName(midi: number, preferFlats?: boolean): string` returns e.g. `'F#'`.
  - `foldIntoRange(midi: number, lo = 47, hi = 64): number`.
  - `bestTransposition(pitches: number[], lo = 47, hi = 64): number` returns the whole-octave shift (a multiple of 12) that puts the most pitches in range; ties go to the shift closest to 0.
  - `difficultyFromCrf(n: number | null | undefined): Difficulty`.

- [ ] **Step 1: Failing tests** in `tests/song/pitch.test.ts`:
  - `noteNameToMidi('C', 4) === 60`, `noteNameToMidi('C#/Db', 4) === 61`, `noteNameToMidi('B', 2) === 47`
  - `foldIntoRange(72) === 60`, `foldIntoRange(40) === 52`, `foldIntoRange(55) === 55`
  - `bestTransposition([72, 74, 76, 77, 79]) === -12`, `bestTransposition([50, 52]) === 0`
  - `difficultyFromCrf(1) === 'easy'`, `difficultyFromCrf(3) === 'intermediate'`, `difficultyFromCrf(5) === 'advanced'`, `difficultyFromCrf(null) === 'easy'`
- [ ] **Step 2:** Run `npx vitest run tests/song/pitch.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `src/song/pitch.ts`, `src/song/types.ts` and the `gameConfig.ts` conversion. Update the imports of `gameConfig` across `src/`.
- [ ] **Step 4:** Run the tests and the typecheck. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(song): GameSong model and pitch utilities`.

---

### Task 3: Target extraction (chord groups, folding, transposition)

**Files:**
- Create: `src/song/extract.ts`, `tests/song/extract.test.ts`

**Interfaces:**
- Consumes: Task 2 types and pitch utils.
- Produces:

```ts
export interface RawNote { beat: number; midi: number; durBeats: number; velocity: number; voice: string; melody: boolean }
export function buildTargets(notes: RawNote[]): { targets: Target[]; accompaniment: AccompNote[]; transpose: number }
```

- **Rules (spec, "Melody extraction rules"):**
  - Take the `melody: true` notes.
  - Compute `transpose = bestTransposition(melodyPitches)`.
  - Group the melody notes by onset, where `|beatA − beatB| < 1e-6` counts as the same onset.
  - Per group:
    - 1 note → one target.
    - ≥2 notes → targets = highest and lowest only, both carrying the same `group` id. Inner notes are pushed to `accompaniment` (voice `'melody-inner'`, true pitch).
  - Target `midi = foldIntoRange(midi + transpose)`. If folding makes the two group targets the same pitch, keep only the higher one, without a group.
  - Melody targets are **not** copied into accompaniment, because the player's key press sounds them, as today. Only inner chord notes (above) go to accompaniment, so nothing is doubled.
  - Target ids are sequential from 0 in beat order; ties are ordered high pitch first.
  - Non-melody notes pass through as accompaniment unchanged.

- [ ] **Step 1: Failing tests:**
  - `single notes become targets in beat order`
  - `three-note chord → two grouped targets (high, low) + one inner accompaniment note`
  - `two-hand onset C5+C3 → targets folded into 47–64 and grouped`
  - `fold collision keeps the higher only`, e.g. C3 and C4 after a −12 transpose both land on 48 or 60
  - `non-melody notes pass through as accompaniment with their voice`
  - `empty melody → targets []` (the caller raises the error)
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `buildTargets`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(song): target extraction with chord groups`.

---

### Task 4: MusicXML / MIDI → GameSong and the score loader

**Files:**
- Create: `src/song/fromScore.ts`, `src/song/load.ts`, `src/song/errors.ts`
- Create fixtures:
  - `tests/fixtures/grand-staff-plus-violin.musicxml`: part P1 piano with 2 staves (4 bars, includes one 3-note RH chord and one RH+LH simultaneous onset); part P2 violin.
  - `tests/fixtures/leadsheet-then-piano.musicxml`: P1 single-staff melody, P2 piano with 2 staves.
  - `tests/fixtures/empty-first-part.musicxml`
  - `tests/fixtures/two-track.mid`: generate it with `@tonejs/midi` in a one-off script under `scripts/` and commit the output.
- Test: `tests/song/fromScore.test.ts`, `tests/song/load.test.ts`

**Interfaces:**
- Consumes: `parseMusicXml`, `parseMidi`, `parseScoreFile`, `sniffScoreFile` and `unpackMxl` from `ivories/core`. Signatures are `(xml|bytes, name, setting: TempoSetting)`; pass `{ mode: 'scale', scale: 1 }`. Also consumes `buildTargets` (Task 3).
- Produces:
  - `export class SongError extends Error { code: 'score-load' | 'score-parse' }`
  - `export function scoreToGameSong(doc: ScoreDocument, opts?: { title?: string; difficulty?: Difficulty | number }): GameSong`
  - `export async function loadSong(src: ScoreSource, opts?: { title?: string; difficulty?: Difficulty | number; fetchImpl?: typeof fetch }): Promise<GameSong>`

- **Melody selection in `scoreToGameSong`:**
  - MusicXML: melody voices = voices whose `source.kind === 'xml-part'` and `partId === firstPartId`, where `firstPartId` = the partId of the first xml-part voice in `doc.voices` order. Verify against ivories' voice ordering, which follows `<part-list>` order.
  - MIDI: melody = the first non-percussion voice that has notes.
- **Conversions:**
  - `beat = startTicks / ppq`, `durBeats = durTicks / ppq`.
  - `bpm` = `tempoMap[0].bpm`, rounded.
  - `beatsPerBar` from `timeSignatures[0].numerator × (4 / denominator)`, with quarter-note beats. For 6/8 that gives 3; `timeSigChanges` are mapped the same way.
  - `lengthBeats` = the end of the last note, rounded **up to a whole bar**.
  - `voices[voiceId] = { instrument: voice.instrument, volume: voice.volume, percussion: voice.percussion }`.
- **Errors:**
  - Zero targets → throw `SongError('score-parse', 'The first part has no playable notes.')`.
  - Fetch or read failure → `'score-load'`.
  - Parser throw → `'score-parse'` with the original as `cause`.
- **Loader:** for `scoreUrl` and `file`, sniff the bytes (`sniffScoreFile`) to choose MusicXML / MXL / MIDI. A `dottl` source delegates to Task 5's `dottlToGameSong` (import it lazily, so this task's tests can stub it until Task 5 lands).

- [ ] **Step 1: Failing tests** (`fromScore.test.ts`, which reads the fixtures with `fs`):
  - `grand staff: targets come only from P1 (both staves); violin is accompaniment voice`
  - `RH 3-note chord → 2 grouped targets`
  - `RH+LH onset → grouped pair`
  - `leadsheet first: targets only from P1 staff 1; P2 notes all accompaniment` (Review Focus 1)
  - `bpm and beatsPerBar read from file`
  - `lengthBeats is a whole number of bars`
  - `empty first part throws SongError code score-parse` (Review Focus 2)
  - `MIDI: first track melody, second track accompaniment`
- [ ] **Step 2: Failing tests** (`load.test.ts`):
  - `musicXml string loads`
  - `scoreUrl uses fetchImpl and sniffs MXL` (zip the fixture with `fflate` inside the test)
  - `file Blob with .mid loads`
  - `fetch 404 → SongError score-load`
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement. If importing `ivories/core` pulls in React/zustand side effects at import (check with a test that imports it under node with no DOM), switch to deep imports `ivories/dist/core.js` or vendor `core/io` + `core/model` into `src/vendor/ivories/` with attribution.
- [ ] **Step 5:** Run. Expected: PASS.
- [ ] **Step 6:** Commit: `feat(song): MusicXML/MIDI loader → GameSong (first grand staff = targets)`.

---

### Task 5: Dottl v5–v7 reader and v7 writer

**Files:**
- Create: `src/song/dottl.ts`, `tests/song/dottl.test.ts`, `tests/fixtures/v7-timesig-stutter.dottl`
- Delete (after the callers move over in Task 9): `src/utils/dottl.js`

**Interfaces:**
- Consumes: `buildTargets`, `noteNameToMidi`. Spec: https://github.com/pepperhorn/dottl-spec (schema v7; local copy at `/home/shaun/dottl-spec/DOTTL_SONG_FORMAT.md`).
- Produces:
  - `export function isDottl(obj: unknown): boolean` returns true when `layers` is an array and `version` is in 5–7, or `version` is absent but `layers` + `divisor` exist.
  - `export function dottlToGameSong(d: object | string): GameSong`
  - `export function gameSongToDottl(song: GameSong): DottlV7` (+ the exported `DottlV7` type)

- **Timing:** `beat = (col − 1 + (subCol ?? 0) / (subCount ?? 1)) / divisor`.
  - Col 0 (pickup) maps to a negative beat. Shift the whole song so the minimum beat ≥ 0, i.e. add a full bar of lead-in.
  - `durBeats = (1 + sustainCells) / divisor`.
- **Pitch:** `midi = noteNameToMidi(name, octave) + transposition`.
- **Stutter:** `stutter: [v…]` expands to N sub-hits. Velocity = `round(16 + v / 7 × 111)`; skip `v = 0`.
  - For the **melody** layer, only the first audible sub-hit becomes a target; the remaining sub-hits go to accompaniment.
- **Layers:** layer 0 notes are `melody: true`; other layers have voice = `layer.id`. `voices[layer.id] = { instrument: layer.smplrPatch ?? layer.instrumentCategory, volume: (layer.volume ?? 80) / 100, percussion: layer.instrumentCategory === 'drums' }`. Check how the current `src/utils/dottl.js` reads volume and patch fields, and keep parity.
- **Meter:**
  - `beatsPerBar`: v7 `beatsPerBar`, else v5 `timeSignature.numerator`, else 4.
  - `timeSigChanges`: `col` mapped to beat `(col − 1) / divisor`.
- **Difficulty:** top-level `difficulty`, else `extensions['piano-invaders'].difficulty`, else easy.
- **Writer:** emits `version: 7`.
  - `divisor` = the smallest of 1, 2, 3 or 4 that places every beat on the grid exactly; otherwise use 4 and round.
  - Layer 0 holds the targets plus inner accompaniment notes from `'melody-inner'`. The other voices become layers.
  - Writes `difficulty` top-level **and** in `extensions['piano-invaders']`.

- [ ] **Step 1: Failing tests:**
  - `every song in public/song_library.json converts with ≥1 target and no throw` (read the file in the test)
  - `tmp/odetojoy-accomp-v5-3.dottl` converts: first target is E4 at beat 0, bpm 85. Copy the file to `tests/fixtures/` first.
  - `v7 beatsPerBar + timeSigChanges map to beats`
  - `stutter expands; silent entries skipped; only first melody sub-hit is a target`
  - `col 0 pickup shifts song to start ≥ 0`
  - `round trip: dottlToGameSong(gameSongToDottl(song)) has equal targets (beat, midi, group) and accompaniment count`
  - `isDottl rejects MusicXML text and {}`
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(song): dottl v5–v7 reader and v7 writer`.

---

### Task 6: Shared AudioContext, Transport and audio engine

**Files:**
- Create: `src/audio/context.ts`, `src/audio/Transport.ts`, `src/audio/AudioEngine.ts`, `src/audio/sfx.ts`, `src/audio/metronome.ts`
- Test: `tests/audio/transport.test.ts`, `tests/audio/engine.test.ts`
- Delete (callers move in Task 9): `src/utils/AudioManager.js`, `src/utils/AccompanimentManager.js`, `src/utils/metronome.js`

**Interfaces:**
- Produces:
  - `context.ts`: `getAudioContext(): AudioContext` (lazy singleton, created on first call, never at import) and `resumeAudio(): Promise<void>`.
  - `Transport.ts`, a pure class with no WebAudio inside:

    ```ts
    export interface TimeSource { readonly currentTime: number }
    export class Transport {
      constructor(time: TimeSource, opts: { bpm: number; lengthBeats: number; leadInBeats?: number })
      start(atSec?: number): void               // beat 0 (after lead-in) at atSec
      beatAt(sec: number): number                // unwrapped (monotonic) beat
      secAt(beat: number): number
      setBpm(bpm: number): void                  // re-anchor so beatAt(now) is unchanged
      /** events in [fromBeat, toBeat) for a looped song: yields { loop, beatInSong, absBeat } */
      window<T extends { beat: number }>(events: T[], fromBeat: number, toBeat: number): Array<{ ev: T; absBeat: number; loop: number }>
    }
    ```

  - `AudioEngine.ts`:

    ```ts
    export class AudioEngine {
      constructor(ctx?: AudioContext)
      load(song: GameSong, playerVoice: 'piano' | 'synth'): Promise<void>  // loads SplendidGrandPiano + one smplr Soundfont/DrumMachine per voice; failures → onError('audio') and fall back to synth for that voice
      setPlayerVoice(v: 'piano' | 'synth'): void
      playPlayer(midi: number, whenSec?: number, durSec?: number): void
      scheduleAccomp(n: AccompNote, whenSec: number, durSec: number): void
      metronomeTick(whenSec: number, accent: boolean, volume: number): void
      sfx(kind: 'hit' | 'miss' | 'explode' | 'fire'): void
      stopAll(): void; dispose(): void
      onError?: (e: { code: 'audio'; message: string; cause?: unknown }) => void
    }
    ```

- **Behaviour:**
  - The metronome uses the existing `src/audio/high|low.(mp3|ogg)` decoded on the shared context, with a synth click as the fallback.
  - The game's scheduler loop (Task 9) calls `transport.window` every 25 ms with a 0.15 s lookahead.

- [ ] **Step 1: Failing tests** (`transport.test.ts`, using a fake `{ currentTime }` object):
  - `beatAt/secAt inverse at 120 bpm`
  - `setBpm mid-song keeps current beat and changes rate` (Review Focus 4)
  - `window over a loop boundary yields events from both loops with correct absBeat`
  - `consecutive windows [a,b) [b,c) never duplicate or skip an event` (Review Focus 4)
  - `lead-in: beat 0 lands at start + leadInBeats × 60/bpm`
- [ ] **Step 2: Failing tests** (`engine.test.ts`, mocking `smplr` via `vi.mock`):
  - `load creates one instrument per voice and SplendidGrandPiano once`
  - `instrument load failure calls onError with code audio and does not throw`
  - `no AudioContext is constructed at import`
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run. Expected: PASS.
- [ ] **Step 6:** Commit: `feat(audio): shared context, beat transport, smplr engine`.

---

### Task 7: Pure game rules (scoring, matching, gunship spring, chord shots)

**Files:**
- Create: `src/game/scoring.ts`, `src/game/gunship.ts`, `src/game/shots.ts`
- Test: `tests/game/scoring.test.ts`, `tests/game/gunship.test.ts`, `tests/game/shots.test.ts`

**Interfaces:**
- Produces:

```ts
// scoring.ts
export const DIFFICULTY_MULT: Record<Difficulty, number> // {easy:1, intermediate:2, advanced:3}
export function totalScore(s: { score: number; hp: number; bpm: number; seconds: number; difficulty: Difficulty }): number // Math.round(score*(hp/100+1)*(bpm/65)*(1+seconds/60)*mult)
export interface ComboState { combo: number; maxCombo: number }
export function onHit(c: ComboState): ComboState; export function onLandHit(c: ComboState): ComboState
// gunship.ts — critically damped spring, frame-rate independent
export interface GunshipState { x: number; v: number; targetX: number }
export const GUNSHIP_SETTLE_MS = 120
export function stepGunship(s: GunshipState, dtSec: number): GunshipState
export function isSettled(s: GunshipState, epsPx?: number): boolean // default 0.5
// shots.ts
export interface LiveNote { id: number; midi: number; x: number; y: number; group?: number; alive: boolean }
export type Shot = { noteId: number; kind: 'straight' | 'explosive'; fromX: number }
export function resolvePress(midi: number, gunX: number, keyX: (midi: number) => number, live: LiveNote[]):
  { moveTo: number | null; shots: Shot[] }
```

- **`stepGunship`:** omega = `2π / (GUNSHIP_SETTLE_MS / 1000)` × ~0.6, tuned so the 99% settle time is ≤ 120 ms. Integrate with the closed-form critically damped solution so the result does not depend on `dt` splitting.
- **`resolvePress` rules** (spec "Gunship → Chord groups"):
  1. The pressed note is the lowest-y-on-screen (closest to land) alive note with `note.midi === midi`. If there is none → `{ moveTo: null, shots: [] }` (wrong key, no penalty).
  2. No `group`, or the group sibling is not alive → `moveTo = keyX(midi)`, one `straight` shot.
  3. Group sibling alive → the anchor is the group member whose `keyX` is closest to `gunX`.
     - If the pressed note **is** the anchor → `moveTo = keyX(anchor)`, `straight` shot.
     - Otherwise → `moveTo = keyX(anchor)` and an `explosive` shot at the pressed note, `fromX = keyX(anchor)`. The anchor stays alive until its own key is pressed (Review Focus 5).
  4. Once the anchor of a group is already shot, a later sibling press is `explosive` from the current `gunX`, with `moveTo = null`.

- [ ] **Step 1: Failing tests:**
  - `totalScore matches the formula for a fixed case`: score 100, hp 50, bpm 65, 60 s, intermediate → `Math.round(100 × 1.5 × 1 × 2 × 2) = 600`
  - `combo increments on hit, resets on land hit, keeps max`
  - `gunship settles within 120 ms from 300 px away at 60 fps and at 144 fps; no overshoot (x never passes targetX)`
  - `same total time with dt=1/30 vs 1/240 gives the same x within 0.5 px`
  - `retarget mid-glide moves smoothly (v continuous)`
  - `single note press → move + straight`
  - `group, press near note → straight at near`
  - `group, press far note first → moveTo near key, explosive at far, near still alive` (Review Focus 5)
  - `group, near already shot, press far → explosive from gunX, moveTo null`
  - `wrong key → no shots`
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(game): scoring, combo, gunship spring, chord shot resolution`.

---

### Task 8: Phosphor '78 renderer (sprites, C badges, land strip, effects)

**Files:**
- Create: `src/render/palette.ts`, `src/render/sprites.ts`, `src/render/badge.ts`, `src/render/LandStrip.ts` (port of `src/utils/LandStrip.js`), `src/render/effects.ts`, `src/render/drawFrame.ts`
- Test: `tests/render/render.test.ts`
- Delete (callers move in Task 9): `src/utils/LandStrip.js`, `src/utils/Note.js`

**Interfaces:**
- Consumes: the mockup board's drawing code. Port panel B's stage, cellophane bands, mothership, invader silhouettes, gunship, crater, scanlines and bezel, plus panel C's badge drawing. Also consumes `LiveNote` and `Shot` (Task 7) and `GunshipState`.
- Produces:

```ts
export interface FrameState {
  width: number; height: number; landTop: number; dpr: number;
  ufoX: number; ufoDropFlash: number;            // 0..1
  notes: (LiveNote & { invader: 'squid' | 'crab' | 'octopus' })[];
  gunship: GunshipState; litMidi: number | null;
  bolts: { x0: number; y0: number; x1: number; y1: number; t: number; kind: Shot['kind'] }[];
  effects: Effect[]; land: LandStrip; flash: number; shake: { x: number; y: number };
  scanlines: boolean; laneGuides: boolean; keyX: (midi: number) => number;
}
export function drawFrame(ctx: CanvasRenderingContext2D, f: FrameState): void
export function drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, midi: number): void
export function pitchColor(midi: number): string   // 12-colour pitch-class map from the board
export class LandStrip { constructor(width: number, height: number, seed?: number); bomb(x: number, radius: number): void; draw(ctx: CanvasRenderingContext2D, top: number): void; resize(width: number): void }
export type Effect = { kind: 'explosion' | 'confetti' | 'text' | 'crater-flash'; x: number; y: number; t: number; text?: string; color?: string }
export function stepEffects(effects: Effect[], dtSec: number): Effect[]
```

- **Invader colour:** invaders are drawn in **panel A "Marquee" style**, tinted with `pitchColor(midi)` the way panel A colours its squid / crab / octopus. B's white 1-bit sprites are not used for invaders; the rest of the stage stays B.
- **Motion:**
  - Mothership and invaders use 4-px stepped motion (B style). The gunship and bolts are drawn at exact sub-pixel positions (exempt).
  - The explosive bolt is an angled, thicker bolt with a larger explosion and extra confetti.
- **Badge text:** use the Global Constraints badge text style exactly.
- **Reduced motion:** `prefers-reduced-motion` is read by the caller and passed as `shake = {0, 0}`. The renderer never reads `window`.

- [ ] **Step 1: Failing tests** (canvas mock):
  - `drawFrame runs without throwing for an empty and a busy frame`
  - `drawBadge sets font '600 20px Poppins, sans-serif' at r=22 and strokes before fill` (inspect the `vitest-canvas-mock` `__getEvents()` order)
  - `pitchColor(60) === pitchColor(72)`
  - `invader sprite fill uses pitchColor(midi)` (a C4 invader draws with `pitchColor(60)`)
  - `LandStrip.bomb removes pixels within radius only`
  - `stepEffects drops finished effects`
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement by porting from `board.html`. Keep the pixel grids as data arrays in `sprites.ts`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(render): Phosphor '78 renderer with neo-arcade note badges`.

---

### Task 9: Game shell rewrite (component, loop, input, screens)

**Files:**
- Create:
  - `src/components/PianoInvaders.tsx`, which replaces the `.jsx`
  - `src/game/useGame.ts`: game loop, spawning from the Transport, collisions, HP, accuracy meter, combo
  - `src/hooks/useContainerSize.ts`: ResizeObserver
  - `src/hooks/useScopedKeys.ts`: focus-scoped QWERTY
  - `src/components/Keyboard.tsx`, `StartScreen.tsx`, `GameOver.tsx`, `RulesPopup.tsx`, `Hud.tsx`
  - `src/plugins/PluginRegistry.ts`
  - `src/utils/leaderboard.ts`, which becomes an adapter
  - `src/index.ts` (library entry)
- Modify: `src/styles/PianoInvaders.css` → `src/styles/piano-invaders.css`, rewritten and scoped (see constraints); `src/App.tsx`; `src/main.tsx` (imports `@fontsource/press-start-2p` and `@fontsource/poppins/{400,600}.css` for the standalone app)
- Delete: all remaining `.jsx` and `.js` in `src/components`, `src/utils` and `src/plugins` that have been replaced. Remove `tone` from `package.json`.
- Test: `tests/components/PianoInvaders.test.tsx`, `tests/hooks/useScopedKeys.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–8.
- Produces (`src/index.ts` exports):

```ts
export interface PianoInvadersProps {
  musicXml?: string; scoreUrl?: string; file?: File | Blob; midi?: ArrayBuffer; dottl?: object | string;
  songs?: Array<GameSong | object>;          // song-picker mode; dottl objects converted
  title?: string; difficulty?: Difficulty | number; bpm?: number;
  showSongPicker?: boolean;                   // default: true when no single-song source given
  allowImport?: boolean;                      // default true in picker mode; accepts .musicxml/.xml/.mxl/.mid/.dottl
  leaderboard?: { load(): LeaderboardEntry[] | Promise<LeaderboardEntry[]>; save(e: LeaderboardEntry[]): void | Promise<void> };
  plugins?: PianoInvadersPlugin[];
  onGameEnd?(stats: GameStats): void;
  onError?(e: { code: 'score-load' | 'score-parse' | 'audio'; message: string; cause?: unknown }): void;
  className?: string;
}
export interface GameStats { score: number; total: number; hp: number; bpm: number; seconds: number; accuracy: number; maxCombo: number; difficulty: Difficulty; song: string }
export interface LeaderboardEntry { name: string; total: number; score: number; bpm: number; hp: number; time: number; song: string; maxCombo?: number }
export { default as PianoInvaders } from './components/PianoInvaders'; export default PianoInvaders
export { loadSong, dottlToGameSong, gameSongToDottl, isDottl, scoreToGameSong } ; export type { GameSong, ScoreSource, Difficulty }
```

- **Spawning.** A target becomes an on-screen note when `transport.beatAt(now) ≥ target.beat − fallBeats`. `fallBeats` is set so a note reaches the hit line at its beat, preserving today's fall speed at 65 bpm.
  - Notes in the same `group` spawn together on one row.
  - Invader type rotates squid / crab / octopus by target id.
- **Hits, misses, gunship.**
  - The keypress path is `resolvePress` → set `gunship.targetX` → spawn bolts; notes die when their bolt arrives.
  - A miss (note reaches `landTop`) → `land.bomb`, HP −5, `onLandHit`.
- **Input.**
  - The root `div.piano-invaders` has `tabIndex=0` and is focused on Start.
  - `useScopedKeys` attaches keydown/keyup to the **root element**, not `window`, and ignores events whose target is an input, textarea, select or contentEditable.
- **Layout.**
  - Key x positions = `keyEl.getBoundingClientRect().left − canvas.getBoundingClientRect().left + width / 2`. This fixes the offset bug.
  - The mobile/landscape layout decision uses `useContainerSize` dimensions, not `window`.
- **Plugins and storage.**
  - Plugin `theme().cssVars` are applied as inline style on the root, with keys mapped to `--pi-*`. `init()` is awaited before Start is enabled.
  - `localStorage` is used only inside effects or handlers, behind `typeof window !== 'undefined'`.
- **Single-song mode** (any single source prop): the StartScreen shows the title, difficulty, BPM, Start and Rules, with no barrel and no import.
- **Errors.** A load error renders an in-game message panel ("Couldn't load this score") and calls `onError` once.
- **Screens.** StartScreen, GameOver and RulesPopup are restyled to the B look:
  - black, cellophane accent bands, Press Start 2P headings, Poppins body text;
  - overlays are `position: absolute` within the root;
  - GameOver shows max combo; the leaderboard stores `maxCombo`.

- [ ] **Step 1: Failing tests** (`useScopedKeys.test.tsx`):
  - `keys fire only when root has focus`
  - `typing in an <input> inside or outside the root does not fire`
  - `listeners are removed on unmount`
- [ ] **Step 2: Failing tests** (`PianoInvaders.test.tsx`, with smplr and `AudioEngine` mocked and the canvas mocked):
  - `renders in a 600×400 container without touching document.documentElement.style`
  - `musicXml prop → single-song start screen shows the title from the file`
  - `invalid musicXml → onError called once with score-parse and an error panel, no throw` (Review Focus 2)
  - `songs prop with a dottl object shows it in the picker`
  - `importing no module touches window` (import `src/index.ts` in a `node` environment test file using `// @vitest-environment node`)
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement. Port the remaining behaviour from the old `PianoInvaders.jsx`: BPM auto increase (`BPM_INCREASE_*`), metronome and count-in toggles (persisted), accompaniment toggle, the SYN/PNO toggle without the `setScore(s => s)` hack, UFO patrol, and the accuracy meter.
- [ ] **Step 5:** Run `npm test && npm run typecheck && npm run lint && grep -rn "from 'tone'" src`. Expected: tests pass, and the grep prints nothing.
- [ ] **Step 6: Manual check.** Run `npm run dev -- --host 0.0.0.0`. Play the bundled Ode to Joy (dottl) and an imported fixture MusicXML. The gunship glides on keypress, chord pairs show the explosive shot, accompaniment stays in time, and the BPM slider works mid-song.
- [ ] **Step 7:** Commit: `feat: rewrite game shell on new song/audio/render core; drop Tone.js`.

---

### Task 10: Library build, embed fixture, Playwright and docs

**Files:**
- Modify: `vite.config.ts` (library mode), `package.json` (`name: "piano-invaders"`, `version: "2.0.0"`, `type: module`, `exports`, `files: ["lib"]`, `peerDependencies`, `sideEffects: ["*.css"]`), `CLAUDE.md`, `README.md`, `EMBEDDING_GUIDE.md`
- Create: `tsconfig.build.json`, `embed.html` + `src/embed/EmbedFixture.tsx` (dev-only page), `playwright.config.ts`, `e2e/embed.spec.ts`, `public/songs/ode-to-joy.musicxml` (bundled MusicXML sample, also listed in the standalone app's picker)

**Interfaces:**
- **Library build:**
  - Entry `src/index.ts`, ESM only, output to `lib/`. All bare imports are external (the ivories `isExternal` pattern), so smplr and ivories are regular `dependencies`.
  - `tsc -p tsconfig.build.json` emits `lib/types`.
  - CSS is emitted as `lib/style.css`, wrapped in `@layer piano-invaders { … }`.
- **Embed fixture:** at `/embed.html` it renders:
  - a page with a 40 px left margin, a header and an `<input class="embed-fixture-input">` above;
  - the game in a `720×480` box at offset (40, 120), given `musicXml` loaded from `/songs/ode-to-joy.musicxml`.
  - It exposes `window.__piFixture = { keyX(midi), noteXs() }` for tests, in dev only.

- [ ] **Step 1: Failing Playwright tests** (`e2e/embed.spec.ts`; Chromium with `--autoplay-policy=no-user-gesture-required`):
  - `game fills its 720×480 box, not the viewport`
  - `typing "asdf" in the fixture input does not light any key or fire` (Review Focus 3)
  - `after clicking Start, pressing the QWERTY key for the first target hits it (score becomes 10)`
  - `falling note x equals its key x within 2 px when the container is offset` (Review Focus 3)
  - `no console errors during 5 s of play`
- [ ] **Step 2:** Run `npm run test:e2e`. Expected: FAIL (fixture missing).
- [ ] **Step 3:** Implement the fixture, the library config and the package metadata.
- [ ] **Step 4:** Run `npm run build:lib && ls lib`. Expected: `index.js`, `style.css` and `types/index.d.ts` exist, and `grep -c "from \"react\"" lib/index.js` is ≥ 1 (React stays external).
- [ ] **Step 5:** Run `npm test && npm run test:e2e && npm run build`. Expected: all pass.
- [ ] **Step 6:** Update the docs.
  - `CLAUDE.md`: the new architecture (song/audio/game/render layers), commands, the TS stack and the embed rules.
  - `EMBEDDING_GUIDE.md`: props table (including `opensongs`), CSS import, fonts the host must load, and a becreative Astro island example. The `embed` gate is noted as TBD.
  - `README.md`: brief.
- [ ] **Step 7:** Commit: `feat: ESM library build, embed fixture, e2e tests, docs`.

---

### Task 11: OpenSongs library in the song roller (runs after Task 9, before Task 10)

**Files:**
- Create: `src/song/opensongs.ts`, `tests/song/opensongs.test.ts`, `tests/fixtures/opensongs-index.json` (a 4-entry excerpt of the real index, covering difficulties 1, 2, 3 and 5)
- Modify: the start screen and roller (`src/components/StartScreen.tsx` and helpers) to show OpenSongs entries and the difficulty filter; `src/components/PianoInvaders.tsx` (props); `src/index.ts` (exports)

**Interfaces:**
- Produces:

```ts
export const OPENSONGS_BASE_URL = 'https://cdn.jsdelivr.net/gh/pepperhorn/opensongs-json@master/'
export interface OpenSongEntry { id: string; title: string; composer?: string; difficulty: Difficulty; level: number; key?: string; timeSignature?: [number, number]; musicxmlUrl: string }
export async function loadOpenSongsIndex(opts?: { baseUrl?: string; fetchImpl?: typeof fetch }): Promise<OpenSongEntry[]>  // sorted by level, then title
export async function loadOpenSong(entry: OpenSongEntry, opts?: { fetchImpl?: typeof fetch }): Promise<GameSong>   // loadSong({ scoreUrl: entry.musicxmlUrl }, { title: entry.title, difficulty: entry.level })
```

- **New prop on `PianoInvadersProps`:** `opensongs?: boolean | { baseUrl?: string }`. It defaults to `true` in picker mode and is ignored in single-song mode.
- **Index format** (from `opensongs-json/index.json`): `{ count, songs: [{ id, title, composer, difficulty: 1-5, key, timeSignature: [n, d], files: { musicxml: 'songs/<id>/song.musicxml' } }] }`. `musicxmlUrl = baseUrl + files.musicxml`.

**Behaviour:**
- **Loading.** The index is fetched lazily when the start screen mounts in picker mode. While it loads, the roller shows bundled songs plus a loading row. On failure, `onError({ code: 'score-load', … })` is called once and bundled songs stay usable.
- **Roller order.** Bundled songs first, then OpenSongs entries in index sort order.
- **Difficulty filter.** All / Easy / Intermediate / Advanced, as pill buttons with `aria-pressed` and contextual class names, styled in the B cabinet look. The filter applies to both bundled and OpenSongs entries.
- **The roller must stay smooth with about 460 entries.** Render only the visible window of the barrel (virtualise), not every item.
- **Picking a song.** Picking an OpenSongs entry calls `loadOpenSong` with a per-song in-memory cache, showing "Loading…" on the Start button until it resolves. A failed load calls `onError` with an error panel; the roller stays usable.

- [ ] **Step 1: Failing tests** (`opensongs.test.ts`, with `fetchImpl` stubbed and the fixture index):
  - `index maps to entries with absolute musicxmlUrl and crf difficulty mapping (1,2→easy; 3→intermediate; 5→advanced)`
  - `entries sorted by level then title`
  - `custom baseUrl is used`
  - `index 500 → SongError score-load`
  - `loadOpenSong fetches the musicxml url and returns a GameSong titled from the entry`, using `tests/fixtures/leadsheet-then-piano.musicxml` as the body
- [ ] **Step 2: Failing tests** (component, with `fetchImpl` / global fetch mocked):
  - `picker shows bundled songs then OpenSongs titles`
  - `difficulty filter narrows the roller`
  - `opensongs={false} shows bundled only`
  - `index failure → onError once, bundled songs still selectable`
  - `roller renders a bounded number of DOM rows with 460 entries` (virtualisation)
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 6: Manual check** on the dev server: scroll the roller and filter it, pick "Hot Cross Buns", and play.
- [ ] **Step 7:** Commit: `feat: OpenSongs library in the song roller`.
