import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight, Maximize2, Pencil, Plus, QrCode, Scissors, Search, X } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { FIELD_ROLES, hasRole, MANAGER_ROLES } from '../auth/roles';
import type { MotherPlant } from '../types';
import { ErrorNote, Field, ListSkeleton, Modal, PageHeader } from '../components/ui';
import { MediaDropzone } from '../components/MediaDropzone';
import { currencySymbol, formatMoney } from '../utils/money';

const COUNTRIES = ['Thailand', 'Vietnam', 'Malaysia', 'India'];
const CATEGORIES = ['FRUIT', 'FLOWERING', 'FOLIAGE', 'MEDICINAL', 'EXOTIC'] as const;
const HEALTH = ['HEALTHY', 'FLOWERING', 'FRUITING', 'DORMANT', 'NEEDS_CARE'] as const;
const METHODS = ['GRAFTING_SCION', 'AIR_LAYERING', 'CUTTING', 'TISSUE_CULTURE'] as const;
const FALLBACK_PLANTS = ['Adenium', 'Blackberry', 'Blueberry', 'Guava', 'Jackfruit', 'Jamun', 'Mulberry'];
const FALLBACK_VARIETIES: VarietyOption[] = [
  { name: 'Black Diamond Guava', plantName: 'Guava' },
  { name: 'Red Diamond Guava', plantName: 'Guava' },
  { name: 'Red King Guava', plantName: 'Guava' },
  { name: 'Variegated Guava', plantName: 'Guava' },
  { name: 'Thai King Jamun', plantName: 'Jamun' },
  { name: 'Seedless Jamun', plantName: 'Jamun' },
  { name: 'Thai Jackfruit', plantName: 'Jackfruit' },
  { name: 'Thai Adenium', plantName: 'Adenium' },
  { name: 'Mulberry', plantName: 'Mulberry' },
  { name: 'Blackberry', plantName: 'Blackberry' },
  { name: 'Blueberry', plantName: 'Blueberry' },
];

type VarietyOption = { name: string; plantName: string | null };

function todayInput() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function blankForm() {
  return {
    category: 'FRUIT',
    plantName: 'Guava',
    varietyName: 'Black Diamond Guava',
    sourceCountry: COUNTRIES[0],
    sourceVendor: '',
    plantingDate: todayInput(),
    locationId: '',
    plantCount: '1',
    healthStatus: 'HEALTHY',
    propagationMethods: ['GRAFTING_SCION'] as string[],
    seasonCapacity: '',
    listPrice: '',
  };
}

