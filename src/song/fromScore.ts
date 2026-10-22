import type { ScoreDocument } from 'ivories/core';
import { buildTargets, type RawNote } from './extract';
import { SongError } from './errors';
import { difficultyFromCrf } from './pitch';
import type { Difficulty, GameSong, VoiceInfo } from './types';

export interface ScoreToSongOpts { title?: string; difficulty?: Difficulty | number }

const DIFFICULTIES: readonly string[] = ['easy', 'intermediate', 'advanced'];

function resolveDifficulty(d: Difficulty | number | undefined): Difficulty {
  if (typeof d === 'number') return difficultyFromCrf(d);
  if (d && DIFFICULTIES.includes(d)) return d;
  return 'easy';
}

/** The id of the first <score-part> in the document, if the raw XML is retained. */
function firstScorePartId(xml: string | undefined): string | null {
  if (!xml) return null;
  const m = /<score-part\b[^>]*\bid\s*=\s*["']([^"']+)["']/.exec(xml);
  return m ? m[1] : null;
}

function melodyVoiceIds(doc: ScoreDocument): Set<string> {
  const ids = new Set<string>();
  if (doc.sourceFormat === 'musicxml') {
    // Parsers drop parts without notes, so the part-list is the authority on "first part".
    const firstXmlVoice = doc.voices.find((v) => v.source?.kind === 'xml-part');
    const firstPartId =
      firstScorePartId(doc.rawXml) ??
      (firstXmlVoice?.source?.kind === 'xml-part' ? firstXmlVoice.source.partId : null);
    if (firstPartId === null) return ids;
    for (const v of doc.voices) {
      if (v.source?.kind === 'xml-part' && v.source.partId === firstPartId) ids.add(v.id);
    }
    return ids;
  }
  const withNotes = new Set(doc.notes.map((n) => n.voiceId));
  const first = doc.voices.find((v) => !v.percussion && withNotes.has(v.id));
  if (first) ids.add(first.id);
  return ids;
}

export function scoreToGameSong(doc: ScoreDocument, opts: ScoreToSongOpts = {}): GameSong {
  const melodyIds = melodyVoiceIds(doc);
  const ppq = doc.ppq || 480;
  const raw: RawNote[] = doc.notes.map((n) => ({
    beat: n.startTicks / ppq,
    midi: n.pitch,
    durBeats: n.durTicks / ppq,
    velocity: n.velocity,
    voice: n.voiceId,
    melody: melodyIds.has(n.voiceId),
  }));

  const { targets, accompaniment } = buildTargets(raw);
  if (targets.length === 0) throw new SongError('score-parse', 'The first part has no playable notes.');

  const toBeatsPerBar = (ts: { numerator: number; denominator: number }) => ts.numerator * (4 / ts.denominator);
  const sigs = doc.timeSignatures ?? [];
  const beatsPerBar = sigs.length ? toBeatsPerBar(sigs[0]) : 4;
  const timeSigChanges = sigs.slice(1).map((ts) => ({ beat: ts.ticks / ppq, beatsPerBar: toBeatsPerBar(ts) }));

  const endBeat = raw.reduce((mx, n) => Math.max(mx, n.beat + n.durBeats), 0);
  const lengthBeats = Math.max(1, Math.ceil(endBeat / beatsPerBar - 1e-9)) * beatsPerBar;

  const voices: Record<string, VoiceInfo> = {};
  for (const v of doc.voices) {
    voices[v.id] = { instrument: v.instrument, volume: v.volume, percussion: v.percussion };
  }

  const title = opts.title ?? doc.name;
  const song: GameSong = {
    id: doc.id || title,
    title,
    bpm: Math.round(doc.tempoMap[0]?.bpm ?? 120),
    beatsPerBar,
    difficulty: resolveDifficulty(opts.difficulty),
    targets,
    accompaniment,
    voices,
    lengthBeats,
    source: doc.sourceFormat === 'midi' ? 'midi' : 'musicxml',
  };
  if (timeSigChanges.length) song.timeSigChanges = timeSigChanges;
  return song;
}
