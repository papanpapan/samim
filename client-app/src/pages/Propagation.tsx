import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Plus, QrCode, Search } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { FIELD_ROLES, hasRole } from '../auth/roles';
import type { MotherPlant, PropagationBatch } from '../types';
import { ErrorNote, Field, FieldHint, ListSkeleton, Modal, PageHeader, StageBadge } from '../components/ui';
import { AudioAssistTrigger } from '../components/AudioAssistTrigger';
import { LabelSheet } from '../components/propagation/LabelSheet';
import { BatchScanner } from '../components/propagation/BatchScanner';
import { MediaDropzone } from '../components/MediaDropzone';

const MOTHER_METHODS = ['GRAFTING_SCION', 'AIR_LAYERING', 'CUTTING', 'TISSUE_CULTURE'] as const;
const PAGE_SIZE = 10;
const STAGE_FILTERS = ['INITIATED', 'MIST_CHAMBER', 'HARDENING_SHADE', 'READY_FOR_SALE', 'CLOSED'] as const;

function showDate(value: string | undefined) {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? `${day}/${month}/${year}` : value;
}
const MAX_BABY_PHOTOS = 6;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

function videoMime(file: File) {
  if (file.type === 'video/mp4' || file.type === 'video/webm' || file.type === 'video/quicktime') return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'mp4' || ext === 'm4v' || ext === 'webm' || ext === 'mov') return ext;
  return '';
}

function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error('photo'));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('photo'));
    };
    image.src = url;
  });
}

function motherMethods(mother: MotherPlant | undefined) {
  return (mother?.propagationMethods ?? []).filter((method) =>
    (MOTHER_METHODS as readonly string[]).includes(method),
  );
}

function draftFor(mother: MotherPlant | undefined) {
  return {
    motherPlantId: mother?.id ?? '',
    method: motherMethods(mother)[0] ?? 'GRAFTING_SCION',
  };
}

function motherLabel(mother: MotherPlant) {
  return `${mother.plantName || mother.varietyName} — ${mother.varietyName} — ${mother.tagNumber}`;
}

