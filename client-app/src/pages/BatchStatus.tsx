import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

type PublicBatch = {
  batchCode: string;
  nurseryName: string;
  plantName: string;
  varietyName: string;
  tagNumber: string;
  place: string;
  method: string;
  stage: string;
  startDate: string;
  initialQuantity: number;
  currentQuantity: number;
  mortalityCount: number;
  growing: number;
  lost: number;
  ready: number;
  successPct: number;
  mortalityPct: number;
};

export function BatchStatus() {
  const { code = '' } = useParams();
  const { t } = useTranslation();
  const [batch, setBatch] = useState<PublicBatch | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.get(`/public/batches/${code}`)
      .then((res) => setBatch(res.data.data as PublicBatch))
      .catch(() => setMissing(true));
  }, [code]);

  if (missing) {
    return <main className="grid min-h-screen place-items-center bg-[#f4efe6] px-6 text-center"><p className="text-2xl">{t('propagation.batchMissing')}</p></main>;
  }
  if (!batch) return <main className="min-h-screen bg-[#f4efe6]" />;

  const facts = [
    [t('propagation.batchCode'), batch.batchCode],
    [t('propagation.mother'), `${batch.plantName || batch.varietyName} · ${batch.varietyName}`],
    [t('propagation.method'), t(`methods.${batch.method}`, { defaultValue: batch.method })],
    [t('propagation.stage'), t(`stages.${batch.stage}`, { defaultValue: batch.stage })],
    [t('propagation.qty'), `${batch.currentQuantity} / ${batch.initialQuantity}`],
    [t('propagation.successRate', { pct: batch.successPct }), t('propagation.mortalityRate', { pct: batch.mortalityPct })],
  ];

  return (
    <main className="min-h-screen bg-[#f4efe6] px-4 py-8 text-[#1c1915]">
      <article className="mx-auto max-w-lg rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-[#8c7355]">{batch.nurseryName}</p>
        <h1 className="mt-2 font-['Cormorant_Garamond',Georgia,serif] text-4xl">{batch.plantName || batch.varietyName}</h1>
        <p className="text-sm text-slate-500">{batch.tagNumber} · {batch.place}</p>
        <dl className="mt-6 space-y-3 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-slate-600">
          {t('propagation.unitCounts', { growing: batch.growing, lost: batch.lost, ready: batch.ready })}
        </p>
      </article>
    </main>
  );
}
