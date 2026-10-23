import { SongError } from './errors';
import { loadSong } from './load';
import { padCountIn } from './pad';
import { difficultyFromCrf } from './pitch';
import type { Difficulty, GameSong } from './types';

export const OPENSONGS_BASE_URL = 'https://cdn.jsdelivr.net/gh/pepperhorn/opensongs-json@master/';

export interface OpenSongEntry {
  id: string;
  title: string;
  composer?: string;
  difficulty: Difficulty;
  /** crf level 1-5 */
  level: number;
  key?: string;
  timeSignature?: [number, number];
  musicxmlUrl: string;
}

interface RawIndexSong {
  id?: unknown; title?: unknown; composer?: unknown; difficulty?: unknown; key?: unknown
  timeSignature?: unknown; files?: { musicxml?: unknown }
}

export async function loadOpenSongsIndex(
  opts: { baseUrl?: string; fetchImpl?: typeof fetch } = {},
): Promise<OpenSongEntry[]> {
  const base = opts.baseUrl ?? OPENSONGS_BASE_URL;
  const root = base.endsWith('/') ? base : `${base}/`;
  const url = `${root}index.json`;
  let raw: { songs?: RawIndexSong[] };
  try {
    const res = await (opts.fetchImpl ?? fetch)(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    raw = await res.json();
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    throw new SongError('score-load', `Could not load the OpenSongs index: ${msg}`, { cause });
  }
  if (!raw || !Array.isArray(raw.songs)) {
    throw new SongError('score-load', 'Could not load the OpenSongs index: unexpected format.');
  }
  const out: OpenSongEntry[] = [];
  for (const s of raw.songs) {
    if (typeof s.id !== 'string' || typeof s.title !== 'string' || typeof s.files?.musicxml !== 'string') continue;
    const level = typeof s.difficulty === 'number' ? s.difficulty : 1;
    const ts = Array.isArray(s.timeSignature) && s.timeSignature.length === 2
      ? ([Number(s.timeSignature[0]), Number(s.timeSignature[1])] as [number, number]) : undefined;
    out.push({
      id: s.id,
      title: s.title,
      composer: typeof s.composer === 'string' ? s.composer : undefined,
      difficulty: difficultyFromCrf(level),
      level,
      key: typeof s.key === 'string' ? s.key : undefined,
      timeSignature: ts,
      musicxmlUrl: root + s.files.musicxml,
    });
  }
  return out.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));
}

/** OpenSongs scores start on beat 1, so they get a two-bar count-in rest at the top. */
export async function loadOpenSong(entry: OpenSongEntry, opts: { fetchImpl?: typeof fetch } = {}): Promise<GameSong> {
  const song = await loadSong({ scoreUrl: entry.musicxmlUrl }, { title: entry.title, difficulty: entry.level, fetchImpl: opts.fetchImpl });
  return padCountIn(song);
}
