// One-off generator for tests/fixtures/two-track.mid (run: node scripts/gen-two-track-midi.mjs)
import fs from 'node:fs';
import tonejs from '../node_modules/@tonejs/midi/build/Midi.js';
const { Midi } = tonejs;
const midi = new Midi();
midi.header.setTempo(100);
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] });
const melody = midi.addTrack();
melody.name = 'Melody';
melody.instrument.number = 0;
['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B4', 'C5'].forEach((name, i) => {
  melody.addNote({ name, ticks: i * midi.header.ppq, durationTicks: midi.header.ppq, velocity: 0.8 });
});
const bass = midi.addTrack();
bass.name = 'Bass';
bass.instrument.number = 32;
[['C3', 0], ['G3', 4]].forEach(([name, beat]) => {
  bass.addNote({ name, ticks: beat * midi.header.ppq, durationTicks: 4 * midi.header.ppq, velocity: 0.7 });
});
fs.writeFileSync(new URL('../tests/fixtures/two-track.mid', import.meta.url), Buffer.from(midi.toArray()));
