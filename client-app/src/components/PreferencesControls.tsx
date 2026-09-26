import { useEffect, useRef, useState } from 'react';
import { Contrast, Eye, Languages, Sun, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, type LanguageCode } from '../i18n/languages';
import { useAccessibility, type FontScale, type ThemeMode } from '../a11y/AccessibilityProvider';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES.find((l) => l.code === 'en')!;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200/80 transition hover:bg-slate-50 sm:min-h-12 sm:gap-2 sm:px-3"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('a11y.language')}
        onClick={() => setOpen((v) => !v)}
      >
        <Languages className="h-4 w-4 shrink-0" aria-hidden />
        <span aria-hidden className="text-base leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={t('a11y.language')}
          className="absolute right-0 z-50 mt-2 max-h-[70vh] w-56 overflow-y-auto rounded-2xl border border-nursery-100 bg-white p-2 shadow-xl"
        >
          {LANGUAGES.map((lang) => {
            const active = lang.code === i18n.language;
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={active}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold ${
                  active ? 'bg-forest-700 text-white' : 'text-slate-800 hover:bg-slate-50'
                }`}
                onClick={() => {
                  void i18n.changeLanguage(lang.code as LanguageCode);
                  setOpen(false);
                }}
              >
                <span className="text-lg" aria-hidden>
                  {lang.flag}
                </span>
                {lang.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const FONTS: { id: FontScale; key: string }[] = [
  { id: 'normal', key: 'a11y.fontNormal' },
  { id: 'large', key: 'a11y.fontLarge' },
  { id: 'xlarge', key: 'a11y.fontXLarge' },
];

const THEMES: { id: ThemeMode; key: string; icon: typeof Sun }[] = [
  { id: 'light', key: 'a11y.themeLight', icon: Sun },
  { id: 'dark', key: 'a11y.themeDark', icon: Contrast },
  { id: 'warm', key: 'a11y.themeWarm', icon: Eye },
];

export function AccessibilityMenu() {
  const { t } = useTranslation();
  const { fontScale, theme, voiceAssist, setFontScale, setTheme, setVoiceAssist } = useAccessibility();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 ring-1 ring-slate-200/80 transition hover:bg-slate-50 sm:h-12 sm:w-auto sm:gap-2 sm:px-3"
        aria-expanded={open}
        aria-label={t('a11y.open')}
        onClick={() => setOpen((v) => !v)}
      >
        <Type className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline text-sm font-semibold">{t('a11y.title')}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-nursery-100 bg-white p-4 text-nursery-900 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">{t('a11y.title')}</h2>
            <button type="button" className="btn-ghost min-h-12 px-3" onClick={() => setOpen(false)}>
              {t('common.close')}
            </button>
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-nursery-600">{t('a11y.font')}</p>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {FONTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`min-h-12 rounded-xl px-2 text-xs font-semibold ring-1 ${
                  fontScale === item.id ? 'bg-forest-700 text-white ring-forest-700' : 'bg-white text-slate-700 ring-slate-200'
                }`}
                onClick={() => setFontScale(item.id)}
              >
                {t(item.key)}
              </button>
            ))}
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-nursery-600">{t('a11y.theme')}</p>
          <div className="mb-4 space-y-2">
            {THEMES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold ring-1 ${
                    theme === item.id ? 'bg-forest-700 text-white ring-forest-700' : 'bg-white text-slate-700 ring-slate-200'
                  }`}
                  onClick={() => setTheme(item.id)}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {t(item.key)}
                </button>
              );
            })}
          </div>
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-nursery-50 px-3">
            <span>
              <span className="block text-sm font-semibold">{t('a11y.voiceMode')}</span>
              <span className="block text-xs text-nursery-600">{t('a11y.voiceModeHelp')}</span>
            </span>
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={voiceAssist}
              onChange={(event) => setVoiceAssist(event.target.checked)}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function PreferencesControls() {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <LanguageSwitcher />
      <AccessibilityMenu />
    </div>
  );
}
