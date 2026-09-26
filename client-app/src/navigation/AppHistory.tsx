import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type AppHistoryValue = {
  canBack: boolean;
  canForward: boolean;
  goBack: () => void;
  goForward: () => void;
  isStandalone: boolean;
  exitHint: string | null;
};

const AppHistoryContext = createContext<AppHistoryValue | null>(null);

function fullPath(pathname: string, search: string, hash: string) {
  return `${pathname}${search}${hash}`;
}

export function isExitRoot(pathname: string) {
  return pathname === '/login' || pathname === '/' || pathname === '/platform';
}

function readStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export function AppHistoryProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const stackRef = useRef<string[]>([fullPath(location.pathname, location.search, location.hash)]);
  const indexRef = useRef(0);
  const skipRecord = useRef(false);
  const exitArmed = useRef(false);
  const exitTimer = useRef<number | undefined>(undefined);
  const [, bump] = useState(0);
  const [exitHint, setExitHint] = useState<string | null>(null);
  const [standalone, setStandalone] = useState(readStandalone);

  const refresh = () => bump((n) => n + 1);

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const sync = () => setStandalone(readStandalone());
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    const key = fullPath(location.pathname, location.search, location.hash);
    if (skipRecord.current) {
      skipRecord.current = false;
      return;
    }
    const stack = stackRef.current;
    const idx = indexRef.current;
    if (stack[idx] === key) return;
    stackRef.current = [...stack.slice(0, idx + 1), key];
    indexRef.current = stackRef.current.length - 1;
    refresh();
  }, [location.pathname, location.search, location.hash]);

  const clearExitArm = useCallback(() => {
    exitArmed.current = false;
    window.clearTimeout(exitTimer.current);
    setExitHint(null);
  }, []);

  const requestExit = useCallback(() => {
    if (!exitArmed.current) {
      exitArmed.current = true;
      setExitHint(t('app.exitAgain'));
      window.clearTimeout(exitTimer.current);
      exitTimer.current = window.setTimeout(() => {
        exitArmed.current = false;
        setExitHint(null);
      }, 2000);
      return;
    }
    clearExitArm();
    const ok = window.confirm(t('app.exitConfirm'));
    if (ok) {
      window.close();
    }
  }, [t, clearExitArm]);

  const goBack = useCallback(() => {
    if (indexRef.current > 0) {
      skipRecord.current = true;
      indexRef.current -= 1;
      refresh();
      navigate(-1);
      return;
    }
    if (isExitRoot(location.pathname)) {
      requestExit();
      return;
    }
    skipRecord.current = true;
    stackRef.current = ['/'];
    indexRef.current = 0;
    refresh();
    navigate('/', { replace: true });
  }, [location.pathname, navigate, requestExit]);

  const goForward = useCallback(() => {
    if (indexRef.current >= stackRef.current.length - 1) return;
    skipRecord.current = true;
    indexRef.current += 1;
    refresh();
    navigate(1);
  }, [navigate]);

  useEffect(() => {
    if (!isExitRoot(location.pathname)) {
      clearExitArm();
      return undefined;
    }

    const lock = () => {
      window.history.pushState({ snExit: 1 }, '', fullPath(location.pathname, location.search, location.hash));
    };
    lock();

    const onPopState = () => {
      lock();
      requestExit();
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [location.pathname, location.search, location.hash, requestExit, clearExitArm]);

  const value = useMemo<AppHistoryValue>(() => ({
    canBack: indexRef.current > 0 || isExitRoot(location.pathname) || location.pathname !== '/',
    canForward: indexRef.current < stackRef.current.length - 1,
    goBack,
    goForward,
    isStandalone: standalone,
    exitHint,
  }), [location.pathname, goBack, goForward, standalone, exitHint, bump]);

  return (
    <AppHistoryContext.Provider value={value}>
      {children}
    </AppHistoryContext.Provider>
  );
}

export function useAppHistory() {
  const ctx = useContext(AppHistoryContext);
  if (!ctx) throw new Error('useAppHistory requires AppHistoryProvider');
  return ctx;
}
