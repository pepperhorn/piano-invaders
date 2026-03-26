import highMp3 from '../audio/high.mp3';
import lowMp3 from '../audio/low.mp3';

let highBuffer = null;
let lowBuffer = null;
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

async function loadSample(url) {
  const ctx = getAudioContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

async function ensureSamples() {
  const [h, l] = await Promise.all([
    highBuffer ? Promise.resolve(highBuffer) : loadSample(highMp3),
    lowBuffer ? Promise.resolve(lowBuffer) : loadSample(lowMp3),
  ]);
  highBuffer = h;
  lowBuffer = l;
}

function playSample(high, volume) {
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

export function playMetronomeTick(beatInBar, volumeScale = 1) {
  if (beatInBar === 0) {
    playSample(true, 0.8 * volumeScale);
  } else if (beatInBar === 2) {
    playSample(false, 0.55 * volumeScale);
  } else {
    playSample(false, 0.3 * volumeScale);
  }
}

/**
 * Play a 2-bar count-in: "1 - 2 - | 1 2 3 4"
 * Bar 1: beats on 1 and 3 (half notes) to set the tempo
 * Bar 2: all 4 beats to lock in the groove
 * Calls onBeat({ bar, beat, label }) for each audible beat.
 * Returns a promise that resolves on the downbeat after the count-in.
 */
export function playCountIn(bpm, onBeat, volumeScale = 1) {
  return new Promise(async (resolve) => {
    await ensureSamples();

    const msPerBeat = 60000 / bpm;
    // 8 beats total across 2 bars
    // Bar 1: tick on beats 0,2 (show "1" then "2"), silent on 1,3
    // Bar 2: tick on all beats 4,5,6,7 (show "1 2 3 4")
    const schedule = [
      { tick: true, label: '1', beatInBar: 0 },   // bar1 beat1
      { tick: false, label: null, beatInBar: 1 },  // bar1 beat2 (silent)
      { tick: true, label: '2', beatInBar: 2 },    // bar1 beat3
      { tick: false, label: null, beatInBar: 3 },  // bar1 beat4 (silent)
      { tick: true, label: '1', beatInBar: 0 },    // bar2 beat1
      { tick: true, label: '2', beatInBar: 1 },    // bar2 beat2
      { tick: true, label: '3', beatInBar: 2 },    // bar2 beat3
      { tick: true, label: '4', beatInBar: 3 },    // bar2 beat4
    ];

    let idx = 0;

    const step = () => {
      const s = schedule[idx];
      if (s.tick) {
        playMetronomeTick(s.beatInBar, volumeScale);
      }
      onBeat({ bar: idx < 4 ? 1 : 2, beat: (idx % 4) + 1, label: s.label });
      idx++;

      if (idx >= schedule.length) {
        setTimeout(resolve, msPerBeat);
      } else {
        setTimeout(step, msPerBeat);
      }
    };

    step();
  });
}

export async function initMetronome() {
  await ensureSamples();
}
