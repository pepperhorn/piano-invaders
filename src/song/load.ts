import { parseMidi, parseMusicXml, parseScoreFile, sniffScoreFile } from 'ivories/core';
import type { ScoreDocument, TempoSetting } from 'ivories/core';
import { SongError } from './errors';
import { scoreToGameSong } from './fromScore';
import type { Difficulty, GameSong, ScoreSource } from './types';

export interface LoadSongOpts { title?: string; difficulty?: Difficulty | number; fetchImpl?: typeof fetch }

const SETTING: TempoSetting = { mode: 'scale', scale: 1 };

function parse<T>(fn: () => T): T {
  try {
    return fn();
  } catch (cause) {
    if (cause instanceof SongError) throw cause;
    const msg = cause instanceof Error ? cause.message : String(cause);
    throw new SongError('score-parse', `Could not parse the score: ${msg}`, { cause });
  }
}

function parseBytes(buf: ArrayBuffer, name: string): ScoreDocument {
  const kind = sniffScoreFile(new Uint8Array(buf));
  if (kind === null) throw new SongError('score-parse', 'Unrecognised score file (expected MusicXML, MXL or MIDI).');
  // parseScoreFile dispatches on the sniffed kind: MIDI, MXL (unzip) or plain MusicXML.
  return parseScoreFile(buf, name, SETTING);
}

function nameFromUrl(url: string): string {
  const last = url.split(/[?#]/)[0].split('/').pop() ?? '';
  return last.replace(/\.[^.]+$/, '') || 'Untitled';
}

export async function loadSong(src: ScoreSource, opts: LoadSongOpts = {}): Promise<GameSong> {
  const sopts = { title: opts.title, difficulty: opts.difficulty };

  if ('dottl' in src) {
    const { dottlToGameSong } = await import('./dottl');
    return parse(() => dottlToGameSong(src.dottl, sopts));
  }
  if ('musicXml' in src) {
    return parse(() => scoreToGameSong(parseMusicXml(src.musicXml, opts.title ?? 'Untitled', SETTING), sopts));
  }
  if ('midi' in src) {
    return parse(() => scoreToGameSong(parseMidi(src.midi, opts.title ?? 'Untitled', SETTING), sopts));
  }

  let buf: ArrayBuffer;
  let name: string;
  if ('scoreUrl' in src) {
    name = nameFromUrl(src.scoreUrl);
    try {
      const res = await (opts.fetchImpl ?? fetch)(src.scoreUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${src.scoreUrl}`);
      buf = await res.arrayBuffer();
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      throw new SongError('score-load', `Could not load the score: ${msg}`, { cause });
    }
  } else {
    const file = src.file;
    name = src.name ?? (file instanceof File ? file.name : 'Untitled');
    name = name.replace(/\.[^.]+$/, '');
    try {
      buf = await readBlob(file);
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      throw new SongError('score-load', `Could not read the score file: ${msg}`, { cause });
    }
  }
  return parse(() => scoreToGameSong(parseBytes(buf, opts.title ?? name), { ...sopts, title: opts.title ?? name }));
}

async function readBlob(b: Blob): Promise<ArrayBuffer> {
  if (typeof b.arrayBuffer === 'function') return b.arrayBuffer();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(b);
  });
}
