let highBuffer: AudioBuffer | null = null;
let lowBuffer: AudioBuffer | null = null;
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/** Load an audio file into an AudioBuffer. */
async function loadSample(url: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

/** Ensure both metronome samples are loaded. */
async function ensureSamples(): Promise<void> {
  const [h, l] = await Promise.all([
    highBuffer ? Promise.resolve(highBuffer) : loadSample(new URL('./high.mp3', import.meta.url).href),
    lowBuffer ? Promise.resolve(lowBuffer) : loadSample(new URL('./low.mp3', import.meta.url).href),
  ]);
  highBuffer = h;
  lowBuffer = l;
}

/**
 * Play a metronome sample.
 * @param high - true for beat 1 (high.mp3), false for others (low.mp3)
 * @param volume - gain level (0-1)
 */
function playSample(high: boolean, volume: number) {
  const ctx = getAudioContext();
  const buffer = high ? highBuffer : lowBuffer;
  if (!buffer) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);

  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

/**
 * Play a single metronome tick for the given beat position.
 * Beat 1: high sample, full volume
 * Beat 3: low sample, medium emphasis
 * Beats 2 & 4: low sample, soft
 * @param volumeScale - 0-1 master volume multiplier
 */
export function playMetronomeTick(beatInBar: number, volumeScale = 1) {
  if (beatInBar === 0) {
    playSample(true, 0.8 * volumeScale);
  } else if (beatInBar === 2) {
    playSample(false, 0.55 * volumeScale);
  } else {
    playSample(false, 0.3 * volumeScale);
  }
}

/**
 * Play a 4-beat count-in using the metronome samples.
 * Calls onBeat(1-4) for each beat.
 * Returns a promise that resolves when the count-in finishes.
 */
export function playCountIn(
  bpm: number,
  onBeat: (beat: number) => void,
  volumeScale = 1,
): Promise<void> {
  return new Promise(async (resolve) => {
    await ensureSamples();

    const msPerBeat = 60000 / bpm;
    let beat = 0;

    const tick = () => {
      playMetronomeTick(beat, volumeScale);
      onBeat(beat + 1); // 1-indexed
      beat++;

      if (beat >= 4) {
        // Wait one more beat so playback starts on the downbeat after the count-in
        setTimeout(resolve, msPerBeat);
      } else {
        setTimeout(tick, msPerBeat);
      }
    };

    tick();
  });
}

/** Pre-load the metronome samples. Call early so they're ready for count-in. */
export async function initMetronome() {
  await ensureSamples();
}
