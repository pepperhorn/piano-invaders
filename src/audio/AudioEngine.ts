import { DrumMachine, Soundfont, SplendidGrandPiano } from 'smplr';
import type { AccompNote, GameSong } from '../song/types';
import { getAudioContext } from './context';
import { Metronome } from './metronome';
import { playSfx, synthTone } from './sfx';
import type { SfxKind } from './sfx';

export interface AudioError { code: 'audio'; message: string; cause?: unknown }

interface Playable {
  ready: Promise<void>;
  start(e: { note: number | string; time?: number; duration?: number | null; velocity?: number }): unknown;
  stop(): void;
}
interface VoiceSlot { inst: Playable | null; gain: GainNode; percussion: boolean }

const PIANO_VELOCITY = 90;

export class AudioEngine {
  onError?: (e: AudioError) => void;

  private readonly injected: AudioContext | undefined;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private piano: Playable | null = null;
  private playerVoice: 'piano' | 'synth' = 'piano';
  private voices = new Map<string, VoiceSlot>();
  private metro: Metronome | null = null;
  private reported = new Set<string>();

  constructor(ctx?: AudioContext) { this.injected = ctx; }

  private context(): AudioContext {
    if (!this.ctx) {
      this.ctx = this.injected ?? getAudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private fail(message: string, cause?: unknown): void {
    if (!this.reported.has(message)) {
      this.reported.add(message);
      console.warn(`[piano-invaders] audio: ${message}`);
    }
    this.onError?.({ code: 'audio', message, cause });
  }

  private async build(label: string, make: () => Playable): Promise<Playable | null> {
    try {
      const inst = make();
      await inst.ready;
      return inst;
    } catch (cause) {
      this.fail(`could not load ${label}; using synth fallback`, cause);
      return null;
    }
  }

  async load(song: GameSong, playerVoice: 'piano' | 'synth'): Promise<void> {
    const ctx = this.context();
    const master = this.master!;
    this.playerVoice = playerVoice;
    this.metro ??= new Metronome(ctx, master);

    const pianoP = this.piano
      ? Promise.resolve(this.piano)
      : this.build('piano', () => SplendidGrandPiano(ctx, { destination: master }) as unknown as Playable);

    const voiceJobs = Object.entries(song.voices).map(async ([id, v]) => {
      const gain = ctx.createGain();
      gain.gain.value = Math.min(1, Math.max(0, v.volume));
      gain.connect(master);
      const inst = await this.build(`voice "${id}" (${v.instrument})`, () => (
        v.percussion
          ? DrumMachine(ctx, { destination: gain }) as unknown as Playable
          : Soundfont(ctx, { instrument: v.instrument, destination: gain }) as unknown as Playable
      ));
      this.voices.set(id, { inst, gain, percussion: !!v.percussion });
    });

    const [piano] = await Promise.all([pianoP, Promise.all(voiceJobs), this.metro.load()]);
    this.piano = piano;
  }

  setPlayerVoice(v: 'piano' | 'synth'): void { this.playerVoice = v; }

  playPlayer(midi: number, whenSec?: number, durSec = 0.4): void {
    const ctx = this.context();
    const when = whenSec ?? ctx.currentTime;
    try {
      if (this.playerVoice === 'piano' && this.piano) {
        this.piano.start({ note: midi, time: when, duration: durSec, velocity: PIANO_VELOCITY });
      } else {
        this.synth(midi, when, durSec, 0.2);
      }
    } catch (cause) {
      this.fail('player note failed', cause);
    }
  }

  scheduleAccomp(n: AccompNote, whenSec: number, durSec: number): void {
    const slot = this.voices.get(n.voice);
    try {
      if (slot?.inst) {
        slot.inst.start({ note: n.midi, time: whenSec, duration: durSec, velocity: n.velocity });
      } else if (!slot?.percussion) {
        this.synth(n.midi, whenSec, durSec, 0.08 * (n.velocity / 127));
      }
    } catch (cause) {
      this.fail('accompaniment note failed', cause);
    }
  }

  private synth(midi: number, when: number, dur: number, gain: number): void {
    const ctx = this.context();
    synthTone(ctx, this.master!, { freq: 440 * 2 ** ((midi - 69) / 12), when, dur, gain });
  }

  metronomeTick(whenSec: number, accent: boolean, volume: number): void {
    this.context();
    this.metro?.tick(whenSec, accent, volume);
  }

  sfx(kind: SfxKind): void {
    playSfx(this.context(), this.master!, kind);
  }

  stopAll(): void {
    for (const i of [this.piano, ...[...this.voices.values()].map((v) => v.inst)]) {
      try { i?.stop(); } catch { /* already stopped */ }
    }
  }

  dispose(): void {
    this.stopAll();
    for (const v of this.voices.values()) v.gain.disconnect();
    this.voices.clear();
    this.master?.disconnect();
    this.master = null;
    this.piano = null;
    this.metro = null;
    this.ctx = null;
  }
}
