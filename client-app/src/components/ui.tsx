import { ReactNode, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AudioAssistTrigger } from './AudioAssistTrigger';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-nursery-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-forest-700" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function ListSkeleton({ rows = 5, framed = true }: { rows?: number; framed?: boolean }) {
  const { t } = useTranslation();
  const body = (
    <ul className="divide-y divide-slate-100" role="status" aria-label={t('common.loading')}>
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center gap-4 px-4 py-4">
          <div className="skeleton h-12 w-12 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-4 w-40 max-w-[70%] rounded" />
            <div className="skeleton h-3 w-64 max-w-[90%] rounded" />
          </div>
          <div className="skeleton hidden h-8 w-20 rounded-lg sm:block" />
        </li>
      ))}
    </ul>
  );
  return framed ? <div className="card overflow-hidden">{body}</div> : body;
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="status" aria-label={t('common.loading')}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card space-y-3 p-5">
          <div className="skeleton h-1 w-10 rounded-full" />
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-8 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

export function RecordItem({
  letter,
  title,
  subtitle,
  extra,
  tags,
  actions,
}: {
  letter: string;
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  tags?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 transition hover:bg-[#f6f8f6] sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-lg font-semibold text-forest-800 ring-1 ring-slate-200">
          {letter}
        </span>
        <div className="min-w-0">
          <div className="font-['Cormorant_Garamond',Georgia,serif] text-[1.65rem] font-semibold leading-none text-slate-900">{title}</div>
          {subtitle && <p className="mt-1 truncate text-sm text-slate-500">{subtitle}</p>}
          {extra}
          {tags && <div className="mt-2 flex flex-wrap items-center gap-1.5">{tags}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
    </li>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = 'nursery',
  icon,
  speak,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: 'nursery' | 'amber' | 'sky' | 'rose';
  icon?: ReactNode;
  speak?: string;
}) {
  const ring: Record<string, string> = {
    nursery: 'from-forest-600 to-forest-700',
    amber: 'from-amber-400 to-amber-600',
    sky: 'from-sky-400 to-sky-600',
    rose: 'from-rose-400 to-rose-600',
  };
  return (
    <div className="card overflow-hidden p-5" data-speak={speak}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className={`h-1 w-10 rounded-full bg-gradient-to-r ${ring[accent]}`} />
        <div className="flex items-center gap-2 text-slate-500">
          {icon}
          {speak ? <AudioAssistTrigger textKey="common.hear" voiceText={speak} /> : null}
        </div>
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-800">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
  stack = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
  /** Second layer over an already-open modal (e.g. Add staff on People). */
  stack?: boolean;
}) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className={`fixed inset-0 flex items-center justify-center p-4 ${stack ? 'z-[60]' : 'z-50'}`}>
      <div className={`absolute inset-0 backdrop-blur-sm ${stack ? 'bg-nursery-950/50' : 'bg-nursery-950/40'}`} onClick={onClose} />
      <div className={`card relative z-10 w-full ${width} max-h-[90vh] overflow-y-auto p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-nursery-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost min-h-12 min-w-12 px-3" aria-label={t('common.close')}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const STAGE_STYLES: Record<string, string> = {
  INITIATED: 'bg-slate-100 text-slate-700',
  MIST_CHAMBER: 'bg-sky-100 text-sky-700',
  HARDENING_SHADE: 'bg-amber-100 text-amber-700',
  READY_FOR_SALE: 'bg-forest-50 text-forest-800',
  CLOSED: 'bg-nursery-950/10 text-nursery-900',
};

export function StageBadge({ stage }: { stage: string }) {
  const { t } = useTranslation();
  return (
    <span className={`badge ${STAGE_STYLES[stage] ?? 'bg-slate-100 text-slate-700'}`}>
      {t(`stages.${stage}`, { defaultValue: stage.replace(/_/g, ' ') })}
    </span>
  );
}

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {message}
    </div>
  );
}

export function FieldHint({ why, example }: { why?: string; example?: string }) {
  const { t } = useTranslation();
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  if (!why) return null;
  const spoken = [why.replace(/\.+\s*$/, ''), example ? `${t('platform.example')}: ${example}` : ''].filter(Boolean).join('. ');

  const showTip = (target: HTMLElement) => {
    window.clearTimeout(hideTimer.current);
    const box = target.getBoundingClientRect();
    setTip({ x: box.left, y: box.bottom + 6 });
  };
  const hideTip = () => {
    hideTimer.current = window.setTimeout(() => setTip(null), 160);
  };

  return (
    <>
      <span className="inline-flex" onMouseEnter={(event) => showTip(event.currentTarget)} onMouseLeave={hideTip}>
        <span className="inline-flex h-5 w-5 items-center justify-center text-slate-400" aria-label={t('platform.why')}>
          <Info className="h-3.5 w-3.5" aria-hidden />
        </span>
      </span>
      {tip && (
        <div
          role="tooltip"
          className="fixed z-[70] w-64 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-white shadow-lg"
          style={{ left: tip.x, top: tip.y }}
          onMouseEnter={() => window.clearTimeout(hideTimer.current)}
          onMouseLeave={hideTip}
        >
          <p>{why}</p>
          {example && <p className="mt-1 text-slate-300">{t('platform.example')}: {example}</p>}
          <div className="mt-2">
            <AudioAssistTrigger textKey="platform.why" voiceText={spoken} compact className="!h-7 !w-7 !rounded-md !bg-white/10 !text-white !ring-white/20" />
          </div>
        </div>
      )}
    </>
  );
}

export function Field({
  label,
  speakKey,
  why,
  example,
  children,
}: {
  label: string;
  speakKey?: string;
  why?: string;
  example?: string;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1 flex items-center gap-1">
        <span className="label mb-0">{label}</span>
        <FieldHint why={why} example={example} />
        {!why && speakKey && <AudioAssistTrigger textKey={speakKey} />}
      </span>
      {children}
    </div>
  );
}
