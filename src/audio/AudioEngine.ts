import { DrumMachine, Soundfont, SplendidGrandPiano, getDrumMachineNames, getSoundfontNames } from 'smplr';
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
interface VoiceSlot { inst: Playable | null; percussion: boolean; volume: number }
/** One loaded instrument, shared by every voice that resolves to it. */
interface InstSlot { inst: Playable | null; gain: GainNode | null }

const PIANO_VELOCITY = 90;
const DEFAULT_DRUMS = 'LM-2';
const DEFAULT_GM = 'acoustic_grand_piano';

export type InstrumentChoice =
  | { kind: 'drum'; instrument: string }
  | { kind: 'splendid' }
  | { kind: 'soundfont'; instrument: string };

const norm = (n: string) => n.toLowerCase().replace(/[\s_-]+/g, '');
const choiceKey = (c: InstrumentChoice) => (c.kind === 'splendid' ? 'splendid' : `${c.kind}:${c.instrument}`);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Map a voice's instrument string (GM name, smplr patch or category) to a concrete smplr instrument. */
export function resolveInstrument(instrument: string, percussion: boolean): InstrumentChoice {
  if (percussion) {
    return { kind: 'drum', instrument: getDrumMachineNames().includes(instrument) ? instrument : DEFAULT_DRUMS };
  }
  if (norm(instrument) === 'splendidgrandpiano') return { kind: 'splendid' };
  if (getSoundfontNames().includes(instrument)) return { kind: 'soundfont', instrument };
  return { kind: 'soundfont', instrument: DEFAULT_GM };
}

export class AudioEngine {
  onError?: (e: AudioError) => void;

  private readonly injected: AudioContext | undefined;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private piano: Playable | null = null;
  private playerVoice: 'piano' | 'synth' = 'piano';
  private voices = new Map<string, VoiceSlot>();
  private insts = new Map<string, InstSlot>();
  private metro: Metronome | null = null;
  private reported = new Set<string>();
  private unavailable = false;
  /** bumped by every load()/dispose(): a load that finishes after a newer one started is stale */
  private gen = 0;

  constructor(ctx?: AudioContext) { this.injected = ctx; }

  /** The shared context, or null (reported once) when WebAudio is unavailable. */
  private context(): AudioContext | null {
    if (!this.ctx && !this.unavailable) {
      try {
        const ctx = this.injected ?? getAudioContext();
        this.master = ctx.createGain();
        this.master.connect(ctx.destination);
        this.ctx = ctx;
      } catch (cause) {
        this.unavailable = true;
        this.fail('audio unavailable', cause);
      }
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

  private teardownVoices(): void {
    for (const i of this.insts.values()) {
      if (i.inst !== this.piano) { try { i.inst?.stop(); } catch { /* already stopped */ } }
      i.gain?.disconnect();
    }
    this.insts.clear();
    this.voices.clear();
  }

  async load(song: GameSong, playerVoice: 'piano' | 'synth'): Promise<void> {
    this.playerVoice = playerVoice;
    const gen = ++this.gen;
    const ctx = this.context();
    const master = this.master;
    if (!ctx || !master) return;
    this.teardownVoices();
    this.metro ??= new Metronome(ctx, master);

    const pianoP = this.piano
      ? Promise.resolve(this.piano)
      : this.build('piano', () => SplendidGrandPiano(ctx, { destination: master }) as unknown as Playable);

    // Only voices that accompaniment notes play are loaded (melody voices never sound through
    // the engine), and voices resolving to the same instrument share one instance. A splendid
    // voice shares the player piano. Per-voice volume is applied as a velocity scale.
    const used = new Set(song.accompaniment.map((n) => n.voice));
    const jobs = new Map<string, Promise<Playable | null>>();
    const own: InstSlot[] = [];
    const voiceJobs = Object.entries(song.voices)
      .filter(([id]) => used.has(id))
      .map(async ([id, v]) => {
        const choice = resolveInstrument(v.instrument, !!v.percussion);
        const key = choiceKey(choice);
        let job = jobs.get(key);
        if (!job) {
          if (choice.kind === 'splendid') {
            job = pianoP;
            this.insts.set(key, { inst: null, gain: null });
          } else {
            const gain = ctx.createGain();
            gain.gain.value = 1;
            gain.connect(master);
            const slot: InstSlot = { inst: null, gain };
            this.insts.set(key, slot);
            own.push(slot);
            job = this.build(`voice "${id}" (${v.instrument})`, () =>
              choice.kind === 'drum'
                ? (DrumMachine(ctx, { instrument: choice.instrument, destination: gain }) as unknown as Playable)
                : (Soundfont(ctx, { instrument: choice.instrument, destination: gain }) as unknown as Playable),
            ).then((inst) => { slot.inst = inst; return inst; });
          }
          jobs.set(key, job);
        }
        const inst = await job;
        if (gen !== this.gen) return;
        this.voices.set(id, { inst, percussion: !!v.percussion, volume: clamp01(v.volume) });
      });

    const [piano] = await Promise.all([pianoP, Promise.all(voiceJobs), this.metro.load()]);
    if (gen !== this.gen) {
      // superseded (e.g. abandoned after the start timeout): drop what this load built
      for (const slot of own) {
        try { slot.inst?.stop(); } catch { /* already stopped */ }
        slot.gain?.disconnect();
      }
      if (piano && piano !== this.piano) { try { piano.stop(); } catch { /* already stopped */ } }
      return;
    }
    this.piano = piano;
  }

  setPlayerVoice(v: 'piano' | 'synth'): void { this.playerVoice = v; }

  playPlayer(midi: number, whenSec?: number, durSec = 0.4): void {
    const ctx = this.context();
    if (!ctx) return;
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
        const velocity = Math.max(1, Math.min(127, Math.round(n.velocity * slot.volume)));
        slot.inst.start({ note: n.midi, time: whenSec, duration: durSec, velocity });
      } else if (!slot?.percussion) {
        this.synth(n.midi, whenSec, durSec, 0.08 * (n.velocity / 127));
      }
    } catch (cause) {
      this.fail('accompaniment note failed', cause);
    }
  }

  private synth(midi: number, when: number, dur: number, gain: number): void {
    const ctx = this.context();
    if (!ctx || !this.master) return;
    synthTone(ctx, this.master, { freq: 440 * 2 ** ((midi - 69) / 12), when, dur, gain });
  }

  metronomeTick(whenSec: number, accent: boolean, volume: number): void {
    if (!this.context()) return;
    this.metro?.tick(whenSec, accent, volume);
  }

  sfx(kind: SfxKind): void {
    const ctx = this.context();
    if (ctx && this.master) playSfx(ctx, this.master, kind);
  }

  stopAll(): void {
    for (const i of new Set([this.piano, ...[...this.insts.values()].map((v) => v.inst)])) {
      try { i?.stop(); } catch { /* already stopped */ }
    }
  }

  dispose(): void {
    this.gen++;
    this.stopAll();
    this.teardownVoices();
    this.master?.disconnect();
    this.master = null;
    this.piano = null;
    this.metro = null;
    this.ctx = null;
  }
}
