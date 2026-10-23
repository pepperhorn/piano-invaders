import type { GameSong } from './types';

/**
 * Give a song a `bars`-bar rest at the top that doubles as its count-in, the way our original
 * song files were written. A song that already opens with that much rest just gets `countInBeats`;
 * otherwise everything shifts later by whole bars, so downbeats stay downbeats.
 */
export function padCountIn(song: GameSong, bars = 2): GameSong {
  const first = song.timeSigChanges?.[0];
  const bpb = first && first.beat <= 1e-9 ? first.beatsPerBar : song.beatsPerBar || 4;
  const want = bars * bpb;
  const starts = [...song.targets.map(t => t.beat), ...song.accompaniment.map(a => a.beat)];
  const rest = starts.length ? Math.max(0, Math.min(...starts)) : 0;
  const pad = Math.max(0, bars - Math.floor(rest / bpb + 1e-9)) * bpb;
  if (pad === 0) return { ...song, countInBeats: want };
  const changes = song.timeSigChanges?.map(c => ({ ...c, beat: c.beat + pad }));
  if (changes?.length) changes.unshift({ beat: 0, beatsPerBar: bpb });
  return {
    ...song,
    targets: song.targets.map(t => ({ ...t, beat: t.beat + pad })),
    accompaniment: song.accompaniment.map(a => ({ ...a, beat: a.beat + pad })),
    timeSigChanges: changes,
    lengthBeats: song.lengthBeats + pad,
    countInBeats: want,
  };
}
