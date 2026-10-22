import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { dottlToGameSong, gameSongToDottl, isDottl } from '../../src/song/dottl';
import { SongError } from '../../src/song/errors';

const fx = (n: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures', n), 'utf8'));

describe('dottl reader', () => {
  it('every dottl song in public/song_library.json converts with >=1 target', () => {
    const lib = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/song_library.json'), 'utf8'));
    const dottls = lib.songs.filter(isDottl);
    expect(dottls.length).toBeGreaterThan(0);
    for (const d of dottls) {
      const song = dottlToGameSong(d);
      expect(song.targets.length).toBeGreaterThanOrEqual(1);
      expect(song.source).toBe('dottl');
    }
  });

  it('odetojoy v5 fixture: first target E4 at beat 0, bpm 85', () => {
    const song = dottlToGameSong(JSON.stringify(fx('odetojoy-accomp-v5-3.dottl')));
    expect(song.bpm).toBe(85);
    // E4 (64) nominally; Task 4's octave fold puts the melody (E4..G4) down to E3 (52)
    expect(song.targets[0]).toMatchObject({ beat: 0, midi: 52 });
    expect(song.accompaniment.length).toBeGreaterThan(0);
    expect(song.lengthBeats % song.beatsPerBar).toBe(0);
  });

  it('v7 beatsPerBar + timeSigChanges map to beats', () => {
    const song = dottlToGameSong(fx('v7-timesig-stutter.dottl'));
    expect(song.beatsPerBar).toBe(3);
    // col 7, divisor 2 -> beat 3, plus a 3-beat lead-in bar for the pickup
    expect(song.timeSigChanges).toEqual([{ beat: 6, beatsPerBar: 4 }]);
    expect(song.difficulty).toBe('intermediate');
  });

  it('stutter expands; silent entries skipped; only first melody sub-hit is a target', () => {
    const song = dottlToGameSong(fx('v7-timesig-stutter.dottl'));
    // melody: pickup G, C stutter [5,3] -> 1 target, E, G, C
    expect(song.targets).toHaveLength(5);
    const c = song.targets[1];
    expect(c.beat).toBeCloseTo(3);
    const rest = song.accompaniment.filter((a) => a.voice === 'mel');
    expect(rest).toHaveLength(1);
    expect(rest[0].velocity).toBe(Math.round(16 + (3 / 7) * 111));
    // drums stutter [7,0] -> 1 audible hit, plus the plain note
    const drums = song.accompaniment.filter((a) => a.voice === 'drums');
    expect(drums).toHaveLength(2);
    expect(drums.some((a) => a.velocity === 127)).toBe(true);
    expect(song.voices.drums.percussion).toBe(true);
    expect(song.voices.drums.volume).toBeCloseTo(0.6);
    expect(song.voices.mel.instrument).toBe('Splendid Grand Piano');
  });

  it('col 0 pickup shifts song to start >= 0', () => {
    const song = dottlToGameSong(fx('v7-timesig-stutter.dottl'));
    const all = [...song.targets, ...song.accompaniment].map((n) => n.beat);
    expect(Math.min(...all)).toBeGreaterThanOrEqual(0);
    expect(song.targets[0].beat).toBeCloseTo(3 - 0.5);
  });

  it('round trip keeps targets and accompaniment count', () => {
    const song = dottlToGameSong(fx('v7-timesig-stutter.dottl'));
    const d = gameSongToDottl(song);
    expect(d.version).toBe(7);
    expect(d.difficulty).toBe('intermediate');
    expect(d.extensions['piano-invaders'].difficulty).toBe('intermediate');
    const back = dottlToGameSong(JSON.parse(JSON.stringify(d)));
    const key = (s: typeof song) => s.targets.map((t) => [t.beat, t.midi, t.group]);
    expect(key(back)).toEqual(key(song));
    expect(back.accompaniment).toHaveLength(song.accompaniment.length);
    expect(back.timeSigChanges).toEqual(song.timeSigChanges);
    const ode = dottlToGameSong(fx('odetojoy-accomp-v5-3.dottl'));
    const ode2 = dottlToGameSong(gameSongToDottl(ode));
    expect(key(ode2)).toEqual(key(ode));
    expect(ode2.accompaniment).toHaveLength(ode.accompaniment.length);
  });

  it('isDottl rejects MusicXML text and {}', () => {
    expect(isDottl('<?xml version="1.0"?><score-partwise/>')).toBe(false);
    expect(isDottl({})).toBe(false);
    expect(isDottl({ layers: [], divisor: 1 })).toBe(true);
    expect(isDottl({ version: 4, layers: [] })).toBe(false);
    expect(isDottl({ version: 6, layers: [] })).toBe(true);
  });

  it('invalid input throws SongError score-parse', () => {
    expect(() => dottlToGameSong('not json')).toThrow(SongError);
    expect(() => dottlToGameSong({})).toThrowError(expect.objectContaining({ code: 'score-parse' }));
  });
});
