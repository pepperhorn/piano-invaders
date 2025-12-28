# Piano Invaders - React Component

A retro-styled rhythm game built as a reusable React component with Tone.js audio integration.

## Project Status

✅ **Complete React Refactor** - The game is now a fully modular React component
✅ **Tone.js Audio** - Piano sounds and game audio fully integrated
✅ **Embeddable** - Easy to integrate into any React application
✅ **Modular Architecture** - Clean component structure for maintainability

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Visit http://localhost:5173
```

### Build

```bash
# Build for production (standalone app)
npm run build

# Build as library (for embedding)
npm run build:lib
```

## Project Structure

```
piano-invaders/
├── src/
│   ├── components/
│   │   ├── PianoInvaders.jsx  # Main game component
│   │   ├── Keyboard.jsx       # Piano keyboard
│   │   ├── StartScreen.jsx    # Song selection screen
│   │   ├── GameOver.jsx       # End game screen
│   │   └── RulesPopup.jsx     # Instructions modal
│   ├── utils/
│   │   ├── AudioManager.js    # Tone.js audio wrapper
│   │   └── Note.js           # Note entity class
│   ├── constants/
│   │   └── gameConfig.js     # Game configuration
│   ├── styles/
│   │   └── PianoInvaders.css # All game styles
│   ├── App.jsx               # Demo app
│   └── main.jsx              # Entry point
├── public/
│   └── song_library.json     # Song data
├── index.html
├── vite.config.js
└── package.json
```

## Features

### ✨ Audio Integration (NEW!)
- **Piano sounds** when you press keys (via Tone.js)
- **Hit/miss sound effects** for gameplay feedback
- **Victory/defeat music** for game endings
- Automatic browser audio policy handling

### 🎮 Game Mechanics
- 18-key piano range (B2 to E4)
- Color-coded notes (green = next, yellow = upcoming, etc.)
- Progressive difficulty (BPM increases over time)
- Destructible bases
- Win at 1000 points
- 7 built-in songs

### 📱 Responsive Design
- Works on desktop and mobile
- Touch-friendly keyboard
- Auto-scaling canvas
- Retro "Press Start 2P" font

### 🧩 Modular Components
Each component has a single responsibility:
- `PianoInvaders` - Main game logic and state
- `Keyboard` - Piano UI and input handling
- `StartScreen` - Song selection with barrel scroller
- `GameOver` - Victory/defeat screen
- `RulesPopup` - How to play instructions
- `AudioManager` - Tone.js audio abstraction
- `Note` - Note entity with physics and rendering

## How to Use as a Component

### Basic Usage

```jsx
import PianoInvaders from './src/components/PianoInvaders.jsx';

function MyApp() {
  return <PianoInvaders />;
}
```

### With Custom Songs

```jsx
const customSongs = [
  {
    name: "C Scale",
    bpm: 60,
    melody: ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"]
  }
];

<PianoInvaders songs={customSongs} />
```

See [EMBEDDING_GUIDE.md](./EMBEDDING_GUIDE.md) for complete documentation.

## Dependencies

- **React 19** - UI framework
- **Tone.js 15** - Web Audio API wrapper for music
- **Vite** - Build tool and dev server

## Configuration

Edit `src/constants/gameConfig.js` to customize:

```javascript
export const GAME_CONFIG = {
  WIN_SCORE: 1000,           // Change win condition
  POINTS_PER_NOTE: 10,       // Points per hit
  NOTE_BASE_SPEED: 1.5,      // Falling speed
  BPM_INCREASE_AMOUNT: 2,    // Difficulty progression
  // ... more settings
};
```

## Adding Songs

Edit `public/song_library.json`:

```json
{
  "songs": [
    {
      "name": "My Song",
      "bpm": 80,
      "melody": ["C3", "E3", "G3", null, "C4", "B3"]
    }
  ]
}
```

- **Valid notes**: B2, C3, C#3, D3, D#3, E3, F3, F#3, G3, G#3, A3, A#3, B3, C4, C#4, D4, D#4, E4
- **Use `null`** for rests (pauses in the melody)

## Development

### Running Tests (Future)

```bash
npm test
```

### Code Style

- ES6+ JavaScript
- React Hooks (functional components)
- CSS with BEM-like naming

### Key Files to Edit

- **Add features**: `src/components/PianoInvaders.jsx`
- **Change audio**: `src/utils/AudioManager.js`
- **Adjust styling**: `src/styles/PianoInvaders.css`
- **Modify constants**: `src/constants/gameConfig.js`

## Migration from Original

The original `piano-invaders.html` (1,070 lines) has been refactored into:

| Original | New | Lines | Purpose |
|----------|-----|-------|---------|
| HTML | `index.html` | 18 | Shell |
| CSS | `PianoInvaders.css` | 450 | Styles |
| JS (all) | `PianoInvaders.jsx` | 360 | Main logic |
| - | `Keyboard.jsx` | 95 | Piano keys |
| - | `StartScreen.jsx` | 52 | Menu |
| - | `GameOver.jsx` | 13 | End screen |
| - | `RulesPopup.jsx` | 47 | Instructions |
| - | `AudioManager.js` | 95 | Audio (NEW!) |
| - | `Note.js` | 60 | Note entity |
| - | `gameConfig.js` | 65 | Constants |

**Result**: More maintainable, testable, and reusable!

## Improvements Over Original

✅ **Audio Integration** - Was missing entirely
✅ **Modular Structure** - Easy to understand and modify
✅ **React Components** - Reusable and composable
✅ **Configuration** - Constants extracted to config file
✅ **Error Handling** - Better fallbacks for missing data
✅ **Type Safety Ready** - Easy to convert to TypeScript
✅ **Build System** - Modern Vite tooling
✅ **Embeddable** - Use as component in any React app

## Next Steps

Based on the README TODO:
- [ ] Expand song library (add more songs to JSON)
- [ ] Add difficulty levels (easy/medium/hard)
- [ ] Score persistence (localStorage)
- [ ] Leaderboard system
- [ ] Song creator/editor UI
- [ ] Combo multiplier system
- [ ] More visual effects
- [ ] Accessibility improvements

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

GPLv3 - See LICENSE file

## Credits

- **Original Concept**: Space Invaders + Piano learning
- **Font**: Press Start 2P by CodeMan38
- **Audio Library**: Tone.js by Yotam Mann
- **Songs**: Public domain melodies

---

**Questions?** See [EMBEDDING_GUIDE.md](./EMBEDDING_GUIDE.md) for detailed integration instructions.
