export const GAME_CONFIG = {
  // Canvas
  CANVAS_BG: '#000',

  // Notes
  NOTE_START_Y: 110,
  NOTE_RADIUS: 22,
  NOTE_BASE_SPEED: 1.5,

  // Scoring
  POINTS_PER_NOTE: 10,

  // Timing
  BPM_INCREASE_DELAY: 30000, // 30 seconds
  BPM_INCREASE_INTERVAL: 60000, // 60 seconds
  BPM_INCREASE_AMOUNT: 2,

  // Health
  MAX_HEALTH: 100,
  DAMAGE_PER_BOMB: 5,

  // Land strip
  BOMB_RADIUS: 20,

  // Target zone (where players can hit notes, above the land)
  TARGET_ZONE_TOP: 150,
  TARGET_ZONE_BOTTOM: 30,

  // UFO
  UFO_Y: 60,
  UFO_SPEED: 1.5,

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

export interface PianoKey { index: number; midi: number; note: string; type: 'white' | 'black'; name: string }

export const KEY_MIDI_LOW = 47;
export const KEY_MIDI_HIGH = 64;

export const PIANO_KEYS: PianoKey[] = [
  { index: 0, midi: 47, note: 'B2', type: 'white', name: 'B' },
  { index: 1, midi: 48, note: 'C3', type: 'white', name: 'C' },
  { index: 2, midi: 49, note: 'C#3', type: 'black', name: 'C#' },
  { index: 3, midi: 50, note: 'D3', type: 'white', name: 'D' },
  { index: 4, midi: 51, note: 'D#3', type: 'black', name: 'D#' },
  { index: 5, midi: 52, note: 'E3', type: 'white', name: 'E' },
  { index: 6, midi: 53, note: 'F3', type: 'white', name: 'F' },
  { index: 7, midi: 54, note: 'F#3', type: 'black', name: 'F#' },
  { index: 8, midi: 55, note: 'G3', type: 'white', name: 'G' },
  { index: 9, midi: 56, note: 'G#3', type: 'black', name: 'G#' },
  { index: 10, midi: 57, note: 'A3', type: 'white', name: 'A' },
  { index: 11, midi: 58, note: 'A#3', type: 'black', name: 'A#' },
  { index: 12, midi: 59, note: 'B3', type: 'white', name: 'B' },
  { index: 13, midi: 60, note: 'C4', type: 'white', name: 'C' },
  { index: 14, midi: 61, note: 'C#4', type: 'black', name: 'C#' },
  { index: 15, midi: 62, note: 'D4', type: 'white', name: 'D' },
  { index: 16, midi: 63, note: 'D#4', type: 'black', name: 'D#' },
  { index: 17, midi: 64, note: 'E4', type: 'white', name: 'E' }
];

export const WHITE_KEYS = PIANO_KEYS.filter(k => k.type === 'white');
export const BLACK_KEYS = PIANO_KEYS.filter(k => k.type === 'black');

// Map MIDI note to key data for quick lookup
// Keyed by lowercase note string (legacy game); use PIANO_KEYS[].midi for numeric lookup
export const MIDI_TO_KEY: Record<string, PianoKey> = {};
PIANO_KEYS.forEach(k => { MIDI_TO_KEY[k.note.toLowerCase()] = k; });
