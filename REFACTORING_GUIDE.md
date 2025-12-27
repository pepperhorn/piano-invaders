# Piano Invaders - Refactoring Implementation Guide

## Quick Start: Add Audio (1-2 hours)

This is the highest-impact improvement you can make.

### Step 1: Add Tone.js via CDN

In `piano-invaders.html`, add before the closing `</body>` tag:

```html
<script src="https://cdn.jsdelivr.net/npm/tone@14.8.49/build/Tone.js"></script>
<script>
    // Your existing game code here

    // ADD THIS SECTION
    // ============== AUDIO MANAGER ==============
    class AudioManager {
        constructor() {
            this.synth = null;
            this.initialized = false;
        }

        async init() {
            if (this.initialized) return;

            await Tone.start();
            this.synth = new Tone.PolySynth(Tone.Synth, {
                envelope: {
                    attack: 0.02,
                    decay: 0.1,
                    sustain: 0.3,
                    release: 1
                }
            }).toDestination();

            this.initialized = true;
        }

        playNote(midi, duration = "8n") {
            if (!this.initialized) return;
            this.synth.triggerAttackRelease(midi, duration);
        }

        playHit() {
            if (!this.initialized) return;
            this.synth.triggerAttackRelease("C5", "32n");
        }

        playMiss() {
            if (!this.initialized) return;
            this.synth.triggerAttackRelease("C2", "16n");
        }

        playGameOver() {
            if (!this.initialized) return;
            // Descending sad trombone
            const now = Tone.now();
            ["C4", "B3", "A3", "G3"].forEach((note, i) => {
                this.synth.triggerAttackRelease(note, "8n", now + i * 0.15);
            });
        }

        playWin() {
            if (!this.initialized) return;
            // Ascending victory fanfare
            const now = Tone.now();
            ["C4", "E4", "G4", "C5"].forEach((note, i) => {
                this.synth.triggerAttackRelease(note, "8n", now + i * 0.1);
            });
        }
    }

    const audioManager = new AudioManager();
</script>
```

### Step 2: Initialize Audio on User Interaction

Replace your `startGame()` function (line 838) with:

```javascript
async function startGame() {
    // Initialize audio on first interaction
    await audioManager.init();

    const song = SONGS[currentSongIndex];
    bpm = song.bpm;
    document.getElementById('songTitle').textContent = song.name;
    document.getElementById('bpm').textContent = `BPM: ${bpm}`;
    document.getElementById('startScreen').style.display = 'none';

    score = 0;
    melodyIndex = 0;
    notes = [];
    gameStartTime = Date.now();
    gameRunning = true;

    calculateKeyPositions();
    initBases();
    updateScore();
    spawnNotes();
    gameLoop();
}
```

### Step 3: Add Sound Effects

**When player presses a key** (line 711):
```javascript
keyEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();

    // Play the piano note
    audioManager.playNote(key.midi, "8n");

    handleKeyPress(key.midi);
    keyEl.classList.add('active');
});
```

**When note is hit successfully** (line 975-982):
```javascript
if (nextNote.midi.toLowerCase() === midi.toLowerCase() && nextNote.isInTargetZone()) {
    nextNote.active = false;
    score += 10;
    updateScore();

    // Add success sound
    audioManager.playHit();

    if (score >= 1000) {
        endGame(true);
    }
}
```

**On game over** (line 871-878):
```javascript
function endGame(won) {
    gameRunning = false;

    // Play appropriate sound
    if (won) {
        audioManager.playWin();
    } else {
        audioManager.playGameOver();
    }

    const gameOver = document.getElementById('gameOver');
    gameOver.style.display = 'flex';
    gameOver.classList.toggle('win', won);
    gameOver.querySelector('h2').textContent = won ? 'YOU WIN!' : 'GAME OVER';
    document.getElementById('finalScore').textContent = `SCORE: ${score}`;
}
```

**When note hits base** (line 1037):
```javascript
const pixel = activePixels[Math.floor(Math.random() * activePixels.length)];
pixel.active = false;
pixel.element.style.display = 'none';
note.active = false;

// Add damage sound
audioManager.playMiss();
```

### Result
You now have:
- Piano notes that actually play when you press keys
- Hit/miss sound effects
- Victory/defeat music
- ~50 lines of code added
- Tone.js loaded from CDN (~200KB)

---

## Full Modular Refactor (4-8 hours)

### Option A: Manual Refactor (No Build Tools)

Create this structure:
```
piano-invaders/
├── index.html
├── styles.css
├── game.js
└── song_library.json
```

**index.html** (minimal):
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Piano Invaders</title>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <!-- Move all the HTML structure here -->
    <div id="gameContainer">
        <!-- ... all the existing HTML ... -->
    </div>

    <script src="https://cdn.jsdelivr.net/npm/tone@14.8.49/build/Tone.js"></script>
    <script src="game.js"></script>
