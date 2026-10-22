import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { loadSong } from '../../src/song/load';
import { SongError } from '../../src/song/errors';

const fx = (n: string) => path.join(__dirname, '../fixtures', n);

describe('loadSong', () => {
  it('musicXml string loads', async () => {
    const song = await loadSong({ musicXml: fs.readFileSync(fx('leadsheet-then-piano.musicxml'), 'utf8') }, { title: 'Lead', difficulty: 4 });
    expect(song.title).toBe('Lead');
    expect(song.difficulty).toBe('advanced');
    expect(song.targets).toHaveLength(10);
  });

  it('scoreUrl uses fetchImpl and sniffs MXL', async () => {
    const xml = fs.readFileSync(fx('leadsheet-then-piano.musicxml'), 'utf8');
    const container = '<?xml version="1.0"?><container><rootfiles><rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>';
    const mxl = zipSync({ 'META-INF/container.xml': strToU8(container), 'score.xml': strToU8(xml) });
    const fetchImpl = vi.fn(async () => new Response(mxl as BodyInit, { status: 200 })) as unknown as typeof fetch;
    const song = await loadSong({ scoreUrl: 'https://x.test/songs/lead.mxl' }, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('https://x.test/songs/lead.mxl');
    expect(song.title).toBe('lead');
    expect(song.targets).toHaveLength(10);
  });

  it('file Blob with .mid loads', async () => {
    const bytes = fs.readFileSync(fx('two-track.mid'));
    const blob = new Blob([bytes], { type: 'audio/midi' });
    const song = await loadSong({ file: blob, name: 'two-track.mid' });
    expect(song.source).toBe('midi');
    expect(song.title).toBe('two-track');
    expect(song.targets).toHaveLength(8);
  });

  it('fetch 404 → SongError score-load', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch;
    await expect(loadSong({ scoreUrl: 'https://x.test/missing.mxl' }, { fetchImpl })).rejects.toMatchObject({ code: 'score-load' });
    await expect(loadSong({ scoreUrl: 'https://x.test/missing.mxl' }, { fetchImpl })).rejects.toBeInstanceOf(SongError);
  });

  it('garbage bytes → score-parse', async () => {
    await expect(loadSong({ file: new Blob([new Uint8Array([1, 2, 3])]), name: 'x.bin' })).rejects.toMatchObject({ code: 'score-parse' });
  });
});

describe('loadSong dottl', () => {
  it('real dottl source (string and object) loads', async () => {
    const text = fs.readFileSync(fx('v7-timesig-stutter.dottl'), 'utf8');
    const a = await loadSong({ dottl: text });
    const b = await loadSong({ dottl: JSON.parse(text) }, { title: 'T', difficulty: 5 });
    expect(a.source).toBe('dottl');
    expect(a.targets).toHaveLength(5);
    expect(b.title).toBe('T');
    expect(b.difficulty).toBe('advanced');
    await expect(loadSong({ dottl: 'nope' })).rejects.toMatchObject({ code: 'score-parse' });
  });

  it('delegates to dottlToGameSong lazily', async () => {
    vi.resetModules();
    vi.doMock('../../src/song/dottl', () => ({ dottlToGameSong: vi.fn(() => ({ id: 'd', title: 'D' })) }));
    const { loadSong: load } = await import('../../src/song/load');
    const song = await load({ dottl: '{}' });
    expect(song.title).toBe('D');
    vi.doUnmock('../../src/song/dottl');
  });
});
