export type SfxKind = 'hit' | 'miss' | 'explode' | 'fire';

/** Plain oscillator blip with a short decay; used for sfx and as the instrument fallback. */
export function synthTone(
  ctx: BaseAudioContext, dest: AudioNode,
  o: { freq: number; when: number; dur: number; gain?: number; type?: OscillatorType; endFreq?: number },
): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(o.freq, o.when);
  if (o.endFreq) osc.frequency.exponentialRampToValueAtTime(o.endFreq, o.when + o.dur);
  const peak = o.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, o.when);
  g.gain.linearRampToValueAtTime(peak, o.when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, o.when + Math.max(o.dur, 0.03));
  osc.connect(g);
  g.connect(dest);
  osc.start(o.when);
  osc.stop(o.when + Math.max(o.dur, 0.03) + 0.05);
}

export function playSfx(ctx: BaseAudioContext, dest: AudioNode, kind: SfxKind): void {
  const t = ctx.currentTime;
  switch (kind) {
    case 'hit': synthTone(ctx, dest, { freq: 523.25, when: t, dur: 0.12, gain: 0.18 }); break;
    case 'miss': synthTone(ctx, dest, { freq: 65.4, when: t, dur: 0.25, gain: 0.25, type: 'sawtooth' }); break;
    case 'explode': synthTone(ctx, dest, { freq: 220, endFreq: 30, when: t, dur: 0.4, gain: 0.3, type: 'sawtooth' }); break;
    case 'fire': synthTone(ctx, dest, { freq: 880, endFreq: 220, when: t, dur: 0.1, gain: 0.12, type: 'square' }); break;
  }
}