function CatalogPicker({
  items,
  value,
  placeholder,
  onChange,
  onCreate,
  searchLabel,
  otherLabel,
  manualLabel,
  addLabel,
  emptyLabel,
}: {
  items: string[];
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onCreate: (name: string) => Promise<void>;
  searchLabel: string;
  otherLabel: string;
  manualLabel: string;
  addLabel: string;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const needle = query.trim().toLowerCase();
  const matches = items.filter((name) => name.toLowerCase().includes(needle));

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
      setAdding(false);
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

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    setAdding(false);
    setQuery('');
    setDraft('');
  };

  const saveNew = async () => {
    const name = draft.trim();
    if (name.length < 2 || busy) return;
    setBusy(true);
    try {
      await onCreate(name);
      setOpen(false);
      setAdding(false);
      setQuery('');
      setDraft('');
    } catch {
      setAdding(true);
    } finally {
      setBusy(false);
    }
  };

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
        <span className={`truncate ${value ? '' : 'text-slate-400'}`}>{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>
      {open && box && (
        <div
          ref={panelRef}
          className="fixed z-[80] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          style={{ left: box.left, top: box.top, width: Math.max(box.width, 260) }}
        >
          <div className="border-b border-slate-100 p-2">
            <input
              className="input"
              autoFocus={!adding}
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
            {matches.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${value === name ? 'bg-forest-50 font-medium text-forest-800' : 'text-slate-700'}`}
                  onClick={() => choose(name)}
                >
                  {name}
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">{emptyLabel}</li>}
            <li className="border-t border-slate-100">
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${adding ? 'bg-forest-50 font-medium text-forest-800' : 'text-slate-700'}`}
                onClick={() => setAdding(true)}
              >
                {otherLabel}
              </button>
              {adding && (
                <div className="flex gap-2 px-3 pb-3">
                  <input
                    className="input"
                    autoFocus
                    value={draft}
                    minLength={2}
                    placeholder={manualLabel}
                    aria-label={manualLabel}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void saveNew();
                      }
                    }}
                  />
                  <button className="btn-primary !min-h-10 shrink-0 !px-3" type="button" disabled={busy || draft.trim().length < 2} onClick={() => void saveNew()}>
                    {addLabel}
                  </button>
                </div>
              )}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

const MAX_PHOTOS = 10;
const PAGE_SIZE = 10;

const HEALTH_TONE: Record<string, string> = {
  HEALTHY: 'bg-emerald-50 text-emerald-800',
  FLOWERING: 'bg-fuchsia-50 text-fuchsia-800',
  FRUITING: 'bg-amber-50 text-amber-900',
  DORMANT: 'bg-slate-100 text-slate-600',
  NEEDS_CARE: 'bg-rose-50 text-rose-700',
};

function showDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function MediaThumb({
  letter,
  photos,
  videoUrl,
  photosLabel,
  videoLabel,
}: {
  letter: string;
  photos: { id: string; url: string }[];
  videoUrl?: string | null;
  photosLabel: string;
  videoLabel: string;
}) {
  const { t } = useTranslation();
  const anchor = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [viewer, setViewer] = useState<{ kind: 'photo'; index: number } | { kind: 'video' } | null>(null);
  const hasMedia = photos.length > 0 || Boolean(videoUrl);

  const place = () => {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 320;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = rect.bottom + 8;
    const top = below + 300 > window.innerHeight ? Math.max(8, rect.top - 308) : below;
    setPos({ top, left });
  };

  const show = () => {
    if (!hasMedia) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    place();
    setOpen(true);
  };

  const hide = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => {
    if (!viewer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewer(null);
      if (viewer.kind !== 'photo' || photos.length < 2) return;
      if (event.key === 'ArrowRight') setViewer({ kind: 'photo', index: (viewer.index + 1) % photos.length });
      if (event.key === 'ArrowLeft') setViewer({ kind: 'photo', index: (viewer.index - 1 + photos.length) % photos.length });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer, photos]);

  return (
    <>
      <div
        ref={anchor}
        className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-forest-50 ring-1 ring-slate-200 ${hasMedia ? 'cursor-zoom-in' : ''}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        tabIndex={hasMedia ? 0 : -1}
      >
        {photos[0] ? (
          <img src={photos[0].url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-forest-800">{letter}</span>
        )}
        {photos.length > 1 && (
          <span className="absolute bottom-1 right-1 rounded bg-slate-900/75 px-1 text-[10px] font-semibold text-white">+{photos.length - 1}</span>
        )}
      </div>
      {open && hasMedia && (
        <div
          className="fixed z-50 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          {photos.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{photosLabel}</p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    type="button"
                    className="group relative overflow-hidden rounded-lg"
                    aria-label={t('mother.viewLarge')}
                    onClick={() => setViewer({ kind: 'photo', index })}
                  >
                    <img src={photo.url} alt="" className="h-20 w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 opacity-0 transition group-hover:bg-slate-950/40 group-hover:opacity-100">
                      <Maximize2 className="h-4 w-4 text-white" aria-hidden />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {videoUrl && (
            <div className={photos.length > 0 ? 'mt-3' : ''}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{videoLabel}</p>
                <button type="button" className="inline-flex items-center gap-1 text-[11px] font-semibold text-forest-700" onClick={() => setViewer({ kind: 'video' })}>
                  <Maximize2 className="h-3 w-3" aria-hidden />
                  {t('mother.viewLarge')}
                </button>
              </div>
              <video src={videoUrl} controls preload="metadata" className="max-h-44 w-full rounded-lg bg-black" />
            </div>
          )}
        </div>
      )}
      {viewer && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={viewer.kind === 'video' ? videoLabel : photosLabel}
          onClick={() => setViewer(null)}
        >
          <div className="relative flex max-h-[90vh] max-w-[92vw] items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="absolute -top-11 right-0 inline-flex h-9 items-center gap-1 rounded-lg bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20"
              aria-label={t('common.close')}
              onClick={() => setViewer(null)}
            >
              <X className="h-4 w-4" aria-hidden />
              {t('common.close')}
            </button>
            {viewer.kind === 'photo' ? (
              <img src={photos[viewer.index]?.url} alt="" className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain" />
            ) : (
              videoUrl && <video src={videoUrl} controls autoPlay className="max-h-[85vh] max-w-[92vw] rounded-lg bg-black" />
            )}
            {viewer.kind === 'photo' && photos.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow"
                  aria-label={t('mother.prev')}
                  onClick={() => setViewer({ kind: 'photo', index: (viewer.index - 1 + photos.length) % photos.length })}
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow"
                  aria-label={t('mother.next')}
                  onClick={() => setViewer({ kind: 'photo', index: (viewer.index + 1) % photos.length })}
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

function videoMime(file: File) {
  if (file.type === 'video/mp4' || file.type === 'video/webm' || file.type === 'video/quicktime') return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
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

export function MotherPlants() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canRegister = hasRole(user?.role, MANAGER_ROLES);
  const canLogScion = hasRole(user?.role, FIELD_ROLES);
  const [places, setPlaces] = useState<{ id: string; name: string; address: string }[]>([]);
  const [items, setItems] = useState<MotherPlant[]>([]);
  const [meta, setMeta] = useState<{ total: number; totalScionsHarvested: number }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<{ id: string; kind: string; url: string }[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [editingVideoUrl, setEditingVideoUrl] = useState<string | null>(null);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [healthFilter, setHealthFilter] = useState('ALL');
  const [plantFilter, setPlantFilter] = useState('ALL');
  const [sort, setSort] = useState('plant-asc');
  const [page, setPage] = useState(1);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [priceSaving, setPriceSaving] = useState<string | null>(null);
  const [priceSaved, setPriceSaved] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);
  const [description, setDescription] = useState('');
  const [plants, setPlants] = useState<string[]>(FALLBACK_PLANTS);
  const [varieties, setVarieties] = useState<VarietyOption[]>(FALLBACK_VARIETIES);
  const [plantPhotos, setPlantPhotos] = useState<File[]>([]);
  const [fruitPhotos, setFruitPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [cycleFor, setCycleFor] = useState<MotherPlant | null>(null);
  const [cycles, setCycles] = useState<{ id: string; kind: string; observedOn: string; notes?: string | null }[]>([]);
  const [cycleForm, setCycleForm] = useState({ kind: 'FLOWERING', observedOn: new Date().toISOString().slice(0, 10), notes: '' });
  const [video, setVideo] = useState<File | null>(null);
  const [videoNote, setVideoNote] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const [tag, setTag] = useState<{ tagNumber: string; plantName?: string; varietyName: string; plotLocation: string; qrDataUrl: string; publicUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/mother-plants')
      .then((res) => {
        setItems(res.data.data);
        setMeta(res.data.meta);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const loadCatalog = () => {
    api
      .get('/mother-plants/plants')
      .then((res) => {
        const names = res.data.data as string[];
        if (names.length > 0) setPlants(names);
      })
      .catch(() => undefined);
    api
      .get('/mother-plants/varieties')
      .then((res) => {
        const rows = res.data.data as VarietyOption[];
        if (rows.length > 0) setVarieties(rows);
      })
      .catch(() => undefined);
  };
  useEffect(loadCatalog, []);
  useEffect(() => {
    if (!canRegister) return;
    api.get('/nursery')
      .then((res) => {
        const rows = res.data.data.locations as { id: string; name: string; address: string }[];
        setPlaces(rows);
      })
      .catch(() => undefined);
  }, [canRegister]);

  const rememberPlant = (saved: string) => {
    setPlants((current) => (
      current.some((item) => item.toLowerCase() === saved.toLowerCase())
        ? current
        : [...current, saved].sort((a, b) => a.localeCompare(b))
    ));
  };

  const addPlant = async (name: string) => {
    try {
      const res = await api.post('/mother-plants/plants', { name });
      const saved = res.data.data as string;
      rememberPlant(saved);
      setForm((current) => ({ ...current, plantName: saved, varietyName: '' }));
    } catch (err) {
      setError(apiErrorMessage(err));
      throw err;
    }
  };

  const addVariety = async (name: string) => {
    if (!form.plantName) {
      setError(t('mother.choosePlant'));
      throw new Error('plant');
    }
    try {
      const res = await api.post('/mother-plants/varieties', { name, plantName: form.plantName });
      const saved = res.data.data as VarietyOption;
      setVarieties((current) => {
        const without = current.filter((item) => item.name.toLowerCase() !== saved.name.toLowerCase());
        return [...without, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
      rememberPlant(saved.plantName ?? form.plantName);
      setForm((current) => ({ ...current, plantName: saved.plantName ?? current.plantName, varietyName: saved.name }));
    } catch (err) {
      setError(apiErrorMessage(err));
      throw err;
    }
  };

  const choosePlant = (plantName: string) => {
    const choices = varieties.filter((item) => !item.plantName || item.plantName.toLowerCase() === plantName.toLowerCase());
    const keep = choices.some((item) => item.name === form.varietyName);
    setForm({ ...form, plantName, varietyName: keep ? form.varietyName : (choices[0]?.name ?? '') });
  };

  const toggleMethod = (method: string) => {
    setForm((current) => {
      const has = current.propagationMethods.includes(method);
      return {
        ...current,
        propagationMethods: has
          ? current.propagationMethods.filter((item) => item !== method)
          : [...current.propagationMethods, method],
      };
    });
  };

  const varietyChoices = varieties
    .filter((item) => !form.plantName || !item.plantName || item.plantName.toLowerCase() === form.plantName.toLowerCase())
    .map((item) => item.name);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (!form.plantName) {
      setSaving(false);
      setError(t('mother.choosePlant'));
      return;
    }
    if (!form.varietyName) {
      setSaving(false);
      setError(t('mother.chooseVariety'));
      return;
    }
    if (form.propagationMethods.length === 0) {
      setSaving(false);
      setError(t('mother.methodRequired'));
      return;
    }
    const plantCount = Number(form.plantCount);
    if (!form.locationId) {
      setSaving(false);
      setError(t('mother.choosePlace'));
      return;
    }
    if (!Number.isInteger(plantCount) || plantCount < 1) {
      setSaving(false);
      setError(t('mother.countRequired'));
      return;
    }
    if (video && video.size > MAX_VIDEO_BYTES) {
      setSaving(false);
      setVideoNote(t('mother.videoTooBig'));
      return;
    }
    try {
      const photos = [
        ...(await Promise.all(plantPhotos.map(async (file) => ({ kind: 'PLANT' as const, dataUrl: await compressPhoto(file) })))),
        ...(await Promise.all(fruitPhotos.map(async (file) => ({ kind: 'FRUIT' as const, dataUrl: await compressPhoto(file) })))),
      ];
      const payload = {
        category: form.category,
        plantName: form.plantName,
        varietyName: form.varietyName,
        sourceCountry: form.sourceCountry,
        sourceVendor: form.sourceVendor.trim() || undefined,
        plantingDate: form.plantingDate,
        locationId: form.locationId,
        plantCount,
        propagationMethods: form.propagationMethods,
        healthStatus: form.healthStatus,
        seasonCapacity: form.seasonCapacity === '' ? undefined : Number(form.seasonCapacity),
        listPrice: form.listPrice === '' ? undefined : Number(form.listPrice),
        description: description.trim() || undefined,
        photos: photos.length > 0 ? photos : undefined,
        removePhotoIds: editingId && removedPhotoIds.length > 0 ? removedPhotoIds : undefined,
        removeVideo: editingId && removeVideo && !video ? true : undefined,
      };
      const keptPhotos = existingPhotos.filter((photo) => !removedPhotoIds.includes(photo.id)).length;
      if (keptPhotos + photos.length > MAX_PHOTOS) {
        setVideoNote(null);
        setError(t('mother.tooManyPhotos'));
        setSaving(false);
        return;
      }
      const created = (await api[editingId ? 'patch' : 'post'](
        editingId ? `/mother-plants/${editingId}` : '/mother-plants',
        payload,
      )).data.data as MotherPlant;
      if (video) {
        setVideoProgress(0);
        const body = new FormData();
        body.append('video', video, video.name);
        try {
          await api.post(`/mother-plants/${created.id}/video`, body, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (event) => {
              if (!event.total) return;
              setVideoProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
            },
          });
        } catch (err) {
          if (!editingId) await api.delete(`/mother-plants/${created.id}`).catch(() => undefined);
          throw err;
        }
      }
      const wasEdit = !!editingId;
      setOpen(false);
      setEditingId(null);
      setEditingTag(null);
      setExistingPhotos([]);
      setRemovedPhotoIds([]);
      setEditingVideoUrl(null);
      setRemoveVideo(false);
      setForm(blankForm());
      setDescription('');
      setPlantPhotos([]);
      setFruitPhotos([]);
      setVideo(null);
      setVideoNote(null);
      load();
      if (!wasEdit) await openTag(created.id);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const harvest = (id: string) => {
    navigate(`/propagation?mother=${encodeURIComponent(id)}`);
  };

  const openCycle = async (plant: MotherPlant) => {
    setCycleFor(plant);
    setCycles([]);
    try {
      const res = await api.get(`/mother-plants/${plant.id}/phenology`);
      setCycles(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const saveCycle = async (e: FormEvent) => {
    e.preventDefault();
    if (!cycleFor) return;
    try {
      await api.post(`/mother-plants/${cycleFor.id}/phenology`, {
        ...cycleForm,
        notes: cycleForm.notes || undefined,
      });
      const res = await api.get(`/mother-plants/${cycleFor.id}/phenology`);
      setCycles(res.data.data);
      setCycleForm({ ...cycleForm, notes: '' });
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openTag = async (id: string) => {
    try {
      const res = await api.get(`/mother-plants/${id}/tag`, { params: { origin: window.location.origin } });
      setCopied(false);
      setTag(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const printTag = () => {
    if (!tag) return;
    const popup = window.open('', '_blank', 'width=420,height=360');
    if (!popup) return;
    popup.document.write(
      `<html><body style="font-family:sans-serif;text-align:center;padding:24px"><h2 style="margin:0">Saba Nursery</h2><p>${tag.tagNumber}</p><img src="${tag.qrDataUrl}" width="180" height="180" /><p>${tag.varietyName}<br/>${tag.plotLocation}</p></body></html>`,
    );
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const resetEditor = () => {
    setEditingId(null);
    setEditingTag(null);
    setExistingPhotos([]);
    setRemovedPhotoIds([]);
    setEditingVideoUrl(null);
    setRemoveVideo(false);
    setForm(blankForm());
    setDescription('');
    setPlantPhotos([]);
    setFruitPhotos([]);
    setVideo(null);
    setVideoNote(null);
  };

  const openCreate = () => {
    resetEditor();
    setError(null);
    setOpen(true);
  };

  const openEdit = (plant: MotherPlant) => {
    setEditingId(plant.id);
    setEditingTag(plant.tagNumber);
    setForm({
      category: plant.category || 'FRUIT',
      plantName: plant.plantName || '',
      varietyName: plant.varietyName,
      sourceCountry: plant.sourceCountry || COUNTRIES[0],
      sourceVendor: plant.sourceVendor || '',
      plantingDate: plant.plantingDate.slice(0, 10),
      locationId: plant.locationId || '',
      plantCount: String(plant.plantCount ?? 1),
      healthStatus: plant.healthStatus || 'HEALTHY',
      propagationMethods: plant.propagationMethods?.length ? [...plant.propagationMethods] : [],
      seasonCapacity: plant.seasonCapacity == null ? '' : String(plant.seasonCapacity),
      listPrice: plant.listPrice == null ? '' : String(plant.listPrice),
    });
    setDescription(plant.description || plant.notes || '');
    setExistingPhotos(plant.photos ?? []);
    setRemovedPhotoIds([]);
    setEditingVideoUrl(plant.videoUrl ?? null);
    setRemoveVideo(false);
    setPlantPhotos([]);
    setFruitPhotos([]);
    setVideo(null);
    setVideoNote(null);
    setError(null);
    setOpen(true);
  };

  const savePrice = async (plant: MotherPlant) => {
    const raw = (priceDrafts[plant.id] ?? (plant.listPrice == null ? '' : String(plant.listPrice))).trim();
    const listPrice = raw === '' ? null : Number(raw);
    if (listPrice !== null && (!Number.isFinite(listPrice) || listPrice < 0)) return;
    setPriceSaving(plant.id);
    setPriceSaved(null);
    try {
      await api.patch(`/mother-plants/${plant.id}/price`, { listPrice });
      setPriceSaved(plant.id);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPriceSaving(null);
    }
  };

  const plantOptions = useMemo(
    () => [...new Set(items.map((item) => item.plantName).filter((name): name is string => !!name))].sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const visiblePlants = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (healthFilter !== 'ALL' && item.healthStatus !== healthFilter) return false;
      if (plantFilter !== 'ALL' && item.plantName !== plantFilter) return false;
      if (!needle) return true;
      const hay = [item.tagNumber, item.plantName, item.varietyName, item.plotLocation, item.sourceCountry, item.sourceVendor, item.description, item.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
    return [...filtered].sort((a, b) => {
      const nameA = a.plantName || a.varietyName;
      const nameB = b.plantName || b.varietyName;
      if (sort === 'plant-desc') return nameB.localeCompare(nameA);
      if (sort === 'newest') return b.plantingDate.localeCompare(a.plantingDate);
      if (sort === 'oldest') return a.plantingDate.localeCompare(b.plantingDate);
      if (sort === 'price-desc') return (b.listPrice ?? -1) - (a.listPrice ?? -1);
      if (sort === 'price-asc') return (a.listPrice ?? Number.MAX_SAFE_INTEGER) - (b.listPrice ?? Number.MAX_SAFE_INTEGER);
      if (sort === 'scions') return b.scionsHarvested - a.scionsHarvested;
      return nameA.localeCompare(nameB);
    });
  }, [items, query, categoryFilter, healthFilter, plantFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(visiblePlants.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = visiblePlants.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const photoTotal = plantPhotos.length + fruitPhotos.length;
  const plantPreviews = useMemo(() => plantPhotos.map((file) => URL.createObjectURL(file)), [plantPhotos]);
  const fruitPreviews = useMemo(() => fruitPhotos.map((file) => URL.createObjectURL(file)), [fruitPhotos]);
  const videoPreview = useMemo(() => (video ? URL.createObjectURL(video) : ''), [video]);
  useEffect(() => () => {
    plantPreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [plantPreviews]);
  useEffect(() => () => {
    fruitPreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [fruitPreviews]);
  useEffect(() => () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
  }, [videoPreview]);

  const addPhotos = (kind: 'plant' | 'fruit', list: FileList | null) => {
    if (!list || list.length === 0) return;
    const room = MAX_PHOTOS - plantPhotos.length - fruitPhotos.length;
    const images = [...list].filter((file) => file.type.startsWith('image/'));
    if (images.length > room) setError(t('mother.tooManyPhotos'));
    const next = images.slice(0, Math.max(0, room));
    if (kind === 'plant') setPlantPhotos([...plantPhotos, ...next]);
    else setFruitPhotos([...fruitPhotos, ...next]);
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#F8FAFC] p-3 sm:p-4 lg:p-6">
      <div className="shrink-0">
      <PageHeader
        title={t('mother.title')}
        subtitle={meta ? t('mother.subtitle', { total: meta.total, scions: meta.totalScionsHarvested }) : t('mother.subtitleEmpty')}
        action={
          canRegister ? (
            <button className="btn-primary" onClick={openCreate} data-speak={t('voice.addMother')}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('mother.add')}
            </button>
          ) : undefined
        }
      />
      <ErrorNote message={error} />
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
                placeholder={t('mother.listSearch')}
                aria-label={t('mother.listSearch')}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
              <select className="input !min-h-10 lg:w-36" value={plantFilter} aria-label={t('mother.plantName')} onChange={(event) => { setPlantFilter(event.target.value); setPage(1); }}>
                <option value="ALL">{t('mother.plantAll')}</option>
                {plantOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select className="input !min-h-10 lg:w-40" value={categoryFilter} aria-label={t('mother.category')} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}>
                <option value="ALL">{t('mother.categoryAll')}</option>
                {CATEGORIES.map((category) => <option key={category} value={category}>{t(`mother.categories.${category}`)}</option>)}
              </select>
              <select className="input !min-h-10 lg:w-40" value={healthFilter} aria-label={t('mother.health')} onChange={(event) => { setHealthFilter(event.target.value); setPage(1); }}>
                <option value="ALL">{t('mother.healthAll')}</option>
                {HEALTH.map((status) => <option key={status} value={status}>{t(`mother.healthOptions.${status}`)}</option>)}
              </select>
              <select className="input !min-h-10 lg:w-44" value={sort} aria-label={t('mother.sort')} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
                <option value="plant-asc">{t('mother.sorts.plantAsc')}</option>
                <option value="plant-desc">{t('mother.sorts.plantDesc')}</option>
                <option value="newest">{t('mother.sorts.newest')}</option>
                <option value="oldest">{t('mother.sorts.oldest')}</option>
                <option value="price-desc">{t('mother.sorts.priceHigh')}</option>
                <option value="price-asc">{t('mother.sorts.priceLow')}</option>
                <option value="scions">{t('mother.sorts.scions')}</option>
              </select>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">{t('mother.empty')}</p>
          ) : pageRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">{t('mother.noMatch')}</p>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {pageRows.map((m) => {
                const priceValue = priceDrafts[m.id] ?? (m.listPrice == null ? '' : String(m.listPrice));
                const methods = m.propagationMethods?.length
                  ? m.propagationMethods.map((method) => t(`mother.methodOptions.${method}`, { defaultValue: method })).join(', ')
                  : '—';
                const facts = [
                  [t('mother.specs.country'), m.sourceCountry || '—'],
                  [t('mother.specs.vendor'), m.sourceVendor || '—'],
                  [t('mother.specs.plot'), m.plotLocation],
                  [t('mother.specs.count'), String(m.plantCount ?? 1)],
                  [t('mother.specs.planted'), showDate(m.plantingDate)],
                  [t('mother.specs.method'), methods],
                  [t('mother.specs.season'), m.seasonCapacity == null ? '—' : String(m.seasonCapacity)],
                  [t('mother.specs.scions'), String(m.scionsHarvested)],
                  [t('mother.specs.batches'), String(m._count?.propagations ?? 0)],
                ] as const;
                return (
                  <li key={m.id} className="px-4 py-4 transition hover:bg-[#f6f8f6]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                      <div className="flex min-w-0 flex-1 gap-4">
                        <MediaThumb
                          letter={(m.plantName || m.varietyName || '?').slice(0, 1)}
                          photos={m.photos ?? []}
                          videoUrl={m.videoUrl}
                          photosLabel={t('mother.previewPhotos')}
                          videoLabel={t('mother.previewVideo')}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[10px] tracking-[0.16em] text-slate-400">{m.tagNumber}</p>
                          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                            <h2 className="font-['Cormorant_Garamond',Georgia,serif] text-[1.65rem] font-semibold leading-none tracking-tight text-slate-900">{m.plantName || m.varietyName}</h2>
                            {m.plantName && m.plantName !== m.varietyName && (
                              <span className="text-sm text-slate-500">{m.varietyName}</span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {m.category && (
                              <span className="rounded-full bg-[#eef6f0] px-2 py-0.5 text-[11px] font-medium text-[#1f6b45]">
                                {t(`mother.categories.${m.category}`, { defaultValue: m.category })}
                              </span>
                            )}
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${HEALTH_TONE[m.healthStatus] ?? HEALTH_TONE.HEALTHY}`}>
                              {t(`mother.healthOptions.${m.healthStatus}`, { defaultValue: m.healthStatus })}
                            </span>
                            {m.videoUrl && (
                              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">{t('mother.videoYes')}</span>
                            )}
                          </div>
                          {m.description && (
                            <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">{m.description}</p>
                          )}
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
                      <div className="flex w-full shrink-0 flex-col gap-2 border-t border-slate-100 pt-3 lg:w-60 lg:border-t-0 lg:pt-0">
                        {canRegister ? (
                          <div className="flex h-9 overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                            <label className="sr-only" htmlFor={`price-${m.id}`}>{t('mother.listPrice')}</label>
                            <span className="flex items-center border-r border-slate-200 bg-slate-50 px-2.5 font-['Noto_Sans_Bengali',sans-serif] text-sm text-slate-500" aria-hidden>{currencySymbol(user?.nursery?.currencyCode)}</span>
                            <input
                              id={`price-${m.id}`}
                              className="w-full min-w-0 border-0 bg-transparent px-2 text-right text-sm outline-none"
                              type="number"
                              min={0}
                              step="0.01"
                              value={priceValue}
                              aria-label={t('mother.listPrice')}
                              onChange={(event) => {
                                setPriceDrafts({ ...priceDrafts, [m.id]: event.target.value });
                                if (priceSaved === m.id) setPriceSaved(null);
                              }}
                            />
                            <button
                              className="shrink-0 bg-forest-700 px-3 text-xs font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
                              type="button"
                              disabled={priceSaving === m.id}
                              onClick={() => void savePrice(m)}
                            >
                              {priceSaving === m.id ? t('common.saving') : t('mother.savePrice')}
                            </button>
                          </div>
                        ) : (
                          <p className="text-right text-sm font-semibold text-slate-800">
                            {m.listPrice == null ? t('showcase.priceOnRequest') : formatMoney(m.listPrice, user?.nursery?.currencyCode)}
                          </p>
                        )}
                        {priceSaved === m.id && <p className="text-right text-xs font-medium text-emerald-700">{t('mother.priceSaved')}</p>}
                        <div className="grid grid-cols-2 gap-1.5">
                          {canRegister && (
                            <button className="inline-flex h-8 items-center justify-center gap-1 rounded-lg text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white" type="button" onClick={() => openEdit(m)}>
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                              {t('mother.edit')}
                            </button>
                          )}
                          <button className="inline-flex h-8 items-center justify-center gap-1 rounded-lg text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white" type="button" onClick={() => openTag(m.id)}>
                            <QrCode className="h-3.5 w-3.5" aria-hidden />
                            {t('mother.metalTag')}
                          </button>
                          {canLogScion && (
                            <>
                              <button className="inline-flex h-8 items-center justify-center rounded-lg text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white" type="button" onClick={() => openCycle(m)}>{t('mother.cycle')}</button>
                              <button className="inline-flex h-8 items-center justify-center gap-1 rounded-lg text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white" type="button" onClick={() => harvest(m.id)} data-speak={t('voice.logScion')}>
                                <Scissors className="h-3.5 w-3.5" aria-hidden />
                                {t('mother.logScion')}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {visiblePlants.length > 0 && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5">
              <p className="text-xs text-slate-500">
                {t('mother.range', {
                  from: (safePage - 1) * PAGE_SIZE + 1,
                  to: Math.min(safePage * PAGE_SIZE, visiblePlants.length),
                  count: visiblePlants.length,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 disabled:opacity-40" type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>{t('mother.prev')}</button>
                <span className="text-xs text-slate-500">{t('mother.pageOf', { page: safePage, pages: pageCount })}</span>
                <button className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 disabled:opacity-40" type="button" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>{t('mother.next')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? t('mother.editTitle') : t('mother.modalTitle')} width="max-w-3xl">
        <form onSubmit={create} className="space-y-4">
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <FormSection title={t('mother.sections.basic')}>
            <Field label={t('mother.tagNumber')} why={t('voice.tagNumber')} example="MP-BDG-A1B2">
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 font-mono text-sm text-slate-600">
                {editingTag || t('mother.tagAuto')}
              </p>
            </Field>
            <Field label={t('mother.category')} why={t('voice.category')} example={t('mother.categories.FRUIT')}>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>{t(`mother.categories.${category}`)}</option>
                ))}
              </select>
            </Field>
            <Field label={t('mother.plantName')} why={t('voice.plantName')} example="Guava">
              <CatalogPicker
                items={plants}
                value={form.plantName}
                placeholder={t('mother.choosePlant')}
                onChange={choosePlant}
                onCreate={addPlant}
                searchLabel={t('mother.plantSearch')}
                otherLabel={t('mother.varietyOther')}
                manualLabel={t('mother.plantManual')}
                addLabel={t('mother.varietyAdd')}
                emptyLabel={t('mother.plantNone')}
              />
            </Field>
            <Field label={t('mother.variety')} why={t('voice.variety')} example="Black Diamond Guava">
              <CatalogPicker
                items={varietyChoices}
                value={form.varietyName}
                placeholder={t('mother.chooseVariety')}
                onChange={(varietyName) => setForm({ ...form, varietyName })}
                onCreate={addVariety}
                searchLabel={t('mother.varietySearch')}
                otherLabel={t('mother.varietyOther')}
                manualLabel={t('mother.varietyManual')}
                addLabel={t('mother.varietyAdd')}
                emptyLabel={t('mother.varietyNone')}
              />
              {form.plantName && <p className="mt-1 text-xs text-slate-500">{t('mother.varietyFor', { plant: form.plantName })}</p>}
            </Field>
          </FormSection>
          <FormSection title={t('mother.sections.origin')}>
            <Field label={t('mother.sourceCountry')} why={t('voice.country')} example="Thailand">
              <select className="input" value={form.sourceCountry} onChange={(e) => setForm({ ...form, sourceCountry: e.target.value })}>
                {COUNTRIES.map((country) => (
                  <option key={country}>{country}</option>
                ))}
              </select>
            </Field>
            <Field label={t('mother.vendor')} why={t('voice.vendor')} example="Chiang Mai Nursery">
              <input className="input" value={form.sourceVendor} onChange={(e) => setForm({ ...form, sourceVendor: e.target.value })} maxLength={120} />
            </Field>
            <Field label={t('mother.listPrice')} why={t('voice.listPrice')} example="450">
              <input className="input" type="number" min={0} step="0.01" inputMode="decimal" value={form.listPrice} onChange={(e) => setForm({ ...form, listPrice: e.target.value })} />
            </Field>
            <Field label={t('mother.plantingDate')} why={t('voice.plantingDate')} example="YYYY-MM-DD">
              <input type="date" className="input" value={form.plantingDate} onChange={(e) => setForm({ ...form, plantingDate: e.target.value })} required />
            </Field>
            <Field label={t('mother.place')} why={t('mother.placeWhy')} example={t('mother.placeExample')}>
              <select className="input" required value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                <option value="">{t('mother.choosePlace')}</option>
                {places.map((place) => (
                  <option key={place.id} value={place.id}>{place.name || place.address}</option>
                ))}
              </select>
              {places.length === 0 && <p className="mt-1 text-xs normal-case tracking-normal text-amber-800">{t('mother.noPlaces')}</p>}
            </Field>
            <Field label={t('mother.plantCount')} why={t('mother.plantCountWhy')} example="200">
              <input className="input" type="number" min={1} step={1} required value={form.plantCount} onChange={(e) => setForm({ ...form, plantCount: e.target.value })} />
            </Field>
          </FormSection>
          <FormSection title={t('mother.sections.propagation')}>
            <div className="md:col-span-2">
              <Field label={t('mother.methods')} why={t('voice.methods')} example={t('mother.methodOptions.AIR_LAYERING')}>
                <div className="flex flex-wrap gap-2">
                  {METHODS.map((method) => {
                    const on = form.propagationMethods.includes(method);
                    return (
                      <button
                        key={method}
                        type="button"
                        aria-pressed={on}
                        className={`rounded-full border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 ${on ? 'border-forest-700 bg-forest-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                        onClick={() => toggleMethod(method)}
                      >
                        {t(`mother.methodOptions.${method}`)}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
            <Field label={t('mother.health')} why={t('voice.health')} example={t('mother.healthOptions.HEALTHY')}>
              <select className="input" value={form.healthStatus} onChange={(e) => setForm({ ...form, healthStatus: e.target.value })}>
                {HEALTH.map((status) => (
                  <option key={status} value={status}>{t(`mother.healthOptions.${status}`)}</option>
                ))}
              </select>
            </Field>
            <Field label={t('mother.capacity')} why={t('voice.capacity')} example="80">
              <input
                className="input"
                type="number"
                min={0}
                max={100000}
                inputMode="numeric"
                value={form.seasonCapacity}
                onChange={(e) => setForm({ ...form, seasonCapacity: e.target.value })}
              />
            </Field>
          </FormSection>
          <FormSection title={t('mother.sections.media')}>
            <div className="md:col-span-2">
              <Field label={t('mother.description')} why={t('voice.description')} example="Sweet dark fruit">
                <textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
              </Field>
            </div>
            {existingPhotos.some((photo) => !removedPhotoIds.includes(photo.id)) && (
              <div className="md:col-span-2 flex flex-wrap gap-2">
                {existingPhotos.filter((photo) => !removedPhotoIds.includes(photo.id)).map((photo) => (
                  <div key={photo.id} className="relative">
                    <img src={photo.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    <button type="button" className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white" aria-label={t('mother.removePhoto')} onClick={() => setRemovedPhotoIds([...removedPhotoIds, photo.id])}>
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {editingVideoUrl && !removeVideo && !video && (
              <div className="md:col-span-2">
                <video src={editingVideoUrl} controls className="max-h-48 w-full rounded-lg bg-black" />
                <button type="button" className="btn-ghost mt-2" onClick={() => setRemoveVideo(true)}>{t('mother.removePhoto')}</button>
              </div>
            )}
            <Field label={t('mother.plantPhotos')} why={t('voice.plantPhotos')} example={t('mother.photoHint')}>
              <MediaDropzone
                previews={plantPreviews}
                hint={t('mother.dropPhotos')}
                removeLabel={t('mother.removePhoto')}
                onAdd={(list) => addPhotos('plant', list)}
                onRemove={(index) => setPlantPhotos(plantPhotos.filter((_, i) => i !== index))}
              />
            </Field>
            <Field label={t('mother.fruitPhotos')} why={t('voice.fruitPhotos')} example={t('mother.photoHint')}>
              <MediaDropzone
                previews={fruitPreviews}
                hint={t('mother.dropPhotos')}
                removeLabel={t('mother.removePhoto')}
                onAdd={(list) => addPhotos('fruit', list)}
                onRemove={(index) => setFruitPhotos(fruitPhotos.filter((_, i) => i !== index))}
              />
            </Field>
            <div className="md:col-span-2" ref={videoBoxRef}>
              <Field label={t('mother.video')} why={t('voice.video')} example="MP4">
                {!video ? (
                  <MediaDropzone
                    previews={[]}
                    hint={t('mother.dropVideo')}
                    removeLabel={t('mother.removePhoto')}
                    multiple={false}
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
                    onAdd={(list) => {
                      const file = list?.[0];
                      if (!file) return;
                      if (!videoMime(file)) {
                        setVideo(null);
                        setVideoNote(t('mother.videoType'));
                        return;
                      }
                      if (file.size > MAX_VIDEO_BYTES) {
                        setVideo(null);
                        setVideoNote(t('mother.videoTooBig'));
                        return;
                      }
                      setError(null);
                      setVideoNote(null);
                      setVideo(file);
                      videoBoxRef.current?.scrollIntoView({ block: 'nearest' });
                    }}
                    onRemove={() => setVideo(null)}
                  />
                ) : (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3" role="status">
                    <p className="text-sm font-semibold text-emerald-900">
                      {saving ? t('mother.videoUploading', { percent: videoProgress }) : t('mother.videoReady')}
                    </p>
                    <p className="mt-1 text-sm text-emerald-950">
                      {video.name} · {(video.size / 1048576).toFixed(1)} MB
                    </p>
                    <p className="mt-1 text-xs text-emerald-800">
                      {saving ? t('mother.videoUploadingHint', { percent: videoProgress }) : t('mother.videoReadyHint')}
                    </p>
                    {saving && (
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
                        <div className="h-full bg-emerald-700" style={{ width: `${videoProgress}%` }} />
                      </div>
                    )}
                    {videoPreview && <video src={videoPreview} controls className="mt-3 max-h-48 w-full rounded-lg bg-black" />}
                    {!saving && (
                      <button type="button" className="btn-ghost mt-3" onClick={() => { setVideo(null); setVideoNote(null); }}>
                        {t('mother.removePhoto')}
                      </button>
                    )}
                  </div>
                )}
                {videoNote && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{videoNote}</p>}
              </Field>
            </div>
            <p className="text-xs text-slate-500 md:col-span-2">{t('mother.photoHint')} {t('mother.photoCount', { count: photoTotal })}</p>
          </FormSection>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" disabled={saving} data-speak={t('voice.saveMother')}>
              {saving && video ? t('mother.videoUploading', { percent: videoProgress }) : saving ? t('common.saving') : editingId ? t('mother.saveEdit') : t('mother.save')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!cycleFor} onClose={() => setCycleFor(null)} title={t('mother.cycleTitle')}>
        <ul className="mb-4 space-y-1 text-sm">
          {cycles.map((c) => (
            <li key={c.id}>{t(`mother.kinds.${c.kind}`)} · {new Date(c.observedOn).toLocaleDateString()} {c.notes ? `· ${c.notes}` : ''}</li>
          ))}
          {cycles.length === 0 && <li className="text-slate-400">{t('mother.noCycle')}</li>}
        </ul>
        <form onSubmit={saveCycle} className="space-y-3">
          <Field label={t('mother.kind')}>
            <select className="input" value={cycleForm.kind} onChange={(e) => setCycleForm({ ...cycleForm, kind: e.target.value })}>
              <option value="FLOWERING">{t('mother.kinds.FLOWERING')}</option>
              <option value="FRUITING">{t('mother.kinds.FRUITING')}</option>
            </select>
          </Field>
          <Field label={t('mother.observedOn')}>
            <input type="date" className="input" value={cycleForm.observedOn} onChange={(e) => setCycleForm({ ...cycleForm, observedOn: e.target.value })} required />
          </Field>
          <Field label={t('mother.notes')}>
            <input className="input" value={cycleForm.notes} onChange={(e) => setCycleForm({ ...cycleForm, notes: e.target.value })} />
          </Field>
          <button className="btn-primary">{t('mother.saveCycle')}</button>
        </form>
      </Modal>

      <Modal open={!!tag} onClose={() => setTag(null)} title={t('mother.metalTag')} width="max-w-md">
        {tag && (
          <div className="text-center">
            <img src={tag.qrDataUrl} alt={tag.tagNumber} className="mx-auto h-44 w-44 rounded-xl border border-slate-200 bg-white p-2" />
            <div className="mt-3 font-mono text-lg font-bold">{tag.tagNumber}</div>
            <div className="text-sm text-slate-600">{tag.plantName ? `${tag.plantName} · ${tag.varietyName}` : tag.varietyName}</div>
            <a href={tag.publicUrl} target="_blank" rel="noreferrer" className="mt-3 block break-all text-sm text-forest-700 underline">
              {tag.publicUrl}
            </a>
            <p className="mt-2 text-xs text-slate-500">{t('mother.shareHint')}</p>
            <div className="mt-4 grid gap-2">
              <button type="button" className="btn-primary" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(t('mother.shareText', { plant: tag.plantName || tag.varietyName, variety: tag.varietyName, url: tag.publicUrl }))}`, '_blank', 'noopener,noreferrer')}>
                {t('mother.shareWhatsApp')}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(tag.publicUrl).then(() => setCopied(true));
                }}
              >
                {copied ? t('mother.copied') : t('mother.copyLink')}
              </button>
              {'share' in navigator && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    void navigator.share({
                      title: tag.varietyName,
                      text: t('mother.shareText', { plant: tag.plantName || tag.varietyName, variety: tag.varietyName, url: tag.publicUrl }),
                      url: tag.publicUrl,
                    });
                  }}
                >
                  {t('mother.shareMore')}
                </button>
              )}
              <button type="button" className="btn-ghost" onClick={printTag}>{t('common.print')}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
