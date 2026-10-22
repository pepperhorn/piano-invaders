# Embedding Piano Invaders

Piano Invaders ships as an ESM React component (`piano-invaders`, v2). It fills its parent element, so give the parent a size. It touches no page-level state: no `window`/`document`/`localStorage` access at import time, no writes to `<html>`, no viewport units, and its keyboard input is scoped to the game element (typing in a host `<input>` does nothing).

```bash
npm install piano-invaders react react-dom   # react / react-dom >= 19 are peers
```

```tsx
import PianoInvaders from 'piano-invaders'
import 'piano-invaders/style.css'

<div style={{ width: 720, height: 480 }}>
  <PianoInvaders musicXml={xmlString} title="Ode to Joy" difficulty="easy" />
</div>
```

## Host requirements

- **CSS:** `import 'piano-invaders/style.css'`. All rules are scoped under `.piano-invaders` inside `@layer piano-invaders`, so unlayered host CSS (Tailwind utilities included) wins. Theme variables are prefixed `--pi-`.
- **Fonts (the library never loads fonts):** Press Start 2P and Poppins 400 + 600. For example `@fontsource/press-start-2p`, `@fontsource/poppins/400.css` and `@fontsource/poppins/600.css`. Without them the game falls back to monospace / system-ui.
- **Sizing:** the game takes 100% of its container, not the viewport. Very short containers shrink the keyboard (minimum 70 px).
- **CSP:** allow `connect-src`/`img-src` for `https://cdn.jsdelivr.net` (OpenSongs library) and for the smplr sample hosts (`https://smpldsnds.github.io` for the piano and drum samples, `https://gleitz.github.io` for soundfonts). Audio is synthesised as a fallback if samples cannot be fetched (reported as an `audio` error). `data:` URLs are used for the bundled logo and metronome clicks.
- **Audio:** the AudioContext is created on the first Start click (user gesture), never at import.

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `musicXml` | `string` | | Single-song mode: MusicXML text. First of `musicXml`, `scoreUrl`, `file`, `midi`, `dottl` that is present wins. |
| `scoreUrl` | `string` | | URL of a `.musicxml` / `.mxl` / `.mid` / `.dottl` file. |
| `file` | `File \| Blob` | | A score file (e.g. from an `<input type=file>`). |
| `midi` | `ArrayBuffer` | | MIDI bytes. The first track is the melody. |
| `dottl` | `object \| string` | | A dottl song (v5 to v7). |
| `songs` | `Array<GameSong \| object>` | | Song-picker mode: `GameSong`s or dottl / legacy song objects. |
| `title` | `string` | from score | Overrides the song title (single-song mode). |
| `difficulty` | `'easy' \| 'intermediate' \| 'advanced' \| number` | `'easy'` | A number is the crf 1 to 5 scale: 1-2 easy, 3 intermediate, 4-5 advanced. Tag plus score multiplier only; notes are never thinned. |
| `bpm` | `number` | from score | Starting tempo override (single-song mode). |
| `showSongPicker` | `boolean` | `true` when no single-song source | `false` with no source shows the built-in song. |
| `allowImport` | `boolean` | `true` in picker mode | Import `.musicxml`, `.xml`, `.mxl`, `.mid`, `.dottl`. |
| `opensongs` | `boolean \| { baseUrl?: string }` | `true` in picker mode | Adds the OpenSongs library (index fetched from `https://cdn.jsdelivr.net/gh/pepperhorn/opensongs-json@master/index.json`) to the song roller, songs loaded on demand. Ignored in single-song mode. Use `{ baseUrl }` for a mirror, `false` to make no network request. |
| `leaderboard` | `{ load(), save(entries) }` | localStorage | Sync or async adapter. Entries carry `maxCombo`. |
| `plugins` | `PianoInvadersPlugin[]` | `[]` | See below. |
| `onGameEnd` | `(stats) => void` | | `{ score, total, hp, bpm, seconds, accuracy, maxCombo, difficulty, song }`. |
| `onError` | `({ code, message, cause }) => void` | | `code` is `'score-load' \| 'score-parse' \| 'audio'`. Each error is also logged once with `console.warn('[piano-invaders] <code>: <message>')` and is never thrown into the host. |
| `className` | `string` | | Extra class on the root element. |

Songs loop until HP reaches 0 or the player quits. Scoring: +10 per hit, -5 HP per missed note, TOTAL = score x (HP/100 + 1) x (BPM / 65) x (1 + minutes) x difficulty multiplier (x1 / x2 / x3).

The package also exports helpers: `loadSong`, `loadOpenSongsIndex`, `loadOpenSong`, `OPENSONGS_BASE_URL`, `dottlToGameSong`, `gameSongToDottl` (writes dottl v7), `isDottl`, `scoreToGameSong`, `SongError`, and the types `PianoInvadersProps`, `GameStats`, `PianoInvadersError`, `LeaderboardAdapter`, `LeaderboardEntry`, `PianoInvadersPlugin`, `PluginTheme`, `GameSong`, and friends.

## Plugins

```ts
interface PianoInvadersPlugin {
  name?: string
  init?(): void | Promise<void>
  songs?(): unknown[] | Promise<unknown[]>      // extra picker songs
  leaderboard?: LeaderboardAdapter              // used when no `leaderboard` prop
  theme?(): { cssVars?: Record<string, string>; backgroundImage?: string; className?: string }
  parseSong?(data: unknown): unknown
  onGameStart?(e); onGameEnd?(e); onNoteHit?(e); onNoteMiss?(e)
  dispose?(): void
}
```

Theme keys map to `--pi-*` custom properties (`accent`, `--accent` and `--pi-accent` all become `--pi-accent`). Note: the game canvas is opaque, so a plugin `backgroundImage` is applied to the root but hidden behind the canvas; it is only visible around the stage.

## Example: becreative (Astro island)

```astro
---
// src/pages/play/[slug].astro
import PianoInvaders from 'piano-invaders'
import 'piano-invaders/style.css'
const sheet = await getSheet(Astro.params.slug) // { musicXml: string, difficulty: 1..5 }
---
<div class="sheet-game" style="width: 100%; max-width: 960px; aspect-ratio: 3 / 2;">
  <PianoInvaders client:only="react" musicXml={sheet.musicXml} difficulty={sheet.difficulty} />
</div>
```

Use `client:only="react"`: the game needs a browser (canvas, Web Audio) and renders nothing on the server. Load the Press Start 2P and Poppins fonts in the site layout. The becreative `embed` gate (which sheets may be embedded) is **TBD** and not part of this package.

## Local development of the embed

`npm run dev -- --host 0.0.0.0` serves the standalone app at `/` and a host-page fixture at `/embed.html` (720x480 box at offset 40,120 with a text input above). The Playwright suite (`npm run test:e2e`) drives that fixture to check confinement, scoped keyboard input and note/key alignment.

## Building the package

`npm run build:lib` emits `lib/index.js` (ESM, every bare import external), `lib/types/**/*.d.ts` and `lib/style.css`. `exports` has `"."` and `"./style.css"`, each with a `source` condition for monorepo consumers.
