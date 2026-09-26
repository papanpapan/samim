import { FormEvent, useEffect, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AddressField } from '../components/AddressField';
import { ErrorNote, Field, ListSkeleton, Modal, PageHeader } from '../components/ui';
import { channelName } from '../constants/salesChannels';

import { formatMoney } from '../utils/money';

interface Grant {
  feature: string;
  enabled: boolean;
}

interface CatalogItem {
  key: string;
  label: string;
  description: string | null;
  system: boolean;
  active: boolean;
}

interface NurseryUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  locationId: string | null;
  featureGrants: Grant[];
}

interface NurseryRow {
  id: string;
  name: string;
  code: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  locations: { id: string; name: string; address: string; latitude: number | null; longitude: number | null }[];
  onboardedAt: string;
  plan: string;
  planPrice: string | number;
  currencyCode: string;
  userLimit: number;
  plantLimit: number;
  status: string;
  features: Grant[];
  salesChannels?: { channel: string; enabled: boolean }[];
  users: NurseryUser[];
}

interface PackagePlan {
  code: string;
  label: string;
  price: number;
  userLimit: number;
  plantLimit: number;
}

interface PlaceDraft {
  key: string;
  id?: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

function localId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function blankPlace(): PlaceDraft {
  return { key: localId(), name: '', address: '' };
}

function todayDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatOnboarded(value: string | null | undefined) {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

function enabledSet(rows: Grant[] | undefined, fallback: string[]) {
  if (!rows || rows.length === 0) return new Set(fallback);
  return new Set(rows.filter((row) => row.enabled).map((row) => row.feature));
}

function ModuleSwitch({
  on,
  label,
  disabled,
  onToggle,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium leading-none transition disabled:cursor-not-allowed disabled:opacity-40 ${
        on
          ? 'border-forest-800 bg-forest-700 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ${on ? 'bg-white text-forest-800' : 'bg-slate-100 text-transparent'}`} aria-hidden>
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function FeatureChips({
  keys,
  selected,
  labelFor,
  disabledKeys,
  onToggle,
}: {
  keys: string[];
  selected: Set<string>;
  labelFor: (key: string) => string;
  disabledKeys?: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2">
      {keys.map((key) => (
        <ModuleSwitch
          key={key}
          label={labelFor(key)}
          on={selected.has(key)}
          disabled={disabledKeys ? !disabledKeys.has(key) : false}
          onToggle={() => onToggle(key)}
        />
      ))}
    </div>
  );
}

export function Platform() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [rows, setRows] = useState<NurseryRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [featureForm, setFeatureForm] = useState({ key: '', label: '', description: '' });
  const [packages, setPackages] = useState<PackagePlan[]>([]);
  const [packageDrafts, setPackageDrafts] = useState<Record<string, PackagePlan>>({});
  const [form, setForm] = useState({
    name: '',
    places: [blankPlace()] as PlaceDraft[],
    phone: '',
    onboardedAt: todayDate(),
    plan: 'FREE',
    planPrice: '0',
    currencyCode: 'BDT',
    userLimit: '2',
    plantLimit: '50',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    features: new Set<string>(),
  });
  const [person, setPerson] = useState({ name: '', email: '', password: '', role: 'STAFF', locationId: '' });
  const [personError, setPersonError] = useState<string | null>(null);
  const [personOpen, setPersonOpen] = useState(false);
  const [tab, setTab] = useState<'sites' | 'modules'>('sites');
  const [dialog, setDialog] = useState<null | 'onboard' | 'features' | 'channels' | 'people' | 'packages'>(null);
  const [channelDraft, setChannelDraft] = useState<Set<string>>(new Set());
  const [channelCatalog, setChannelCatalog] = useState<{ code: string; label: string; system: boolean; inUse: boolean }[]>([]);
  const [channelNameInput, setChannelNameInput] = useState('');
  const [channelError, setChannelError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [channelBusy, setChannelBusy] = useState<'add' | 'save' | 'delete' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [grantUserId, setGrantUserId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'name-desc' | 'newest' | 'oldest' | 'people'>('name');
  const [page, setPage] = useState(1);
  const [editingNurseryId, setEditingNurseryId] = useState<string | null>(null);
  const [passwordUserId, setPasswordUserId] = useState('');
  const pageSize = 5;
  const roles = ['ADMIN', 'MANAGER', 'STAFF', 'CASHIER'] as const;

  const keys = catalog.filter((item) => item.active).map((item) => item.key);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/platform/nurseries'), api.get('/platform/features'), api.get('/platform/packages')])
      .then(([nurseries, features, plans]) => {
        setRows(nurseries.data.data);
        const list = features.data.data as CatalogItem[];
        setCatalog(list);
        setDrafts(Object.fromEntries(list.map((item) => [item.key, item.label])));
        const planRows = plans.data.data as PackagePlan[];
        setPackages(planRows);
        setPackageDrafts(Object.fromEntries(planRows.map((plan) => [plan.code, plan])));
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (form.name === '' && keys.length > 0 && form.features.size === 0) {
      setForm((current) => ({ ...current, features: new Set(keys) }));
    }
  }, [keys.join('|')]);

  const label = (key: string) => catalog.find((item) => item.key === key)?.label ?? t(`platform.featureLabels.${key}`, { defaultValue: key });

  const toggleFormFeature = (key: string) => {
    setForm((current) => {
      const features = new Set(current.features);
      if (features.has(key)) features.delete(key);
      else features.add(key);
      return { ...current, features };
    });
  };

  const createNursery = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        places: form.places.map((place) => ({
          id: place.id,
          name: place.name || undefined,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
        })),
        phone: form.phone || undefined,
        onboardedAt: form.onboardedAt,
        plan: form.plan,
        planPrice: Number(form.planPrice),
        currencyCode: form.currencyCode,
        userLimit: Number(form.userLimit),
        plantLimit: Number(form.plantLimit),
        features: [...form.features],
      };
      if (editingNurseryId) {
        await api.patch(`/platform/nurseries/${editingNurseryId}`, payload);
        const nursery = rows.find((row) => row.id === editingNurseryId);
        const login = nursery?.users.find((user) => user.id === passwordUserId);
        if (login && form.adminPassword.trim()) {
          await api.patch(`/platform/users/${login.id}`, {
            name: login.name,
            role: login.role,
            password: form.adminPassword,
          });
        }
      } else {
        await api.post('/platform/nurseries', {
          ...payload,
          admin: { name: form.adminName, email: form.adminEmail, password: form.adminPassword },
        });
      }
      setForm({
        name: '',
        places: [blankPlace()],
        phone: '',
        onboardedAt: todayDate(),
        plan: 'FREE',
        planPrice: '0',
        currencyCode: 'BDT',
        userLimit: '2',
        plantLimit: '50',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        features: new Set(keys),
      });
      setEditingNurseryId(null);
      setDialog(null);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (nursery: NurseryRow) => {
    const places = nursery.locations?.length
      ? nursery.locations
      : [{ id: localId(), name: '', address: nursery.address || nursery.city || 'Area', latitude: null, longitude: null }];
    setEditingNurseryId(nursery.id);
    setForm({
      name: nursery.name,
      places: places.map((place) => ({
        key: place.id,
        id: place.id,
        name: place.name,
        address: place.address,
        latitude: place.latitude ?? undefined,
        longitude: place.longitude ?? undefined,
      })),
      phone: nursery.phone ?? '',
      onboardedAt: nursery.onboardedAt.slice(0, 10),
      plan: nursery.plan,
      planPrice: String(Number(nursery.planPrice)),
      currencyCode: nursery.currencyCode === 'INR' ? 'INR' : 'BDT',
      userLimit: String(nursery.userLimit),
      plantLimit: String(nursery.plantLimit),
      adminName: '',
      adminEmail: '',
      adminPassword: '',
      features: enabledSet(nursery.features, keys),
    });
    const login = nursery.users.find((user) => user.role === 'ADMIN') ?? nursery.users[0];
    setPasswordUserId(login?.id ?? '');
    setDialog('onboard');
  };

  const saveNurseryFeatures = async (nursery: NurseryRow, feature: string, enabled: boolean) => {
    const features = keys.map((key) => ({
      feature: key,
      enabled: key === feature ? enabled : enabledSet(nursery.features, keys).has(key),
    }));
    setError(null);
    try {
      await api.patch(`/platform/nurseries/${nursery.id}/features`, { features });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const setStatus = async (nursery: NurseryRow) => {
    setError(null);
    try {
      await api.patch(`/platform/nurseries/${nursery.id}/status`, {
        status: nursery.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
      });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openNursery = async (nursery: NurseryRow) => {
    localStorage.setItem('sn-nursery', nursery.id);
    await refresh();
    navigate('/');
  };

  const savePersonFeatures = async (user: NurseryUser, feature: string, enabled: boolean, inherit: boolean) => {
    const current = user.featureGrants.length ? enabledSet(user.featureGrants, []) : enabledSet([], keys);
    if (inherit) current.clear();
    const features = keys.map((key) => ({
      feature: key,
      enabled: inherit ? false : key === feature ? enabled : current.has(key) || user.featureGrants.length === 0,
    }));
    setError(null);
    try {
      await api.patch(`/platform/users/${user.id}/features`, { features, inherit });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const closePersonForm = () => {
    setPersonOpen(false);
    setEditingId(null);
    setPersonError(null);
    setPerson({ name: '', email: '', password: '', role: 'STAFF', locationId: '' });
  };

  const startAddStaff = (locationId = '') => {
    setEditingId(null);
    setGrantUserId(null);
    setPersonError(null);
    setPerson({ name: '', email: '', password: '', role: 'STAFF', locationId });
    setPersonOpen(true);
  };

  const startEditStaff = (user: NurseryUser) => {
    setGrantUserId(null);
    setConfirmId(null);
    setPersonError(null);
    setEditingId(user.id);
    setPerson({ name: user.name, email: user.email, password: '', role: user.role, locationId: user.locationId ?? '' });
    setPersonOpen(true);
  };

  const addPerson = async (event: FormEvent, nurseryId: string) => {
    event.preventDefault();
    setBusy(true);
    setPersonError(null);
    try {
      await api.post(`/platform/nurseries/${nurseryId}/users`, {
        name: person.name,
        email: person.email,
        password: person.password,
        role: person.role,
        locationId: person.locationId || undefined,
      });
      closePersonForm();
      load();
    } catch (err) {
      const raw = apiErrorMessage(err);
      const match = raw.match(/This plan allows (\d+) people/);
      const nursery = rows.find((row) => row.id === nurseryId);
      setPersonError(match && nursery
        ? t('site.peopleLimit', {
            plan: t(`site.plans.${nursery.plan}`, { defaultValue: nursery.plan }),
            limit: Number(match[1]),
            count: nursery.users.length,
          })
        : raw);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    setBusy(true);
    setPersonError(null);
    try {
      await api.patch(`/platform/users/${editingId}`, {
        name: person.name,
        role: person.role,
        password: person.password || undefined,
        locationId: person.locationId || null,
      });
      closePersonForm();
      load();
    } catch (err) {
      setPersonError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removePerson = async (userId: string) => {
    setBusy(true);
    setPersonError(null);
    try {
      await api.delete(`/platform/users/${userId}`);
      setConfirmId(null);
      if (grantUserId === userId) setGrantUserId(null);
      if (editingId === userId) closePersonForm();
      load();
    } catch (err) {
      setPersonError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openChannels = (nursery: NurseryRow) => {
    const enabled = new Set((nursery.salesChannels ?? []).filter((row) => row.enabled).map((row) => row.channel));
    setChannelDraft(enabled.size > 0 ? enabled : new Set(['RETAIL_COUNTER', 'WHOLESALE_ORCHARDIST', 'INDIAMART', 'MEESHO']));
    setChannelNameInput('');
    setChannelError(null);
    setPendingDelete(null);
    setSelectedId(nursery.id);
    setDialog('channels');
    api.get('/platform/channels')
      .then((res) => setChannelCatalog(res.data.data as { code: string; label: string; system: boolean; inUse: boolean }[]))
      .catch((err) => setChannelError(apiErrorMessage(err)));
  };

  const addChannel = async (event: FormEvent) => {
    event.preventDefault();
    const label = channelNameInput.trim();
    if (label.length < 2) return;
    setChannelBusy('add');
    setChannelError(null);
    try {
      const res = await api.post('/platform/channels', { label });
      const row = res.data.data as { code: string; label: string; system: boolean; inUse: boolean };
      setChannelCatalog((current) => current.some((item) => item.code === row.code) ? current : [...current, row]);
      setChannelDraft((current) => new Set(current).add(row.code));
      setChannelNameInput('');
    } catch (err) {
      setChannelError(apiErrorMessage(err));
    } finally {
      setChannelBusy(null);
    }
  };

  const deleteChannel = async (code: string) => {
    setChannelBusy('delete');
    setChannelError(null);
    try {
      await api.delete(`/platform/channels/${code}`);
      setChannelCatalog((current) => current.filter((item) => item.code !== code));
      setChannelDraft((current) => {
        const next = new Set(current);
        next.delete(code);
        return next;
      });
      setPendingDelete(null);
    } catch (err) {
      setChannelError(apiErrorMessage(err));
    } finally {
      setChannelBusy(null);
    }
  };

  const saveChannels = async () => {
    if (!selected || channelDraft.size === 0 || channelCatalog.length === 0) return;
    setChannelBusy('save');
    setChannelError(null);
    try {
      await api.patch(`/platform/nurseries/${selected.id}/channels`, {
        channels: channelCatalog.map((row) => ({ channel: row.code, enabled: channelDraft.has(row.code) })),
      });
      setDialog(null);
      load();
    } catch (err) {
      setChannelError(apiErrorMessage(err));
    } finally {
      setChannelBusy(null);
    }
  };

  const openPeople = (nurseryId: string) => {
    setSelectedId(nurseryId);
    setDialog('people');
    setEditingId(null);
    setGrantUserId(null);
    setConfirmId(null);
    setPersonOpen(false);
    setPersonError(null);
    setPerson({ name: '', email: '', password: '', role: 'STAFF', locationId: '' });
  };

  const addFeature = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/platform/features', {
        key: featureForm.key.trim().toUpperCase().replace(/\s+/g, '_'),
        label: featureForm.label,
        description: featureForm.description || undefined,
      });
      setFeatureForm({ key: '', label: '', description: '' });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveLabel = async (item: CatalogItem) => {
    setError(null);
    try {
      await api.patch(`/platform/features/${item.key}`, { label: drafts[item.key] || item.label });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const removeFeature = async (item: CatalogItem) => {
    setError(null);
    try {
      if (item.active) await api.delete(`/platform/features/${item.key}`);
      else await api.patch(`/platform/features/${item.key}`, { active: true });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const choosePlan = (plan: PackagePlan) => {
    setForm((current) => ({
      ...current,
      plan: plan.code,
      planPrice: String(plan.price),
      userLimit: String(plan.userLimit),
      plantLimit: String(plan.plantLimit),
    }));
  };

  const savePackages = async () => {
    setBusy(true);
    setError(null);
    try {
      await Promise.all(
        packages.map((plan) =>
          api.patch(`/platform/packages/${plan.code}`, {
            price: Number(packageDrafts[plan.code]?.price ?? plan.price),
            userLimit: Number(packageDrafts[plan.code]?.userLimit ?? plan.userLimit),
            plantLimit: Number(packageDrafts[plan.code]?.plantLimit ?? plan.plantLimit),
          }),
        ),
      );
      setDialog(null);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const activeSites = rows.filter((row) => row.status === 'ACTIVE').length;
  const liveModules = catalog.filter((item) => item.active).length;
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const editingNursery = rows.find((row) => row.id === editingNurseryId) ?? null;
  const grantUser = selected?.users.find((user) => user.id === grantUserId) ?? null;
  const needle = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    if (planFilter && row.plan !== planFilter) return false;
    if (!needle) return true;
    const placeText = (row.locations ?? []).map((place) => `${place.name} ${place.address}`).join(' ');
    return [row.name, row.code, row.city ?? '', row.address ?? '', row.plan, formatOnboarded(row.onboardedAt), placeText].some((value) => value.toLowerCase().includes(needle));
  });
  const sorted = [...visible].sort((a, b) => {
    if (sortKey === 'name-desc') return b.name.localeCompare(a.name);
    if (sortKey === 'newest') return b.onboardedAt.localeCompare(a.onboardedAt);
    if (sortKey === 'oldest') return a.onboardedAt.localeCompare(b.onboardedAt);
    if (sortKey === 'people') return b.users.length - a.users.length;
    return a.name.localeCompare(b.name);
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{t('platform.kicker')}</p>
      <PageHeader
        title={t('platform.title')}
        subtitle={t('platform.subtitle')}
        action={
          <div className="flex rounded-lg bg-slate-100 p-1">
            {(['sites', 'modules'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`min-h-12 rounded-md px-4 text-sm font-semibold ${
                  tab === item ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t(item === 'sites' ? 'platform.tabSites' : 'platform.tabModules')}
              </button>
            ))}
          </div>
        }
      />
      <ErrorNote message={error} />
      {loading ? <ListSkeleton rows={6} /> : null}

      {!loading && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            [t('platform.sites'), rows.length],
            [t('platform.active'), activeSites],
            [t('platform.modulesOn'), liveModules],
          ].map(([caption, value]) => (
            <div key={String(caption)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{caption}</div>
              <div className="mt-1 font-mono text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'sites' && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="input sm:max-w-xs"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder={t('platform.searchPlaceholder')}
            aria-label={t('platform.searchPlaceholder')}
          />
          <select className="input sm:max-w-[9rem]" aria-label={t('platform.filterStatus')} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">{t('platform.filterAll')}</option>
            <option value="ACTIVE">{t('platform.active')}</option>
            <option value="SUSPENDED">{t('platform.suspended')}</option>
          </select>
          <select className="input sm:max-w-[9rem]" aria-label={t('platform.filterPlan')} value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}>
            <option value="">{t('platform.filterAll')}</option>
            {packages.map((plan) => <option key={plan.code} value={plan.code}>{plan.label}</option>)}
          </select>
          <select className="input sm:max-w-[11rem]" aria-label={t('platform.sort')} value={sortKey} onChange={(e) => { setSortKey(e.target.value as typeof sortKey); setPage(1); }}>
            <option value="name">{t('platform.sortName')}</option>
            <option value="name-desc">{t('platform.sortNameDesc')}</option>
            <option value="newest">{t('platform.sortNewest')}</option>
            <option value="oldest">{t('platform.sortOldest')}</option>
            <option value="people">{t('platform.sortPeople')}</option>
          </select>
          <button className="btn-ghost sm:ml-auto" type="button" onClick={() => setDialog('packages')}>
            {t('platform.packages')}
          </button>
          <button className="btn-primary" type="button" onClick={() => { setEditingNurseryId(null); setForm({ name: '', places: [blankPlace()], phone: '', onboardedAt: todayDate(), plan: 'FREE', planPrice: '0', currencyCode: 'BDT', userLimit: '2', plantLimit: '50', adminName: '', adminEmail: '', adminPassword: '', features: new Set(keys) }); setDialog('onboard'); }}>
            {t('platform.add')}
          </button>
        </div>
      )}

      {!loading && tab === 'modules' && (
        <section className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
            <h2 className="text-lg font-semibold tracking-tight">{t('platform.catalog')}</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">{t('platform.catalogHelp')}</p>
          </div>
          <form onSubmit={addFeature} className="grid grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50 p-5 sm:grid-cols-4">
            <Field label={t('platform.catalogKey')}>
              <input className="input font-mono uppercase" required value={featureForm.key} onChange={(e) => setFeatureForm({ ...featureForm, key: e.target.value.toUpperCase() })} />
            </Field>
            <Field label={t('platform.catalogLabel')}>
              <input className="input" required value={featureForm.label} onChange={(e) => setFeatureForm({ ...featureForm, label: e.target.value })} />
            </Field>
            <Field label={t('platform.catalogDescription')}>
              <input className="input" value={featureForm.description} onChange={(e) => setFeatureForm({ ...featureForm, description: e.target.value })} />
            </Field>
            <div className="flex items-end">
              <button className="btn-primary w-full" disabled={busy}>{t('platform.catalogAdd')}</button>
            </div>
          </form>
          <ul className="divide-y divide-slate-100">
            {catalog.map((item) => (
              <li key={item.key} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center ${item.active ? '' : 'bg-slate-50 opacity-70'}`}>
                <div className="w-full sm:w-44">
                  <div className="font-mono text-xs font-semibold tracking-wide text-slate-500">{item.key}</div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {item.system ? t('platform.builtIn') : t('platform.custom')}
                  </div>
                </div>
                <input className="input" value={drafts[item.key] ?? item.label} onChange={(e) => setDrafts({ ...drafts, [item.key]: e.target.value })} aria-label={item.key} />
                <div className="flex gap-2">
                  <button className="btn-ghost" type="button" onClick={() => saveLabel(item)}>{t('common.save')}</button>
                  <button className="btn-ghost" type="button" onClick={() => removeFeature(item)}>
                    {item.active ? t('platform.catalogDelete') : t('platform.catalogRestore')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && tab === 'sites' && (
        <div className="card overflow-hidden">
          {sorted.length === 0 && <p className="px-5 py-8 text-sm text-slate-500">{t('platform.empty')}</p>}
          <ul className="divide-y divide-slate-100">
            {pageRows.map((nursery) => {
              const on = enabledSet(nursery.features, keys);
              const live = nursery.status === 'ACTIVE';
              return (
                <li key={nursery.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">{nursery.name}</h2>
                      <span className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${live ? 'bg-forest-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {live ? t('platform.active') : t('platform.suspended')}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {nursery.code}
                      {` · ${formatOnboarded(nursery.onboardedAt)}`}
                      {` · ${nursery.plan}`}
                      {` · ${formatMoney(Number(nursery.planPrice), nursery.currencyCode)}`}
                      {(nursery.locations?.[0]?.address || nursery.address || nursery.city) ? ` · ${nursery.locations?.[0]?.address || nursery.address || nursery.city}` : ''}
                      {(nursery.locations?.length ?? 0) > 1 ? ` · +${(nursery.locations?.length ?? 1) - 1}` : ''}
                      {` · ${nursery.users.length} ${t('platform.peopleCount')}`}
                      {` · ${on.size} ${t('platform.enabledOf')}`}
                    </p>
                    {(nursery.locations?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {nursery.locations.map((place) => (
                          <span key={place.id} className="max-w-[18rem] truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600" title={place.address}>
                            {place.name ? `${place.name} · ${place.address}` : place.address}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-ghost" type="button" onClick={() => openEdit(nursery)}>{t('platform.editNursery')}</button>
                    <button className="btn-ghost" type="button" onClick={() => { setSelectedId(nursery.id); setDialog('features'); }}>{t('platform.permissions')}</button>
                    <button className="btn-ghost" type="button" onClick={() => openChannels(nursery)}>{t('platform.channels')}</button>
                    <button className="btn-ghost" type="button" onClick={() => openPeople(nursery.id)}>{t('platform.users')}</button>
                    <button className="btn-ghost" type="button" onClick={() => setStatus(nursery)}>
                      {live ? t('platform.suspend') : t('platform.activate')}
                    </button>
                    <button className="btn-primary" type="button" onClick={() => openNursery(nursery)}>{t('platform.open')}</button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>{t('platform.pageOf', { page: safePage, pages: pageCount, count: sorted.length })}</span>
            <div className="flex gap-2">
              <button className="btn-ghost !min-h-9" type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>{t('platform.prev')}</button>
              <button className="btn-ghost !min-h-9" type="button" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>{t('platform.next')}</button>
            </div>
          </div>
        </div>
      )}

      <Modal open={dialog === 'onboard'} onClose={() => { setDialog(null); setEditingNurseryId(null); }} title={editingNurseryId ? t('platform.editNursery') : t('platform.add')} width="max-w-3xl">
        <form onSubmit={createNursery} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:col-span-2">{t('platform.siteBlock')}</h3>
          <Field label={t('platform.name')} why={t('platform.hints.nameWhy')} example={t('platform.hints.nameExample')}>
            <input className="input" required placeholder={t('platform.hints.nameExample')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={t('platform.code')} why={t('platform.hints.codeWhy')} example={t('platform.hints.codeExample')}>
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 font-mono text-sm text-slate-600">
              {editingNurseryId ? rows.find((row) => row.id === editingNurseryId)?.code : t('platform.codeAuto')}
            </p>
          </Field>
          <div className="space-y-3 sm:col-span-2">
            {form.places.map((place, index) => (
              <div key={place.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {t('platform.place')} {index + 1}
                  </span>
                  {form.places.length > 1 && (
                    <button
                      className="text-xs font-medium text-slate-500 hover:text-slate-800"
                      type="button"
                      onClick={() => setForm({ ...form, places: form.places.filter((item) => item.key !== place.key) })}
                    >
                      {t('platform.removePlace')}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <Field label={t('platform.placeName')} why={index === 0 ? t('platform.hints.placeWhy') : undefined} example={t('platform.hints.placeExample')}>
                    <input
                      className="input"
                      placeholder={t('platform.hints.placeExample')}
                      value={place.name}
                      onChange={(event) => {
                        const places = form.places.map((item) => item.key === place.key ? { ...item, name: event.target.value } : item);
                        setForm({ ...form, places });
                      }}
                    />
                  </Field>
                  <AddressField
                    value={place.address}
                    why={index === 0 ? t('platform.hints.addressWhy') : undefined}
                    example={t('platform.hints.addressExample')}
                    onChange={(next) => {
                      const places = form.places.map((item) => item.key === place.key ? { ...item, address: next.address, latitude: next.latitude, longitude: next.longitude } : item);
                      setForm({ ...form, places });
                    }}
                  />
                </div>
              </div>
            ))}
            <button className="btn-ghost !min-h-9" type="button" onClick={() => setForm({ ...form, places: [...form.places, blankPlace()] })}>
              {t('platform.addPlace')}
            </button>
          </div>
          <Field label={t('platform.phone')} why={t('platform.hints.phoneWhy')} example={t('platform.hints.phoneExample')}>
            <input className="input" placeholder={t('platform.hints.phoneExample')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label={t('platform.onboardedAt')} why={t('platform.hints.onboardedWhy')} example={t('platform.hints.onboardedExample')}>
            <input className="input" type="date" required aria-label={t('platform.onboardedAt')} value={form.onboardedAt} onChange={(e) => setForm({ ...form, onboardedAt: e.target.value })} />
          </Field>
          <Field label={t('platform.currency')} why={t('platform.hints.currencyWhy')} example={t('platform.hints.currencyExample')}>
            <select
              className="input"
              required
              aria-label={t('platform.currency')}
              value={form.currencyCode}
              onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
            >
              <option value="BDT">{t('platform.currencyBdt')}</option>
              <option value="INR">{t('platform.currencyInr')}</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('platform.plan')} why={t('platform.hints.planWhy')} example={t('platform.hints.planExample')}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {packages.map((plan) => (
                  <button
                    key={plan.code}
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-left ${form.plan === plan.code ? 'border-forest-700 bg-forest-700 text-white' : 'border-slate-200 bg-white text-slate-800'}`}
                    onClick={() => choosePlan(plan)}
                  >
                    <div className="text-sm font-semibold">{plan.label}</div>
                    <div className="mt-1 font-mono text-xs">{formatMoney(plan.price, form.currencyCode)}</div>
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <Field label={t('platform.userLimit')} why={t('platform.hints.userLimitWhy')} example={t('platform.hints.userLimitExample')}>
            <input className="input" required inputMode="numeric" min={0} placeholder={t('platform.hints.userLimitExample')} value={form.userLimit} onChange={(e) => setForm({ ...form, userLimit: e.target.value })} />
          </Field>
          {editingNursery && editingNursery.users.length > 0 ? (
            <div className="sm:col-span-2">
              <Field label={t('platform.changePassword')} why={t('platform.hints.changePasswordWhy')} example={t('platform.hints.passwordExample')}>
                {editingNursery.users.length > 1 && (
                  <select className="input mb-2" value={passwordUserId} onChange={(event) => setPasswordUserId(event.target.value)} aria-label={t('platform.changePassword')}>
                    {editingNursery.users.map((user) => (
                      <option key={user.id} value={user.id}>{user.name} · {user.email}</option>
                    ))}
                  </select>
                )}
                {editingNursery.users.length === 1 && (
                  <p className="mb-2 text-sm normal-case tracking-normal text-slate-500">
                    {editingNursery.users[0].name} · {editingNursery.users[0].email}
                  </p>
                )}
                <input
                  className="input"
                  type="password"
                  minLength={form.adminPassword ? 6 : undefined}
                  placeholder={t('platform.hints.passwordExample')}
                  value={form.adminPassword}
                  onChange={(event) => setForm({ ...form, adminPassword: event.target.value })}
                />
                <span className="mt-1 block text-xs normal-case tracking-normal text-slate-400">{t('platform.passwordKeep')}</span>
              </Field>
            </div>
          ) : null}
          {!editingNurseryId && (
            <>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:col-span-2">{t('platform.adminBlock')}</h3>
              <Field label={t('platform.adminName')} why={t('platform.hints.adminWhy')} example={t('platform.hints.adminExample')}>
                <input className="input" required placeholder={t('platform.hints.adminExample')} value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
              </Field>
              <Field label={t('platform.adminEmail')} why={t('platform.hints.emailWhy')} example={t('platform.hints.emailExample')}>
                <input className="input" type="email" required placeholder={t('platform.hints.emailExample')} value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
              </Field>
              <Field label={t('platform.adminPassword')} why={t('platform.hints.passwordWhy')} example={t('platform.hints.passwordExample')}>
                <input className="input" type="password" required minLength={6} placeholder={t('platform.hints.passwordExample')} value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
              </Field>
            </>
          )}
          <div className="sm:col-span-2">
            <Field label={t('platform.features')} why={t('platform.hints.featuresWhy')} example={t('platform.hints.featuresExample')}>
              <span className="sr-only">{t('platform.features')}</span>
            </Field>
            <FeatureChips keys={keys} selected={form.features} labelFor={label} onToggle={toggleFormFeature} />
          </div>
          <button className="btn-primary sm:col-span-2" disabled={busy}>{editingNurseryId ? t('common.save') : t('platform.saveNursery')}</button>
        </form>
      </Modal>

      <Modal open={dialog === 'packages'} onClose={() => setDialog(null)} title={t('platform.packages')} width="max-w-3xl">
        <form
          className="grid grid-cols-1 gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void savePackages();
          }}
        >
          {packages.map((plan) => {
            const draft = packageDrafts[plan.code] ?? plan;
            return (
              <div key={plan.code} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                <div className="text-sm font-semibold text-slate-900 sm:col-span-2">{plan.label}</div>
                <label className="block text-xs text-slate-500">
                  {t('platform.price')}
                  <input
                    className="input mt-1"
                    inputMode="decimal"
                    placeholder={t('platform.hints.priceExample')}
                    value={draft.price}
                    onChange={(event) =>
                      setPackageDrafts({ ...packageDrafts, [plan.code]: { ...draft, price: Number(event.target.value) } })
                    }
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  {t('platform.userLimit')}
                  <input
                    className="input mt-1"
                    inputMode="numeric"
                    placeholder={t('platform.hints.userLimitExample')}
                    value={draft.userLimit}
                    onChange={(event) =>
                      setPackageDrafts({ ...packageDrafts, [plan.code]: { ...draft, userLimit: Number(event.target.value) } })
                    }
                  />
                </label>
              </div>
            );
          })}
          <button className="btn-primary" disabled={busy}>{t('platform.savePackage')}</button>
        </form>
      </Modal>

      <Modal
        open={dialog === 'channels' && !!selected}
        onClose={() => setDialog(null)}
        title={selected ? `${selected.name}` : t('platform.channels')}
        width="max-w-md"
      >
        {selected && (
          <div>
            <p className="text-sm leading-6 text-slate-500">{t('platform.channelsHelp')}</p>
            <form onSubmit={(event) => { void addChannel(event); }} className="mt-4 flex gap-2">
              <input
                className="input min-w-0 flex-1"
                value={channelNameInput}
                placeholder={t('platform.channelName')}
                maxLength={40}
                onChange={(event) => setChannelNameInput(event.target.value)}
              />
              <button className="btn-primary shrink-0 px-3" type="submit" disabled={channelBusy !== null || channelNameInput.trim().length < 2}>
                <Plus className="h-4 w-4" aria-hidden />
                {channelBusy === 'add' ? t('common.saving') : t('platform.addChannel')}
              </button>
            </form>
            {channelError && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{channelError}</p>}
            <ul className="mt-4 space-y-2">
              {channelCatalog.map((row) => {
                const on = channelDraft.has(row.code);
                const name = channelName(t, row.code, row.label);
                return (
                  <li key={row.code} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-semibold ${on ? 'bg-forest-50 text-forest-800' : 'bg-slate-100 text-slate-500'}`}>
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-800">{name}</div>
                        <div className="text-xs text-slate-400">{on ? t('platform.channelOn') : t('platform.channelOff')}</div>
                      </div>
                      <ModuleSwitch
                        label={name}
                        on={on}
                        onToggle={() => {
                          const next = new Set(channelDraft);
                          if (next.has(row.code)) next.delete(row.code);
                          else next.add(row.code);
                          setChannelDraft(next);
                        }}
                      />
                      {!row.inUse && (
                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={t('platform.deleteChannel')}
                          onClick={() => setPendingDelete(pendingDelete === row.code ? null : row.code)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </div>
                    {pendingDelete === row.code && (
                      <div className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
                        <p className="font-medium">{t('platform.deleteChannelAsk', { name })}</p>
                        <p className="mt-1 text-xs text-rose-700">{t('platform.deleteChannelHint')}</p>
                        <div className="mt-2 flex justify-end gap-2">
                          <button type="button" className="btn-ghost" onClick={() => setPendingDelete(null)}>{t('common.cancel')}</button>
                          <button type="button" className="btn-primary bg-rose-600 hover:bg-rose-700" disabled={channelBusy !== null} onClick={() => { void deleteChannel(row.code); }}>{t('platform.deleteChannel')}</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <span className="text-xs text-slate-500">{t('platform.channelsOn', { count: channelDraft.size })}</span>
              <button className="btn-primary" type="button" disabled={channelBusy !== null || channelDraft.size === 0} onClick={() => { void saveChannels(); }}>
                {channelBusy === 'save' ? t('common.saving') : t('platform.saveChannels')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={dialog === 'features' && !!selected}
        onClose={() => setDialog(null)}
        title={selected ? `${selected.name} · ${t('platform.permissions')}` : t('platform.permissions')}
        width="max-w-3xl"
      >
        {selected && (
          <FeatureChips
            keys={keys}
            selected={enabledSet(selected.features, keys)}
            labelFor={label}
            onToggle={(key) => saveNurseryFeatures(selected, key, !enabledSet(selected.features, keys).has(key))}
          />
        )}
      </Modal>

      <Modal
        open={dialog === 'people' && !!selected}
        onClose={() => { closePersonForm(); setDialog(null); }}
        title={selected ? `${selected.name} · ${t('platform.users')}` : t('platform.users')}
        width="max-w-3xl"
      >
        {selected && grantUser && (
          <div>
            <button className="btn-ghost mb-3" type="button" onClick={() => setGrantUserId(null)}>{t('platform.back')}</button>
            <p className="mb-3 text-sm text-slate-500">{grantUser.name} · {grantUser.email}</p>
            <div className="mb-3">
              <ModuleSwitch
                label={t('platform.inherit')}
                on={grantUser.featureGrants.length === 0}
                onToggle={() => savePersonFeatures(grantUser, '', false, grantUser.featureGrants.length > 0)}
              />
            </div>
            {grantUser.featureGrants.length > 0 && (
              <FeatureChips
                keys={keys}
                selected={enabledSet(grantUser.featureGrants, [])}
                labelFor={label}
                disabledKeys={enabledSet(selected.features, keys)}
                onToggle={(key) => {
                  const grants = enabledSet(grantUser.featureGrants, []);
                  savePersonFeatures(grantUser, key, !grants.has(key), false);
                }}
              />
            )}
          </div>
        )}
        {selected && !grantUser && (
          <div>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm text-slate-500">{t('platform.roleNote')}</p>
              {(selected.userLimit <= 0 || selected.users.length < selected.userLimit) && (
                <button
                  className="btn-primary !min-h-9 !px-3 !text-sm"
                  type="button"
                  onClick={() => startAddStaff(selected.locations.length === 1 ? selected.locations[0].id : '')}
                >
                  {t('site.addStaff')}
                </button>
              )}
            </div>
            {selected.userLimit > 0 && selected.users.length >= selected.userLimit && (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {t('site.peopleLimit', {
                  plan: t(`site.plans.${selected.plan}`, { defaultValue: selected.plan }),
                  limit: selected.userLimit,
                  count: selected.users.length,
                })}
              </p>
            )}
            <div className="space-y-3">
              {[
                ...selected.locations.map((place) => ({
                  id: place.id,
                  name: place.name || place.address,
                  address: place.name ? place.address : '',
                  people: selected.users.filter((user) => user.locationId === place.id),
                })),
                ...(selected.users.some((user) => !user.locationId)
                  ? [{
                      id: 'unassigned',
                      name: t('site.unassigned'),
                      address: t('site.unassignedHint'),
                      people: selected.users.filter((user) => !user.locationId),
                    }]
                  : []),
              ].map((place) => (
                <section key={place.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{place.name}</h3>
                      {place.address && <p className="text-xs text-slate-500">{place.address}</p>}
                      {place.id !== 'unassigned' && <p className="mt-1 text-xs text-slate-400">{t('site.multipleStaff')}</p>}
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {t('site.peopleCount', { count: place.people.length })}
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {place.people.map((user) => (
                      <li key={user.id} className="py-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800">{user.name}</div>
                            <div className="text-sm text-slate-500">{user.email} · {t(`roles.${user.role}`, { defaultValue: user.role })}</div>
                            <div className="text-xs font-medium text-forest-800">{place.name}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button className="btn-ghost" type="button" onClick={() => startEditStaff(user)}>{t('platform.editUser')}</button>
                            <button className="btn-ghost" type="button" onClick={() => setGrantUserId(user.id)}>{t('platform.permissions')}</button>
                            <button className="btn-ghost" type="button" onClick={() => setConfirmId(user.id)}>{t('platform.deleteUser')}</button>
                          </div>
                        </div>
                        {confirmId === user.id && (
                          <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
                            <p>{t('platform.confirmDelete')}</p>
                            <div className="mt-2 flex gap-2">
                              <button className="btn-primary !bg-rose-700 hover:!bg-rose-800" type="button" disabled={busy} onClick={() => removePerson(user.id)}>{t('platform.deleteUser')}</button>
                              <button className="btn-ghost" type="button" onClick={() => setConfirmId(null)}>{t('common.cancel')}</button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                    {place.people.length === 0 && <li className="py-3 text-sm text-slate-400">{t('site.emptyPeople')}</li>}
                  </ul>
                  {place.id !== 'unassigned' && (selected.userLimit <= 0 || selected.users.length < selected.userLimit) && (
                    <button
                      className="btn-ghost mt-2 !min-h-9 !px-3 !text-xs"
                      type="button"
                      onClick={() => startAddStaff(place.id)}
                    >
                      {t('site.addStaff')}
                    </button>
                  )}
                </section>
              ))}
              {selected.locations.length === 0 && selected.users.length === 0 && (
                <p className="rounded-xl border border-slate-200 px-3 py-6 text-sm text-slate-400">{t('platform.empty')}</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={personOpen && !!selected}
        onClose={closePersonForm}
        title={editingId ? t('platform.editUser') : t('site.addStaff')}
        width="max-w-lg"
        stack
      >
        {selected && (
          <form
            onSubmit={editingId ? saveEdit : (event) => addPerson(event, selected.id)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {personError && <div className="sm:col-span-2"><ErrorNote message={personError} /></div>}
            <Field label={t('platform.adminName')}>
              <input
                className="input"
                required
                autoFocus
                placeholder={t('platform.hints.adminExample')}
                value={person.name}
                onChange={(e) => setPerson({ ...person, name: e.target.value })}
              />
            </Field>
            <Field label={t('admin.role')}>
              <select className="input" value={person.role} onChange={(e) => setPerson({ ...person, role: e.target.value })}>
                {roles.map((role) => <option key={role} value={role}>{t(`roles.${role}`, { defaultValue: role })}</option>)}
              </select>
            </Field>
            {!editingId && (
              <Field label={t('platform.adminEmail')}>
                <input
                  className="input"
                  type="email"
                  required
                  placeholder={t('platform.hints.emailExample')}
                  value={person.email}
                  onChange={(e) => setPerson({ ...person, email: e.target.value })}
                />
              </Field>
            )}
            {selected.locations.length > 0 && (
              <Field label={t('site.place')}>
                <select
                  className="input"
                  required
                  value={person.locationId}
                  onChange={(e) => setPerson({ ...person, locationId: e.target.value })}
                >
                  <option value="">{t('site.choosePlace')}</option>
                  {selected.locations.map((place) => (
                    <option key={place.id} value={place.id}>{place.name || place.address}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={editingId ? t('platform.changePassword') : t('platform.adminPassword')}>
              <input
                className="input"
                type="password"
                required={!editingId}
                minLength={editingId && !person.password ? undefined : 6}
                placeholder={t('platform.hints.passwordExample')}
                value={person.password}
                onChange={(e) => setPerson({ ...person, password: e.target.value })}
              />
              {editingId && <span className="mt-1 block text-xs normal-case tracking-normal text-slate-400">{t('platform.passwordKeep')}</span>}
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <button className="btn-primary" disabled={busy} type="submit">
                {editingId ? t('common.save') : t('site.addStaff')}
              </button>
              <button className="btn-ghost" type="button" onClick={closePersonForm}>{t('common.cancel')}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
