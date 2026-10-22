import type { AccompNote, Target, VoiceInfo } from './types';
import { bestTransposition, foldIntoRange } from './pitch';

export interface RawNote { beat: number; midi: number; durBeats: number; velocity: number; voice: string; melody: boolean }

const EPS = 1e-6;

/** Voice id buildTargets gives to the inner notes of 3+-note melody chords (played, not targeted). */
export const MELODY_INNER = 'melody-inner';

/** Register the MELODY_INNER voice with the melody's instrument, so inner chord notes play on it. */
export function addInnerVoice(voices: Record<string, VoiceInfo>, melody: VoiceInfo | undefined): Record<string, VoiceInfo> {
  if (melody && !(MELODY_INNER in voices)) voices[MELODY_INNER] = { ...melody, percussion: false };
  return voices;
}

export function buildTargets(notes: RawNote[]): { targets: Target[]; accompaniment: AccompNote[]; transpose: number } {
  const accompaniment: AccompNote[] = notes
    .filter((x) => !x.melody)
    .map(({ beat, midi, durBeats, velocity, voice }) => ({ beat, midi, durBeats, velocity, voice }));
  const melody = notes.filter((x) => x.melody).sort((a, b) => a.beat - b.beat);
  const transpose = bestTransposition(melody.map((m) => m.midi));

  const groups: RawNote[][] = [];
  for (const m of melody) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(m.beat - last[0].beat) < EPS) last.push(m);
    else groups.push([m]);
  }

  const targets: Target[] = [];
  let nextGroup = 0;
  for (const g of groups) {
    const sorted = [...g].sort((a, b) => b.midi - a.midi);
    const beat = sorted[0].beat;
    const fold = (m: number) => foldIntoRange(m + transpose);
    if (sorted.length === 1) {
      targets.push({ id: targets.length, beat, midi: fold(sorted[0].midi), durBeats: sorted[0].durBeats });
      continue;
    }
    const hi = sorted[0];
    const lo = sorted[sorted.length - 1];
    for (const inner of sorted.slice(1, -1)) {
      accompaniment.push({ beat: inner.beat, midi: inner.midi, durBeats: inner.durBeats, velocity: inner.velocity, voice: MELODY_INNER });
    }
    const hiMidi = fold(hi.midi);
    const loMidi = fold(lo.midi);
    if (hiMidi === loMidi) {
      targets.push({ id: targets.length, beat, midi: hiMidi, durBeats: hi.durBeats });
    } else {
      const group = nextGroup++;
      targets.push({ id: targets.length, beat, midi: hiMidi, durBeats: hi.durBeats, group });
      targets.push({ id: targets.length, beat, midi: loMidi, durBeats: lo.durBeats, group });
    }
  }
  accompaniment.sort((a, b) => a.beat - b.beat);
  return { targets, accompaniment, transpose };
}