function MotherPicker({
  mothers,
  value,
  onChange,
  searchLabel,
  emptyLabel,
  placeholder,
}: {
  mothers: MotherPlant[];
  value: string;
  onChange: (id: string) => void;
  searchLabel: string;
  emptyLabel: string;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = mothers.find((item) => item.id === value);
  const needle = query.trim().toLowerCase();
  const matches = mothers.filter((item) => {
    const haystack = [item.plantName, item.varietyName, item.tagNumber, item.plotLocation].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(needle);
  });

  const place = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setBox({ left: rect.left, top: rect.bottom + 4, width: rect.width });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        className="input flex items-center justify-between text-left"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`truncate ${selected ? '' : 'text-slate-400'}`}>{selected ? motherLabel(selected) : placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>
      <input className="sr-only" tabIndex={-1} aria-hidden value={value} required onChange={() => undefined} />
      {open && box && (
        <div
          ref={panelRef}
          className="fixed z-[80] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          style={{ left: box.left, top: box.top, width: Math.max(box.width, 280) }}
        >
          <div className="border-b border-slate-100 p-2">
            <input
              className="input"
              autoFocus
              value={query}
              placeholder={searchLabel}
              aria-label={searchLabel}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault();
                if (event.key === 'Escape') setOpen(false);
              }}
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1" role="listbox">
            {matches.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={item.id === value}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${item.id === value ? 'bg-forest-50 font-medium text-forest-800' : 'text-slate-700'}`}
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {motherLabel(item)}
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">{emptyLabel}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function stockCategory(category: string | undefined) {
  if (category === 'FRUIT' || category === 'EXOTIC') return 'Fruit';
  if (category === 'FOLIAGE') return 'Indoor';
  return 'Ornamental';
}

function readyDraft(batch: PropagationBatch) {
  const mother = batch.motherPlant;
  const price = mother?.listPrice ?? 0;
  return {
    commonName: mother?.plantName || mother?.varietyName || '',
    variety: mother?.varietyName ?? '',
    category: stockCategory(mother?.category),
    bagSize: '5x7 inch',
    costPrice: 45,
    retailPrice: price,
    wholesalePrice: price,
  };
}

export function Propagation() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const openedFromLink = useRef(false);
  const canRunBatch = hasRole(user?.role, FIELD_ROLES);
  const canMarkReady = hasRole(user?.role, FIELD_ROLES);
  const [batches, setBatches] = useState<PropagationBatch[]>([]);
  const [mothers, setMothers] = useState<MotherPlant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const [openNew, setOpenNew] = useState(false);
  const [newForm, setNewForm] = useState({ motherPlantId: '', method: 'GRAFTING_SCION' });
  const [qtyText, setQtyText] = useState('1');

  const [readyBatch, setReadyBatch] = useState<PropagationBatch | null>(null);
  const [babyPhotos, setBabyPhotos] = useState<File[]>([]);
  const [babyPreviews, setBabyPreviews] = useState<string[]>([]);
  const [babyVideo, setBabyVideo] = useState<File | null>(null);
  const [babyVideoUrl, setBabyVideoUrl] = useState<string | null>(null);
  const [customerQr, setCustomerQr] = useState<{ sku: string; publicUrl: string; qrDataUrl: string } | null>(null);
  const [climateBatch, setClimateBatch] = useState<PropagationBatch | null>(null);
  const [readings, setReadings] = useState<{ id: string; temperatureC: string; humidityPct: string; recordedAt: string }[]>([]);
  const [climateForm, setClimateForm] = useState({ temperatureC: 28, humidityPct: 85 });
  const [readyForm, setReadyForm] = useState({
    commonName: '',
    variety: '',
    category: 'Fruit',
    bagSize: '5x7 inch',
    costPrice: 45,
    retailPrice: 0,
    wholesalePrice: 0,
  });
  const [labelBatch, setLabelBatch] = useState<PropagationBatch | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [batchQr, setBatchQr] = useState<{ batchCode: string; publicUrl: string; qrDataUrl: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ batch: PropagationBatch; toStage: string } | null>(null);
  const [survived, setSurvived] = useState('');
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [plantFilter, setPlantFilter] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const load = (quiet = false) => {
    if (!quiet) setLoading(true);
    Promise.all([api.get('/propagation'), api.get('/mother-plants')])
      .then(([b, m]) => {
        const nextMothers = m.data.data as MotherPlant[];
        setBatches(b.data.data);
        setMothers(nextMothers);
        setNewForm((current) => current.motherPlantId ? current : draftFor(nextMothers[0]));
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    const id = searchParams.get('mother');
    if (!id || openedFromLink.current || mothers.length === 0) return;
    const mother = mothers.find((item) => item.id === id);
    if (!mother) return;
    openedFromLink.current = true;
    setNewForm(draftFor(mother));
    setOpenNew(true);
    const next = new URLSearchParams(searchParams);
    next.delete('mother');
    setSearchParams(next, { replace: true });
  }, [mothers, searchParams, setSearchParams]);

  const selectedMother = mothers.find((item) => item.id === newForm.motherPlantId);
  const methodOptions = motherMethods(selectedMother);

  const createBatch = async (e: FormEvent) => {
    e.preventDefault();
    const quantity = Number(qtyText);
    if (!qtyText || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      setError(t('propagation.qtyMin'));
      return;
    }
    if (methodOptions.length === 0) {
      setError(t('propagation.noMethod'));
      return;
    }
    setPending('create');
    setError(null);
    try {
      const res = await api.post('/propagation', {
        motherPlantId: newForm.motherPlantId,
        method: newForm.method,
        initialQuantity: quantity,
      });
      setNote(t('propagation.started', { code: res.data.data.batchCode }));
      setOpenNew(false);
      load(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const openMove = (batch: PropagationBatch, toStage: string) => {
    setMoveTarget({ batch, toStage });
    setSurvived(String(batch.currentQuantity));
  };

  const submitMove = async (e: FormEvent) => {
    e.preventDefault();
    if (!moveTarget) return;
    const count = Number(survived);
    if (!Number.isInteger(count) || count < 0) return;
    setPending('move');
    setError(null);
    try {
      const res = await api.patch(`/propagation/${moveTarget.batch.id}/stage`, {
        toStage: moveTarget.toStage,
        survivedCount: count,
      });
      setNote(t('propagation.moved', {
        stage: t(`stages.${moveTarget.toStage}`),
        loss: res.data.meta.mortalityDelta,
        pct: res.data.meta.mortalityPct,
      }));
      setMoveTarget(null);
      load(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  useEffect(() => {
    const urls = babyPhotos.map((file) => URL.createObjectURL(file));
    setBabyPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [babyPhotos]);

  useEffect(() => {
    if (!babyVideo) {
      setBabyVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(babyVideo);
    setBabyVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [babyVideo]);

  const openReady = (batch: PropagationBatch) => {
    setReadyForm(readyDraft(batch));
    setBabyPhotos([]);
    setBabyVideo(null);
    setReadyBatch(batch);
  };

  const addBabyPhotos = (list: FileList | null) => {
    if (!list) return;
    const images = [...list].filter((file) => file.type.startsWith('image/'));
    setBabyPhotos((current) => [...current, ...images].slice(0, MAX_BABY_PHOTOS));
  };

  const submitReady = async (e: FormEvent) => {
    e.preventDefault();
    if (!readyBatch) return;
    if (babyVideo && (babyVideo.size > MAX_VIDEO_BYTES || !videoMime(babyVideo))) {
      setError(t('propagation.babyVideoType'));
      return;
    }
    setPending('ready');
    setError(null);
    try {
      const photos = await Promise.all(babyPhotos.map(async (file) => ({ dataUrl: await compressPhoto(file) })));
      const res = await api.post(`/propagation/${readyBatch.id}/ready`, {
        ...readyForm,
        photos: photos.length > 0 ? photos : undefined,
      }, { params: { origin: window.location.origin } });
      const created = res.data.data as { id: string; sku: string; currentStock: number; publicUrl: string; qrDataUrl: string };
      if (babyVideo) {
        const body = new FormData();
        body.append('video', babyVideo, babyVideo.name);
        try {
          await api.post(`/propagation/stock/${created.id}/video`, body, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (err) {
          setError(apiErrorMessage(err));
        }
      }
      setNote(`${created.sku} · ${created.currentStock}`);
      if (created.publicUrl) setCustomerQr({ sku: created.sku, publicUrl: created.publicUrl, qrDataUrl: created.qrDataUrl });
      setReadyBatch(null);
      setBabyPhotos([]);
      setBabyVideo(null);
      load(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const chip = 'inline-flex h-8 items-center justify-center rounded-lg px-2 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white disabled:opacity-50';

  const nextAction = (b: PropagationBatch) => {
    if (!canRunBatch) return null;
    if (b.stage === 'INITIATED') {
      return (
        <button className={chip} type="button" onClick={() => openMove(b, 'MIST_CHAMBER')} disabled={pending === 'move'}>
          {t('propagation.mist')}
        </button>
      );
    }
    if (b.stage === 'MIST_CHAMBER') {
      return (
        <button className={chip} type="button" onClick={() => openMove(b, 'HARDENING_SHADE')} disabled={pending === 'move'}>
          {t('propagation.hardening')}
        </button>
      );
    }
    if (b.stage === 'HARDENING_SHADE') {
      return canMarkReady ? (
        <button className="inline-flex h-8 items-center justify-center rounded-lg bg-forest-700 px-2 text-xs font-semibold text-white hover:bg-forest-800 disabled:opacity-50" type="button" onClick={() => openReady(b)} data-speak={t('voice.markReady')} disabled={pending === 'ready'}>
          {t('propagation.markReady')}
        </button>
      ) : (
        <span className="text-xs text-slate-500">{t('propagation.managerReady')}</span>
      );
    }
    return null;
  };

  const openBatchQr = async (batch: PropagationBatch) => {
    try {
      const res = await api.get(`/propagation/${batch.id}/tag`, { params: { origin: window.location.origin } });
      setBatchQr(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openClimate = async (b: PropagationBatch) => {
    setClimateBatch(b);
    try {
      const res = await api.get(`/propagation/${b.id}/climate`);
      setReadings(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const saveClimate = async (e: FormEvent) => {
    e.preventDefault();
    if (!climateBatch) return;
    setPending('climate');
    try {
      await api.post(`/propagation/${climateBatch.id}/climate`, climateForm);
      const res = await api.get(`/propagation/${climateBatch.id}/climate`);
      setReadings(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const plantOptions = useMemo(
    () => [...new Set(batches.map((batch) => batch.motherPlant?.plantName).filter((name): name is string => !!name))].sort((a, b) => a.localeCompare(b)),
    [batches],
  );
  const methodOptionsInList = useMemo(
    () => [...new Set(batches.map((batch) => batch.method))].sort(),
    [batches],
  );
  const visibleBatches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = batches.filter((batch) => {
      if (stageFilter !== 'ALL' && batch.stage !== stageFilter) return false;
      if (methodFilter !== 'ALL' && batch.method !== methodFilter) return false;
      const plantName = batch.motherPlant?.plantName || '';
      if (plantFilter !== 'ALL' && plantName !== plantFilter) return false;
      if (!needle) return true;
      const haystack = [
        batch.batchCode,
        batch.motherPlant?.plantName,
        batch.motherPlant?.varietyName,
        batch.motherPlant?.tagNumber,
        batch.motherPlant?.plotLocation,
        batch.method,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(needle);
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'oldest') return a.startDate.localeCompare(b.startDate);
      if (sort === 'code-asc') return a.batchCode.localeCompare(b.batchCode);
      if (sort === 'code-desc') return b.batchCode.localeCompare(a.batchCode);
      if (sort === 'qty') return b.currentQuantity - a.currentQuantity;
      if (sort === 'success') {
        const rate = (batch: PropagationBatch) => (batch.initialQuantity ? batch.currentQuantity / batch.initialQuantity : 0);
        return rate(b) - rate(a);
      }
      return b.startDate.localeCompare(a.startDate);
    });
  }, [batches, query, stageFilter, methodFilter, plantFilter, sort]);
  const pageCount = Math.max(1, Math.ceil(visibleBatches.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = visibleBatches.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#F8FAFC] p-3 sm:p-4 lg:p-6">
      <div className="shrink-0">
      <PageHeader
        title={t('propagation.title')}
        subtitle={t('propagation.subtitle')}
        action={
          canRunBatch ? (
            <div className="flex items-center gap-2">
              <button className="btn-ghost" type="button" onClick={() => setScanOpen(true)}>{t('propagation.scan')}</button>
              <button className="btn-primary" type="button" onClick={() => setOpenNew(true)} data-speak={t('voice.newBatch')}>
                <Plus className="h-4 w-4" aria-hidden />
                {t('propagation.newBatch')}
              </button>
              <AudioAssistTrigger textKey="voice.newBatch" />
            </div>
          ) : undefined
        }
      />
      <ErrorNote message={error} />
      {note && (
        <div className="mb-3 rounded-lg border border-nursery-200 bg-nursery-50 px-3 py-2 text-sm text-nursery-700">
          {note}
        </div>
      )}
      </div>
      {loading ? (
        <div className="min-h-0 flex-1">
          <ListSkeleton rows={6} />
        </div>
      ) : (
        <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 bg-white p-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                className="input !min-h-10 pl-9"
                value={query}
                placeholder={t('propagation.listSearch')}
                aria-label={t('propagation.listSearch')}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
              <select className="input !min-h-10 lg:w-36" value={plantFilter} aria-label={t('propagation.mother')} onChange={(event) => { setPlantFilter(event.target.value); setPage(1); }}>
                <option value="ALL">{t('propagation.plantAll')}</option>
                {plantOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select className="input !min-h-10 lg:w-40" value={methodFilter} aria-label={t('propagation.method')} onChange={(event) => { setMethodFilter(event.target.value); setPage(1); }}>
                <option value="ALL">{t('propagation.methodAll')}</option>
                {methodOptionsInList.map((method) => (
                  <option key={method} value={method}>{t(`methods.${method}`, { defaultValue: method.replace(/_/g, ' ') })}</option>
                ))}
              </select>
              <select className="input !min-h-10 lg:w-40" value={stageFilter} aria-label={t('propagation.stage')} onChange={(event) => { setStageFilter(event.target.value); setPage(1); }}>
                <option value="ALL">{t('propagation.stageAll')}</option>
                {STAGE_FILTERS.map((stage) => <option key={stage} value={stage}>{t(`stages.${stage}`)}</option>)}
              </select>
              <select className="input !min-h-10 lg:w-44" value={sort} aria-label={t('propagation.sort')} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
                <option value="newest">{t('propagation.sorts.newest')}</option>
                <option value="oldest">{t('propagation.sorts.oldest')}</option>
                <option value="code-asc">{t('propagation.sorts.codeAsc')}</option>
                <option value="code-desc">{t('propagation.sorts.codeDesc')}</option>
                <option value="qty">{t('propagation.sorts.qty')}</option>
                <option value="success">{t('propagation.sorts.success')}</option>
              </select>
            </div>
          </div>
          {batches.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">{t('propagation.empty')}</p>
          ) : pageRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">{t('propagation.noMatch')}</p>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {pageRows.map((b) => {
                const successPct = b.initialQuantity ? ((b.currentQuantity / b.initialQuantity) * 100).toFixed(1) : '0';
                const lossPct = b.initialQuantity ? ((b.mortalityCount / b.initialQuantity) * 100).toFixed(1) : '0';
                const mother = b.motherPlant;
                const plantLabel = mother?.plantName || mother?.varietyName || b.batchCode;
                const facts = [
                  [t('propagation.specs.method'), t(`methods.${b.method}`, { defaultValue: b.method.replace(/_/g, ' ') })],
                  [t('propagation.specs.alive'), `${b.currentQuantity} / ${b.initialQuantity}`],
                  [t('propagation.specs.success'), `${successPct}%`],
                  [t('propagation.specs.loss'), `${lossPct}%`],
                  [t('propagation.specs.place'), mother?.plotLocation || '—'],
                  [t('propagation.specs.tag'), mother?.tagNumber || '—'],
                  [t('propagation.specs.started'), showDate(b.startDate)],
                ] as const;
                return (
                  <li key={b.id} className="px-4 py-4 transition hover:bg-[#f6f8f6]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                      <div className="flex min-w-0 flex-1 gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-forest-50 font-['Cormorant_Garamond',Georgia,serif] text-2xl text-forest-800 ring-1 ring-slate-200">
                          {plantLabel.slice(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[10px] tracking-[0.16em] text-slate-400">{b.batchCode}</p>
                          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                            <h2 className="font-['Cormorant_Garamond',Georgia,serif] text-[1.65rem] font-semibold leading-none tracking-tight text-slate-900">{plantLabel}</h2>
                            {mother?.varietyName && mother.varietyName !== plantLabel && (
                              <span className="text-sm text-slate-500">{mother.varietyName}</span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <StageBadge stage={b.stage} />
                            {mother?.tagNumber && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{mother.tagNumber}</span>
                            )}
                          </div>
                          <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
                            {facts.map(([label, value]) => (
                              <div key={label} className="min-w-0 border-l border-slate-200 pl-2">
                                <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">{label}</dt>
                                <dd className="truncate text-[13px] text-slate-700" title={value}>{value}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </div>
                      <div className="grid w-full shrink-0 grid-cols-2 gap-1.5 border-t border-slate-100 pt-3 lg:w-52 lg:border-t-0 lg:pt-1">
                        <button className={chip} type="button" onClick={() => setLabelBatch(b)}>{t('propagation.labels')}</button>
                        <button className={chip} type="button" onClick={() => openBatchQr(b)}>{t('propagation.batchQr')}</button>
                        {canRunBatch && (
                          <button className={chip} type="button" onClick={() => openClimate(b)}>{t('propagation.climate')}</button>
                        )}
                        {nextAction(b)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {visibleBatches.length > 0 && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5">
              <p className="text-xs text-slate-500">
                {t('propagation.range', {
                  from: (safePage - 1) * PAGE_SIZE + 1,
                  to: Math.min(safePage * PAGE_SIZE, visibleBatches.length),
                  count: visibleBatches.length,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button className={chip} type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>{t('propagation.prev')}</button>
                <span className="text-xs text-slate-500">{t('propagation.pageOf', { page: safePage, pages: pageCount })}</span>
                <button className={chip} type="button" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>{t('propagation.next')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={openNew} onClose={() => setOpenNew(false)} title={t('propagation.modalTitle')}>
        <form onSubmit={createBatch} className="space-y-4">
          <Field label={t('propagation.motherPlant')} why={t('voice.motherSelect')} example="MP-BULK-BDG">
            <MotherPicker
              mothers={mothers}
              value={newForm.motherPlantId}
              searchLabel={t('propagation.motherSearch')}
              emptyLabel={t('propagation.motherEmpty')}
              placeholder={t('propagation.motherSearch')}
              onChange={(id) => {
                const mother = mothers.find((item) => item.id === id);
                setNewForm(draftFor(mother));
              }}
            />
          </Field>
          {selectedMother && (
            <p className="text-sm text-slate-500">
              {t('propagation.motherFacts', {
                plant: selectedMother.plantName || selectedMother.varietyName,
                place: selectedMother.plotLocation || '—',
                count: selectedMother.plantCount ?? 1,
              })}
            </p>
          )}
          {mothers.length === 0 && <p className="text-sm text-slate-500">{t('propagation.noMothers')}</p>}
          {selectedMother && methodOptions.length === 0 && <p className="text-sm text-amber-700">{t('propagation.noMethod')}</p>}
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('propagation.method')} why={t('voice.method')} example={t('methods.GRAFTING_SCION')}>
              <select
                className="input"
                value={newForm.method}
                onChange={(e) => setNewForm({ ...newForm, method: e.target.value })}
                disabled={methodOptions.length === 0}
              >
                {methodOptions.map((m) => (
                  <option key={m} value={m}>
                    {t(`methods.${m}`, { defaultValue: m.replace(/_/g, ' ') })}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('propagation.initialQty')} why={t('propagation.qtyWhy')} example="100">
              <input
                type="text"
                inputMode="numeric"
                className="input"
                value={qtyText}
                onChange={(e) => setQtyText(e.target.value.replace(/\D/g, ''))}
                required
              />
            </Field>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpenNew(false)}>
              {t('common.cancel')}
            </button>
            <FieldHint why={t('voice.startBatch')} example={t('propagation.start')} />
            <button className="btn-primary" disabled={pending === 'create' || methodOptions.length === 0} data-speak={t('voice.startBatch')}>
              {pending === 'create' ? t('propagation.creating') : t('propagation.start')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!moveTarget} onClose={() => setMoveTarget(null)} title={t('propagation.moveTitle')}>
        <form onSubmit={submitMove} className="space-y-4">
          <p className="text-sm text-slate-600">
            {t('propagation.survivors', { stage: t(`stages.${moveTarget?.toStage ?? ''}`), current: moveTarget?.batch.currentQuantity ?? 0 })}
          </p>
          <Field label={t('propagation.survivedCount')}>
            <input
              type="number"
              min={0}
              max={moveTarget?.batch.currentQuantity ?? 0}
              className="input"
              value={survived}
              onChange={(e) => setSurvived(e.target.value)}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setMoveTarget(null)}>{t('common.cancel')}</button>
            <button className="btn-primary" disabled={pending === 'move'}>
              {pending === 'move' ? t('propagation.moving') : t('propagation.move')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!readyBatch} onClose={() => setReadyBatch(null)} title={`${t('propagation.readyTitle')} · ${readyBatch?.batchCode ?? ''}`} width="max-w-2xl">
        <p className="mb-1 text-sm text-nursery-600">
          {t('propagation.readyHelp', { count: readyBatch?.currentQuantity ?? 0 })}
        </p>
        <p className="mb-4 text-xs text-slate-500">{t('propagation.priceFromMother')}</p>
        <form onSubmit={submitReady} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('propagation.commonName')}>
              <input className="input" value={readyForm.commonName} onChange={(e) => setReadyForm({ ...readyForm, commonName: e.target.value })} required />
            </Field>
            <Field label={t('propagation.category')}>
              <select className="input" value={readyForm.category} onChange={(e) => setReadyForm({ ...readyForm, category: e.target.value })}>
                <option value="Fruit">Fruit</option>
                <option value="Ornamental">Ornamental</option>
                <option value="Indoor">Indoor</option>
              </select>
            </Field>
            <Field label={t('propagation.bagSize')}>
              <select className="input" value={readyForm.bagSize} onChange={(e) => setReadyForm({ ...readyForm, bagSize: e.target.value })}>
                <option>5x7 inch</option>
                <option>8x10 inch</option>
                <option>12 inch Tob</option>
              </select>
            </Field>
            <Field label={t('propagation.variety')}>
              <input className="input" value={readyForm.variety} onChange={(e) => setReadyForm({ ...readyForm, variety: e.target.value })} />
            </Field>
            <Field label={t('propagation.cost')}>
              <input type="number" className="input" value={readyForm.costPrice} onChange={(e) => setReadyForm({ ...readyForm, costPrice: Number(e.target.value) })} />
            </Field>
            <Field label={t('propagation.retail')}>
              <input type="number" className="input" value={readyForm.retailPrice} onChange={(e) => setReadyForm({ ...readyForm, retailPrice: Number(e.target.value) })} />
            </Field>
            <Field label={t('propagation.wholesale')}>
              <input type="number" className="input" value={readyForm.wholesalePrice} onChange={(e) => setReadyForm({ ...readyForm, wholesalePrice: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-800">{t('propagation.customerMedia')}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{t('propagation.babyOptional')}</p>
            <div className="mt-4 grid grid-cols-1 gap-4">
            <Field label={t('propagation.babyPhotos')} why={t('propagation.babyPhotosWhy')} example="6">
              <MediaDropzone
                dense
                previews={babyPreviews}
                hint={t('media.dropHere')}
                removeLabel={t('mother.removePhoto')}
                onAdd={addBabyPhotos}
                onRemove={(index) => setBabyPhotos(babyPhotos.filter((_, item) => item !== index))}
              />
            </Field>
            <Field label={t('propagation.babyVideo')} why={t('propagation.babyVideoWhy')} example="MP4">
              {!babyVideo ? (
                <MediaDropzone
                  dense
                  previews={[]}
                  hint={t('media.dropHere')}
                  removeLabel={t('mother.removePhoto')}
                  multiple={false}
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
                  onAdd={(list) => {
                    const file = list?.[0];
                    if (!file) return;
                    if (file.size > MAX_VIDEO_BYTES || !videoMime(file)) {
                      setBabyVideo(null);
                      setError(t('propagation.babyVideoType'));
                      return;
                    }
                    setError(null);
                    setBabyVideo(file);
                  }}
                  onRemove={() => setBabyVideo(null)}
                />
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  {babyVideoUrl && <video src={babyVideoUrl} className="h-16 w-24 shrink-0 rounded-lg bg-black object-cover" muted />}
                  <p className="min-w-0 flex-1 truncate text-sm text-slate-800">{babyVideo.name}</p>
                  <button type="button" className="btn-ghost !min-h-10 shrink-0 !px-3" onClick={() => setBabyVideo(null)}>{t('mother.removePhoto')}</button>
                </div>
              )}
            </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setReadyBatch(null)}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" disabled={pending === 'ready'} data-speak={t('voice.createStock')}>
              <QrCode className="h-4 w-4" aria-hidden />
              {pending === 'ready' ? t('propagation.processing') : t('propagation.createStock')}
            </button>
            <AudioAssistTrigger textKey="voice.createStock" />
          </div>
        </form>
      </Modal>

      <Modal open={!!climateBatch} onClose={() => setClimateBatch(null)} title={t('propagation.climateTitle')}>
        <p className="mb-3 font-mono text-sm text-slate-600">{climateBatch?.batchCode}</p>
        <ul className="mb-4 space-y-1 text-sm">
          {readings.map((r) => (
            <li key={r.id}>{Number(r.temperatureC)}°C · {Number(r.humidityPct)}% · {new Date(r.recordedAt).toLocaleString()}</li>
          ))}
          {readings.length === 0 && <li className="text-slate-400">{t('propagation.noClimate')}</li>}
        </ul>
        <form onSubmit={saveClimate} className="grid grid-cols-2 gap-3">
          <Field label={t('propagation.temp')}>
            <input type="number" step="0.1" className="input" value={climateForm.temperatureC} onChange={(e) => setClimateForm({ ...climateForm, temperatureC: Number(e.target.value) })} required />
          </Field>
          <Field label={t('propagation.humidity')}>
            <input type="number" step="0.1" className="input" value={climateForm.humidityPct} onChange={(e) => setClimateForm({ ...climateForm, humidityPct: Number(e.target.value) })} required />
          </Field>
          <button className="btn-primary col-span-2" disabled={pending === 'climate'}>
            {pending === 'climate' ? t('propagation.creating') : t('propagation.logClimate')}
          </button>
        </form>
      </Modal>

      <Modal open={!!customerQr} onClose={() => setCustomerQr(null)} title={t('propagation.customerQr')}>
        {customerQr && (
          <div className="text-center">
            <p className="mb-3 text-sm text-slate-600">{t('propagation.customerQrHelp')}</p>
            {customerQr.qrDataUrl && <img src={customerQr.qrDataUrl} alt={customerQr.sku} className="mx-auto h-44 w-44" />}
            <a href={customerQr.publicUrl} className="mt-3 block break-all text-sm text-forest-700 underline">{customerQr.publicUrl}</a>
          </div>
        )}
      </Modal>

      {labelBatch && <LabelSheet batch={labelBatch} onClose={() => setLabelBatch(null)} />}
      {scanOpen && <BatchScanner onClose={() => setScanOpen(false)} />}
      <Modal open={!!batchQr} onClose={() => setBatchQr(null)} title={t('propagation.batchQrTitle', { code: batchQr?.batchCode ?? '' })}>
        {batchQr && (
          <div className="text-center">
            <img src={batchQr.qrDataUrl} alt={batchQr.batchCode} className="mx-auto h-44 w-44" />
            <a href={batchQr.publicUrl} className="mt-3 block break-all text-sm text-forest-700 underline">{batchQr.publicUrl}</a>
          </div>
        )}
      </Modal>
    </div>
  );
}
