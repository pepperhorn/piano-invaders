# Piano Invaders - Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Install Dependencies

```bash
npm install
```

This installs:
- React 19
- Tone.js 15 (for audio)
- Vite (build tool)

### 2. Run Development Server

```bash
npm run dev
```

Visit http://localhost:5173 in your browser.

### 3. Play the Game!

1. Click **START** to begin (this also initializes audio)
2. Press piano keys to shoot falling notes
3. Hit the **GREEN** note first
4. Reach 1000 points to win!

---

## 📦 Embedding in Your Site

### Simple Embed

```jsx
import PianoInvaders from './src/components/PianoInvaders.jsx';

function MyApp() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <PianoInvaders />
    </div>
  );
}
```

### With Custom Songs

```jsx
const songs = [
  {
    name: "C Scale",
    bpm: 60,
    melody: ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"]
  }
];

<PianoInvaders songs={songs} />
```

---

## 🎵 Adding Songs

Edit `public/song_library.json`:

```json
{
  "songs": [
    {
      "name": "Your Song",
      "bpm": 80,
      "melody": ["C3", "E3", "G3", null, "C4"]
    }
  ]
}
```

**Valid notes**: B2, C3, C#3, D3, D#3, E3, F3, F#3, G3, G#3, A3, A#3, B3, C4, C#4, D4, D#4, E4

**Use `null`** for rests (pauses)

---

## 🔧 Customization

### Change Game Settings

Edit `src/constants/gameConfig.js`:

```javascript
export const GAME_CONFIG = {
  WIN_SCORE: 1000,        // Points to win
  POINTS_PER_NOTE: 10,    // Points per hit
  NOTE_BASE_SPEED: 1.5,   // Falling speed
  // ...
};
```

### Modify Styles

Edit `src/styles/PianoInvaders.css`:

```css
.piano-invaders-game {
  background: #000; /* Change background */
}

.piano-key {
  border-color: #0f0; /* Change key borders */
}
```

---

## 🏗️ Build for Production

### Standalone App

```bash
npm run build
```

Output in `dist/` folder - deploy to any static hosting.

### As a Library

```bash
npm run build:lib
```

Creates reusable library files:
- `dist/piano-invaders.es.js` (ES module)
- `dist/piano-invaders.umd.js` (UMD module)

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| **EMBEDDING_GUIDE.md** | Complete embedding examples |
| **REACT_README.md** | React version overview |
| **CODE_REVIEW.md** | Code analysis and improvements |
| **IMPLEMENTATION_SUMMARY.md** | What was built and why |
| **README.md** | Original documentation |

---

## 🎮 Game Controls

- **Click/Tap** piano keys to shoot
- Hit the **GREEN** note (next in sequence)
- **Yellow** = upcoming note
- **Orange** = 2nd upcoming
- **Gray** = queued notes

---

## 🔊 Audio

Audio is powered by **Tone.js** and includes:
- 🎹 Piano sounds when you press keys
- ✅ Success beep on correct hit
- ❌ Error sound on miss
- 🎉 Victory fanfare on win
- 💀 Game over sound on loss

**Note**: Audio requires user interaction (clicking START) due to browser policies.

---

## ❓ Troubleshooting

### No Audio?
- Click the START button (initializes audio)
- Check browser console for errors
- Try a different browser
- Ensure volume is up

### Songs Not Loading?
- Check `public/song_library.json` exists
- Pass songs via props instead:
  ```jsx
  <PianoInvaders songs={customSongs} />
  ```

### Build Errors?
- Delete `node_modules/` and run `npm install` again
- Clear `dist/` folder
- Check Node.js version (v18+ recommended)

---

## 🚀 Next Steps

1. **Test it**: `npm run dev`
2. **Add songs**: Edit `public/song_library.json`
3. **Embed it**: See EMBEDDING_GUIDE.md
4. **Deploy it**: `npm run build` → upload `dist/`

---

## 💡 Pro Tips

- The component is **fully self-contained** - copy `src/components/` and `src/utils/` into any React project
- Use **custom songs** to create educational lessons (scales, chords, etc.)
- Adjust **difficulty** by changing BPM and speed in config
- **Mobile-friendly** out of the box - no extra work needed

---

**Ready to play?** Run `npm run dev` and have fun! 🎹👾
