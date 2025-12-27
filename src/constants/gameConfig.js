export const GAME_CONFIG = {
  // Canvas
  CANVAS_BG: '#000',

  // Notes
  NOTE_START_Y: 110,
  NOTE_RADIUS: 22,
  NOTE_BASE_SPEED: 1.5,

  // Scoring
  WIN_SCORE: 1000,
  POINTS_PER_NOTE: 10,

  // Timing
  BPM_INCREASE_DELAY: 60000, // 1 minute
  BPM_INCREASE_INTERVAL: 10000, // 10 seconds
  BPM_INCREASE_AMOUNT: 2,

  // Layout
  TANK_BOTTOM_OFFSET: 240,
  BASE_BOTTOM_OFFSET: 265,
  KEYBOARD_HEIGHT: 200,

  // Colors
  COLORS: {
    PRIMARY: '#0f0',
    NEXT: '#00ff00',
    UPCOMING_1: '#ffff00',
    UPCOMING_2: '#ff8800',
    QUEUE: '#555555',
    DANGER: '#f00'
  }
};

export const PIANO_KEYS = [
  { index: 0, midi: 'B2', type: 'white', name: 'B' },
  { index: 1, midi: 'C3', type: 'white', name: 'C' },
  { index: 2, midi: 'C#3', type: 'black', name: 'C#' },
  { index: 3, midi: 'D3', type: 'white', name: 'D' },
  { index: 4, midi: 'D#3', type: 'black', name: 'D#' },
  { index: 5, midi: 'E3', type: 'white', name: 'E' },
  { index: 6, midi: 'F3', type: 'white', name: 'F' },
  { index: 7, midi: 'F#3', type: 'black', name: 'F#' },
  { index: 8, midi: 'G3', type: 'white', name: 'G' },
  { index: 9, midi: 'G#3', type: 'black', name: 'G#' },
  { index: 10, midi: 'A3', type: 'white', name: 'A' },
  { index: 11, midi: 'A#3', type: 'black', name: 'A#' },
  { index: 12, midi: 'B3', type: 'white', name: 'B' },
  { index: 13, midi: 'C4', type: 'white', name: 'C' },
  { index: 14, midi: 'C#4', type: 'black', name: 'C#' },
  { index: 15, midi: 'D4', type: 'white', name: 'D' },
  { index: 16, midi: 'D#4', type: 'black', name: 'D#' },
  { index: 17, midi: 'E4', type: 'white', name: 'E' }
];

export const WHITE_KEYS = PIANO_KEYS.filter(k => k.type === 'white');
export const BLACK_KEYS = PIANO_KEYS.filter(k => k.type === 'black');

// Map MIDI note to key data for quick lookup
export const MIDI_TO_KEY = {};
PIANO_KEYS.forEach(k => MIDI_TO_KEY[k.midi.toLowerCase()] = k);
