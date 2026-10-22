let ctx: AudioContext | null = null;

/** Lazy singleton shared by smplr, sfx and the metronome. Never created at import. */
export function getAudioContext(): AudioContext {
  if (!ctx) {
    if (typeof window === 'undefined' && typeof AudioContext === 'undefined') {
      throw new Error('AudioContext is not available in this environment');
    }
    const Ctor: typeof AudioContext =
      (typeof AudioContext !== 'undefined' ? AudioContext : (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    ctx = new Ctor();
  }
  return ctx;
}

/** Resume the shared context (call from a user gesture). Never rejects. */
export async function resumeAudio(): Promise<void> {
  try {
    const c = getAudioContext();
    if (c.state === 'suspended') await c.resume();
  } catch {
    /* autoplay policy or no WebAudio: callers fall back silently */
  }
}
