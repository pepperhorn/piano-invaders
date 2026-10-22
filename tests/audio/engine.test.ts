import { describe, it, expect, vi, beforeEach } from 'vitest';

const made: Array<{ kind: string; opts: unknown; ready: Promise<void>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
let failInstrument: string | null = null;

vi.mock('smplr', () => {
  const factory = (kind: string) =>
    vi.fn((_ctx: unknown, opts: { instrument?: string }) => {
      const failing = failInstrument !== null && (opts?.instrument === failInstrument || kind === failInstrument);
      const inst = {
        kind, opts, start: vi.fn(() => () => {}), stop: vi.fn(),
        ready: failing ? Promise.reject(new Error('boom')) : Promise.resolve(),
      };
      inst.ready.catch(() => {});
      made.push(inst);
      return inst;
    });
  return {
    SplendidGrandPiano: factory('piano'), Soundfont: factory('soundfont'), DrumMachine: factory('drum'),
    getDrumMachineNames: () => ['TR-808', 'LM-2'],
    getSoundfontNames: () => ['acoustic_grand_piano', 'violin', 'acoustic_bass', 'percussive_organ', 'synth_bass_1'],
  };
});

import * as smplr from 'smplr';
import type { GameSong } from '../../src/song/types';

const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() });
const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), gain: param(), frequency: param(), type: '', buffer: null as unknown });
function fakeCtx() {
  return {
    currentTime: 0, destination: node(), sampleRate: 44100,
    createGain: vi.fn(node), createOscillator: vi.fn(node), createBufferSource: vi.fn(node),
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(10) })),
    decodeAudioData: vi.fn(async () => ({})),
    resume: vi.fn(async () => {}), state: 'running',
  } as unknown as AudioContext;
}

const song = (): GameSong => ({
  id: 's', title: 's', bpm: 100, beatsPerBar: 4, difficulty: 'easy', targets: [], source: 'musicxml', lengthBeats: 8,
  accompaniment: [{ beat: 0, midi: 60, durBeats: 1, velocity: 90, voice: 'a' }],
  voices: {
    a: { instrument: 'violin', volume: 0.8 },
    b: { instrument: 'acoustic_bass', volume: 1 },
    d: { instrument: 'drums', volume: 1, percussion: true },
  },
});

beforeEach(() => { made.length = 0; failInstrument = null; vi.clearAllMocks(); });

describe('AudioEngine', () => {
  it('no AudioContext is constructed at import', async () => {
    const ctor = vi.fn();
    vi.stubGlobal('AudioContext', ctor);
    await import('../../src/audio/AudioEngine');
    await import('../../src/audio/context');
    expect(ctor).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('load creates one instrument per voice and SplendidGrandPiano once', async () => {
    const { AudioEngine } = await import('../../src/audio/AudioEngine');
    const e = new AudioEngine(fakeCtx());
    await e.load(song(), 'piano');
    expect(smplr.SplendidGrandPiano).toHaveBeenCalledTimes(1);
    expect(smplr.Soundfont).toHaveBeenCalledTimes(2);
    expect(smplr.DrumMachine).toHaveBeenCalledTimes(1);
    e.scheduleAccomp(song().accompaniment[0], 1, 0.5);
    const sf = made.find((m) => m.kind === 'soundfont' && (m.opts as { instrument: string }).instrument === 'violin')!;
    expect(sf.start).toHaveBeenCalledWith(expect.objectContaining({ note: 60, time: 1, duration: 0.5, velocity: 90 }));
  });

  it('instrument load failure calls onError with code audio and does not throw', async () => {
    failInstrument = 'violin';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { AudioEngine } = await import('../../src/audio/AudioEngine');
    const e = new AudioEngine(fakeCtx());
    const onError = vi.fn();
    e.onError = onError;
    await expect(e.load(song(), 'piano')).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'audio' }));
    expect(() => e.scheduleAccomp(song().accompaniment[0], 1, 0.5)).not.toThrow(); // synth fallback
    warn.mockRestore();
  });

  it('player voice follows setPlayerVoice and falls back to synth when piano fails', async () => {
    failInstrument = 'piano';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { AudioEngine } = await import('../../src/audio/AudioEngine');
    const ctx = fakeCtx();
    const e = new AudioEngine(ctx);
    const onError = vi.fn();
    e.onError = onError;
    await e.load(song(), 'piano');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'audio' }));
    const before = (ctx.createOscillator as ReturnType<typeof vi.fn>).mock.calls.length;
    e.playPlayer(60);
    expect((ctx.createOscillator as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(before);
    warn.mockRestore();
  });

  it('resolves the four song_library layer shapes to the right factory and options', async () => {
    const { AudioEngine } = await import('../../src/audio/AudioEngine');
    const e = new AudioEngine(fakeCtx());
    const s = song();
    s.voices = {
      drums: { instrument: 'LM-2', volume: 1, percussion: true },
      drumsNoPatch: { instrument: 'Drums', volume: 1, percussion: true },
      splendid: { instrument: 'Splendid Grand Piano', volume: 1 },
      gm: { instrument: 'percussive_organ', volume: 1 },
      keys: { instrument: 'Keys', volume: 1 },
    };
    const onError = vi.fn();
    e.onError = onError;
    await e.load(s, 'piano');
    expect(onError).not.toHaveBeenCalled();
    const drumOpts = made.filter((m) => m.kind === 'drum').map((m) => (m.opts as { instrument: string }).instrument);
    expect(drumOpts).toEqual(['LM-2', 'LM-2']);
    expect(smplr.SplendidGrandPiano).toHaveBeenCalledTimes(2); // player piano + splendid voice
    const sf = made.filter((m) => m.kind === 'soundfont').map((m) => (m.opts as { instrument: string }).instrument);
    expect(sf).toEqual(['percussive_organ', 'acoustic_grand_piano']);
  });

  it('second load leaves only the new song voices and stops old ones', async () => {
    const { AudioEngine } = await import('../../src/audio/AudioEngine');
    const e = new AudioEngine(fakeCtx());
    await e.load(song(), 'piano');
    const oldSf = made.filter((m) => m.kind === 'soundfont');
    const s2 = song();
    s2.voices = { z: { instrument: 'violin', volume: 1 } };
    await e.load(s2, 'piano');
    oldSf.forEach((m) => expect(m.stop).toHaveBeenCalled());
    const ids = [...(e as unknown as { voices: Map<string, unknown> }).voices.keys()];
    expect(ids).toEqual(['z']);
  });

  it('missing AudioContext reports audio unavailable once and never throws', async () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    vi.resetModules();
    const { AudioEngine } = await import('../../src/audio/AudioEngine');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = new AudioEngine();
    const onError = vi.fn();
    e.onError = onError;
    await expect(e.load(song(), 'piano')).resolves.toBeUndefined();
    expect(() => { e.playPlayer(60); e.sfx('hit'); e.metronomeTick(0, true, 1); e.scheduleAccomp(song().accompaniment[0], 0, 1); }).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'audio', message: 'audio unavailable' }));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    vi.unstubAllGlobals();
  });
});
