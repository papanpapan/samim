import { cancelSpeak, speak } from './speak';
import { startAlertTone, stopAlertTone } from './alertTone';

/** Speak once, then sound the alert for this long, then detection may resume. */
export const INTRUSION_ALERT_MS = 30_000;

let busyUntil = 0;
let waitTimer: number | undefined;
let cycleId = 0;
let listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

function clearWait() {
  if (waitTimer !== undefined) window.clearTimeout(waitTimer);
  waitTimer = undefined;
}

function release() {
  clearWait();
  busyUntil = 0;
  notify();
}

export function intrusionAlarmBusy() {
  return Date.now() < busyUntil;
}

export function subscribeIntrusionAlarm(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Stop voice + tone immediately and resume detection. */
export function stopIntrusionAlarm() {
  cycleId += 1;
  cancelSpeak();
  stopAlertTone(false);
  release();
}

/**
 * One voice line, then a 30s alert tone. Returns false if a cycle is already running.
 * When muted, skips audio but still holds the busy window for 30s.
 */
export function playIntrusionAlarm(text: string, language: string, muted: boolean): boolean {
  if (intrusionAlarmBusy()) return false;

  const id = ++cycleId;
  busyUntil = Date.now() + INTRUSION_ALERT_MS + 20_000;
  notify();

  const afterAlert = () => {
    if (id !== cycleId) return;
    release();
  };

  if (muted) {
    clearWait();
    waitTimer = window.setTimeout(afterAlert, INTRUSION_ALERT_MS);
    return true;
  }

  speak(text, language, () => {
    if (id !== cycleId) return;
    startAlertTone(INTRUSION_ALERT_MS, afterAlert);
  });

  return true;
}
