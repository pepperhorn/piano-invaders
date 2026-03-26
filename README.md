# Piano Invaders

A retro-styled rhythm game that combines Space Invaders gameplay with piano-based music mechanics. Shoot falling musical notes by pressing the correct piano keys!

## Intent

A quick project to see if we can build a simple game to reinforce or introduce someone to the piano keyboard. Goal to keep the game inside a React element so it can be easily embedded, while modularizing components for maintainability and flexibility.

## How to Play

### Getting Started
1. Run `npm install` then `npm run dev`
2. Select a song from the barrel scroller (use ▲/▼ buttons)
3. Click **START** to begin or **RANDOM** for a random song
4. Import your own `.dottl` songs with the **IMPORT** button

### Gameplay
- A UFO flies across the top, dropping musical notes
- Notes fall diagonally toward their target piano key
- Press the correct key to shoot the note and score points
- Missed notes bomb the land strip below, draining your HP
- The game ends when HP reaches 0

### Note Colors
- **Green**: Next note to hit
- **Yellow**: Coming soon
- **Orange**: Further away
- **Gray**: In queue

### Controls
- **Click/Tap** piano keys on mobile
- **Desktop keyboard** (Ableton-style): A=B, S=C, D=D, F=E, G=F, H=G, J=A, K=B, L=C — sharps on top row: E=C#, R=D#, Y=F#, U=G#, I=A#, P=C#, [=D#

### Scoring
- **+10 points** per correct note hit
- **-5 HP** per missed note
- **TOTAL** = Score × HP% × BPM × Time × Difficulty
- Difficulty multiplier: Easy x1, Intermediate x2, Advanced x3
- Top 10 scores saved to a local leaderboard

### Difficulty Progression
- BPM increases after 30 seconds, then every 60 seconds (+2 BPM)
- Higher BPM = faster falling notes

## Song Format

Songs use the [Dottl song format](https://github.com/pepperhorn/dottl-spec) (`.dottl` v3). The first layer is the game melody; additional layers provide accompaniment.

Players can import their own `.dottl` files from the start screen.

### Built-in Songs
| Song | BPM | Difficulty |
|------|-----|------------|
| Ode to Joy | 65 | Easy |
| Twinkle Twinkle | 70 | Easy |
| Mary Had a Lamb | 75 | Easy |
| Happy Birthday | 65 | Easy |
| Frere Jacques | 75 | Intermediate |
| Blue Danube | 80 | Intermediate |
| Fur Elise | 70 | Advanced |

## Development

```bash
npm install
npm run dev -- --host 0.0.0.0
```

### Tech Stack
- React 19 + Vite 7
- Tone.js for audio synthesis
- Canvas API for game rendering
- Plain CSS with 'Press Start 2P' pixel font
- No TypeScript, no CSS framework

### Key Modules
- `src/components/PianoInvaders.jsx` — Main game component and loop
- `src/components/Keyboard.jsx` — Piano keyboard with QWERTY support
- `src/utils/LandStrip.js` — Procedural terrain generation
- `src/utils/dottl.js` — Dottl format converter
- `src/utils/leaderboard.js` — localStorage leaderboard
- `src/constants/gameConfig.js` — Tunable game parameters

### Embedding
The component accepts an optional `songs` prop. The library build (`npm run build:lib`) externalizes React/ReactDOM for use as an embeddable widget.

## Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Fully responsive: portrait mobile, landscape mobile, desktop
- Touch and pointer events supported
- PWA-ready with manifest and icons

## Credits

Game Design: Retro arcade style inspired by Space Invaders
Font: Press Start 2P by CodeMan38 (Google Fonts)
Music: Classic public domain melodies

---

**License**: GPLv3
