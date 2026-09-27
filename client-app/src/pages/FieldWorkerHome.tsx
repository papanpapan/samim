import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Check,
  Droplets,
  Leaf,
  QrCode,
  ShoppingCart,
  Sprout,
  User,
  type LucideIcon,
} from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { InventoryScanner } from '../components/inventory/InventoryScanner';
import { ErrorNote } from '../components/ui';
import { useSoloMode } from '../hooks/useSoloMode';
import type { PlantInventory } from '../types';
import { formatMoney } from '../utils/money';

interface CareTask {
  id: string;
  taskType: string;
  status: string;
  scheduledOn: string;
  plant: { sku: string; commonName: string; zoneLabel?: string | null };
}

interface MotherRow {
  id: string;
  tagNumber: string;
  plantName?: string;
  varietyName?: string;
  variety?: string;
}

type CartLine = { plant: PlantInventory; quantity: number };

/** Field Hub “today”: due today or overdue — not future PENDING rows. */
function isCareDueToday(scheduledOn: string): boolean {
  const due = new Date(scheduledOn);
  if (Number.isNaN(due.getTime())) return true;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return due.getTime() <= endOfToday.getTime();
}

function openCareForToday(tasks: CareTask[]): CareTask[] {
  return tasks.filter((task) => task.status !== 'DONE' && isCareDueToday(task.scheduledOn));
}

function JobButton({
  step,
  icon: Icon,
  title,
  help,
  cta,
  badge,
  accent,
  onClick,
}: {
  step: string;
  icon: LucideIcon;
  title: string;
  help: string;
  cta: string;
  badge?: string | null;
  accent: 'sky' | 'forest' | 'amber';
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const tone = {
    sky: {
      shell: 'border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-white hover:border-sky-300',
      icon: 'bg-sky-100 text-sky-800 ring-sky-200/70',
      badge: 'bg-sky-600 text-white',
    },
    forest: {
      shell: 'border-forest-200/70 bg-gradient-to-br from-forest-50 via-white to-white hover:border-forest-400',
      icon: 'bg-forest-100 text-forest-800 ring-forest-200/70',
      badge: 'bg-forest-700 text-white',
    },
    amber: {
      shell: 'border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-white hover:border-amber-300',
      icon: 'bg-amber-100 text-amber-800 ring-amber-200/70',
      badge: 'bg-amber-600 text-white',
    },
  }[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`card group flex h-full min-h-[12rem] w-full flex-col justify-between gap-5 overflow-hidden p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-forest-600 focus:ring-offset-1 sm:p-6 ${tone.shell}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${tone.icon}`}>
            <Icon className="h-5 w-5" aria-hidden />
            {badge ? (
              <span
                className={`absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums shadow-sm ${tone.badge}`}
              >
                {badge}
              </span>
            ) : null}
          </span>
          <div className="min-w-0">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {t('fieldHub.jobStep', { step })}
            </span>
            <span className="block text-lg font-bold tracking-tight text-slate-800">{title}</span>
            <span className="mt-1 block text-sm leading-snug text-slate-500">{help}</span>
          </div>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 self-start rounded-xl bg-forest-700 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition group-hover:bg-forest-800">
        {cta}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </button>
  );
}

/**
 * Zero-training Field Hub — same SN-ERMS card / forest theme as Today dashboard.
 */
