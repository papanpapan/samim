import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../../api/client';
import type { BatchLabel, PropagationBatch } from '../../types';
import { ErrorNote, ListSkeleton, Modal } from '../ui';

type LabelPack = {
  batchCode: string;
  plantName: string;
  varietyName: string;
  page: number;
  pageSize: number;
  total: number;
  labels: BatchLabel[];
};

export function LabelSheet({ batch, onClose }: { batch: PropagationBatch; onClose: () => void }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pack, setPack] = useState<LabelPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 12;

  useEffect(() => {
    setLoading(true);
    api.get(`/propagation/${batch.id}/labels`, {
      params: { page, pageSize, origin: window.location.origin },
    })
      .then((res) => setPack(res.data.data as LabelPack))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [batch.id, page]);

  const pages = pack ? Math.max(1, Math.ceil(pack.total / pack.pageSize)) : 1;

  const printPage = () => {
    if (!pack) return;
    const cards = pack.labels.map((label) => (
      `<article class="label"><img src="${label.qrDataUrl}" alt="" /><strong>${label.serial}</strong><p>${pack.plantName || pack.varietyName}</p><p>${pack.varietyName}</p></article>`
    )).join('');
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) return;
    popup.document.write(`<!doctype html><html><head><title>${pack.batchCode}</title><style>
      @page { size: A4; margin: 10mm; }
      body { margin: 0; font-family: sans-serif; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .label { border: 1px solid #cbd5e1; border-radius: 8px; text-align: center; padding: 8px; break-inside: avoid; }
      img { width: 28mm; height: 28mm; }
      strong { display: block; font-size: 11px; }
      p { margin: 2px 0; font-size: 11px; }
    </style></head><body><div class="grid">${cards}</div></body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <Modal open onClose={onClose} title={t('propagation.labelsTitle', { code: batch.batchCode })} width="max-w-3xl">
      <ErrorNote message={error} />
      <p className="mb-3 text-sm text-slate-500">{t('propagation.labelsHelp')}</p>
      {loading ? <ListSkeleton rows={3} framed={false} /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {pack?.labels.map((label) => (
            <article key={label.code} className="rounded-xl border border-slate-200 bg-white p-2 text-center">
              <img src={label.qrDataUrl} alt={label.serial} className="mx-auto h-24 w-24" />
              <p className="mt-1 break-all font-mono text-[11px] font-semibold text-slate-800">{label.serial}</p>
              <p className="text-xs text-slate-500">{pack.varietyName}</p>
            </article>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{t('propagation.prevPage')}</button>
          <span className="self-center text-sm text-slate-500">{page} / {pages}</span>
          <button type="button" className="btn-ghost" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>{t('propagation.nextPage')}</button>
        </div>
        <button type="button" className="btn-primary" onClick={printPage} disabled={!pack || pack.labels.length === 0}>{t('propagation.printLabels')}</button>
      </div>
    </Modal>
  );
}
