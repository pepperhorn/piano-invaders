const STORAGE_KEY = 'piano-invaders-leaderboard';
const MAX_ENTRIES = 10;

const DEFAULT_SCORES = [
  { name: 'MOE', total: 5200, score: 320, bpm: 71, hp: 45, time: 180, song: 'Ode to Joy' },
  { name: 'CURLY', total: 4100, score: 280, bpm: 69, hp: 30, time: 150, song: 'Twinkle Twinkle' },
  { name: 'LARRY', total: 3600, score: 250, bpm: 67, hp: 55, time: 120, song: 'Happy Birthday' },
  { name: 'BUZZ', total: 2900, score: 200, bpm: 73, hp: 20, time: 140, song: 'Fur Elise' },
  { name: 'WOODY', total: 2400, score: 180, bpm: 68, hp: 40, time: 110, song: 'Blue Danube' },
  { name: 'DRAKE', total: 1800, score: 150, bpm: 67, hp: 35, time: 90, song: 'Frere Jacques' },
  { name: 'PEACH', total: 1400, score: 120, bpm: 66, hp: 25, time: 80, song: 'Mary Had a Lamb' },
  { name: 'TOAD', total: 900, score: 90, bpm: 65, hp: 15, time: 60, song: 'Ode to Joy' },
  { name: 'YOSHI', total: 500, score: 60, bpm: 65, hp: 10, time: 45, song: 'Twinkle Twinkle' },
  { name: 'GOOMBA', total: 200, score: 30, bpm: 65, hp: 5, time: 30, song: 'Happy Birthday' },
];

export function loadLeaderboard() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && stored.length > 0) return stored;
    return [...DEFAULT_SCORES];
  } catch {
    return [...DEFAULT_SCORES];
  }
}

export function saveLeaderboard(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export { MAX_ENTRIES };
