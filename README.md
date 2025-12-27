# Piano Invaders

A retro-styled rhythm game that combines Space Invaders gameplay with piano-based music mechanics. Shoot falling musical notes by pressing the correct piano keys at the right time!

## Intent
A quick project to see if we can build a simple game to reinforce or introduce someone to the piano keyboard.  Goal to keep the game inside a React element so it can be easily embedded, while modularizing components for maintainability and flexibility.

## TODO
- Larger song library in the JSON format


## Overview

Piano Invaders is a single-file web game featuring:
- Arcade-style retro graphics with green terminal aesthetics
- Interactive piano keyboard with 18 keys (B2 to E4)
- 7 built-in classic songs
- Progressive difficulty with BPM increases
- Scoring system with win condition (1000 points)
- Destructible base defense mechanics

## How to Play

### Getting Started
1. Open `piano-invaders.html` in a web browser
2. Select a song from the barrel scroller (use ▲/▼ buttons)
3. Click **START** to begin or **RANDOM** for a random song
4. Click **RULES** to view detailed instructions

### Gameplay
- Musical notes fall from the top of the screen
- Press the correct piano key when a note reaches the target zone (bottom of screen)
- The **next note to hit** is highlighted in **green**
- Upcoming notes are color-coded:
  - **Green**: Current note (hit this one!)
  - **Yellow**: Next note coming
  - **Orange**: 2nd upcoming note
  - **Gray**: Further notes in queue

### Controls
- **Click/Tap** piano keys to shoot notes
- Must hit notes in sequence (green note first)
- Notes in the target zone score 10 points each

### Objectives
- **Win**: Reach 1000 points
- **Lose**: All 4 bases are destroyed by missed notes
- **Challenge**: BPM increases every 10 seconds after the first minute

## File Structure

```
piano-invaders/
├── piano-invaders.html    # Main game file (self-contained HTML/CSS/JS)
└── song_library.json      # Song data (7 songs with melodies)
```

## Technical Details

### Piano Keyboard Layout
- **18 keys total**: B2, C3, C#3, D3, D#3, E3, F3, F#3, G3, G#3, A3, A#3, B3, C4, C#4, D4, D#4, E4
- **11 white keys**: Displayed in bottom row
- **7 black keys**: Displayed in top row with proper piano spacing
- MIDI note naming convention used throughout

### Game Mechanics

#### Scoring System
- **+10 points** per correct note hit
- **Win condition**: 1000 points
- Notes must be hit in the **target zone** (bottom area above keyboard)

#### BPM Progression
- Starts at song's base BPM (typically 65-80 BPM)
- After 1 minute: BPM increases by +2 every 10 seconds
- Higher BPM = faster falling notes = increased difficulty

#### Base Defense
- **4 bases** protect the bottom of the screen
- Each base has a pixelated structure
- Missed notes destroy random pixels from bases
- Game over when all base pixels are destroyed

#### Note Spawning
- Notes spawn based on song's melody array
- Spawn timing: `60000 / BPM` milliseconds between notes
- Notes loop when melody ends
- `null` values in melody create rests (no note spawned)

### Code Architecture (piano-invaders.html)

#### Key Constants
- **PIANO_KEYS** (lines 542-561): 18-key piano definition with MIDI mapping
- **MIDI_TO_KEY** (lines 567-568): Fast lookup for MIDI note data

#### Main Functions
- **init()** (line 588): Initialize game, load songs, build UI
- **loadSongs()** (line 615): Fetch songs from `song_library.json`
- **buildKeyboard()** (line 640): Generate piano keyboard with proper layout
- **startGame()** (line 838): Initialize game state and start gameplay
- **gameLoop()** (line 1014): Main game loop (rendering, collision, scoring)
- **spawnNotes()** (line 940): Spawn notes based on BPM timing
- **handleKeyPress()** (line 967): Process player input and score hits

