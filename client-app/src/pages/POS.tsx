import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Plus, Printer, ScanLine, Search, Sparkles, X } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { PlantInventory, Sale } from '../types';
import { ErrorNote, Modal, PageHeader } from '../components/ui';
import { AudioAssistTrigger } from '../components/AudioAssistTrigger';
import { InventoryScanner } from '../components/inventory/InventoryScanner';
import { channelName, FALLBACK_CHANNELS, readChannelChoices, type ChannelChoice } from '../constants/salesChannels';
import { formatMoney, isInr } from '../utils/money';

interface CartLine {
  plant: PlantInventory;
  quantity: number;
}

interface ReceiptLine {
  quantity: number;
  unitPrice: string | number;
  itemTotalPrice: string | number;
  plant?: { commonName: string; sku: string; bagSize: string; variety?: string };
}

interface Receipt extends Sale {
  customerPhone?: string | null;
  customerCity?: string | null;
  subTotal?: string | number;
  items?: ReceiptLine[];
  meta?: { discountPct: number };
}

const DEMO_BUYERS: Record<string, { name: string; city: string; qty: number; match: number }> = {
  WHOLESALE_ORCHARDIST: { name: 'Orchard Demo', city: 'Kolkata', qty: 100, match: 96 },
  INDIAMART: { name: 'Rahul Mondal', city: 'Bardhaman', qty: 40, match: 91 },
  MEESHO: { name: 'Rina Das', city: 'Howrah', qty: 2, match: 84 },
  AMAZON: { name: 'Green Basket', city: 'Delhi', qty: 6, match: 88 },
  FACEBOOK: { name: 'Local Garden', city: 'Baruipur', qty: 8, match: 79 },
  INSTAGRAM: { name: 'Patio Plants', city: 'Salt Lake', qty: 4, match: 86 },
};

const PAYMENTS = [
  { value: 'CASH' },
  { value: 'UPI_PHONEPE_GPAY' },
  { value: 'BANK_NEFT_IMPS' },
];

function stockLeft(plant: PlantInventory) {
  return Math.max(0, plant.currentStock - (plant.reservedQty ?? 0));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);
}

