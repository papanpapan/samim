import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

type PublicUnit = {
  serial: string;
  status: string;
  nurseryName: string;
  batchCode: string;
  stage: string;
  method: string;
  plantName: string;
  varietyName: string;
  tagNumber: string;
};

export function UnitLabel() {
  const { code = '' } = useParams();
  const { t } = useTranslation();
  const [unit, setUnit] = useState<PublicUnit | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.get(`/public/units/${code}`)
      .then((res) => setUnit(res.data.data as PublicUnit))
      .catch(() => setMissing(true));
  }, [code]);

  if (missing) {
    return <main className="grid min-h-screen place-items-center bg-[#f4efe6] px-6 text-center"><p className="text-2xl">{t('propagation.unitMissing')}</p></main>;
  }
  if (!unit) return <main className="min-h-screen bg-[#f4efe6]" />;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4efe6] px-4 py-8 text-[#1c1915]">
      <article className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-sm">
        <p className="text-xs uppercase tracking-widest text-[#8c7355]">{unit.nurseryName}</p>
        <h1 className="mt-2 font-['Cormorant_Garamond',Georgia,serif] text-4xl">{unit.plantName || unit.varietyName}</h1>
        <p className="text-sm text-slate-500">{unit.varietyName}</p>
        <p className="mt-4 break-all font-mono text-sm font-semibold">{unit.serial}</p>
        <p className="mt-2 text-sm">{t(`propagation.unitStatus.${unit.status}`, { defaultValue: unit.status })}</p>
        <p className="mt-1 text-sm text-slate-500">{unit.batchCode} · {t(`stages.${unit.stage}`, { defaultValue: unit.stage })}</p>
        <p className="text-xs text-slate-400">{unit.tagNumber} · {t(`methods.${unit.method}`, { defaultValue: unit.method })}</p>
      </article>
    </main>
  );
}
