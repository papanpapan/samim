import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Mic, MicOff, Send, Trash2, X } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { speechLocale } from '../i18n/languages';

type AgentState = 'IDLE' | 'LISTENING' | 'PARSING' | 'AWAITING_CONFIRMATION' | 'EXECUTING' | 'FEEDBACK';

type Preview = {
  intent: { name: string; args: Record<string, string | number | undefined>; confidence: number };
  summary: string;
  summaryEn: string;
  needsConfirmation: boolean;
  mockLlm: boolean;
  suggestions?: string[];
};

type ChatMsg = {
  id: string;
  kind: 'user' | 'assistant' | 'system';
  text: string;
  at: number;
  name?: string;
  role?: string;
  suggestions?: string[];
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((ev?: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

const CHAT_KEY = 'sn-saba-voice-chat';
const WAKE_KEY = 'sn-saba-wake-on';
const MIC_KEY = 'sn-saba-mic-ok';
const MAX_CHAT = 100;
const FAB_VOICE = 'fixed bottom-5 right-[5.75rem] z-40';

/** Broad wake match — ASR often mangled "Saba". */
const WAKE_RE =
  /(?:hey|hi|hello|ok|okay|yes)\s*[,.]?\s*sab[aehàá]?|হে\s*সাবা|হ্যালো\s*সাবা|জি\s*সাবা|हे\s*साबा|नमस्ते\s*साबा/i;

function normalizeClientText(input: string): string {
  let t = input.normalize('NFC').trim().replace(/\s+/g, ' ');
  t = t.replace(/\bhey\s*sab[aehàá]?\b/gi, 'hey saba');
  t = t.replace(/\bhi\s*sab[aeh]?\b/gi, 'hi saba');
  t = t.replace(/\bstalk\b/gi, 'stock');
  t = t.replace(/\bstoke\b/gi, 'stock');
  t = t.replace(/\bstok\b/gi, 'stock');
  t = t.replace(/\b(ajj|aaj|aajke|ajke)\b/gi, 'today');
  t = t.replace(/\badin+i+um\b/gi, 'adenium');
  t = t.replace(/\badeneum\b/gi, 'adenium');
  t = t.replace(/\bpeyara\b/gi, 'guava');
  t = t.replace(/\baam\b/gi, 'mango');
  return t;
}

function getRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function pickFemaleVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (!window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return undefined;
  const locale = speechLocale(lang).toLowerCase();
  const prefix = locale.slice(0, 2);
  const byLang = voices.filter(
    (v) => v.lang.toLowerCase().startsWith(prefix) || v.lang.toLowerCase().startsWith(locale),
  );
  const pool = byLang.length ? byLang : voices;
  const femaleName =
    /female|zira|susan|samantha|karen|moira|tessa|veena|raveena|priya|heera|neerja|google uk english female|microsoft.*natural.*female|bangla|bengali|বাংলা/i;
  const maleName = /male|david|mark|george|ravi|fred|daniel|thomas|richard|microsoft david|microsoft mark/i;
  return (
    pool.find((v) => femaleName.test(v.name)) ||
    pool.find((v) => !maleName.test(v.name)) ||
    pool[0]
  );
}

function speak(text: string, lang: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const spoken = text.replace(/\n+/g, '. ').trim();
  const u = new SpeechSynthesisUtterance(spoken);
  u.lang = speechLocale(lang);
  u.rate = 0.95;
  u.pitch = 1.05;
  const voice = pickFemaleVoice(lang);
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

function loadChat(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMsg[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_CHAT) : [];
  } catch {
    return [];
  }
}

function saveChat(rows: ChatMsg[]) {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(rows.slice(-MAX_CHAT)));
  } catch {
    /* ignore */
  }
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function localGreeting(lang: string, name?: string) {
  const n = name?.split(/\s+/)[0] || 'boss';
  if (lang.startsWith('bn')) return `জি ${n}, কীভাবে সাহায্য করব?`;
  if (lang.startsWith('hi')) return `जी ${n}, मैं कैसे मदद करूँ?`;
  return `Yes ${n}, how can I help you?`;
}

function localSuggestions(lang: string): string[] {
  if (lang.startsWith('bn')) return ['আমের স্টক কত', 'আজকের বিক্রি', 'মাদার কত', 'লো স্টক'];
  if (lang.startsWith('hi')) return ['आम स्टॉक', 'आज बिक्री', 'मदर कितने', 'लो स्टॉक'];
  return ['mango stock', 'today sales', 'how many mothers', 'low stock'];
}

export function SabaVoiceAssistant() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AgentState>('IDLE');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [chat, setChat] = useState<ChatMsg[]>(() => loadChat());
  const [wakeOn, setWakeOn] = useState(() => {
    try {
      return localStorage.getItem(WAKE_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const [wakeArmed, setWakeArmed] = useState(() => {
    try {
      return sessionStorage.getItem(MIC_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [wakeListening, setWakeListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeRef = useRef<SpeechRecognitionLike | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(false);
  const busyRef = useRef(false);
  const activatingRef = useRef(false);

  openRef.current = open;

  const pushChat = useCallback((msg: Omit<ChatMsg, 'id' | 'at'>) => {
    setChat((prev) => {
      const next = [...prev, { ...msg, id: uid(), at: Date.now() }];
      saveChat(next);
      return next;
    });
  }, []);

  const clearChat = () => {
    setChat([]);
    saveChat([]);
  };

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const warm = () => {
      void window.speechSynthesis.getVoices();
    };
    warm();
    window.speechSynthesis.addEventListener('voiceschanged', warm);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', warm);
  }, []);

  // Re-arm wake if the browser already granted microphone (new tab / refresh)
  useEffect(() => {
    const perm = navigator.permissions;
    if (!perm?.query) return;
    void perm
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        if (status.state === 'granted') {
          sessionStorage.setItem(MIC_KEY, '1');
          setWakeArmed(true);
        }
        status.onchange = () => {
          if (status.state === 'granted') {
            sessionStorage.setItem(MIC_KEY, '1');
            setWakeArmed(true);
          }
        };
      })
      .catch(() => {
        /* Permissions API may reject microphone on some browsers */
      });
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, open, state]);

  const ensureMic = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((tr) => tr.stop());
      sessionStorage.setItem(MIC_KEY, '1');
      setWakeArmed(true);
      return true;
    } catch {
      setError(t('sabaVoice.micNeeded'));
      return false;
    }
  }, [t]);

  const resetTurn = useCallback(() => {
    setState('IDLE');
    setPreview(null);
    setError(null);
    busyRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const activateFromWake = useCallback(() => {
    if (activatingRef.current || openRef.current) return;
    activatingRef.current = true;
    setOpen(true);
    const hello = localGreeting(i18n.language, user?.name);
    const suggestions = localSuggestions(i18n.language);
    const tip =
      i18n.language.startsWith('bn')
        ? `\n\nআপনি জিজ্ঞাসা করতে পারেন: ${suggestions.join(' · ')}।`
        : i18n.language.startsWith('hi')
          ? `\n\nआप पूछ सकते हैं: ${suggestions.join(' · ')}।`
          : `\n\nYou can ask: ${suggestions.join(' · ')}.`;
    pushChat({ kind: 'assistant', text: `${hello}${tip}`, name: 'Saba', suggestions });
    speak(`${hello}${tip}`, i18n.language);
    setState('FEEDBACK');
    window.setTimeout(() => {
      activatingRef.current = false;
    }, 800);
  }, [i18n.language, pushChat, user?.name]);

  const ask = useCallback(
    async (text: string) => {
      const cleaned = normalizeClientText(text);
      if (!cleaned || busyRef.current) return;
      busyRef.current = true;
      setOpen(true);
      setState('PARSING');
      setError(null);
      setPreview(null);
      pushChat({
        kind: 'user',
        text: cleaned,
        name: user?.name,
        role: user?.role,
      });

      if (WAKE_RE.test(cleaned) && cleaned.replace(WAKE_RE, '').trim().length < 2) {
        const hello = localGreeting(i18n.language, user?.name);
        const suggestions = localSuggestions(i18n.language);
        const tip =
          i18n.language.startsWith('bn')
            ? `\n\nআপনি জিজ্ঞাসা করতে পারেন: ${suggestions.join(' · ')}।`
            : `\n\nYou can ask: ${suggestions.join(' · ')}.`;
        pushChat({ kind: 'assistant', text: `${hello}${tip}`, name: 'Saba', suggestions });
        speak(`${hello}${tip}`, i18n.language);
        setState('FEEDBACK');
        busyRef.current = false;
        return;
      }

      try {
        const res = await api.post('/voice-agent/parse', { text: cleaned, lang: i18n.language });
        const data = res.data.data as Preview;
        setPreview(data);
        pushChat({
          kind: 'assistant',
          text: data.summary,
          name: 'Saba',
          suggestions: data.suggestions,
        });
        speak(data.summary, i18n.language);
        if (data.needsConfirmation) {
          setState('AWAITING_CONFIRMATION');
        } else {
          setState('FEEDBACK');
          setPreview(null);
        }
      } catch (err) {
        const msg = apiErrorMessage(err);
        setError(msg);
        pushChat({ kind: 'system', text: msg });
        setState('IDLE');
      } finally {
        busyRef.current = false;
      }
    },
    [i18n.language, pushChat, user?.name, user?.role],
  );

  const startListen = async () => {
    setError(null);
    const ok = await ensureMic();
    if (!ok) return;
    try {
      wakeRef.current?.stop();
    } catch {
      /* ignore */
    }
    const rec = getRecognition();
    if (!rec) {
      setError(t('sabaVoice.noSpeechApi'));
      return;
    }
    rec.lang = speechLocale(i18n.language);
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const text = ev.results[0]?.[0]?.transcript?.trim() ?? '';
      if (text) void ask(text);
    };
    rec.onerror = () => {
      setState('IDLE');
      setError(t('sabaVoice.listenFailed'));
    };
    rec.onend = () => {
      setState((s) => (s === 'LISTENING' ? 'IDLE' : s));
    };
    recRef.current = rec;
    setState('LISTENING');
    try {
      rec.start();
    } catch {
      setState('IDLE');
      setError(t('sabaVoice.listenFailed'));
    }
  };

  const confirm = async () => {
    if (!preview) return;
    setState('EXECUTING');
    busyRef.current = true;
    try {
      const res = await api.post('/voice-agent/execute', {
        intent: preview.intent,
        confirmed: true,
      });
      const data = res.data.data as { answer?: string; navigateTo?: string };
      const msg = data.answer ?? t('sabaVoice.done');
      pushChat({ kind: 'assistant', text: msg, name: 'Saba' });
      setState('FEEDBACK');
      setPreview(null);
      speak(msg, i18n.language);
      if (data.navigateTo) {
        setTimeout(() => navigate(data.navigateTo!), 900);
      }
    } catch (err) {
      const msg = apiErrorMessage(err);
      setError(msg);
      pushChat({ kind: 'system', text: msg });
      setState('AWAITING_CONFIRMATION');
    } finally {
      busyRef.current = false;
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void ask(text);
  };

  // Continuous wake-word listener while board is closed
  useEffect(() => {
    if (!wakeOn || open || !wakeArmed) {
      setWakeListening(false);
      try {
        wakeRef.current?.abort?.();
        wakeRef.current?.stop();
      } catch {
        /* ignore */
      }
      return;
    }

    let stopped = false;
    let restartTimer: number | undefined;

    const loop = () => {
      if (stopped || openRef.current) return;
      const rec = getRecognition();
      if (!rec) return;
      // English ASR hears "Hey Saba" more reliably as the wake phrase
      rec.lang = 'en-IN';
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (ev) => {
        let chunk = '';
        for (let i = 0; i < ev.results.length; i++) {
          chunk += ev.results[i]?.[0]?.transcript ?? '';
        }
        if (WAKE_RE.test(chunk) && !openRef.current) {
          try {
            rec.stop();
          } catch {
            /* ignore */
          }
          activateFromWake();
        }
      };
      rec.onerror = (ev) => {
        if (stopped) return;
        const err = ev?.error ?? '';
        // not-allowed needs user gesture again
        if (err === 'not-allowed') {
          setWakeArmed(false);
          sessionStorage.removeItem(MIC_KEY);
          setWakeListening(false);
          return;
        }
        const delay = err === 'no-speech' ? 250 : 900;
        restartTimer = window.setTimeout(loop, delay);
      };
      rec.onend = () => {
        if (stopped || openRef.current) return;
        restartTimer = window.setTimeout(loop, 280);
      };
      wakeRef.current = rec;
      try {
        rec.start();
        setWakeListening(true);
      } catch {
        setWakeListening(false);
        restartTimer = window.setTimeout(loop, 1200);
      }
    };

    loop();
    return () => {
      stopped = true;
      setWakeListening(false);
      if (restartTimer) window.clearTimeout(restartTimer);
      try {
        wakeRef.current?.abort?.();
        wakeRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, [wakeOn, open, wakeArmed, activateFromWake]);

  useEffect(
    () => () => {
      try {
        recRef.current?.stop();
        wakeRef.current?.stop();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const roleLabel = (role?: string) => {
    if (!role) return '';
    return t(`roles.${role}`, { defaultValue: role });
  };

  const openBoard = async () => {
    const ok = await ensureMic();
    setOpen(true);
    if (chat.length === 0) {
      const hello = localGreeting(i18n.language, user?.name);
      const suggestions = localSuggestions(i18n.language);
      const tip = i18n.language.startsWith('bn')
        ? `\n\nআপনি জিজ্ঞাসা করতে পারেন: ${suggestions.join(' · ')}।`
        : `\n\nYou can ask: ${suggestions.join(' · ')}.`;
      pushChat({ kind: 'assistant', text: `${hello}${tip}`, name: 'Saba', suggestions });
    }
    if (!ok) return;
  };

  return (
    <>
      {!open && (
        <>
          {wakeOn && (
            <div className="fixed bottom-[5.75rem] right-[5.75rem] z-40 max-w-[11rem] rounded-xl bg-emerald-900/90 px-2.5 py-1.5 text-[10px] font-medium text-emerald-50 shadow-lg ring-1 ring-white/20">
              {wakeArmed
                ? wakeListening
                  ? t('sabaVoice.wakeListening')
                  : t('sabaVoice.wakeStarting')
                : t('sabaVoice.wakeTapMic')}
            </div>
          )}
          <button
            type="button"
            className={`${FAB_VOICE} flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-2 ring-white/80 hover:bg-emerald-700`}
            aria-label={t('sabaVoice.open')}
            onClick={() => void openBoard()}
          >
            <Mic className="h-6 w-6" aria-hidden />
          </button>
        </>
      )}

      {open && (
        <div className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-end">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-slate-950/55 via-slate-950/20 to-transparent" />

          <div className="pointer-events-auto relative mx-auto mb-[5.25rem] flex w-full max-w-md flex-col px-3 sm:ml-auto sm:mr-6 sm:max-w-sm">
            <div className="overflow-hidden rounded-2xl border border-white/20 bg-slate-950/50 shadow-2xl backdrop-blur-md ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{t('sabaVoice.boardTitle')}</p>
                  <p className="truncate text-[11px] text-white/70">
                    {user?.nursery?.name ? `${user.nursery.name} · ` : ''}
                    {user?.name ?? '—'}
                    {user?.role ? ` · ${roleLabel(user.role)}` : ''}
                    {' · '}
                    {t(`sabaVoice.state.${state}`)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <label className="mr-1 flex items-center gap-1 text-[10px] text-white/70">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={wakeOn}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setWakeOn(on);
                        try {
                          localStorage.setItem(WAKE_KEY, on ? '1' : '0');
                        } catch {
                          /* ignore */
                        }
                        if (on) void ensureMic();
                      }}
                    />
                    {t('sabaVoice.wakeToggle')}
                  </label>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/80 hover:bg-white/10"
                    aria-label={t('sabaVoice.clearChat')}
                    onClick={clearChat}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/80 hover:bg-white/10"
                    aria-label={t('common.close')}
                    onClick={() => {
                      resetTurn();
                      setOpen(false);
                    }}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div
                ref={listRef}
                className="flex max-h-[40vh] min-h-[12rem] flex-col gap-2 overflow-y-auto px-3 py-3"
                role="log"
                aria-live="polite"
              >
                {chat.length === 0 && (
                  <p className="rounded-xl bg-white/10 px-3 py-2 text-center text-xs text-white/80">
                    {t('sabaVoice.emptyChat')}
                  </p>
                )}
                {chat.map((msg) => {
                  const mine = msg.kind === 'user';
                  const system = msg.kind === 'system';
                  return (
                    <div
                      key={msg.id}
                      className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        system
                          ? 'self-center bg-rose-500/80 text-white'
                          : mine
                            ? 'self-end bg-emerald-500/90 text-white'
                            : 'self-start bg-white/90 text-slate-900'
                      }`}
                    >
                      {!system && (
                        <p
                          className={`mb-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            mine ? 'text-emerald-100' : 'text-slate-500'
                          }`}
                        >
                          {msg.name ?? (mine ? user?.name : 'Saba')}
                          {msg.role ? ` · ${roleLabel(msg.role)}` : ''}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap leading-snug">{msg.text}</p>
                      {msg.kind === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {msg.suggestions.map((s) => (
                            <button
                              key={s}
                              type="button"
                              className="rounded-lg bg-emerald-600/15 px-2 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-600/25 hover:bg-emerald-600/25"
                              onClick={() => void ask(s)}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className={`mt-1 text-[10px] ${mine || system ? 'text-white/70' : 'text-slate-400'}`}>
                        {new Date(msg.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  );
                })}
              </div>

              {error && <p className="px-3 pb-1 text-xs text-rose-200">{error}</p>}

              <form onSubmit={onSubmit} className="flex gap-2 border-t border-white/10 bg-black/25 px-3 py-2">
                <input
                  className="min-h-11 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/50 outline-none focus:border-emerald-400"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t('sabaVoice.typePlaceholder')}
                  disabled={state === 'PARSING' || state === 'EXECUTING'}
                />
                <button
                  type="submit"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
                  disabled={!draft.trim() || state === 'PARSING'}
                  aria-label={t('sabaVoice.send')}
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>

              <div className="flex flex-wrap gap-2 border-t border-white/10 bg-black/20 px-3 py-2.5">
                {state !== 'LISTENING' &&
                  state !== 'PARSING' &&
                  state !== 'EXECUTING' &&
                  state !== 'AWAITING_CONFIRMATION' && (
                    <button
                      type="button"
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 text-sm font-semibold text-white hover:bg-emerald-600"
                      onClick={() => void startListen()}
                    >
                      <Mic className="h-5 w-5" />
                      {t('sabaVoice.speak')}
                    </button>
                  )}
                {state === 'LISTENING' && (
                  <button
                    type="button"
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white/15 px-3 text-sm font-semibold text-white"
                    onClick={() => recRef.current?.stop()}
                  >
                    <MicOff className="h-5 w-5" />
                    {t('sabaVoice.stop')}
                  </button>
                )}
                {(state === 'PARSING' || state === 'EXECUTING') && (
                  <div className="flex min-h-11 flex-1 items-center justify-center gap-2 text-sm text-white/80">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {t('common.loading')}
                  </div>
                )}
                {state === 'AWAITING_CONFIRMATION' && (
                  <>
                    <button
                      type="button"
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-500 px-3 text-sm font-semibold text-white"
                      onClick={() => void confirm()}
                    >
                      {t('sabaVoice.confirm')}
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-white/15 px-3 text-sm font-semibold text-white"
                      onClick={resetTurn}
                    >
                      {t('sabaVoice.cancel')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`${FAB_VOICE} flex h-14 w-14 items-center justify-center rounded-full ${
              state === 'LISTENING' ? 'bg-rose-600 animate-pulse' : 'bg-emerald-600'
            } text-white shadow-lg ring-2 ring-white`}
            aria-label={state === 'LISTENING' ? t('sabaVoice.stop') : t('sabaVoice.speak')}
            onClick={() => {
              if (state === 'LISTENING') recRef.current?.stop();
              else void startListen();
            }}
          >
            {state === 'LISTENING' ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>
        </div>
      )}
    </>
  );
}
