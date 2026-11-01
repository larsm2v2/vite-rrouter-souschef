let audioContext: AudioContext | null = null;

/** Browsers (iOS especially) only allow audio after a user gesture; call this from a tap handler. */
export function unlockAudio(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    audioContext ??= new Ctor();
    if (audioContext.state === "suspended") void audioContext.resume();
  } catch {
    // audio unavailable; visual alert still works
  }
}

function beep(ctx: AudioContext, startAt: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.4, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.3);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + 0.32);
}

/** Sound and vibration for a finished timer. Both are best-effort. */
export function playTimerAlert(): void {
  try {
    if (audioContext && audioContext.state === "running") {
      const t = audioContext.currentTime;
      beep(audioContext, t);
      beep(audioContext, t + 0.4);
      beep(audioContext, t + 0.8);
    }
  } catch {
    // ignore audio failures
  }
  try {
    navigator.vibrate?.([200, 100, 200, 100, 200]);
  } catch {
    // vibration unsupported
  }
}
