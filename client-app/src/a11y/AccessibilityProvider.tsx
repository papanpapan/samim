import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { speak } from './speak';

export type FontScale = 'normal' | 'large' | 'xlarge';
export type ThemeMode = 'light' | 'dark' | 'warm';

interface A11yState {
  fontScale: FontScale;
  theme: ThemeMode;
  voiceAssist: boolean;
  setFontScale: (scale: FontScale) => void;
  setTheme: (theme: ThemeMode) => void;
  setVoiceAssist: (on: boolean) => void;
}

const KEY = 'sn-a11y';
const SCALES: Record<FontScale, string> = {
  normal: '100%',
  large: '115%',
  xlarge: '130%',
};

const VOICE_NOTICE: Record<string, string> = {
  bn: 'এই কম্পিউটারে বাংলা কণ্ঠ নেই। Windows Settings → Time & language → Language & region → Add a language → বাংলা → Speech ইনস্টল করুন, তারপর ব্রাউজার আবার খুলুন।',
  hi: 'इस कंप्यूटर में हिन्दी आवाज़ नहीं है। Windows Settings → Language में Hindi जोड़कर Speech इंस्टॉल करें, फिर ब्राउज़र फिर खोलें।',
  en: 'This computer has no voice for that language. In Windows Settings, add the language and install Speech, then reopen the browser.',
};

const AccessibilityContext = createContext<A11yState | undefined>(undefined);

function load(): { fontScale: FontScale; theme: ThemeMode; voiceAssist: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { fontScale: 'normal' as FontScale, theme: 'light' as ThemeMode, voiceAssist: false };
    const parsed = JSON.parse(raw) as Partial<A11yState>;
    return {
      fontScale: parsed.fontScale === 'large' || parsed.fontScale === 'xlarge' ? parsed.fontScale : 'normal',
      theme: parsed.theme === 'dark' || parsed.theme === 'warm' ? parsed.theme : 'light',
      voiceAssist: Boolean(parsed.voiceAssist),
    };
  } catch {
    return { fontScale: 'normal' as FontScale, theme: 'light' as ThemeMode, voiceAssist: false };
  }
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const initial = load();
  const [fontScale, setFontScale] = useState<FontScale>(initial.fontScale);
  const [theme, setTheme] = useState<ThemeMode>(initial.theme);
  const [voiceAssist, setVoiceAssist] = useState(initial.voiceAssist);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.font = fontScale;
    root.style.setProperty('--font-scale', SCALES[fontScale]);
    localStorage.setItem(KEY, JSON.stringify({ fontScale, theme, voiceAssist }));
  }, [fontScale, theme, voiceAssist]);

  useEffect(() => {
    const onMissing = (event: Event) => {
      const code = (event as CustomEvent<string>).detail || i18n.language;
      setVoiceNotice(VOICE_NOTICE[code] ?? VOICE_NOTICE.en);
    };
    window.addEventListener('sn-speech-missing', onMissing);
    return () => window.removeEventListener('sn-speech-missing', onMissing);
  }, [i18n.language]);

  useEffect(() => {
    if (!voiceAssist) return;
    let last = '';
    let timer = 0;
    const onPoint = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const el = target?.closest?.('[data-speak]') as HTMLElement | null;
      const text = el?.getAttribute('data-speak')?.trim();
      if (!text || text === last) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        last = text;
        speak(text, i18n.language);
      }, 450);
    };
    document.addEventListener('mouseover', onPoint);
    document.addEventListener('focusin', onPoint);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mouseover', onPoint);
      document.removeEventListener('focusin', onPoint);
    };
  }, [voiceAssist, i18n.language]);

  const value = useMemo(
    () => ({ fontScale, theme, voiceAssist, setFontScale, setTheme, setVoiceAssist }),
    [fontScale, theme, voiceAssist],
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      {voiceNotice && (
        <div className="fixed bottom-4 left-1/2 z-[60] w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-800 shadow-lg" role="status">
          <div className="flex items-start justify-between gap-3">
            <p>{voiceNotice}</p>
            <button type="button" className="btn-ghost min-h-12 shrink-0 px-3" onClick={() => setVoiceNotice(null)}>
              OK
            </button>
          </div>
        </div>
      )}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return ctx;
}
