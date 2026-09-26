import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Image as ImageIcon, Link2, Maximize2, Search, Video, X } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorNote, Field, ListSkeleton, Modal, PageHeader } from '../components/ui';

interface Zone {
  id: string;
  name: string;
  location: string;
  status: string;
}

interface AlertRow {
  id: string;
  caseNo: string;
  kind: string;
  severity: string;
  message: string;
  history: string | null;
  closeNotes: string | null;
  status: string;
  raisedAt: string;
  ackAt: string | null;
  closedAt: string | null;
  cameraId?: string | null;
  cameraName: string | null;
  detectKind: string | null;
  photoUrl: string | null;
  videoUrl: string | null;
  publicUrl: string | null;
  qrDataUrl: string | null;
  nurseryId?: string;
  nurseryName?: string | null;
  nurseryCode?: string | null;
  placeId?: string | null;
  placeName?: string | null;
  zone: { name: string; location: string } | null;
}

const KINDS = ['FIRE', 'INTRUSION', 'FLOOD', 'HEAT', 'DISEASE', 'OTHER'] as const;
const STATUSES = ['OPEN', 'ACKNOWLEDGED', 'CLOSED'] as const;
const SOUND_KEY = 'sn-alert-sound';
const PAGE_SIZE = 10;
const ease = 'duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]';

function beep() {
  const audio = new AudioContext();
  const tone = audio.createOscillator();
  const gain = audio.createGain();
  tone.frequency.value = 880;
  gain.gain.value = 0.05;
  tone.connect(gain);
  gain.connect(audio.destination);
  tone.start();
  tone.stop(audio.currentTime + 0.25);
  window.setTimeout(() => void audio.close(), 400);
}

async function shrinkPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1280;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.72));
    bitmap.close();
    if (!blob) return file;
    return new File([blob], 'alert.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function buildCloseHistory(item: AlertRow, t: (key: string, opts?: Record<string, string>) => string) {
  if (item.history?.trim()) return item.history;
  return [
    `${t('alerts.caseNo')}: ${item.caseNo}`,
    item.nurseryName ? `${t('alerts.nursery')}: ${item.nurseryName}` : null,
    `${t(`alerts.kinds.${item.kind}`)} · ${item.severity}`,
    item.cameraName ? `${t('alerts.camera')}: ${item.cameraName}` : null,
    item.placeName ? `${t('alerts.place')}: ${item.placeName}` : null,
    item.detectKind ? `${t('alerts.detect')}: ${item.detectKind}` : null,
    item.message,
    `${t('alerts.raised')}: ${new Date(item.raisedAt).toLocaleString()}`,
    item.ackAt ? `${t('alerts.acked')}: ${new Date(item.ackAt).toLocaleString()}` : null,
  ].filter(Boolean).join('\n');
}

function statusTone(status: string) {
  if (status === 'CLOSED') return 'bg-slate-100 text-slate-600';
  if (status === 'ACKNOWLEDGED') return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200';
  return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
}

