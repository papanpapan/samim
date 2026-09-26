import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, QrCode, Search, SlidersHorizontal } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { FIELD_ROLES, hasRole, MANAGER_ROLES } from '../auth/roles';
import type { PlantInventory } from '../types';
import { ErrorNote, Field, ListSkeleton, Modal, PageHeader, Spinner } from '../components/ui';
import { AudioAssistTrigger } from '../components/AudioAssistTrigger';
import { InventoryScanner } from '../components/inventory/InventoryScanner';
import { InventoryLabelSheet } from '../components/inventory/InventoryLabelSheet';
import { channelName, FALLBACK_CHANNELS, readChannelChoices, type ChannelChoice } from '../constants/salesChannels';
import { currencySymbol, formatMoney } from '../utils/money';

type AdjustReason = 'MORTALITY' | 'ADJUSTMENT' | 'PURCHASE';

interface LabelData {
  label: { sku: string; commonName: string; bagSize: string; mrp: string; sizeMm: string };
  encoded: string;
  pngDataUrl: string;
}

const PAGE_SIZE = 10;
const chip = 'inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white disabled:opacity-50';

export function Inventory() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const currency = user?.nursery?.currencyCode;
  const money = (value: string | number) => formatMoney(value, currency);
  const symbol = currencySymbol(currency);
  const canAdjust = hasRole(user?.role, FIELD_ROLES);
  const canPrice = hasRole(user?.role, MANAGER_ROLES);
  const [items, setItems] = useState<PlantInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [plantFilter, setPlantFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [bagFilter, setBagFilter] = useState('ALL');
  const [varietyFilter, setVarietyFilter] = useState('ALL');
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'card' | 'table'>('card');
  const [scanOpen, setScanOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [details, setDetails] = useState<PlantInventory | null>(null);
  const [detailForm, setDetailForm] = useState({ plantHeight: '', plantAge: '', zoneLabel: '', reservedQty: '0', reorderAlert: '15' });
  const [savingDetails, setSavingDetails] = useState(false);
  const [pricePlant, setPricePlant] = useState<PlantInventory | null>(null);
  const [offerPrices, setOfferPrices] = useState<Record<string, string>>({});
  const [savingPrice, setSavingPrice] = useState(false);
  const [channelOptions, setChannelOptions] = useState<ChannelChoice[]>(FALLBACK_CHANNELS);
  const [label, setLabel] = useState<LabelData | null>(null);
  const [labelLoading, setLabelLoading] = useState(false);
  const [customer, setCustomer] = useState<{ sku: string; publicUrl: string; qrDataUrl: string } | null>(null);
  const [adjusting, setAdjusting] = useState<PlantInventory | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<AdjustReason>('MORTALITY');
  const [savingAdjust, setSavingAdjust] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/inventory')
      .then((res) => setItems(res.data.data as PlantInventory[]))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get('/nursery/channels')
      .then((res) => {
        const list = readChannelChoices(res.data.data);
        if (list.length > 0) setChannelOptions(list);
      })
      .catch(() => undefined);
  }, []);

  const plantOptions = useMemo(
    () => [...new Set(items.map((item) => item.commonName).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const categoryOptions = useMemo(
    () => [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const bagOptions = useMemo(
    () => [...new Set(items.map((item) => item.bagSize).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const varietyOptions = useMemo(
    () => [...new Set(items.map((item) => item.variety).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const zoneOptions = useMemo(
    () => [...new Set(items.map((item) => item.zoneLabel).filter((zone): zone is string => !!zone))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (plantFilter !== 'ALL' && item.commonName !== plantFilter) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (bagFilter !== 'ALL' && item.bagSize !== bagFilter) return false;
      if (varietyFilter !== 'ALL' && item.variety !== varietyFilter) return false;
      if (zoneFilter !== 'ALL' && (item.zoneLabel || '') !== zoneFilter) return false;
      if (stockFilter === 'OUT' && item.currentStock > 0) return false;
      if (stockFilter === 'LOW' && !(item.currentStock > 0 && item.currentStock <= item.reorderAlert)) return false;
      if (stockFilter === 'IN' && !(item.currentStock > item.reorderAlert)) return false;
      if (!needle) return true;
      const haystack = [item.sku, item.commonName, item.variety, item.category, item.bagSize, item.zoneLabel, item.plantHeight, item.plantAge].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'name-asc') return a.commonName.localeCompare(b.commonName);
      if (sort === 'name-desc') return b.commonName.localeCompare(a.commonName);
      if (sort === 'stock-desc') return b.currentStock - a.currentStock;
      if (sort === 'stock-asc') return a.currentStock - b.currentStock;
      if (sort === 'price-desc') return Number(b.retailPrice) - Number(a.retailPrice);
      if (sort === 'price-asc') return Number(a.retailPrice) - Number(b.retailPrice);
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
  }, [items, query, plantFilter, categoryFilter, bagFilter, varietyFilter, zoneFilter, stockFilter, sort]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openPrice = (plant: PlantInventory) => {
    const next: Record<string, string> = {};
    for (const channel of channelOptions) {
      const saved = plant.channelPrices?.find((row) => row.channel === channel.code);
      const fallback = channel.code === 'WHOLESALE_ORCHARDIST' ? plant.wholesalePrice : plant.retailPrice;
      next[channel.code] = String(saved?.price ?? fallback);
    }
    setOfferPrices(next);
    setPricePlant(plant);
  };

  const savePrice = async (event: FormEvent) => {
    event.preventDefault();
    if (!pricePlant) return;
    const offers = channelOptions.map((channel) => ({ channel: channel.code, price: Number(offerPrices[channel.code]) }));
    if (offers.some((offer) => !Number.isFinite(offer.price) || offer.price < 0)) return;
    setSavingPrice(true);
    setError(null);
    try {
      const res = await api.patch(`/inventory/${pricePlant.id}/price`, { offers });
      const saved = res.data.data as PlantInventory;
      setItems((current) => current.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)));
      setPricePlant(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingPrice(false);
    }
  };

  const saveAdjust = async (e: FormEvent) => {
    e.preventDefault();
    if (!adjusting) return;
    const deltaQty = Number(delta);
    if (!Number.isInteger(deltaQty) || deltaQty === 0) {
      setError(t('inventory.deltaHelp'));
      return;
    }
    setSavingAdjust(true);
    setError(null);
    try {
      await api.post(`/inventory/${adjusting.id}/adjust`, { deltaQty, actionType: reason });
      setAdjusting(null);
      setDelta('');
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingAdjust(false);
    }
  };

  const showLabel = async (id: string) => {
    setLabelLoading(true);
    try {
      const res = await api.get(`/inventory/${id}/label`, { params: { origin: window.location.origin } });
      setLabel(res.data.data as LabelData);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLabelLoading(false);
    }
  };

  const openDetails = (plant: PlantInventory) => {
    setDetails(plant);
    setDetailForm({
      plantHeight: plant.plantHeight ?? '',
      plantAge: plant.plantAge ?? '',
      zoneLabel: plant.zoneLabel ?? '',
      reservedQty: String(plant.reservedQty ?? 0),
      reorderAlert: String(plant.reorderAlert),
    });
  };

  const saveDetails = async (event: FormEvent) => {
    event.preventDefault();
    if (!details) return;
    const reservedQty = Number(detailForm.reservedQty);
    const reorderAlert = Number(detailForm.reorderAlert);
    if (!Number.isInteger(reservedQty) || reservedQty < 0 || !Number.isInteger(reorderAlert) || reorderAlert < 0) return;
    setSavingDetails(true);
    setError(null);
    try {
      const res = await api.patch(`/inventory/${details.id}/details`, {
        plantHeight: detailForm.plantHeight,
        plantAge: detailForm.plantAge,
        zoneLabel: detailForm.zoneLabel,
        reservedQty,
        reorderAlert,
      });
      const saved = res.data.data as PlantInventory;
      setItems((current) => current.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)));
      setDetails(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingDetails(false);
    }
  };

  const openCustomer = async (plant: PlantInventory) => {
    try {
      const res = await api.get(`/inventory/${plant.id}/customer`, { params: { origin: window.location.origin } });
      setCustomer(res.data.data as { sku: string; publicUrl: string; qrDataUrl: string });
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#F8FAFC] p-3 sm:p-4 lg:p-6">
      <div className="shrink-0">
        <PageHeader
          title={t('inventory.title')}
          subtitle={t('inventory.subtitle')}
          action={(
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" type="button" onClick={() => setScanOpen(true)}>{t('inventory.scan')}</button>
              <button className="btn-ghost" type="button" onClick={() => setSheetOpen(true)} disabled={visible.length === 0}>{t('inventory.printSheet')}</button>
            </div>
          )}
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
                placeholder={t('inventory.listSearch')}
                aria-label={t('inventory.listSearch')}
                data-speak={t('voice.searchInventory')}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex xl:grid-cols-none">
              <select className="input !min-h-10 lg:w-36" value={plantFilter} aria-label={t('inventory.plant')} onChange={(event) => { setPlantFilter(event.target.value); setPage(1); }}>
                <option value="ALL">{t('inventory.plantAll')}</option>
                {plantOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select className="input !min-h-10 lg:w-36" value={categoryFilter} aria-label={t('inventory.category')} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}>
                <option value="ALL">{t('inventory.categoryAll')}</option>
                {categoryOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select className="input !min-h-10 lg:w-32" value={bagFilter} aria-label={t('inventory.bag')} onChange={(event) => { setBagFilter(event.target.value); setPage(1); }}>
                <option value="ALL">{t('inventory.bagAll')}</option>
                {bagOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select className="input !min-h-10 lg:w-36" value={varietyFilter} aria-label={t('inventory.specs.variety')} onChange={(event) => { setVarietyFilter(event.target.value); setPage(1); }}>
                <option value="ALL">{t('inventory.varietyAll')}</option>
                {varietyOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select className="input !min-h-10 lg:w-36" value={zoneFilter} aria-label={t('inventory.zone')} onChange={(event) => { setZoneFilter(event.target.value); setPage(1); }}>
                <option value="ALL">{t('inventory.zoneAll')}</option>
                {zoneOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select className="input !min-h-10 lg:w-36" value={stockFilter} aria-label={t('inventory.stock')} onChange={(event) => { setStockFilter(event.target.value); setPage(1); }}>
                <option value="ALL">{t('inventory.stockAll')}</option>
                <option value="IN">{t('inventory.stockIn')}</option>
                <option value="LOW">{t('inventory.stockLow')}</option>
                <option value="OUT">{t('inventory.stockOut')}</option>
              </select>
              <div className="flex h-10 overflow-hidden rounded-lg ring-1 ring-slate-200">
                <button type="button" className={`px-3 text-xs font-semibold ${view === 'card' ? 'bg-forest-700 text-white' : 'bg-white text-slate-600'}`} onClick={() => setView('card')}>{t('inventory.cardView')}</button>
                <button type="button" className={`px-3 text-xs font-semibold ${view === 'table' ? 'bg-forest-700 text-white' : 'bg-white text-slate-600'}`} onClick={() => setView('table')}>{t('inventory.tableView')}</button>
              </div>
              <select className="input !min-h-10 lg:w-44" value={sort} aria-label={t('inventory.sort')} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
                <option value="newest">{t('inventory.sorts.newest')}</option>
                <option value="name-asc">{t('inventory.sorts.nameAsc')}</option>
                <option value="name-desc">{t('inventory.sorts.nameDesc')}</option>
                <option value="stock-desc">{t('inventory.sorts.stockHigh')}</option>
                <option value="stock-asc">{t('inventory.sorts.stockLow')}</option>
                <option value="price-desc">{t('inventory.sorts.priceHigh')}</option>
                <option value="price-asc">{t('inventory.sorts.priceLow')}</option>
              </select>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">{t('inventory.empty')}</p>
          ) : pageRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">{t('inventory.noMatch')}</p>
          ) : view === 'table' ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">{t('inventory.sku')}</th>
                    <th className="px-3 py-2">{t('inventory.plant')}</th>
                    <th className="px-3 py-2">{t('inventory.specs.zone')}</th>
                    <th className="px-3 py-2">{t('inventory.specs.available')}</th>
                    <th className="px-3 py-2">{t('inventory.retail')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((plant) => (
                    <tr key={plant.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs">{plant.sku}</td>
                      <td className="px-3 py-2">{plant.commonName}<span className="block text-xs text-slate-400">{plant.variety}</span></td>
                      <td className="px-3 py-2">{plant.zoneLabel || '—'}</td>
                      <td className="px-3 py-2">{Math.max(0, plant.currentStock - (plant.reservedQty ?? 0))}</td>
                      <td className="px-3 py-2">{money(plant.retailPrice)}</td>
                      <td className="px-3 py-2 text-right">
                        {canPrice && <button className={chip} type="button" onClick={() => openPrice(plant)}>{t('inventory.savePrice')}</button>}
                        <button className={chip} type="button" onClick={() => openDetails(plant)}>{t('inventory.details')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {pageRows.map((plant) => {
                const state = plant.currentStock <= 0 ? 'OUT' : plant.currentStock <= plant.reorderAlert ? 'LOW' : 'IN';
                const available = Math.max(0, plant.currentStock - (plant.reservedQty ?? 0));
                const photo = plant.photos?.[0]?.url;
                const facts = [
                  [t('inventory.specs.bag'), plant.bagSize],
                  [t('inventory.specs.available'), String(available)],
                  [t('inventory.specs.reserved'), String(plant.reservedQty ?? 0)],
                  [t('inventory.specs.sold'), String(plant.soldQty ?? 0)],
                  [t('inventory.specs.dead'), String(plant.mortalityQty ?? 0)],
                  [t('inventory.specs.zone'), plant.zoneLabel || '—'],
                  [t('inventory.specs.height'), plant.plantHeight || '—'],
                  [t('inventory.specs.age'), plant.plantAge || '—'],
                  [t('inventory.specs.reorder'), String(plant.reorderAlert)],
                  [t('inventory.specs.wholesale'), money(plant.wholesalePrice)],
                ] as const;
                return (
                  <li key={plant.id} className="px-4 py-4 transition hover:bg-[#f6f8f6]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                      <div className="flex min-w-0 flex-1 gap-4">
                        {photo ? (
                          <img src={photo} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-slate-200" />
                        ) : (
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-forest-50 font-['Cormorant_Garamond',Georgia,serif] text-2xl text-forest-800 ring-1 ring-slate-200">
                            {plant.commonName.slice(0, 1)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[10px] tracking-[0.16em] text-slate-400">{plant.sku}</p>
                          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                            <h2 className="font-['Cormorant_Garamond',Georgia,serif] text-[1.65rem] font-semibold leading-none tracking-tight text-slate-900">{plant.commonName}</h2>
                            {plant.variety && <span className="text-sm text-slate-500">{plant.variety}</span>}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-[#eef6f0] px-2 py-0.5 text-[11px] font-medium text-[#1f6b45]">{plant.category}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${state === 'OUT' ? 'bg-slate-100 text-slate-600' : state === 'LOW' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'}`}>
                              {t(`inventory.stock${state === 'OUT' ? 'Out' : state === 'LOW' ? 'Low' : 'In'}`)} · {available}
                            </span>
                            {plant.videoUrl && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">{t('inventory.videoYes')}</span>}
                          </div>
                          <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3">
                            {facts.map(([labelText, value]) => (
                              <div key={labelText} className="min-w-0 border-l border-slate-200 pl-2">
                                <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">{labelText}</dt>
                                <dd className="truncate text-[13px] text-slate-700" title={value}>{value}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </div>
                      <div className="flex w-full shrink-0 flex-col gap-2 border-t border-slate-100 pt-3 lg:w-60 lg:border-t-0 lg:pt-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">{money(plant.retailPrice)}</p>
                          {canPrice && (
                            <button className={chip} type="button" onClick={() => openPrice(plant)}>{t('inventory.savePrice')}</button>
                          )}
                        </div>
                        {(plant.channelPrices ?? []).length > 0 && (
                          <p className="text-[11px] leading-4 text-slate-500">
                            {(plant.channelPrices ?? []).map((row) => `${channelName(t, row.channel, channelOptions.find((item) => item.code === row.channel)?.label)} ${money(row.price)}`).join(' · ')}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-1.5">
                          {canAdjust && (
                            <button
                              className={chip}
                              type="button"
                              onClick={() => { setAdjusting(plant); setDelta(''); setReason('MORTALITY'); setError(null); }}
                              data-speak={t('voice.adjustStock')}
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                              {t('inventory.adjust')}
                            </button>
                          )}
                          <button className={chip} type="button" onClick={() => openDetails(plant)}>{t('inventory.details')}</button>
                          <button className={chip} type="button" onClick={() => void showLabel(plant.id)} data-speak={t('voice.qr')}>
                            <QrCode className="h-3.5 w-3.5" aria-hidden />
                            {t('inventory.qr')}
                          </button>
                          {plant.shareCode && (
                            <button className={chip} type="button" onClick={() => void openCustomer(plant)}>{t('inventory.customerQr')}</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {visible.length > 0 && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5">
              <p className="text-xs text-slate-500">
                {t('inventory.range', {
                  from: (safePage - 1) * PAGE_SIZE + 1,
                  to: Math.min(safePage * PAGE_SIZE, visible.length),
                  count: visible.length,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button className={chip} type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>{t('inventory.prev')}</button>
                <span className="text-xs text-slate-500">{t('inventory.pageOf', { page: safePage, pages: pageCount })}</span>
                <button className={chip} type="button" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>{t('inventory.next')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={!!adjusting} onClose={() => setAdjusting(null)} title={t('inventory.adjustTitle')}>
        {adjusting && (
          <form onSubmit={saveAdjust} className="space-y-4">
            <p className="text-sm text-slate-600">
              {adjusting.commonName}
              <span className="mt-1 block font-mono text-xs text-slate-500">{adjusting.sku}</span>
            </p>
            <Field label={t('inventory.delta')} speakKey="voice.adjustStock">
              <input
                className="input"
                type="number"
                step={1}
                required
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="-1"
                aria-label={t('inventory.delta')}
              />
            </Field>
            <p className="text-xs text-slate-500">{t('inventory.deltaHelp')}</p>
            <Field label={t('inventory.reason')}>
              <select className="input" value={reason} onChange={(e) => setReason(e.target.value as AdjustReason)}>
                {(['MORTALITY', 'ADJUSTMENT', 'PURCHASE'] as const).map((key) => (
                  <option key={key} value={key}>{t(`inventory.reasons.${key}`)}</option>
                ))}
              </select>
            </Field>
            <button className="btn-primary w-full" disabled={savingAdjust} data-speak={t('voice.adjustStock')}>
              {savingAdjust ? t('inventory.adjusting') : t('inventory.saveAdjust')}
            </button>
          </form>
        )}
      </Modal>

      <Modal open={!!label || labelLoading} onClose={() => setLabel(null)} title={t('inventory.labelTitle')} width="max-w-sm">
        {labelLoading || !label ? (
          <Spinner label={t('inventory.generating')} />
        ) : (
          <div>
            <div className="mx-auto w-[280px] rounded-lg border-2 border-dashed border-nursery-300 bg-white p-3">
              <div className="flex items-center gap-3">
                <img src={label.pngDataUrl} alt="QR code" className="h-24 w-24" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-nursery-700">Saba Nursery</div>
                  <div className="truncate text-sm font-bold text-nursery-900">{label.label.commonName}</div>
                  <div className="text-xs text-nursery-600">{label.label.bagSize}</div>
                  <div className="font-mono text-[10px] text-nursery-500">{label.label.sku}</div>
                  <div className="mt-1 text-base font-extrabold text-nursery-800">{symbol}{label.label.mrp}</div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">{t('inventory.labelScanHelp')}</p>
            <div className="mt-2 break-all rounded bg-nursery-50 p-2 text-[10px] text-nursery-500">{label.encoded}</div>
            <div className="mt-4 flex items-center gap-2">
              <button className="btn-primary w-full" onClick={() => window.print()} data-speak={t('voice.printLabel')}>
                <Printer className="h-4 w-4" aria-hidden />
                {t('inventory.print')}
              </button>
              <AudioAssistTrigger textKey="voice.printLabel" />
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!pricePlant} onClose={() => setPricePlant(null)} title={t('inventory.priceTitle')} width="max-w-lg">
        {pricePlant && (
          <form onSubmit={savePrice}>
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-forest-50 text-base font-semibold text-forest-800">
                {pricePlant.commonName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">{pricePlant.commonName}</div>
                <div className="font-mono text-xs text-slate-400">{pricePlant.sku}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {channelOptions.map((channel) => {
                const name = channelName(t, channel.code, channel.label);
                return (
                  <label key={channel.code} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-forest-700 focus-within:ring-2 focus-within:ring-forest-700/15">
                    <span className="flex items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="truncate text-xs font-medium text-slate-500">{name}</span>
                    </span>
                    <span className="mt-2 flex items-baseline gap-1">
                      <span className="text-sm font-semibold text-slate-400">{symbol}</span>
                      <input
                        className="w-full border-0 bg-transparent p-0 text-lg font-semibold text-slate-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        type="number"
                        min={0}
                        step="0.01"
                        value={offerPrices[channel.code] ?? ''}
                        aria-label={name}
                        onChange={(event) => setOfferPrices({ ...offerPrices, [channel.code]: event.target.value })}
                      />
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">{t('inventory.priceHelp')}</p>
            <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
              <button className="btn-primary" disabled={savingPrice}>{savingPrice ? t('common.saving') : t('inventory.savePrice')}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!details} onClose={() => setDetails(null)} title={t('inventory.detailsTitle')}>
        {details && (
          <form onSubmit={saveDetails} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <p className="font-mono text-xs text-slate-500 sm:col-span-2">{details.sku} · {details.commonName}</p>
            <Field label={t('inventory.specs.height')}>
              <input className="input" value={detailForm.plantHeight} onChange={(event) => setDetailForm({ ...detailForm, plantHeight: event.target.value })} placeholder="2 ft" />
            </Field>
            <Field label={t('inventory.specs.age')}>
              <input className="input" value={detailForm.plantAge} onChange={(event) => setDetailForm({ ...detailForm, plantAge: event.target.value })} placeholder="8 month" />
            </Field>
            <Field label={t('inventory.zone')}>
              <input className="input" value={detailForm.zoneLabel} onChange={(event) => setDetailForm({ ...detailForm, zoneLabel: event.target.value })} placeholder="Block-A, Shade-1" />
            </Field>
            <Field label={t('inventory.specs.reserved')}>
              <input className="input" type="number" min={0} value={detailForm.reservedQty} onChange={(event) => setDetailForm({ ...detailForm, reservedQty: event.target.value })} />
            </Field>
            <Field label={t('inventory.specs.reorder')}>
              <input className="input" type="number" min={0} value={detailForm.reorderAlert} onChange={(event) => setDetailForm({ ...detailForm, reorderAlert: event.target.value })} />
            </Field>
            <div className="flex justify-end sm:col-span-2">
              <button className="btn-primary" disabled={savingDetails}>{savingDetails ? t('common.saving') : t('inventory.saveDetails')}</button>
            </div>
          </form>
        )}
      </Modal>

      {scanOpen && <InventoryScanner onClose={() => setScanOpen(false)} />}
      {sheetOpen && <InventoryLabelSheet ids={visible.slice(0, 48).map((plant) => plant.id)} currencyCode={currency} onClose={() => setSheetOpen(false)} />}

      <Modal open={!!customer} onClose={() => setCustomer(null)} title={t('inventory.customerQr')}>
        {customer && (
          <div className="text-center">
            <p className="mb-3 text-sm text-slate-600">{t('inventory.customerQrHelp')}</p>
            {customer.qrDataUrl && <img src={customer.qrDataUrl} alt={customer.sku} className="mx-auto h-44 w-44" />}
            <a href={customer.publicUrl} className="mt-3 block break-all text-sm text-forest-700 underline">{customer.publicUrl}</a>
          </div>
        )}
      </Modal>
    </div>
  );
}