</body>
</html>
```

**styles.css**: Copy all CSS from the `<style>` tag

**game.js**: Copy all JavaScript from the `<script>` tag

### Option B: Modern Module System (Recommended)

#### Step 1: Initialize Project

```bash
cd /home/urmom/piano-invaders
npm init -y
npm install vite --save-dev
npm install tone
```

#### Step 2: Update package.json

```json
{
  "name": "piano-invaders",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  },
  "dependencies": {
    "tone": "^14.8.49"
  }
}
```

#### Step 3: Create Modular Structure

```
src/
├── main.js              # Entry point
├── config.js            # Constants
├── audio/
│   └── AudioManager.js
├── game/
│   ├── GameState.js
│   └── GameLoop.js
├── entities/
│   ├── Note.js
│   └── Base.js
├── ui/
│   ├── Keyboard.js
│   └── BarrelScroller.js
└── styles/
    └── main.css
```

#### Step 4: Example Module Files

**src/config.js**:
```javascript
export const GAME_CONFIG = {
    NOTE_START_Y: 110,
    NOTE_RADIUS: 22,
    NOTE_BASE_SPEED: 1.5,
    WIN_SCORE: 1000,
    POINTS_PER_NOTE: 10,
    TANK_BOTTOM_OFFSET: 240,
    BASE_BOTTOM_OFFSET: 265,

    COLORS: {
        PRIMARY: '#0f0',
        NEXT: '#00ff00',
        UPCOMING_1: '#ffff00',
        UPCOMING_2: '#ff8800',
        QUEUE: '#555555'
    }
};

export const PIANO_KEYS = [
    { index: 0,  midi: 'B2',  type: 'white', name: 'B' },
    { index: 1,  midi: 'C3',  type: 'white', name: 'C' },
    { index: 2,  midi: 'C#3', type: 'black', name: 'C#' },
    // ... rest
];
```

**src/entities/Note.js**:
```javascript
import { GAME_CONFIG } from '../config.js';

export class Note {
    constructor(midi, x, keyData) {
        this.midi = midi;
        this.x = x;
        this.y = GAME_CONFIG.NOTE_START_Y;
        this.radius = GAME_CONFIG.NOTE_RADIUS;
        this.active = true;
        this.baseSpeed = GAME_CONFIG.NOTE_BASE_SPEED;
        this.displayName = keyData?.name || midi;
    }

    update(bpmMultiplier) {
        if (!this.active) return;
        this.y += this.baseSpeed * bpmMultiplier;
    }

    draw(ctx, queuePosition) {
        if (!this.active) return;

        const color = this.getColor(queuePosition);

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = color.bg;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = 'bold 14px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color.text;
        ctx.fillText(this.displayName, this.x, this.y);
    }

    getColor(queuePosition) {
        const colors = GAME_CONFIG.COLORS;
        const colorMap = [
            { bg: colors.NEXT, text: '#000' },
            { bg: colors.UPCOMING_1, text: '#000' },
            { bg: colors.UPCOMING_2, text: '#000' },
            { bg: colors.QUEUE, text: '#fff' }
        ];
        return colorMap[Math.min(queuePosition, 3)];
    }

    isInTargetZone(windowHeight) {
        const targetY = windowHeight - GAME_CONFIG.BASE_BOTTOM_OFFSET;
        return this.y >= targetY - 40 && this.y <= targetY + 20;
    }
}
```

**src/audio/AudioManager.js**:
```javascript
import * as Tone from 'tone';

export class AudioManager {
    constructor() {
        this.synth = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        await Tone.start();
        this.synth = new Tone.PolySynth(Tone.Synth, {
            envelope: {
                attack: 0.02,
                decay: 0.1,
                sustain: 0.3,
                release: 1
            }
        }).toDestination();

        this.initialized = true;
    }

    playNote(midi, duration = "8n") {
        if (!this.initialized) return;
        this.synth.triggerAttackRelease(midi, duration);
    }

    playHit() {
        if (!this.initialized) return;
        this.synth.triggerAttackRelease("C5", "32n");
    }

    playMiss() {
        if (!this.initialized) return;
        this.synth.triggerAttackRelease("C2", "16n");
    }

    playWin() {
        if (!this.initialized) return;
        const now = Tone.now();
        ["C4", "E4", "G4", "C5"].forEach((note, i) => {
            this.synth.triggerAttackRelease(note, "8n", now + i * 0.1);
        });
    }

    playGameOver() {
        if (!this.initialized) return;
        const now = Tone.now();
        ["C4", "B3", "A3", "G3"].forEach((note, i) => {
            this.synth.triggerAttackRelease(note, "8n", now + i * 0.15);
        });
    }
}
```

**src/main.js**:
```javascript
import { AudioManager } from './audio/AudioManager.js';
import { Note } from './entities/Note.js';
import { GAME_CONFIG, PIANO_KEYS } from './config.js';
import './styles/main.css';