export function Alerts() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isOwner = !!user?.isPlatformOwner;
  const [zones, setZones] = useState<Zone[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [filterNurseries, setFilterNurseries] = useState<{ id: string; name: string; code: string }[]>([]);
  const [filterPlaces, setFilterPlaces] = useState<{ id: string; name: string; nurseryId: string; nurseryName?: string; cameraIds?: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [zone, setZone] = useState({ name: '', location: '' });
  const [alert, setAlert] = useState({ zoneId: '', kind: 'FIRE', message: '' });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem(SOUND_KEY) === 'on');
  const [closing, setClosing] = useState<AlertRow | null>(null);
  const [closeForm, setCloseForm] = useState({ message: '', history: '', closeNotes: '' });
  const [closeBusy, setCloseBusy] = useState(false);
  const [stage, setStage] = useState<{ item: AlertRow; kind: 'photo' | 'video' } | null>(null);
  const [stageIn, setStageIn] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [nurseryFilter, setNurseryFilter] = useState('ALL');
  const [placeFilter, setPlaceFilter] = useState('ALL');
  const [kindFilter, setKindFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const known = useRef<Set<string> | null>(null);

  const notice = (rows: AlertRow[]) => {
    const ids = new Set(rows.map((row) => row.id));
    if (known.current && localStorage.getItem(SOUND_KEY) === 'on') {
      const fresh = rows.find((row) => row.status !== 'CLOSED' && !known.current?.has(row.id));
      if (fresh) {
        beep();
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(t('alerts.deskTitle'), {
            body: `${fresh.caseNo} · ${t(`alerts.kinds.${fresh.kind}`)} · ${fresh.message}`,
          });
        }
      }
    }
    known.current = ids;
  };

  const load = (quiet = false) => {
    if (!quiet) setLoading(true);
    const alertParams: Record<string, string | number> = { t: Date.now() };
    if (isOwner && nurseryFilter !== 'ALL') alertParams.nurseryId = nurseryFilter;
    if (placeFilter !== 'ALL') alertParams.placeId = placeFilter;
    Promise.all([
      api.get('/smart/zones', { params: { t: Date.now() } }),
      api.get('/smart/alerts', {
        params: alertParams,
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      }),
    ])
      .then(([z, a]) => {
        setZones(z.data.data);
        const rows = a.data.data as AlertRow[];
        notice(rows);
        setAlerts(rows);
        const filters = a.data.filters as {
          nurseries?: { id: string; name: string; code: string }[];
          places?: { id: string; name: string; nurseryId: string; nurseryName?: string; cameraIds?: string[] }[];
        } | undefined;
        setFilterNurseries(filters?.nurseries ?? []);
        setFilterPlaces(filters?.places ?? []);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 15000);
    return () => window.clearInterval(timer);
    // Nursery / place change must hit the API — server filters the rows.
  }, [nurseryFilter, placeFilter, isOwner]);

  const nurseryOptions = useMemo(() => {
    if (filterNurseries.length > 0) {
      return filterNurseries.map((row) => [row.id, row.name] as [string, string]);
    }
    const map = new Map<string, string>();
    for (const row of alerts) {
      if (row.nurseryId && row.nurseryName) map.set(row.nurseryId, row.nurseryName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [filterNurseries, alerts]);

  const placeOptions = useMemo(() => {
    const rows = filterPlaces.filter((place) => nurseryFilter === 'ALL' || place.nurseryId === nurseryFilter);
    return rows
      .map((place) => {
        const label = isOwner && nurseryFilter === 'ALL' && place.nurseryName
          ? `${place.nurseryName} · ${place.name}`
          : place.name;
        return [place.id, label] as [string, string];
      })
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [filterPlaces, nurseryFilter, isOwner]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    // Nursery + place already applied by the API; only search / kind / status here.
    const filtered = alerts.filter((row) => {
      if (kindFilter !== 'ALL' && row.kind !== kindFilter) return false;
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (!needle) return true;
      const hay = [
        row.caseNo,
        row.message,
        row.history,
        row.cameraName,
        row.detectKind,
        row.nurseryName,
        row.nurseryCode,
        row.placeName,
        row.zone?.name,
        row.kind,
        row.status,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'oldest') return a.raisedAt.localeCompare(b.raisedAt);
      if (sort === 'case') return a.caseNo.localeCompare(b.caseNo);
      if (sort === 'nursery') return (a.nurseryName ?? '').localeCompare(b.nurseryName ?? '') || b.raisedAt.localeCompare(a.raisedAt);
      if (sort === 'kind') return a.kind.localeCompare(b.kind) || b.raisedAt.localeCompare(a.raisedAt);
      return b.raisedAt.localeCompare(a.raisedAt);
    });
  }, [alerts, query, kindFilter, statusFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const openStage = (item: AlertRow, kind: 'photo' | 'video') => {
    setStage({ item, kind });
    setStageIn(false);
    window.requestAnimationFrame(() => setStageIn(true));
  };

  const closeStage = () => {
    setStageIn(false);
    window.setTimeout(() => setStage(null), 280);
  };

  const shareCase = async (item: AlertRow) => {
    const url = item.publicUrl || `${window.location.origin}/alert/${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.caseNo, text: item.message, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(item.id);
      window.setTimeout(() => setCopied((current) => (current === item.id ? null : current)), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(item.id);
        window.setTimeout(() => setCopied((current) => (current === item.id ? null : current)), 2000);
      } catch {
        setError(t('alerts.shareFail'));
      }
    }
  };

  const addZone = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await api.post('/smart/zones', zone);
      setZone({ name: '', location: '' });
      load(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    const small = await shrinkPhoto(file);
    setPhoto(small);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(small);
    });
  };

  const raise = async (event: FormEvent) => {
    event.preventDefault();
    if (!photo && alert.message.trim().length < 3) {
      setError(t('alerts.photoNeed'));
      return;
    }
    const form = new FormData();
    form.append('kind', alert.kind);
    form.append('severity', alert.kind === 'HEAT' || alert.kind === 'DISEASE' || alert.kind === 'OTHER' ? 'MEDIUM' : 'HIGH');
    if (alert.zoneId) form.append('zoneId', alert.zoneId);
    if (alert.message.trim()) form.append('message', alert.message.trim());
    if (photo) form.append('file', photo);
    setBusy(true);
    setError(null);
    try {
      await api.post('/smart/alerts', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAlert({ zoneId: '', kind: 'FIRE', message: '' });
      setPhoto(null);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      load(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    setError(null);
    try {
      await api.patch(`/smart/alerts/${id}`, { status });
      load(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openClose = (item: AlertRow) => {
    setClosing(item);
    setCloseForm({
      message: item.message,
      history: buildCloseHistory(item, t),
      closeNotes: item.closeNotes ?? '',
    });
  };

  const submitClose = async (event: FormEvent) => {
    event.preventDefault();
    if (!closing) return;
    setCloseBusy(true);
    setError(null);
    try {
      await api.patch(`/smart/alerts/${closing.id}`, {
        status: 'CLOSED',
        message: closeForm.message.trim(),
        history: closeForm.history.trim(),
        closeNotes: closeForm.closeNotes.trim(),
      });
      setClosing(null);
      load(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCloseBusy(false);
    }
  };

  const enableSound = async () => {
    localStorage.setItem(SOUND_KEY, 'on');
    setSoundOn(true);
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  return (
    <div>
      <PageHeader title={t('alerts.title')} subtitle={t('alerts.subtitle')} />
      <ErrorNote message={error} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <form onSubmit={raise} className="card space-y-4 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">{t('alerts.phoneTitle')}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={`min-h-11 rounded-xl px-3 text-sm font-semibold ring-1 transition ${alert.kind === kind ? 'bg-forest-700 text-white ring-forest-700' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'}`}
                onClick={() => setAlert({ ...alert, kind })}
              >
                {t(`alerts.kinds.${kind}`)}
              </button>
            ))}
          </div>
          <Field label={t('alerts.zone')}>
            <select className="input" value={alert.zoneId} onChange={(e) => setAlert({ ...alert, zoneId: e.target.value })}>
              <option value="">{t('alerts.anyZone')}</option>
              {zones.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <div>
            <label className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-forest-700 px-4 text-sm font-semibold text-white hover:bg-forest-800">
              <Camera className="h-5 w-5" aria-hidden />
              {photo ? t('alerts.retake') : t('alerts.photo')}
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  void choosePhoto(file);
                }}
              />
            </label>
            {preview && <img src={preview} alt="" className="mt-3 max-h-52 w-full rounded-xl object-cover" />}
          </div>
          <Field label={t('alerts.message')}>
            <input className="input" value={alert.message} onChange={(e) => setAlert({ ...alert, message: e.target.value })} placeholder={t('alerts.messageHint')} />
          </Field>
          <button className="btn-primary w-full" disabled={busy}>{busy ? t('alerts.sending') : t('alerts.raise')}</button>
        </form>

        <section className="card flex min-h-[28rem] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">{t('alerts.open')}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {isOwner ? t('alerts.deskHelpOwner') : t('alerts.deskHelp')}
              </p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => void enableSound()}>
              {soundOn ? t('alerts.deskOn') : t('alerts.desk')}
            </button>
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 bg-white p-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                className="input !min-h-10 pl-9"
                value={query}
                placeholder={t('alerts.listSearch')}
                aria-label={t('alerts.listSearch')}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              />
            </div>
            <div className={`grid gap-2 ${isOwner ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {isOwner && (
                <select
                  className="input !min-h-10"
                  value={nurseryFilter}
                  aria-label={t('alerts.nursery')}
                  onChange={(event) => { setNurseryFilter(event.target.value); setPlaceFilter('ALL'); setPage(1); }}
                >
                  <option value="ALL">{t('alerts.nurseryAll')}</option>
                  {nurseryOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              )}
              <select
                className="input !min-h-10"
                value={placeFilter}
                aria-label={t('alerts.place')}
                onChange={(event) => { setPlaceFilter(event.target.value); setPage(1); }}
              >
                <option value="ALL">{t('alerts.placeAll')}</option>
                {placeOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <select className="input !min-h-10" value={kindFilter} aria-label={t('alerts.kind')} onChange={(event) => { setKindFilter(event.target.value); setPage(1); }}>
                <option value="ALL">{t('alerts.kindAll')}</option>
                {KINDS.map((kind) => <option key={kind} value={kind}>{t(`alerts.kinds.${kind}`)}</option>)}
              </select>
              <select className="input !min-h-10" value={statusFilter} aria-label={t('alerts.status')} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
                <option value="ALL">{t('alerts.statusAll')}</option>
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <select className="input !min-h-10" value={sort} aria-label={t('alerts.sort')} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
                <option value="newest">{t('alerts.sorts.newest')}</option>
                <option value="oldest">{t('alerts.sorts.oldest')}</option>
                <option value="case">{t('alerts.sorts.case')}</option>
                {isOwner && <option value="nursery">{t('alerts.sorts.nursery')}</option>}
                <option value="kind">{t('alerts.sorts.kind')}</option>
              </select>
            </div>
          </div>

          {loading && alerts.length === 0 ? <ListSkeleton rows={4} framed={false} /> : (
            <>
              {alerts.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-400">{t('alerts.empty')}</p>
              ) : pageRows.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-400">{t('alerts.noMatch')}</p>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                  {pageRows.map((item) => (
                    <li key={item.id} className="px-5 py-4 transition hover:bg-[#f6f8f6]">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200"
                          onClick={() => {
                            if (item.videoUrl) openStage(item, 'video');
                            else if (item.photoUrl) openStage(item, 'photo');
                          }}
                          disabled={!item.photoUrl && !item.videoUrl}
                          aria-label={t('alerts.openEvidence')}
                        >
                          {item.photoUrl ? (
                            <img src={item.photoUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="grid h-full place-items-center text-xs font-semibold text-slate-400">
                              {t(`alerts.kinds.${item.kind}`).slice(0, 1)}
                            </span>
                          )}
                          {(item.videoUrl || item.photoUrl) && (
                            <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-0 transition hover:opacity-100">
                              <Maximize2 className="h-4 w-4 text-white" aria-hidden />
                            </span>
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-forest-800">{item.caseNo}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(item.status)}`}>{item.status}</span>
                          </div>
                          {(isOwner || item.placeName) && (
                            <p className="mt-0.5 text-xs font-medium text-slate-500">
                              {isOwner && item.nurseryName ? item.nurseryName : null}
                              {isOwner && item.nurseryName && item.placeName ? ' · ' : null}
                              {item.placeName ?? null}
                            </p>
                          )}
                          <p className="mt-0.5 text-sm font-medium text-slate-800">
                            {t(`alerts.kinds.${item.kind}`)} · {item.severity}
                          </p>
                          <p className="truncate text-sm text-slate-600">{item.message}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {item.cameraName ?? item.zone?.name ?? t('alerts.anyZone')}
                            {item.detectKind ? ` · ${item.detectKind}` : ''}
                            {' · '}
                            {new Date(item.raisedAt).toLocaleString()}
                          </p>
                        </div>
                        {item.qrDataUrl && (
                          <img src={item.qrDataUrl} alt={item.caseNo} className="hidden h-16 w-16 shrink-0 rounded-xl bg-white p-1 ring-1 ring-slate-200 sm:block" />
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.photoUrl && (
                          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800" onClick={() => openStage(item, 'photo')}>
                            <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                            {t('alerts.evidencePhoto')}
                          </button>
                        )}
                        {item.videoUrl && (
                          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700" onClick={() => openStage(item, 'video')}>
                            <Video className="h-3.5 w-3.5" aria-hidden />
                            {t('alerts.evidenceVideo')}
                          </button>
                        )}
                        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50" onClick={() => void shareCase(item)}>
                          <Link2 className="h-3.5 w-3.5" aria-hidden />
                          {copied === item.id ? t('alerts.copied') : t('alerts.share')}
                        </button>
                        {item.status === 'OPEN' && (
                          <button className="btn-ghost !min-h-0 !px-3 !py-2 !text-xs" type="button" onClick={() => setStatus(item.id, 'ACKNOWLEDGED')}>{t('alerts.ack')}</button>
                        )}
                        {item.status !== 'CLOSED' && (
                          <button className="btn-primary !min-h-0 !px-3 !py-2 !text-xs" type="button" onClick={() => openClose(item)}>{t('alerts.close')}</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {visible.length > 0 && (
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5">
                  <p className="text-xs text-slate-500">
                    {t('alerts.range', {
                      from: (safePage - 1) * PAGE_SIZE + 1,
                      to: Math.min(safePage * PAGE_SIZE, visible.length),
                      count: visible.length,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 disabled:opacity-40" type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>{t('alerts.prev')}</button>
                    <span className="text-xs text-slate-500">{t('alerts.pageOf', { page: safePage, pages: pageCount })}</span>
                    <button className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 disabled:opacity-40" type="button" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>{t('alerts.next')}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <form onSubmit={addZone} className="card mt-4 space-y-3 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">{t('alerts.zone')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('alerts.zoneName')}><input className="input" required value={zone.name} onChange={(e) => setZone({ ...zone, name: e.target.value })} /></Field>
          <Field label={t('alerts.location')}><input className="input" required value={zone.location} onChange={(e) => setZone({ ...zone, location: e.target.value })} /></Field>
        </div>
        <button className="btn-primary">{t('alerts.addZone')}</button>
        {zones.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {zones.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-slate-500">{item.location}</div>
              </li>
            ))}
          </ul>
        )}
      </form>

      <Modal open={!!closing} onClose={() => setClosing(null)} title={t('alerts.closeTitle')} width="max-w-xl">
        {closing && (
          <form onSubmit={submitClose} className="space-y-4">
            <p className="text-sm font-semibold text-forest-800">{closing.caseNo}</p>
            {closing.qrDataUrl && (
              <img src={closing.qrDataUrl} alt="" className="mx-auto h-28 w-28 rounded-lg bg-white p-1 ring-1 ring-slate-200" />
            )}
            <Field label={t('alerts.message')}>
              <input className="input" value={closeForm.message} onChange={(e) => setCloseForm({ ...closeForm, message: e.target.value })} required />
            </Field>
            <Field label={t('alerts.history')}>
              <textarea className="input min-h-32" value={closeForm.history} onChange={(e) => setCloseForm({ ...closeForm, history: e.target.value })} required />
            </Field>
            <Field label={t('alerts.closeNotes')}>
              <textarea className="input min-h-20" value={closeForm.closeNotes} onChange={(e) => setCloseForm({ ...closeForm, closeNotes: e.target.value })} placeholder={t('alerts.closeNotesHint')} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setClosing(null)}>{t('common.cancel')}</button>
              <button type="submit" className="btn-primary" disabled={closeBusy}>
                {closeBusy ? t('alerts.closing') : t('alerts.submitClose')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {stage && (
        <div className={`fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-3 ${stageIn ? 'bg-slate-950/75 backdrop-blur-[2px]' : 'bg-slate-950/0'} transition-all ${ease}`}>
          <div
            className={`relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#0c1222] text-white shadow-2xl transition sm:h-[calc(100dvh-1.5rem)] sm:max-w-5xl sm:rounded-[28px] sm:ring-1 sm:ring-white/10 ${ease} ${stageIn ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-[0.96] opacity-0'}`}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{stage.item.caseNo}</div>
                <div className="truncate text-xs text-white/60">
                  {stage.kind === 'video' ? t('alerts.evidenceVideo') : t('alerts.evidencePhoto')}
                  {' · '}
                  {t(`alerts.kinds.${stage.item.kind}`)}
                  {stage.item.nurseryName ? ` · ${stage.item.nurseryName}` : ''}
                </div>
              </div>
              <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" onClick={closeStage} aria-label={t('common.close')}>
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-black p-3 sm:p-5">
              {stage.kind === 'video' && stage.item.videoUrl ? (
                <video src={stage.item.videoUrl} controls autoPlay playsInline className="max-h-full max-w-full rounded-2xl" />
              ) : stage.item.photoUrl ? (
                <img src={stage.item.photoUrl} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-xs text-white/60 sm:px-5">
              <span>{stage.item.cameraName ?? stage.item.placeName ?? stage.item.zone?.name ?? t('alerts.anyZone')} · {new Date(stage.item.raisedAt).toLocaleString()}</span>
              <button type="button" className="rounded-full bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-white/20" onClick={() => void shareCase(stage.item)}>
                {copied === stage.item.id ? t('alerts.copied') : t('alerts.share')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