export function FieldWorkerHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { solo, toggleSolo } = useSoloMode();
  const [panel, setPanel] = useState<'home' | 'care' | 'scion' | 'sale'>('home');
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [mothers, setMothers] = useState<MotherRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scionForm, setScionForm] = useState({ motherId: '', quantity: '10', scan: '' });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [scan, setScan] = useState('');
  const [payment, setPayment] = useState<'CASH' | 'UPI_PHONEPE_GPAY'>('CASH');
  const [scanOpen, setScanOpen] = useState(false);
  const [pendingCare, setPendingCare] = useState<number | null>(null);

  const currency = user?.nursery?.currencyCode;
  const money = (n: number) => formatMoney(n, currency);

  const loadCare = () => {
    api
      .get('/care')
      .then((res) => {
        const rows = openCareForToday(res.data.data.tasks as CareTask[]);
        setTasks(rows);
        setPendingCare(rows.length);
      })
      .catch((err) => setError(apiErrorMessage(err)));
  };

  const loadMothers = () => {
    api
      .get('/mother-plants')
      .then((res) => {
        const rows = ((res.data.data as MotherRow[]) ?? []).map((m) => ({
          ...m,
          plantName: m.plantName || m.varietyName || m.variety || m.tagNumber,
        }));
        setMothers(rows);
        setScionForm((f) => ({ ...f, motherId: f.motherId || rows[0]?.id || '' }));
      })
      .catch((err) => setError(apiErrorMessage(err)));
  };

  useEffect(() => {
    setError(null);
    setNote(null);
    if (panel === 'care') loadCare();
    if (panel === 'scion') loadMothers();
  }, [panel]);

  useEffect(() => {
    if (panel !== 'home') return;
    api
      .get('/care')
      .then((res) => {
        const rows = openCareForToday(res.data.data.tasks as CareTask[]);
        setPendingCare(rows.length);
      })
      .catch(() => setPendingCare(null));
  }, [panel]);

  const careByBed = useMemo(() => {
    const map = new Map<string, CareTask[]>();
    for (const task of tasks) {
      const bed = task.plant.zoneLabel?.trim() || t('fieldHub.bedFloor');
      const list = map.get(bed) ?? [];
      list.push(task);
      map.set(bed, list);
    }
    return [...map.entries()];
  }, [tasks, t]);

  const cartTotal = cart.reduce((sum, line) => sum + Number(line.plant.retailPrice) * line.quantity, 0);

  const completeTask = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/care/${id}/complete`, {});
      loadCare();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitScion = async (e: FormEvent) => {
    e.preventDefault();
    if (!scionForm.motherId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/mother-plants/${scionForm.motherId}/scions`, {
        quantity: Number(scionForm.quantity) || 1,
      });
      setScionForm((f) => ({ ...f, quantity: '10', scan: '' }));
      setNote(t('fieldHub.scionSaved'));
      setPanel('home');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resolveMotherFromScan = (code: string) => {
    const token = code.trim().toLowerCase();
    const hit = mothers.find((m) => m.tagNumber.toLowerCase() === token || m.id === code.trim());
    if (hit) setScionForm((f) => ({ ...f, motherId: hit.id, scan: code }));
    else if (code.trim()) setError(t('fieldHub.motherNotFound'));
  };

  const addPlant = (plant: PlantInventory) => {
    setCart((prev) => {
      const existing = prev.find((line) => line.plant.id === plant.id);
      if (existing) {
        return prev.map((line) =>
          line.plant.id === plant.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...prev, { plant, quantity: 1 }];
    });
    setScanOpen(false);
    setScan('');
  };

  const addBySku = async (e: FormEvent) => {
    e.preventDefault();
    const sku = scan.trim();
    if (!sku) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.get(`/inventory/scan/${encodeURIComponent(sku)}`);
      addPlant(res.data.data as PlantInventory);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const paid = cartTotal;
      await api.post('/sales', {
        channel: 'RETAIL_COUNTER',
        paymentMode: payment,
        customerName: t('pos.walkIn'),
        taxPct: 0,
        items: cart.map((line) => ({ plantId: line.plant.id, quantity: line.quantity })),
      });
      setCart([]);
      setNote(t('fieldHub.saleDone', { total: money(paid) }));
      setPanel('home');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const shell = (title: string, subtitle: string, body: ReactNode) => (
    <div className="w-full">
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-forest-200/70 bg-gradient-to-br from-forest-800 via-forest-700 to-forest-600 px-5 py-6 text-white shadow-md sm:px-7 sm:py-7">
        <div
          className="pointer-events-none absolute -right-8 top-0 h-40 w-40 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <Leaf
          className="pointer-events-none absolute right-5 top-5 h-16 w-16 rotate-12 text-white/15 sm:right-8 sm:top-6 sm:h-20 sm:w-20"
          aria-hidden
        />
        <div className="relative">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
            {t('fieldHub.kicker')}
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-50/90 sm:text-base">{subtitle}</p>
        </div>
      </section>
      <ErrorNote message={error} />
      <button type="button" className="btn-ghost mb-4 min-h-12" onClick={() => setPanel('home')}>
        {t('common.back')}
      </button>
      {body}
    </div>
  );

  if (panel === 'care') {
    return shell(
      t('fieldHub.careTitle'),
      t('fieldHub.careHelp'),
      <div className="space-y-5">
        {careByBed.length === 0 && (
          <p className="card p-4 text-sm text-slate-500">{t('fieldHub.careEmpty')}</p>
        )}
        {careByBed.map(([bed, rows]) => (
          <section key={bed}>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {t('fieldHub.bedLabel', { bed })}
            </h2>
            <ul className="space-y-3">
              {rows.map((task) => (
                <li key={task.id} className="card flex items-center gap-3 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                    <Droplets className="h-6 w-6" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">{task.plant.commonName}</p>
                    <p className="text-xs text-slate-500">
                      {t(`care.taskTypes.${task.taskType}`, { defaultValue: task.taskType })} · {task.plant.sku}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex min-h-14 min-w-14 items-center justify-center rounded-xl bg-forest-700 text-white hover:bg-forest-800 disabled:opacity-50"
                    aria-label={t('fieldHub.markDone')}
                    onClick={() => void completeTask(task.id)}
                  >
                    <Check className="h-7 w-7" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>,
    );
  }

  if (panel === 'scion') {
    return shell(
      t('fieldHub.scionTitle'),
      t('fieldHub.scionHelp'),
      <form onSubmit={submitScion} className="card space-y-4 p-5">
        <label className="block text-sm font-semibold text-slate-700">
          {t('fieldHub.scanTag')}
          <div className="mt-1 flex gap-2">
            <input
              className="input min-h-14 flex-1"
              value={scionForm.scan}
              onChange={(e) => setScionForm({ ...scionForm, scan: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  resolveMotherFromScan(scionForm.scan);
                }
              }}
              placeholder={t('fieldHub.scanPlaceholder')}
            />
            <button
              type="button"
              className="btn-ghost inline-flex min-h-14 min-w-14 items-center justify-center"
              aria-label={t('fieldHub.openCamera')}
              onClick={() => resolveMotherFromScan(scionForm.scan)}
            >
              <QrCode className="h-6 w-6 text-forest-800" />
            </button>
          </div>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          {t('fieldHub.mother')}
          <select
            className="input mt-1 min-h-14"
            value={scionForm.motherId}
            onChange={(e) => setScionForm({ ...scionForm, motherId: e.target.value })}
            required
          >
            {mothers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.tagNumber} · {m.plantName}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          {t('fieldHub.count')}
          <input
            className="input mt-1 min-h-14"
            type="number"
            min={1}
            value={scionForm.quantity}
            onChange={(e) => setScionForm({ ...scionForm, quantity: e.target.value })}
            required
          />
        </label>
        <button type="submit" disabled={busy} className="btn-primary min-h-14 w-full text-base">
          {t('fieldHub.logScion')}
        </button>
      </form>,
    );
  }

  if (panel === 'sale') {
    return shell(
      t('fieldHub.saleTitle'),
      t('fieldHub.saleHelp'),
      <>
        <form onSubmit={addBySku} className="mb-4 flex flex-wrap gap-2">
          <input
            className="input min-h-14 min-w-0 flex-1"
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            placeholder={t('pos.scanPlaceholder')}
            autoFocus
          />
          <button type="submit" className="btn-primary min-h-14 px-4" disabled={busy}>
            {t('pos.add')}
          </button>
          <button
            type="button"
            className="btn-ghost inline-flex min-h-14 min-w-14 items-center justify-center"
            onClick={() => setScanOpen(true)}
            aria-label={t('inventory.scan')}
          >
            <QrCode className="h-6 w-6 text-forest-800" />
          </button>
        </form>

        <ul className="mb-4 space-y-2">
          {cart.length === 0 && <li className="card p-4 text-sm text-slate-500">{t('pos.empty')}</li>}
          {cart.map((line) => (
            <li key={line.plant.id} className="card flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{line.plant.commonName}</p>
                <p className="text-xs text-slate-500">
                  {line.plant.sku} · {money(Number(line.plant.retailPrice))} × {line.quantity}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost !min-h-11 !px-3 !text-xs"
                onClick={() => setCart((prev) => prev.filter((row) => row.plant.id !== line.plant.id))}
              >
                {t('pos.remove')}
              </button>
            </li>
          ))}
        </ul>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            className={`min-h-14 rounded-xl text-sm font-semibold ring-1 transition ${
              payment === 'CASH'
                ? 'bg-forest-700 text-white ring-forest-700'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => setPayment('CASH')}
          >
            {t('pos.payments.CASH')}
          </button>
          <button
            type="button"
            className={`min-h-14 rounded-xl text-sm font-semibold ring-1 transition ${
              payment === 'UPI_PHONEPE_GPAY'
                ? 'bg-forest-700 text-white ring-forest-700'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => setPayment('UPI_PHONEPE_GPAY')}
          >
            {t('pos.payments.UPI_PHONEPE_GPAY')}
          </button>
        </div>

        <div className="card mb-3 flex justify-between p-4 text-base font-bold text-nursery-900">
          <span>{t('pos.net')}</span>
          <span>{money(cartTotal)}</span>
        </div>
        <button
          type="button"
          disabled={busy || cart.length === 0}
          className="btn-primary min-h-14 w-full text-base"
          onClick={() => void checkout()}
        >
          {t('fieldHub.settleNow')}
        </button>
        {scanOpen && <InventoryScanner onClose={() => setScanOpen(false)} onAdd={addPlant} />}
      </>,
    );
  }

  return (
    <div className="w-full">
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-forest-200/70 bg-gradient-to-br from-forest-800 via-forest-700 to-forest-600 px-5 py-6 text-white shadow-md sm:px-7 sm:py-7">
        <div
          className="pointer-events-none absolute -right-8 top-0 h-40 w-40 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-10 left-1/3 h-36 w-36 rounded-full bg-emerald-300/20 blur-3xl"
          aria-hidden
        />
        <Leaf
          className="pointer-events-none absolute right-5 top-5 h-16 w-16 rotate-12 text-white/15 sm:right-8 sm:top-6 sm:h-20 sm:w-20"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
              {t('fieldHub.kicker')}
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('fieldHub.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-50/90 sm:text-base">
              {t('fieldHub.subtitle', { name: user?.name ?? '' })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3.5 text-sm font-semibold backdrop-blur-sm">
              <Droplets className="h-4 w-4 text-emerald-100" aria-hidden />
              {t('fieldHub.careStat', { count: pendingCare ?? 0 })}
            </span>
            <span className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3.5 text-sm font-semibold backdrop-blur-sm">
              <User className="h-4 w-4 text-emerald-100" aria-hidden />
              {solo ? t('fieldHub.soloOn') : t('fieldHub.soloOff')}
            </span>
            {user?.nursery?.name ? (
              <span className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3.5 text-sm font-semibold backdrop-blur-sm">
                <Leaf className="h-4 w-4 text-emerald-100" aria-hidden />
                {user.nursery.name}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <ErrorNote message={error} />
      {note && (
        <p className="mb-5 rounded-xl bg-forest-50 px-4 py-3 text-sm font-medium text-forest-800 ring-1 ring-forest-200">
          {note}
        </p>
      )}

      <section className="card mb-5 overflow-hidden border-forest-200/70 bg-gradient-to-br from-forest-50 via-white to-white p-5 shadow-sm">
        <label className="flex cursor-pointer items-start justify-between gap-3">
          <span className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 ring-1 ring-amber-200/70">
              <User className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-base font-bold text-slate-800">{t('fieldHub.soloMode')}</span>
              <span id="solo-help" className="mt-0.5 block text-sm text-slate-500">
                {t('fieldHub.soloHelp')}
              </span>
            </span>
          </span>
          <input
            type="checkbox"
            className="mt-1 h-6 w-6 shrink-0 accent-forest-700"
            checked={solo}
            onChange={toggleSolo}
            aria-describedby="solo-help"
          />
        </label>
      </section>

      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800">{t('fieldHub.jobsHeading')}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{t('fieldHub.jobsHint')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <JobButton
          step="1"
          icon={Droplets}
          title={t('fieldHub.careBtn')}
          help={t('fieldHub.careBtnHelp')}
          cta={t('fieldHub.openCare')}
          badge={pendingCare != null && pendingCare > 0 ? String(pendingCare) : null}
          accent="sky"
          onClick={() => setPanel('care')}
        />
        <JobButton
          step="2"
          icon={Sprout}
          title={t('fieldHub.scionBtn')}
          help={t('fieldHub.scionBtnHelp')}
          cta={t('fieldHub.openScion')}
          accent="forest"
          onClick={() => setPanel('scion')}
        />
        <JobButton
          step="3"
          icon={ShoppingCart}
          title={t('fieldHub.saleBtn')}
          help={t('fieldHub.saleBtnHelp')}
          cta={t('fieldHub.openSale')}
          accent="amber"
          onClick={() => setPanel('sale')}
        />
      </div>

      <section className="card mt-5 overflow-hidden border-slate-200 bg-gradient-to-br from-slate-50 via-white to-forest-50/50 p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-100 text-forest-800 ring-1 ring-forest-200/70">
            <Sprout className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-800">{t('fieldHub.moreHeading')}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{t('fieldHub.moreHint')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            to="/propagation"
            className="group flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-forest-300 hover:shadow-md"
          >
            <span>{t('fieldHub.markReadyLink')}</span>
            <ArrowRight className="h-4 w-4 text-forest-700 transition group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <Link
            to="/"
            className="group flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-forest-200 bg-forest-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-800 hover:shadow-md"
          >
            <span>{t('fieldHub.fullDesk')}</span>
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
