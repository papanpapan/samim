import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../../api/client';
import { formatMoney } from '../../utils/money';
import { ErrorNote, ListSkeleton, Modal } from '../ui';

type StockLabel = {
  id: string;
  sku: string;
  commonName: string;
  variety: string;
  bagSize: string;
  zoneLabel?: string | null;
  retailPrice: number;
  wholesalePrice: number;
  publicUrl: string;
  qrDataUrl: string;
};

export function InventoryLabelSheet({
  ids,
  currencyCode,
  onClose,
}: {
  ids: string[];
  currencyCode?: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [labels, setLabels] = useState<StockLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const money = (value: number) => formatMoney(value, currencyCode);

  const idKey = ids.join(',');
  useEffect(() => {
    const nextIds = idKey.split(',').filter(Boolean);
    setLoading(true);
    api.post('/inventory/labels', { ids: nextIds }, { params: { origin: window.location.origin } })
      .then((res) => setLabels((res.data.data as { labels: StockLabel[] }).labels))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [idKey]);

  const printPage = () => {
    const cards = labels.map((label) => (
      `<article class="label"><img src="${label.qrDataUrl}" alt="" /><strong>${label.commonName}</strong><p>${label.variety} · ${label.bagSize}</p><p>${money(label.retailPrice)} / ${money(label.wholesalePrice)}</p><p>${label.zoneLabel || ''}</p><p class="sku">${label.sku}</p></article>`
    )).join('');
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) return;
    popup.document.write(`<!doctype html><html><head><title>${t('inventory.printSheet')}</title><style>
      @page { size: A4; margin: 10mm; }
      body { margin: 0; font-family: sans-serif; color: #1e293b; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .label { border: 1px solid #cbd5e1; border-radius: 8px; text-align: center; padding: 8px; break-inside: avoid; }
      img { width: 28mm; height: 28mm; }
      strong { display: block; margin-top: 4px; font-size: 12px; }
      p { margin: 2px 0; font-size: 11px; }
      .sku { font-family: ui-monospace, monospace; font-size: 10px; }
    </style></head><body><div class="grid">${cards}</div></body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <Modal open onClose={onClose} title={t('inventory.printSheet')} width="max-w-3xl">
      <ErrorNote message={error} />
      <p className="mb-3 text-sm text-slate-500">{t('inventory.printSheetHelp')}</p>
      {loading ? <ListSkeleton rows={3} framed={false} /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {labels.map((label) => (
            <article key={label.id} className="rounded-xl border border-slate-200 bg-white p-2 text-center">
              {label.qrDataUrl && <img src={label.qrDataUrl} alt={label.sku} className="mx-auto h-24 w-24" />}
              <p className="mt-1 text-sm font-semibold text-slate-800">{label.commonName}</p>
              <p className="text-xs text-slate-500">{label.variety} · {label.bagSize}</p>
              <p className="text-xs text-slate-600">{money(label.retailPrice)} / {money(label.wholesalePrice)}</p>
              <p className="text-[11px] text-slate-400">{label.zoneLabel || label.sku}</p>
            </article>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn-primary" onClick={printPage} disabled={labels.length === 0}>{t('inventory.print')}</button>
      </div>
    </Modal>
  );
}
