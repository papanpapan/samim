import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppHistory } from '../navigation/AppHistory';

/** iPhone-style back / forward controls for the app chrome. */
export function AppNavButtons({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const { canBack, canForward, goBack, goForward } = useAppHistory();

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-forest-800 transition active:scale-95 enabled:hover:bg-forest-50 disabled:text-slate-300"
        onClick={goBack}
        disabled={!canBack}
        aria-label={t('app.back')}
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={2.25} aria-hidden />
      </button>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-forest-800 transition active:scale-95 enabled:hover:bg-forest-50 disabled:text-slate-300"
        onClick={goForward}
        disabled={!canForward}
        aria-label={t('app.forward')}
      >
        <ChevronRight className="h-6 w-6" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}

export function ExitHintToast() {
  const { exitHint } = useAppHistory();
  if (!exitHint) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 lg:hidden">
      <div className="rounded-full bg-slate-900/90 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur">
        {exitHint}
      </div>
    </div>
  );
}

/** Tip to install as home-screen app so the browser address bar disappears. */
export function InstallHint() {
  const { t } = useTranslation();
  const { isStandalone } = useAppHistory();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('sn-install-hint') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (localStorage.getItem('sn-install-hint') === '1') setHidden(true);
    } catch { /* ignore */ }
  }, []);

  if (isStandalone || hidden) return null;

  return (
    <div className="border-b border-amber-200/80 bg-amber-50 px-3 py-2 text-amber-950 lg:hidden">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[11px] font-medium leading-snug">
          {t('app.installHint')}
        </p>
        <button
          type="button"
          className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800"
          onClick={() => {
            try { localStorage.setItem('sn-install-hint', '1'); } catch { /* ignore */ }
            setHidden(true);
          }}
        >
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
