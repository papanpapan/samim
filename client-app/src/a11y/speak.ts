import { speechLocale } from '../i18n/languages';

const MISSING_VOICE: Record<string, string> = {
  bn: 'This computer has no Bangla voice. In Windows Settings, open Language, add Bangla, install Speech, then reopen the browser.',
  hi: 'This computer has no Hindi voice. In Windows Settings, open Language, add Hindi, install Speech, then reopen the browser.',
  th: 'This computer has no Thai voice. In Windows Settings, open Language, add Thai, install Speech, then reopen the browser.',
  vi: 'This computer has no Vietnamese voice. In Windows Settings, open Language, add Vietnamese, install Speech, then reopen the browser.',
  ta: 'This computer has no Tamil voice. In Windows Settings, open Language, add Tamil, install Speech, then reopen the browser.',
  mr: 'This computer has no Marathi voice. In Windows Settings, open Language, add Marathi, install Speech, then reopen the browser.',
  ml: 'This computer has no Malayalam voice. In Windows Settings, open Language, add Malayalam, install Speech, then reopen the browser.',
  zh: 'This computer has no Chinese voice. In Windows Settings, open Language, add Chinese, install Speech, then reopen the browser.',
  ja: 'This computer has no Japanese voice. In Windows Settings, open Language, add Japanese, install Speech, then reopen the browser.',
};

const VOICE_ALIASES: Record<string, string[]> = {
  bn: ['bn', 'bengali', 'bangla'],
  hi: ['hi', 'hindi'],
  th: ['th', 'thai'],
  vi: ['vi', 'vietnam'],
  ta: ['ta', 'tamil'],
  mr: ['mr', 'marathi'],
  ml: ['ml', 'malayalam'],
  zh: ['zh', 'chinese', 'mandarin'],
  ja: ['ja', 'japan'],
  en: ['en', 'english'],
};

let held: SpeechSynthesisUtterance | null = null;
/** Bumped to invalidate in-flight speak onEnd / safety timers. */
let speakGen = 0;
let safetyTimer: number | undefined;

function pickVoice(voices: SpeechSynthesisVoice[], tag: string): SpeechSynthesisVoice | undefined {
  const prefix = tag.slice(0, 2).toLowerCase();
  const names = VOICE_ALIASES[prefix] ?? [prefix];
  return (
    voices.find((voice) => voice.lang.toLowerCase() === tag.toLowerCase()) ??
    voices.find((voice) => voice.lang.toLowerCase().replace('_', '-').startsWith(prefix)) ??
    voices.find((voice) => names.some((name) => voice.name.toLowerCase().includes(name)))
  );
}

function queue(synth: SpeechSynthesis, utter: SpeechSynthesisUtterance, gen: number) {
  held = utter;
  window.setTimeout(() => {
    if (held !== utter || gen !== speakGen) return;
    if (synth.paused) synth.resume();
    synth.speak(utter);
  }, 80);
}

/** Stop speech immediately and prevent any pending onEnd from running. */
export function cancelSpeak() {
  speakGen += 1;
  held = null;
  if (safetyTimer !== undefined) {
    window.clearTimeout(safetyTimer);
    safetyTimer = undefined;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function speak(text: string, language: string, onEnd?: () => void) {
  if (!text.trim() || typeof window === 'undefined' || !window.speechSynthesis) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  const myGen = ++speakGen;
  if (safetyTimer !== undefined) {
    window.clearTimeout(safetyTimer);
    safetyTimer = undefined;
  }

  let ran = false;
  let finished = false;
  const done = () => {
    if (finished || myGen !== speakGen) return;
    finished = true;
    if (safetyTimer !== undefined) {
      window.clearTimeout(safetyTimer);
      safetyTimer = undefined;
    }
    onEnd?.();
  };

  const start = () => {
    if (ran || myGen !== speakGen) return;
    ran = true;
    synth.cancel();
    const tag = speechLocale(language);
    const voices = synth.getVoices();
    const match = pickVoice(voices, tag);
    const utter = new SpeechSynthesisUtterance(match ? text : (MISSING_VOICE[language] ?? text));
    if (match) {
      utter.voice = match;
      utter.lang = match.lang || tag;
    } else {
      const english = pickVoice(voices, 'en-US');
      if (english) utter.voice = english;
      utter.lang = 'en-US';
      window.dispatchEvent(new CustomEvent('sn-speech-missing', { detail: language }));
    }
    utter.rate = 0.88;
    utter.pitch = 1;
    utter.onend = done;
    utter.onerror = done;
    safetyTimer = window.setTimeout(done, 12_000);
    queue(synth, utter, myGen);
  };

  if (synth.getVoices().length === 0) {
    synth.addEventListener('voiceschanged', start, { once: true });
    window.setTimeout(start, 400);
    return;
  }
  start();
}