function printReceipt(receipt: Receipt, nurseryName: string, currencyCode?: string | null, taxLabel?: string) {
  const money = (value: string | number) => formatMoney(value, currencyCode);
  const lines = (receipt.items ?? []).map((line) => (
    `<tr><td>${escapeHtml(line.plant?.commonName ?? '')}<br><span>${escapeHtml(line.plant?.sku ?? '')} · ${escapeHtml(line.plant?.bagSize ?? '')}</span></td><td>${line.quantity}</td><td>${money(line.unitPrice)}</td><td>${money(line.itemTotalPrice)}</td></tr>`
  )).join('');
  const taxPct = Number(receipt.taxPct ?? 0);
  const taxAmount = Number(receipt.taxAmount ?? 0);
  const taxRow = taxAmount > 0
    ? `<p>${escapeHtml(taxLabel ?? 'Tax')} (${taxPct}%): ${money(taxAmount)}</p>`
    : '';
  const popup = window.open('', '_blank', 'width=720,height=800');
  if (!popup) return;
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(receipt.invoiceNumber)}</title><style>
    @page { size: A4; margin: 12mm; }
    body { margin: 0; font-family: sans-serif; color: #1e293b; }
    h1 { font-size: 20px; margin: 0; }
    p { margin: 4px 0; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 8px 4px; font-size: 13px; vertical-align: top; }
    td span { color: #64748b; font-size: 11px; }
    .total { margin-top: 12px; text-align: right; font-size: 16px; font-weight: 700; }
  </style></head><body>
    <h1>${escapeHtml(nurseryName)}</h1>
    <p>${escapeHtml(receipt.invoiceNumber)}</p>
    <p>${escapeHtml(receipt.customerName)}${receipt.customerPhone ? ` · ${escapeHtml(receipt.customerPhone)}` : ''}${receipt.customerCity ? ` · ${escapeHtml(receipt.customerCity)}` : ''}</p>
    <table><thead><tr><th>Plant</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table>
    ${taxRow}
    <p class="total">${money(receipt.netTotal)}</p>
  </body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

export function POS() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const currency = user?.nursery?.currencyCode;
  const money = (value: string | number) => formatMoney(value, currency);
  const showGst = isInr(currency);
  const [taxPct, setTaxPct] = useState(0);
  const [scan, setScan] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [plants, setPlants] = useState<PlantInventory[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [channelOptions, setChannelOptions] = useState<ChannelChoice[]>(FALLBACK_CHANNELS);
  const [channel, setChannel] = useState('RETAIL_COUNTER');
  const [payment, setPayment] = useState('CASH');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const seededSku = useRef(false);
  const [params] = useSearchParams();
  const [upi, setUpi] = useState<{ vpa: string; qrDataUrl: string } | null>(null);
  const [demoPlantId, setDemoPlantId] = useState('');
  const [demoPhase, setDemoPhase] = useState<'idle' | 'read' | 'write' | 'post' | 'explain' | 'deal' | 'done'>('idle');
  const [media, setMedia] = useState<{ id: string; category: string; kind: string; url: string }[]>([]);
  const [mediaCategory, setMediaCategory] = useState<'FRUIT' | 'FLOWER' | 'FOLIAGE'>('FRUIT');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [demoPosted, setDemoPosted] = useState(0);
  const [demoOpen, setDemoOpen] = useState(() => {
    try {
      return localStorage.getItem('sn-pos-ai') === 'open';
    } catch {
      return false;
    }
  });
  const demoTimers = useRef<number[]>([]);

  const loadDesk = () => {
    api.get('/inventory').then((res) => setPlants(res.data.data as PlantInventory[])).catch((err) => setError(apiErrorMessage(err)));
    api.get('/sales').then((res) => setSales(res.data.data as Sale[])).catch(() => setSales([]));
  };

  useEffect(() => {
    loadDesk();
    api.get('/nursery/channels')
      .then((res) => {
        const list = readChannelChoices(res.data.data);
        if (list.length === 0) return;
        setChannelOptions(list);
        setChannel((current) => (list.some((row) => row.code === current) ? current : list[0].code));
      })
      .catch(() => undefined);
    api.get('/sales/marketing').then((res) => setMedia(res.data.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        scanRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isWholesale = channel === 'WHOLESALE_ORCHARDIST';
  const unitPrice = (plant: PlantInventory) => {
    const offer = plant.channelPrices?.find((row) => row.channel === channel);
    if (offer) return Number(offer.price);
    return Number(isWholesale ? plant.wholesalePrice : plant.retailPrice);
  };
  const subTotal = cart.reduce((sum, line) => sum + unitPrice(line.plant) * line.quantity, 0);
  const totalQty = cart.reduce((sum, line) => sum + line.quantity, 0);
  const discountPct = isWholesale ? (totalQty >= 500 ? 20 : totalQty >= 100 ? 10 : 0) : 0;
  const discount = (subTotal * discountPct) / 100;
  const taxable = subTotal - discount;
  const taxAmount = showGst ? Math.round(((taxable * taxPct) / 100) * 100) / 100 : 0;
  const net = taxable + taxAmount;
  const overStock = cart.some((line) => line.quantity > stockLeft(line.plant));

  const digitalChannels = channelOptions.filter((row) => row.code !== 'RETAIL_COUNTER');
  const demoPlant = plants.find((plant) => plant.id === demoPlantId) ?? plants.find((plant) => stockLeft(plant) > 0) ?? null;

  useEffect(() => {
    if (demoPlantId || plants.length === 0) return;
    const ready = plants.find((plant) => stockLeft(plant) > 0);
    if (ready) setDemoPlantId(ready.id);
  }, [plants, demoPlantId]);

  useEffect(() => () => {
    demoTimers.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const setAiOpen = (open: boolean) => {
    setDemoOpen(open);
    try {
      localStorage.setItem('sn-pos-ai', open ? 'open' : 'closed');
    } catch {
      /* the counter still works if the browser blocks storage */
    }
  };

  const startDemo = () => {
    demoTimers.current.forEach((id) => window.clearTimeout(id));
    demoTimers.current = [];
    if (!demoPlant || digitalChannels.length === 0) return;
    setDemoPosted(0);
    setDemoPhase('read');
    const steps: Array<() => void> = [
      () => setDemoPhase('write'),
      ...digitalChannels.map((_, index) => () => {
        setDemoPhase('post');
        setDemoPosted(index + 1);
      }),
      () => setDemoPhase('explain'),
      () => setDemoPhase('deal'),
      () => setDemoPhase('done'),
    ];
    steps.forEach((step, index) => {
      demoTimers.current.push(window.setTimeout(step, 700 * (index + 1)));
    });
  };

  const readyPlants = plants.filter((plant) => stockLeft(plant) > 0);
  const marketKey = (category: string) => {
    const value = category.toLowerCase();
    if (value.includes('flower')) return 'FLOWER';
    if (value.includes('fruit')) return 'FRUIT';
    return 'FOLIAGE';
  };
  const plantMedia = media.filter((row) => demoPlant && row.category === marketKey(demoPlant.category));
  const categoryMedia = media.filter((row) => row.category === mediaCategory);

  const pickPlant = (id: string) => {
    setDemoPlantId(id);
    setDemoPhase('idle');
    setDemoPosted(0);
  };

  const uploadMedia = async (file: File, kind: 'PHOTO' | 'VIDEO') => {
    const form = new FormData();
    form.append('category', mediaCategory);
    form.append('kind', kind);
    form.append('file', file);
    setMediaBusy(true);
    setError(null);
    try {
      const res = await api.post('/sales/marketing', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMedia((current) => [res.data.data, ...current]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setMediaBusy(false);
    }
  };

  const catalog = useMemo(() => {
    const needle = catalogQuery.trim().toLowerCase();
    return plants.filter((plant) => {
      if (!needle) return true;
      return [plant.sku, plant.commonName, plant.variety, plant.category, plant.bagSize, plant.zoneLabel].join(' ').toLowerCase().includes(needle);
    }).slice(0, 40);
  }, [plants, catalogQuery]);

  useEffect(() => {
    if (payment !== 'UPI_PHONEPE_GPAY' || net <= 0) {
      setUpi(null);
      return;
    }
    const handle = window.setTimeout(() => {
      api
        .get('/sales/upi-qr', { params: { amount: net.toFixed(2) } })
        .then((res) => setUpi(res.data.data))
        .catch(() => setUpi(null));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [payment, net]);

  const addPlant = (plant: PlantInventory) => {
    const left = stockLeft(plant);
    if (left <= 0) {
      setError(t('pos.out'));
      return;
    }
    setError(null);
    setCart((prev) => {
      const found = prev.find((line) => line.plant.id === plant.id);
      if (!found) return [...prev, { plant, quantity: 1 }];
      if (found.quantity >= left) return prev;
      return prev.map((line) => (line.plant.id === plant.id ? { ...line, quantity: line.quantity + 1 } : line));
    });
  };

  const findScanned = (raw: string) => api.get(`/inventory/scan/${encodeURIComponent(raw.trim())}`);

  useEffect(() => {
    const sku = params.get('sku');
    if (!sku || seededSku.current) return;
    seededSku.current = true;
    setScan(sku);
    findScanned(sku)
      .then((res) => {
        addPlant(res.data.data as PlantInventory);
        setScan('');
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, [params]);

  const addBySku = async (event: FormEvent) => {
    event.preventDefault();
    const sku = scan.trim();
    if (!sku) return;
    setError(null);
    try {
      const res = await findScanned(sku);
      addPlant(res.data.data as PlantInventory);
      setScan('');
      scanRef.current?.focus();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const setQty = (id: string, qty: number) =>
    setCart((prev) => prev.map((line) => {
      if (line.plant.id !== id) return line;
      const next = Number.isFinite(qty) ? Math.max(1, qty) : 1;
      return { ...line, quantity: Math.min(next, Math.max(1, stockLeft(line.plant))) };
    }));
  const removeLine = (id: string) => setCart((prev) => prev.filter((line) => line.plant.id !== id));

  const openReceipt = async (id: string) => {
    try {
      const res = await api.get(`/sales/${id}`);
      setReceipt(res.data.data as Receipt);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const checkout = async () => {
    if (cart.length === 0 || overStock) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/sales', {
        channel,
        paymentMode: payment,
        customerName,
        customerPhone: customerPhone || undefined,
        customerCity: customerCity || undefined,
        taxPct: showGst ? taxPct : 0,
        items: cart.map((line) => ({ plantId: line.plant.id, quantity: line.quantity })),
      });
      setReceipt({ ...res.data.data, meta: res.data.meta });
      setCart([]);
      loadDesk();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={t('pos.title')} subtitle={t('pos.subtitle')} />
      <ErrorNote message={error} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <form onSubmit={addBySku} className="flex flex-wrap items-center gap-2">
            <input
              ref={scanRef}
              autoFocus
              className="input min-w-[16rem] flex-1 font-mono"
              placeholder={t('pos.scanPlaceholder')}
              aria-label={t('pos.scanPlaceholder')}
              value={scan}
              onChange={(event) => setScan(event.target.value)}
              data-speak={t('voice.scan')}
            />
            <button className="btn-primary whitespace-nowrap" data-speak={t('voice.addSku')}>
              <ScanLine className="h-4 w-4" aria-hidden />
              {t('pos.add')}
            </button>
            <button className="btn-ghost" type="button" onClick={() => setScanOpen(true)}>{t('inventory.scan')}</button>
            <AudioAssistTrigger textKey="voice.scan" />
          </form>

          <div className="card overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-slate-200 p-3 sm:flex-row sm:items-center">
              <p className="text-sm font-semibold text-slate-800">{t('pos.catalog')}</p>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  className="input !min-h-10 pl-9"
                  value={catalogQuery}
                  placeholder={t('pos.catalogSearch')}
                  aria-label={t('pos.catalogSearch')}
                  onChange={(event) => setCatalogQuery(event.target.value)}
                />
              </div>
            </div>
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {catalog.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-slate-400">{t('inventory.noMatch')}</li>
              ) : catalog.map((plant) => {
                const left = stockLeft(plant);
                return (
                  <li key={plant.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{plant.commonName}</p>
                      <p className="truncate text-xs text-slate-500">{plant.variety} · {plant.bagSize}{plant.zoneLabel ? ` · ${plant.zoneLabel}` : ''}</p>
                      <p className="font-mono text-[11px] text-slate-400">{plant.sku} · {t('pos.available')} {left}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-slate-800">{money(unitPrice(plant))}</p>
                    <button className="btn-ghost shrink-0" type="button" disabled={left <= 0} onClick={() => addPlant(plant)}>{t('pos.add')}</button>
                  </li>
                );
              })}
            </ul>
          </div>

          {import.meta.env.DEV && (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-lg">
            <div className={`bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.18),transparent_42%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_36%)] ${demoOpen ? 'p-4' : 'px-4 py-3'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30 ${demoPhase !== 'idle' && demoPhase !== 'done' ? 'animate-pulse' : ''}`}>
                    <Sparkles className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-white">{t('pos.demoTitle')}</h2>
                      <span className="inline-flex rounded-full bg-amber-300/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200">{t('pos.demoBadge')}</span>
                      {!demoOpen && demoPhase === 'done' && (
                        <span className="text-xs text-emerald-200">{t('pos.demoSummary', { count: digitalChannels.length })}</span>
                      )}
                    </div>
                    {demoOpen && <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">{t('pos.demoHelp')}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {demoOpen && (
                    <button
                      className="btn-primary !min-h-10"
                      type="button"
                      disabled={!demoPlant || digitalChannels.length === 0 || (demoPhase !== 'idle' && demoPhase !== 'done')}
                      onClick={startDemo}
                    >
                      {demoPhase === 'done' ? t('pos.demoAgain') : t('pos.demoStart')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
                    aria-expanded={demoOpen}
                    onClick={() => setAiOpen(!demoOpen)}
                  >
                    {demoOpen ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
                    {demoOpen ? t('pos.demoHide') : t('pos.demoShow')}
                  </button>
                </div>
              </div>
              {demoOpen && (digitalChannels.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">{t('pos.demoEmpty')}</p>
              ) : (
                <div className="mt-4 max-h-[40rem] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[14rem_1fr]">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-400">{t('pos.demoPlant')}</p>
                    <ul className="max-h-64 space-y-1 overflow-y-auto">
                      {readyPlants.map((plant) => (
                        <li key={plant.id}>
                          <button
                            type="button"
                            className={`w-full rounded-xl px-3 py-2 text-left ring-1 ${plant.id === demoPlant?.id ? 'bg-emerald-400/15 ring-emerald-400/40' : 'bg-white/5 ring-white/10 hover:bg-white/10'}`}
                            onClick={() => pickPlant(plant.id)}
                          >
                            <span className="block truncate text-sm font-semibold text-white">{plant.commonName}</span>
                            <span className="block truncate text-[11px] text-slate-400">{t('pos.demoInStock', { count: stockLeft(plant) })} · {plant.category}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    {demoPlant && (
                      <div className="flex gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                        {demoPlant.photos?.[0] ? (
                          <img src={demoPlant.photos[0].url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-lg font-semibold text-emerald-200">{demoPlant.commonName.slice(0, 1)}</span>
                        )}
                        <div className="min-w-0 text-sm">
                          <div className="truncate font-semibold text-white">{demoPlant.commonName}</div>
                          <div className="font-mono text-[11px] text-slate-400">{demoPlant.sku} · {demoPlant.variety} · {demoPlant.bagSize}</div>
                          <div className="mt-1 text-xs text-slate-300">{t('pos.demoInStock', { count: stockLeft(demoPlant) })} · {t('pos.available')} {stockLeft(demoPlant)} · {money(demoPlant.retailPrice)}</div>
                          <div className="text-xs text-slate-400">{demoPlant.category}{demoPlant.zoneLabel ? ` · ${demoPlant.zoneLabel}` : ''}{demoPlant.plantHeight ? ` · ${demoPlant.plantHeight}` : ''}{demoPlant.plantAge ? ` · ${demoPlant.plantAge}` : ''}</div>
                        </div>
                      </div>
                    )}
                    <div className="rounded-2xl bg-white/5 px-3 py-2.5 font-mono text-xs leading-5 text-emerald-200 ring-1 ring-white/10">
                      {demoPhase === 'idle' && <p className="text-slate-400">{demoPlant ? demoPlant.commonName : t('pos.demoNoPlant')}</p>}
                      {demoPhase !== 'idle' && <p>{t('pos.demoRead')}</p>}
                      {(demoPhase === 'write' || demoPhase === 'post' || demoPhase === 'explain' || demoPhase === 'deal' || demoPhase === 'done') && <p>{t('pos.demoWrite')}</p>}
                      {(demoPhase === 'write' || demoPhase === 'post' || demoPhase === 'explain' || demoPhase === 'deal' || demoPhase === 'done') && demoPlant && (
                        <p>{t('pos.mediaUsing', { photos: plantMedia.filter((row) => row.kind === 'PHOTO').length, videos: plantMedia.filter((row) => row.kind === 'VIDEO').length })}</p>
                      )}
                      {digitalChannels.slice(0, demoPosted).map((row) => (
                        <p key={row.code}>{t('pos.demoLive', { channel: channelName(t, row.code, row.label) })}</p>
                      ))}
                      {demoPhase === 'post' && demoPosted < digitalChannels.length && (
                        <p className="animate-pulse text-sky-200">{t('pos.demoPost', { channel: channelName(t, digitalChannels[demoPosted].code, digitalChannels[demoPosted].label) })}</p>
                      )}
                    </div>
                    {(demoPhase === 'explain' || demoPhase === 'deal' || demoPhase === 'done') && demoPlant && (
                      <p className="rounded-2xl bg-sky-400/10 px-3 py-2 text-sm leading-6 text-sky-100">{t('pos.demoExplain', { name: demoPlant.commonName, price: money(demoPlant.retailPrice), count: stockLeft(demoPlant) })}</p>
                    )}
                    {(demoPhase === 'deal' || demoPhase === 'done') && demoPlant && (
                      <p className="rounded-2xl bg-emerald-400/10 px-3 py-2 text-sm leading-6 text-emerald-100">{t('pos.demoDeal', { name: demoPlant.commonName })}</p>
                    )}
                    {(demoPhase === 'explain' || demoPhase === 'deal' || demoPhase === 'done') && demoPlant && (
                      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {digitalChannels.map((row, index) => {
                          const buyer = DEMO_BUYERS[row.code] ?? { name: `Buyer ${index + 1}`, city: 'Kolkata', qty: 5, match: 80 };
                          return (
                            <li key={row.code} className="rounded-2xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{channelName(t, row.code, row.label)}</span>
                                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">{t('pos.demoMatch', { score: buyer.match })}</span>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-400/15 text-xs font-semibold text-sky-200">{buyer.name.slice(0, 1)}</span>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-white">{buyer.name}</div>
                                  <div className="truncate text-xs text-slate-400">{buyer.city} · {t('pos.demoQty', { qty: buyer.qty })}</div>
                                </div>
                              </div>
                              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" style={{ width: `${buyer.match}%` }} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                      <p className="text-sm font-semibold text-white">{t('pos.mediaTitle')}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{t('pos.mediaHelp')}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(['FRUIT', 'FLOWER', 'FOLIAGE'] as const).map((code) => (
                          <button
                            key={code}
                            type="button"
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${mediaCategory === code ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/5 text-slate-300'}`}
                            onClick={() => setMediaCategory(code)}
                          >
                            {t(`pos.mediaCategories.${code}`)}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-white/10 px-3 text-sm font-semibold text-white">
                          {t('pos.mediaPhoto')}
                          <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={mediaBusy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadMedia(file, 'PHOTO'); }} />
                        </label>
                        <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-white/10 px-3 text-sm font-semibold text-white">
                          {t('pos.mediaVideo')}
                          <input className="sr-only" type="file" accept="video/mp4,video/webm,video/quicktime" disabled={mediaBusy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadMedia(file, 'VIDEO'); }} />
                        </label>
                      </div>
                      {categoryMedia.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-500">{t('pos.mediaEmpty')}</p>
                      ) : (
                        <ul className="mt-2 flex gap-2 overflow-x-auto">
                          {categoryMedia.map((row) => (
                            <li key={row.id} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/30">
                              {row.kind === 'PHOTO' ? <img src={row.url} alt="" className="h-full w-full object-cover" /> : <video src={row.url} className="h-full w-full object-cover" muted />}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              ))}
            </div>
          </div>
          )}

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-nursery-50 text-left text-xs uppercase tracking-wide text-nursery-600">
                <tr>
                  <th className="px-4 py-3">{t('pos.item')}</th>
                  <th className="px-4 py-3">{t('pos.unit')}</th>
                  <th className="px-4 py-3">{t('pos.qty')}</th>
                  <th className="px-4 py-3">{t('pos.total')}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nursery-50">
                {cart.map((line) => (
                  <tr key={line.plant.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{line.plant.commonName}</div>
                      <div className="font-mono text-[11px] text-nursery-500">{line.plant.sku} · {line.plant.bagSize} · {t('pos.available')} {stockLeft(line.plant)}</div>
                    </td>
                    <td className="px-4 py-3">{money(unitPrice(line.plant))}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        max={stockLeft(line.plant)}
                        className="input w-20 py-1"
                        value={line.quantity}
                        onChange={(event) => setQty(line.plant.id, Number(event.target.value))}
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold">{money(unitPrice(line.plant) * line.quantity)}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn-ghost min-w-12 px-3 text-rose-600" onClick={() => removeLine(line.plant.id)} aria-label={t('pos.remove')}>
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-nursery-400">
                      {t('pos.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <div className="card h-fit space-y-3 p-5">
            <div>
              <span className="mb-1 flex items-center justify-between">
                <span className="label mb-0">{t('pos.channel')}</span>
                <AudioAssistTrigger textKey="voice.channel" />
              </span>
              <select className="input" value={channel} onChange={(event) => setChannel(event.target.value)} data-speak={t('voice.channel')}>
                {channelOptions.map((row) => (
                  <option key={row.code} value={row.code}>{channelName(t, row.code, row.label)}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-1 flex items-center justify-between">
                <span className="label mb-0">{t('pos.customer')}</span>
                <AudioAssistTrigger textKey="voice.customer" />
              </span>
              <input className="input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} data-speak={t('voice.customer')} />
            </div>
            <div>
              <span className="mb-1 flex items-center justify-between">
                <span className="label mb-0">{t('pos.phone')}</span>
                <AudioAssistTrigger textKey="voice.phone" />
              </span>
              <input className="input" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder={t('common.optional')} data-speak={t('voice.phone')} />
            </div>
            <div>
              <span className="label mb-1">{t('pos.city')}</span>
              <input className="input" value={customerCity} onChange={(event) => setCustomerCity(event.target.value)} placeholder={t('common.optional')} />
            </div>
            <div>
              <span className="mb-1 flex items-center justify-between">
                <span className="label mb-0">{t('pos.payment')}</span>
                <AudioAssistTrigger textKey="voice.payment" />
              </span>
              <select className="input" value={payment} onChange={(event) => setPayment(event.target.value)} data-speak={t('voice.payment')}>
                {PAYMENTS.map((item) => (
                  <option key={item.value} value={item.value}>{t(`pos.payments.${item.value}`)}</option>
                ))}
              </select>
            </div>

            {showGst && (
              <div>
                <span className="label mb-1">{t('pos.gstPct')}</span>
                <select className="input" value={taxPct} onChange={(event) => setTaxPct(Number(event.target.value))}>
                  <option value={0}>{t('pos.gstNone')}</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">{t('pos.gstLocalNote')}</p>
              </div>
            )}

            <div className="rounded-xl bg-nursery-50 p-4 text-sm">
              <div className="flex justify-between"><span>{t('pos.subtotal')}</span><span>{money(subTotal)}</span></div>
              <div className="flex justify-between text-nursery-600">
                <span>{t('pos.discount')} {discountPct > 0 && `(${discountPct}%)`}</span>
                <span>− {money(discount)}</span>
              </div>
              {showGst && taxPct > 0 && (
                <div className="flex justify-between text-nursery-600">
                  <span>{t('pos.gstAmount')} ({taxPct}%)</span>
                  <span>{money(taxAmount)}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-nursery-200 pt-2 text-lg font-bold text-nursery-900">
                <span>{t('pos.net')}</span><span>{money(net)}</span>
              </div>
            </div>
            {overStock && <p className="text-sm text-rose-700">{t('pos.overStock')}</p>}

            {upi && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('pos.upiTitle')}</div>
                <img src={upi.qrDataUrl} alt={upi.vpa} className="mx-auto mt-2 h-32 w-32" />
                <div className="mt-1 font-mono text-xs text-slate-600">{upi.vpa}</div>
                <p className="mt-1 text-xs text-slate-500">{t('pos.upiHelp')}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button className="btn-primary w-full" disabled={busy || cart.length === 0 || overStock} onClick={checkout} data-speak={t('voice.checkout')}>
                <Plus className="h-4 w-4" aria-hidden />
                {busy ? t('pos.processing') : t('pos.checkout')}
              </button>
              <AudioAssistTrigger textKey="voice.checkout" />
            </div>
          </div>

          <div className="card overflow-hidden">
            <p className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">{t('pos.receipts')}</p>
            {sales.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">{t('pos.noReceipts')}</p>
            ) : (
              <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                {sales.slice(0, 12).map((sale) => (
                  <li key={sale.id}>
                    <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50" onClick={() => void openReceipt(sale.id)}>
                      <span>
                        <span className="block font-mono text-xs text-slate-500">{sale.invoiceNumber}</span>
                        <span className="block text-sm text-slate-800">{sale.customerName}</span>
                      </span>
                      <span className="text-sm font-semibold text-slate-800">{money(sale.netTotal)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {scanOpen && <InventoryScanner onClose={() => setScanOpen(false)} onAdd={addPlant} />}

      <Modal open={!!receipt} onClose={() => setReceipt(null)} title={t('pos.complete')} width="max-w-md">
        {receipt && (
          <div>
            <div className="text-lg font-bold text-nursery-900">{receipt.invoiceNumber}</div>
            <div className="text-sm text-nursery-500">{receipt.customerName} · {t(`pos.payments.${receipt.paymentMode}`, { defaultValue: receipt.paymentMode.replace(/_/g, ' ') })}</div>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {(receipt.items ?? []).map((line, index) => (
                <li key={`${line.plant?.sku ?? index}`} className="flex justify-between gap-3 py-2">
                  <span>{line.plant?.commonName ?? line.plant?.sku} × {line.quantity}</span>
                  <span>{money(line.itemTotalPrice)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-xl bg-nursery-50 p-4 text-sm">
              <div className="flex justify-between"><span>{t('pos.channel')}</span><span>{channelName(t, receipt.channel)}</span></div>
              <div className="flex justify-between"><span>{t('pos.discount')}</span><span>{money(receipt.discountAmount)}</span></div>
              {Number(receipt.taxAmount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span>{t('pos.gstAmount')} ({Number(receipt.taxPct ?? 0)}%)</span>
                  <span>{money(receipt.taxAmount ?? 0)}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-nursery-200 pt-2 text-base font-bold">
                <span>{t('pos.net')}</span><span>{money(receipt.netTotal)}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-nursery-500">{t('pos.receiptHelp')}</p>
            <button
              className="btn-primary mt-4 w-full"
              type="button"
              onClick={() => printReceipt(
                receipt,
                user?.nursery?.name || 'Nursery',
                currency,
                t('pos.gstAmount'),
              )}
            >
              <Printer className="h-4 w-4" aria-hidden />
              {t('pos.printReceipt')}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
