# Piano Invaders - React Component Embedding Guide

## Overview

Piano Invaders is now a fully self-contained React component that can be easily embedded into any React application or website. This guide explains how to integrate it into your project.

## Quick Start

### For React Applications

#### Option 1: Direct Import (Recommended)

If you're working within this repository:

```jsx
import PianoInvaders from './src/components/PianoInvaders.jsx';

function MyApp() {
  return (
    <div>
      <h1>My Cool Website</h1>
      <PianoInvaders />
    </div>
  );
}
```

#### Option 2: As an npm Package

After building the library:

```bash
npm run build:lib
```

Then in another project:

```jsx
import PianoInvaders from 'piano-invaders';

function MyApp() {
  return <PianoInvaders />;
}
```

### For Non-React Applications

You can embed the component using the UMD build:

```html
<!DOCTYPE html>
<html>
<head>
  <script crossorigin src="https://unpkg.com/react@19/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"></script>
  <script src="./dist/piano-invaders.umd.js"></script>
</head>
<body>
  <div id="piano-game"></div>

  <script>
    const e = React.createElement;
    const root = ReactDOM.createRoot(document.getElementById('piano-game'));
    root.render(e(PianoInvaders));
  </script>
</body>
</html>
```

## Component API

### Props

The `PianoInvaders` component accepts the following optional props:

#### `songs` (Array, optional)

Custom song library to use instead of loading from JSON.

```jsx
const customSongs = [
  {
    name: "Twinkle Twinkle",
    bpm: 70,
    melody: ["C3", "C3", "G3", "G3", "A3", "A3", "G3", null, "F3", "F3", "E3", "E3", "D3", "D3", "C3"]
  },
  {
    name: "Mary Had a Lamb",
    bpm: 75,
    melody: ["E3", "D3", "C3", "D3", "E3", "E3", "E3", null, "D3", "D3", "D3"]
  }
];

<PianoInvaders songs={customSongs} />
```

**Song Object Format:**
- `name` (string): Display name of the song
- `bpm` (number): Beats per minute (40-200 recommended)
- `melody` (Array): Array of MIDI note names or `null` for rests
  - Valid notes: B2, C3, C#3, D3, D#3, E3, F3, F#3, G3, G#3, A3, A#3, B3, C4, C#4, D4, D#4, E4
  - Use `null` for musical rests (no note)

### Default Behavior

If no `songs` prop is provided, the component will:
1. Attempt to fetch `/song_library.json`
2. Fall back to a default "Ode to Joy" melody if fetch fails

## Integration Examples

### Example 1: Simple Embed

```jsx
import React from 'react';
import PianoInvaders from './src/components/PianoInvaders.jsx';

function GamePage() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <PianoInvaders />
    </div>
  );
}

export default GamePage;
```

### Example 2: With Custom Songs

```jsx
import React from 'react';
import PianoInvaders from './src/components/PianoInvaders.jsx';

const educationalSongs = [
  {
    name: "C Major Scale",
    bpm: 60,
    melody: ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"]
  },
  {
    name: "C Major Arpeggio",
    bpm: 70,
    melody: ["C3", "E3", "G3", "C4", "G3", "E3", "C3"]
  }
];

function MusicLearningApp() {
  return (
    <div>
      <h1>Learn Piano with Games!</h1>
      <PianoInvaders songs={educationalSongs} />
    </div>
  );
}

export default MusicLearningApp;
```

### Example 3: Conditional Rendering

```jsx
import React, { useState } from 'react';
import PianoInvaders from './src/components/PianoInvaders.jsx';

function GameHub() {
  const [showGame, setShowGame] = useState(false);

  return (
    <div>
      {!showGame ? (
        <button onClick={() => setShowGame(true)}>
          Launch Piano Invaders
        </button>
      ) : (
        <div style={{ width: '100vw', height: '100vh' }}>
          <PianoInvaders />
        </div>
      )}
    </div>
  );
}

export default GameHub;
```

### Example 4: Within a Modal/Dialog

```jsx
import React, { useState } from 'react';
import PianoInvaders from './src/components/PianoInvaders.jsx';

function ModalGame() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Play Game</button>

      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          zIndex: 9999
        }}>
          <button
            onClick={() => setIsOpen(false)}
            style={{ position: 'absolute', top: 10, right: 10, zIndex: 10000 }}
          >
            Close
          </button>
          <PianoInvaders />
        </div>
      )}
    </>
  );
}

export default ModalGame;
```

## Styling and Layout

### Container Requirements

The component is designed to fill its container:
- Default size: 100vw × 100vh (full viewport)
- The component uses `position: relative` internally
- Parent container should have defined dimensions

### Recommended Container Styles

```css
.game-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
```

### Responsive Behavior

The game automatically:
- Resizes canvas on window resize
- Recalculates keyboard positions
- Adjusts layout for mobile devices
- Supports touch events

### Mobile Optimization

The component includes:
- Touch-friendly piano keys
- No text selection on touch
- Proper viewport meta tag handling
- Auto-scaling based on screen size

## Dependencies

The component requires these peer dependencies:

```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "tone": "^15.0.0"
}
```

Install them in your project:

```bash
npm install react react-dom tone
```

## Audio Considerations

### Browser Audio Policies

Modern browsers require user interaction before playing audio. The component handles this automatically:

1. Audio is initialized on first click of "START" or "RANDOM" button
2. If audio fails to initialize, gameplay continues without sound
3. No additional configuration needed

### Audio Features

The component uses Tone.js to provide:
- **Piano sounds** when pressing keys
- **Hit sound** when successfully hitting a note (C5 beep)
- **Miss sound** when note hits a base (C2 beep)
- **Victory fanfare** when reaching 1000 points
- **Game over sound** when all bases are destroyed

### Disabling Audio (Not Implemented Yet)

If you want to add an option to disable audio, you can modify the component:

```jsx
<PianoInvaders muted={true} />  // Future feature
```

## Building for Production

### Development

```bash
npm run dev
```

Runs Vite dev server at http://localhost:5173

### Production Build (Standalone App)

```bash
npm run build
```

Outputs to `dist/` folder:
- Optimized for hosting
- Includes all assets
- Ready to deploy

### Library Build (For Embedding)

```bash
npm run build:lib
```

Creates:
- `dist/piano-invaders.es.js` - ES module
- `dist/piano-invaders.umd.js` - UMD module

## Deployment

### Option 1: Deploy Standalone

Upload the `dist/` folder to any static hosting:

- **Netlify**: Drag and drop `dist/`
- **Vercel**: Connect Git repo
- **GitHub Pages**: Push to `gh-pages` branch
- **AWS S3**: Upload to bucket with static hosting

### Option 2: Embed in Existing Site

1. Build the library: `npm run build:lib`
2. Copy `dist/piano-invaders.es.js` to your project
3. Import and use as shown above

### Option 3: Publish to npm

1. Update `package.json` with your details
2. Add repository, author, license
3. Run `npm publish`
4. Install in other projects: `npm install piano-invaders`

## Customization

### Changing Game Constants

Edit `src/constants/gameConfig.js`:

```javascript
export const GAME_CONFIG = {
  WIN_SCORE: 1000,        // Points needed to win
  POINTS_PER_NOTE: 10,    // Points per correct note
  NOTE_BASE_SPEED: 1.5,   // Falling speed
  BPM_INCREASE_DELAY: 60000,  // 1 minute before BPM increases
  BPM_INCREASE_INTERVAL: 10000,  // Increase BPM every 10 seconds
  BPM_INCREASE_AMOUNT: 2,  // How much to increase BPM
  // ...
};
```

### Adding Custom Styles

Override CSS classes in your parent component:

```jsx
<div className="custom-game-wrapper">
  <PianoInvaders />
</div>
```

```css
.custom-game-wrapper .piano-invaders-game {
  background: linear-gradient(to bottom, #000033, #000000);
}

.custom-game-wrapper .piano-key {
  border-color: #00ffff;
}
```

### Extending the Component

Create a wrapper component:

```jsx
import React, { useState } from 'react';
import PianoInvaders from './src/components/PianoInvaders.jsx';

function EnhancedPianoInvaders() {
  const [difficulty, setDifficulty] = useState('normal');

  const getSongs = () => {
    // Load different songs based on difficulty
    if (difficulty === 'easy') {
      return easyMelodies;
    } else if (difficulty === 'hard') {
      return hardMelodies;
    }
    return normalMelodies;
  };

  return (
    <div>
      <select onChange={(e) => setDifficulty(e.target.value)}>
        <option value="easy">Easy</option>
        <option value="normal">Normal</option>
        <option value="hard">Hard</option>
      </select>

      <PianoInvaders songs={getSongs()} />
    </div>
  );
}
```

## Troubleshooting

### No Audio

**Symptom**: Game works but no sound plays

**Solutions**:
1. Check browser console for audio errors
2. Ensure user clicked START button (audio needs user interaction)
3. Check browser audio permissions
4. Try different browser (some block audio)

### Songs Not Loading

**Symptom**: "Loading..." appears indefinitely

**Solutions**:
1. Ensure `song_library.json` is in `public/` folder
2. Check browser console for fetch errors
3. Pass songs directly via props instead

### Layout Issues

**Symptom**: Game appears cut off or misaligned

**Solutions**:
1. Ensure parent container has defined width/height
2. Remove conflicting CSS from parent
3. Check for CSS that affects `position: absolute`

### Performance Issues

**Symptom**: Game runs slowly or choppy

**Solutions**:
1. Close other browser tabs
2. Check if running on low-power device
3. Reduce number of active notes
4. Disable other animations on page

## Advanced: TypeScript Support

To add TypeScript support:

1. Rename files from `.jsx` to `.tsx`
2. Add type definitions:

```typescript
// types.ts
export interface Song {
  name: string;
  bpm: number;
  melody: (string | null)[];
}

export interface PianoInvadersProps {
  songs?: Song[];
}
```

3. Update component:

```tsx
import React from 'react';
import { PianoInvadersProps } from './types';

const PianoInvaders: React.FC<PianoInvadersProps> = ({ songs }) => {
  // ...
};
```

## Examples Repository

For more examples and demos, see:
- `src/App.jsx` - Basic usage
- `examples/` folder (to be added)

## Support

For issues or questions:
- Check the troubleshooting section above
- Review the main README.md
- Check browser console for errors
- Ensure all dependencies are installed

## License

GPLv3 - See LICENSE file for details

---

**Pro Tip**: The component is fully self-contained. You can copy the entire `src/components/` and `src/utils/` folders into any React project and it will work!
