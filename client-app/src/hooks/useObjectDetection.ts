import { useCallback, useEffect, useRef, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import {
  intrusionAlarmBusy,
  playIntrusionAlarm,
  stopIntrusionAlarm,
  subscribeIntrusionAlarm,
} from '../a11y/intrusionAlarm';

export type DetectClass = 'person' | 'cow' | 'sheep' | 'dog' | 'cat' | 'bird';

export interface DetectionHit {
  class: DetectClass;
  score: number;
  /** Pixel box in the source video's intrinsic coordinates. */
  box: { x: number; y: number; width: number; height: number };
}

export interface ObjectDetectionOptions {
  active: boolean;
  /** Speak / broadcast only while danger alert is armed. */
  voiceEnabled: boolean;
  language: string;
  /** Localized line, e.g. "Saba Nursery এ গরু ঢুকেছে। বিপদ সতর্কতা।" */
  announce: (hit: DetectionHit) => string;
  /** Notify nursery desks (other phones / computers). */
  onIntrusion?: (hit: DetectionHit) => void;
}

const TARGETS = new Set<string>(['person', 'cow', 'sheep', 'dog', 'cat', 'bird']);
/** Animals need a higher bar — coco-ssd often confuses people/plants with cow/sheep. */
const SCORE_NEED: Record<DetectClass, number> = {
  person: 0.60,
  cow: 0.75,
  sheep: 0.75,
  dog: 0.68,
  cat: 0.68,
  bird: 0.70,
};
const SCAN_MS = 400;
const MUTE_KEY = 'sn-live-detect-mute';
const DETECT_MIN_SIDE = 640;
/** Same class must win this many recent scans before we speak. */
const CONFIRM_NEED = 3;
const CONFIRM_HISTORY = 5;
const MIN_BOX_SHARE = 0.012;
const IOU_DROP = 0.35;

function isDetectClass(value: string): value is DetectClass {
  return TARGETS.has(value);
}

function frameAreaShare(box: DetectionHit['box'], videoW: number, videoH: number) {
  if (videoW <= 0 || videoH <= 0) return 0;
  return (box.width * box.height) / (videoW * videoH);
}

function iou(a: DetectionHit['box'], b: DetectionHit['box']) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  const inter = w * h;
  if (inter <= 0) return 0;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

/** Drop animal boxes that sit on top of a stronger person box (common false cow). */
function preferPersonOverAnimals(hits: DetectionHit[]) {
  const people = hits.filter((hit) => hit.class === 'person');
  if (people.length === 0) return hits;
  return hits.filter((hit) => {
    if (hit.class === 'person') return true;
    return !people.some((person) => iou(person.box, hit.box) >= IOU_DROP && person.score + 0.05 >= hit.score);
  });
}

function pickStable(hits: DetectionHit[]): DetectionHit | null {
  if (hits.length === 0) return null;
  const ranked = [...hits].sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const person = ranked.find((hit) => hit.class === 'person');
  // If a person is close in confidence, trust person over a shaky animal label.
  if (person && best.class !== 'person' && person.score >= best.score - 0.12) {
    return person;
  }
  return best;
}

export function useObjectDetection(
  video: HTMLVideoElement | null,
  { active, voiceEnabled, language, announce, onIntrusion }: ObjectDetectionOptions,
) {
  const [hits, setHits] = useState<DetectionHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [alerting, setAlerting] = useState(() => intrusionAlarmBusy());
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === 'on');
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const busyRef = useRef(false);
  const historyRef = useRef<DetectClass[]>([]);
  const mutedRef = useRef(muted);
  const voiceRef = useRef(voiceEnabled);
  const announceRef = useRef(announce);
  const languageRef = useRef(language);
  const intrusionRef = useRef(onIntrusion);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    voiceRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    announceRef.current = announce;
  }, [announce]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    intrusionRef.current = onIntrusion;
  }, [onIntrusion]);

  useEffect(() => subscribeIntrusionAlarm(() => setAlerting(intrusionAlarmBusy())), []);

  // Camera stop / unpublish ends any running voice + alert tone.
  const wasActive = useRef(active);
  useEffect(() => {
    if (wasActive.current && !active) {
      stopIntrusionAlarm();
      historyRef.current = [];
    }
    wasActive.current = active;
  }, [active]);

  const stopAlert = useCallback(() => {
    stopIntrusionAlarm();
    historyRef.current = [];
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      localStorage.setItem(MUTE_KEY, next ? 'on' : 'off');
      mutedRef.current = next;
      if (next) {
        stopIntrusionAlarm();
        historyRef.current = [];
      } else if (typeof window !== 'undefined' && window.speechSynthesis) {
        const unlock = new SpeechSynthesisUtterance(' ');
        unlock.volume = 0;
        window.speechSynthesis.speak(unlock);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!active) {
      setHits([]);
      historyRef.current = [];
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    const boot = async () => {
      try {
        if (!modelRef.current) {
          modelRef.current = await cocoSsd.load({ base: 'mobilenet_v2' });
        }
        if (!cancelled) {
          setReady(true);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
          setReady(false);
        }
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (!active || !video || !ready || !modelRef.current) {
      setHits([]);
      return undefined;
    }

    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const scan = async () => {
      if (stopped || busyRef.current || !modelRef.current || !ctx) return;
      // Voice once → 30s alert → then scan again.
      if (intrusionAlarmBusy()) {
        setHits([]);
        historyRef.current = [];
        return;
      }
      if (video.readyState < 2 || video.videoWidth < 16) return;
      busyRef.current = true;
      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const scale = Math.max(1, DETECT_MIN_SIDE / Math.min(vw, vh));
        canvas.width = Math.max(1, Math.round(vw * scale));
        canvas.height = Math.max(1, Math.round(vh * scale));
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Higher minScore cuts shaky false labels before our filters.
        const raw = await modelRef.current.detect(canvas, 12, 0.5);
        if (stopped) return;

        let next: DetectionHit[] = [];
        for (const row of raw) {
          if (!isDetectClass(row.class)) continue;
          const need = SCORE_NEED[row.class];
          if (row.score < need) continue;
          const [x, y, width, height] = row.bbox;
          const box = {
            x: x / scale,
            y: y / scale,
            width: width / scale,
            height: height / scale,
          };
          if (frameAreaShare(box, vw, vh) < MIN_BOX_SHARE) continue;
          next.push({ class: row.class, score: row.score, box });
        }
        next = preferPersonOverAnimals(next);
        next.sort((a, b) => b.score - a.score);
        setHits(next);

        const top = pickStable(next);
        if (!top) {
          historyRef.current = [];
        } else {
          const history = historyRef.current;
          history.push(top.class);
          if (history.length > CONFIRM_HISTORY) history.shift();
          historyRef.current = history;

          const same = history.filter((kind) => kind === top.class).length;
          const readyToSpeak = same >= CONFIRM_NEED && history[history.length - 1] === top.class;

          if (readyToSpeak && voiceRef.current && !intrusionAlarmBusy()) {
            intrusionRef.current?.(top);
            const started = playIntrusionAlarm(
              announceRef.current(top),
              languageRef.current,
              mutedRef.current,
            );
            if (started) {
              historyRef.current = [];
              setAlerting(true);
            }
          }
        }
      } catch {
        /* frame skipped */
      } finally {
        busyRef.current = false;
      }
    };

    void scan();
    const timer = window.setInterval(() => void scan(), SCAN_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      historyRef.current = [];
      setHits([]);
    };
  }, [active, video, ready]);

  return { hits, loading, ready, failed, muted, alerting, toggleMute, stopAlert };
}