#### Classes
- **Note** (lines 881-937): Represents a falling musical note
  - Properties: position (x,y), MIDI note, active state, speed
  - Methods: update(), draw(), isInTargetZone()

## Song Library Format

The `song_library.json` file contains an array of song objects:

```json
{
  "songs": [
    {
      "name": "Song Title",
      "bpm": 70,
      "melody": ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"]
    }
  ]
}
```

### Song Properties
- **name**: Display name shown in game
- **bpm**: Base tempo (beats per minute)
- **melody**: Array of MIDI notes (e.g., "C3", "E4", "F#3") or `null` for rests

### Built-in Songs
1. **Ode to Joy** - 65 BPM
2. **Twinkle Twinkle** - 70 BPM
3. **Mary Had a Lamb** - 75 BPM
4. **Happy Birthday** - 65 BPM
5. **Fur Elise** - 70 BPM
6. **Blue Danube** - 80 BPM
7. **Frere Jacques** - 75 BPM

## Adding New Songs

To add a custom song:

1. Open `song_library.json`
2. Add a new song object to the `songs` array:

```json
{
  "name": "My Custom Song",
  "bpm": 80,
  "melody": ["C3", "E3", "G3", null, "C4", "B3", "A3", "G3"]
}
```

3. Use MIDI note names from the available range: **B2 to E4**
4. Use `null` for rests (pauses in the melody)
5. Save and reload the game

### Supported Note Range
Valid notes: B2, C3, C#3, D3, D#3, E3, F3, F#3, G3, G#3, A3, A#3, B3, C4, C#4, D4, D#4, E4

## Customization

### Styling
All styles are contained in the `<style>` tag (lines 8-455). Key variables:
- **Primary color**: `#0f0` (green) - used throughout UI
- **Background**: `#000` (black)
- **Accent colors**: `#ff0` (yellow), `#f80` (orange), `#f00` (red)
- **Font**: 'Press Start 2P' (retro pixel font from Google Fonts)

### Game Parameters
Easily adjustable values in the JavaScript:
- **Win score**: Line 980 - `if (score >= 1000)`
- **Points per note**: Line 977 - `score += 10`
- **Note speed**: Line 887 - `this.speed = 1.5`
- **BPM increase interval**: Line 1002 - `timeSinceFirstMinute / 10000`
- **BPM increase amount**: Line 1007 - `bpm += 2`
- **Initial delay before BPM increases**: Line 1001 - `elapsed > 60000` (60 seconds)

## Browser Compatibility

- **Recommended**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Requirements**:
  - Canvas API support
  - ES6+ JavaScript
  - CSS Grid/Flexbox
  - Touch events (for mobile)
- **Mobile**: Fully responsive with touch support

## Technical Requirements

- No dependencies or build process required
- Runs entirely in the browser
- Requires `song_library.json` in the same directory
- No server needed (can run from `file://` protocol)

## Game Elements

### Visual Components
- **UFO**: Animated spaceship at top with blinking lights (lines 69-127)
- **Tank**: Triangle shooter that moves with key presses (lines 216-227)
- **Bases**: 4 destructible pixel structures (lines 229-243, pattern at lines 755-763)
- **Canvas**: Main game area for falling notes
- **Keyboard**: Interactive piano keys at bottom

### UI Screens
1. **Start Screen**: Song selection with barrel scroller
2. **Game Screen**: Active gameplay with score/BPM display
3. **Rules Popup**: Instructions overlay
4. **Game Over Screen**: Shows final score and restart option

## Performance Notes

- Game loop uses `requestAnimationFrame` for smooth 60 FPS
- Canvas cleared and redrawn each frame
- Notes filtered to remove inactive instances
- Key positions calculated once on resize
- Collision detection optimized for active notes only

## Credits

Game Design: Retro arcade style inspired by Space Invaders
Font: Press Start 2P by CodeMan38 (Google Fonts)
Music: Classic public domain melodies

---

**Version**: 1.0
**License**: GPLv3
**Last Updated**: 2025
