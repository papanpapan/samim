import { ReactNode } from 'react';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-nursery-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-nursery-300 border-t-nursery-700" />
      {label && <span className="text-sm">{label}</span>}
    </div>
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
        <h1 className="text-2xl font-bold text-nursery-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-nursery-600">{subtitle}</p>}
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
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: 'nursery' | 'amber' | 'sky' | 'rose';
}) {
  const ring: Record<string, string> = {
    nursery: 'from-nursery-500 to-nursery-700',
    amber: 'from-amber-400 to-amber-600',
    sky: 'from-sky-400 to-sky-600',
    rose: 'from-rose-400 to-rose-600',
  };
  return (
    <div className="card overflow-hidden p-5">
      <div className={`mb-3 h-1 w-10 rounded-full bg-gradient-to-r ${ring[accent]}`} />
      <div className="text-xs font-semibold uppercase tracking-wide text-nursery-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-nursery-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-nursery-500">{hint}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-nursery-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`card relative z-10 w-full ${width} max-h-[90vh] overflow-y-auto p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-nursery-900">{title}</h2>
          <button onClick={onClose} className="text-nursery-400 hover:text-nursery-700" aria-label="Close">
            ✕
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
  READY_FOR_SALE: 'bg-nursery-100 text-nursery-800',
  CLOSED: 'bg-nursery-950/10 text-nursery-900',
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span className={`badge ${STAGE_STYLES[stage] ?? 'bg-slate-100 text-slate-700'}`}>
      {stage.replace(/_/g, ' ')}
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

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
