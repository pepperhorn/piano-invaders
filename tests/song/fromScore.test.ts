import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseMusicXml, parseMidi } from 'ivories/core';
import { scoreToGameSong } from '../../src/song/fromScore';
import { SongError } from '../../src/song/errors';

const fx = (n: string) => path.join(__dirname, '../fixtures', n);
const xml = (n: string) => parseMusicXml(fs.readFileSync(fx(n), 'utf8'), n, { mode: 'scale', scale: 1 });

describe('scoreToGameSong', () => {
  it('grand staff: targets come only from P1 (both staves); violin is accompaniment voice', () => {
    const doc = xml('grand-staff-plus-violin.musicxml');
    const song = scoreToGameSong(doc);
    expect(song.targets.length).toBeGreaterThan(0);
    expect(song.accompaniment.some((a) => a.voice.includes('P2'))).toBe(true);
    expect(song.accompaniment.filter((a) => a.voice.includes('P2'))).toHaveLength(4);
    expect(song.targets.some((t) => t.beat === 12 || t.beat === 8)).toBe(true);
    const p2 = Object.keys(song.voices).filter((v) => v.includes('P2'));
    expect(p2).toHaveLength(1);
    // LH (staff 2) notes contribute targets: beat 8 has RH D + LH G
    expect(song.targets.filter((t) => t.beat === 8)).toHaveLength(2);
    expect(song.source).toBe('musicxml');
  });

  it('RH 3-note chord → 2 grouped targets', () => {
    const song = scoreToGameSong(xml('grand-staff-plus-violin.musicxml'));
    const at = song.targets.filter((t) => t.beat === 4);
    expect(at).toHaveLength(2);
    expect(at[0].group).toBeDefined();
    expect(at[0].group).toBe(at[1].group);
    expect(song.accompaniment.some((a) => a.beat === 4 && a.voice === 'melody-inner')).toBe(true);
  });

  it('RH+LH onset → grouped pair', () => {
    const song = scoreToGameSong(xml('grand-staff-plus-violin.musicxml'));
    const at = song.targets.filter((t) => t.beat === 8);
    expect(at).toHaveLength(2);
    expect(at[0].group).toBe(at[1].group);
    expect(at[0].group).toBeDefined();
  });

  it('leadsheet first: targets only from P1 staff 1; P2 notes all accompaniment', () => {
    const song = scoreToGameSong(xml('leadsheet-then-piano.musicxml'));
    expect(song.targets).toHaveLength(10);
    expect(song.targets.every((t) => t.group === undefined)).toBe(true);
    const p2 = song.accompaniment.filter((a) => a.voice.includes('P2'));
    expect(p2).toHaveLength(8);
    expect(song.accompaniment.every((a) => a.voice.includes('P2'))).toBe(true);
  });

  it('bpm and beatsPerBar read from file', () => {
    const a = scoreToGameSong(xml('grand-staff-plus-violin.musicxml'));
    expect(a.bpm).toBe(100);
    expect(a.beatsPerBar).toBe(4);
    const b = scoreToGameSong(xml('leadsheet-then-piano.musicxml'));
    expect(b.bpm).toBe(90);
    expect(b.beatsPerBar).toBe(3);
  });

  it('lengthBeats is a whole number of bars', () => {
    const a = scoreToGameSong(xml('grand-staff-plus-violin.musicxml'));
    expect(a.lengthBeats).toBe(16);
    const b = scoreToGameSong(xml('leadsheet-then-piano.musicxml'));
    expect(b.lengthBeats).toBe(12);
    expect(b.lengthBeats % b.beatsPerBar).toBe(0);
  });

  it('empty first part throws SongError code score-parse', () => {
    const doc = xml('empty-first-part.musicxml');
    let err: unknown;
    try { scoreToGameSong(doc); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(SongError);
    expect((err as SongError).code).toBe('score-parse');
    expect((err as SongError).message).toBe('The first part has no playable notes.');
  });

  it('percussion-only first part throws SongError score-parse (Review Focus 2)', () => {
    const doc = xml('percussion-first-part.musicxml');
    expect(doc.voices[0].percussion).toBe(true);
    let err: unknown;
    try { scoreToGameSong(doc); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(SongError);
    expect((err as SongError).code).toBe('score-parse');
    expect((err as SongError).message).toBe('The first part has no playable notes.');
  });

  it("registers a 'melody-inner' voice with the first part's instrument", () => {
    const song = scoreToGameSong(xml('grand-staff-plus-violin.musicxml'));
    expect(song.accompaniment.some((a) => a.voice === 'melody-inner')).toBe(true);
    const p1 = Object.entries(song.voices).find(([id]) => id.includes('P1'))![1];
    expect(song.voices['melody-inner']).toMatchObject({ instrument: p1.instrument, volume: p1.volume });
    expect(song.voices['melody-inner'].percussion).toBeFalsy();
  });

  it('MIDI: first track melody, second track accompaniment', () => {
    const buf = fs.readFileSync(fx('two-track.mid'));
    const doc = parseMidi(Uint8Array.from(buf).buffer as ArrayBuffer, 'two-track', { mode: 'scale', scale: 1 });
    const song = scoreToGameSong(doc);
    expect(song.source).toBe('midi');
    expect(song.targets).toHaveLength(8);
    expect(song.accompaniment).toHaveLength(2);
    expect(song.bpm).toBe(100);
    expect(song.lengthBeats).toBe(8);
  });
});
