/** Repeating two-tone danger alert for a fixed duration (Web Audio). */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let pulseTimer: number | undefined;
let endTimer: number | undefined;
let onDoneCb: (() => void) | null = null;

function clearTimers() {
  if (pulseTimer !== undefined) window.clearInterval(pulseTimer);
  if (endTimer !== undefined) window.clearTimeout(endTimer);
  pulseTimer = undefined;
  endTimer = undefined;
}

function beep(audio: AudioContext, dest: GainNode, high: boolean) {
  const tone = audio.createOscillator();
  const gain = audio.createGain();
  tone.type = 'square';
  tone.frequency.value = high ? 880 : 660;
  const now = audio.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  tone.connect(gain);
  gain.connect(dest);
  tone.start(now);
  tone.stop(now + 0.3);
}

/**
 * Stops the tone immediately.
 * @param invokeDone - when false (user Stop), skips the natural-end callback.
 */
export function stopAlertTone(invokeDone = true) {
  clearTimers();
  const done = onDoneCb;
  onDoneCb = null;
  if (master) {
    try {
      master.gain.value = 0;
    } catch {
      /* already closed */
    }
    master = null;
  }
  if (ctx) {
    const audio = ctx;
    ctx = null;
    void audio.close().catch(() => undefined);
  }
  if (invokeDone) done?.();
}

/** Plays an alternating alarm for `durationMs`, then calls `onDone`. Returns a stop function. */
export function startAlertTone(durationMs: number, onDone?: () => void): () => void {
  stopAlertTone(false);
  onDoneCb = onDone ?? null;
  const audio = new AudioContext();
  ctx = audio;
  const gain = audio.createGain();
  gain.gain.value = 1;
  gain.connect(audio.destination);
  master = gain;
  void audio.resume().catch(() => undefined);

  let high = true;
  const pulse = () => {
    if (!ctx || !master) return;
    beep(ctx, master, high);
    high = !high;
  };
  pulse();
  pulseTimer = window.setInterval(pulse, 450);
  endTimer = window.setTimeout(() => {
    stopAlertTone(true);
  }, durationMs);

  return () => stopAlertTone(false);
}