// Initialize
const audioManager = new AudioManager();
let gameState = {
    running: false,
    score: 0,
    bpm: 65,
    notes: []
};

async function init() {
    // Your initialization code
    buildKeyboard();
    attachEventListeners();
}

function buildKeyboard() {
    // Keyboard building logic
}

async function startGame() {
    await audioManager.init();
    // Game start logic
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
```

**index.html** (at root):
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Piano Invaders</title>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
</head>
<body>
    <div id="gameContainer">
        <!-- Your HTML structure -->
    </div>

    <script type="module" src="/src/main.js"></script>
</body>
</html>
```

#### Step 5: Run Development Server

```bash
npm run dev
```

Visit http://localhost:5173

#### Step 6: Build for Production

```bash
npm run build
```

Output in `dist/` folder - deploy this.

---

## Migration Checklist

### Phase 1: Quick Wins (2-4 hours)
- [ ] Add Tone.js via CDN
- [ ] Implement AudioManager class
- [ ] Add sound effects to key presses
- [ ] Add sound effects to hits/misses
- [ ] Add win/lose music
- [ ] Extract CSS to separate file
- [ ] Create config.js with constants

### Phase 2: Modularization (4-6 hours)
- [ ] Set up Vite project
- [ ] Install dependencies (tone)
- [ ] Create src/ directory structure
- [ ] Extract Note class to separate file
- [ ] Extract Base class to separate file
- [ ] Extract Keyboard logic
- [ ] Extract GameState management
- [ ] Update imports
- [ ] Test in dev mode

### Phase 3: Polish (2-4 hours)
- [ ] Add error handling
- [ ] Add loading states
- [ ] Add user feedback messages
- [ ] Improve mobile touch targets
- [ ] Add keyboard navigation
- [ ] Test on multiple devices
- [ ] Build for production

### Phase 4: Advanced (Optional, 6-10 hours)
- [ ] Convert to TypeScript
- [ ] Add unit tests
- [ ] Add E2E tests
- [ ] Implement localStorage for scores
- [ ] Add difficulty levels
- [ ] Create song editor
- [ ] Add PWA support
- [ ] Add analytics

---

## Testing Your Changes

### Manual Testing Checklist
- [ ] Game loads without errors
- [ ] Songs appear in barrel scroller
- [ ] Can select different songs
- [ ] Game starts when clicking START
- [ ] Notes fall from top
- [ ] Piano keys respond to clicks/taps
- [ ] **Audio plays when pressing keys**
- [ ] **Hit sound plays on correct notes**
- [ ] **Miss sound plays when base is hit**
- [ ] Score increases on hits
- [ ] BPM increases after 1 minute
- [ ] Game ends at 1000 points (win)
- [ ] Game ends when bases destroyed (lose)
- [ ] **Win music plays on victory**
- [ ] **Lose music plays on defeat**
- [ ] Can restart game
- [ ] Works on mobile
- [ ] Works on desktop

### Browser Testing
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

---

## Common Issues & Solutions

### "Tone.js not defined"
Make sure the CDN script loads before your game script:
```html
<script src="https://cdn.jsdelivr.net/npm/tone@14.8.49/build/Tone.js"></script>
<script src="game.js"></script> <!-- After Tone.js -->
```

### "The AudioContext was not allowed to start"
Audio requires user interaction. Make sure you call `audioManager.init()` inside a click handler.

### "Module not found"
Check your import paths:
```javascript
// Correct
import { Note } from './entities/Note.js';  // Include .js extension

// Wrong
import { Note } from './entities/Note';     // Missing .js
```

### No sound on iOS
iOS requires user interaction before audio. This is handled by calling `Tone.start()` in the startGame function.

### Build errors with Vite
Make sure all imports have file extensions and paths are correct.

---

## Performance Tips

1. **Lazy load Tone.js**: Only load when user clicks START
2. **Limit active notes**: Cap at 50 simultaneous notes
3. **Use requestAnimationFrame**: Already implemented
4. **Cache canvas operations**: Pre-render repeated graphics
5. **Throttle resize events**: Debounce keyboard rebuild

---

## Next Steps After Refactoring

1. **Add more songs** - Create a song editor UI
2. **Difficulty modes** - Easy/Medium/Hard with different speeds
3. **Combo system** - Multiplier for consecutive hits
4. **Visual effects** - Particles, screen shake
5. **Mobile improvements** - Better touch feedback
6. **Accessibility** - Screen reader support, high contrast mode
7. **Social features** - Share scores, leaderboard
8. **PWA** - Install as app, offline play

