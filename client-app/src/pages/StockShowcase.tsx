import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { formatMoney } from '../utils/money';

type PublicStock = {
  nurseryName: string;
  nurseryPhone?: string | null;
  currencyCode?: string;
  commonName: string;
  variety: string;
  bagSize: string;
  plantHeight?: string | null;
  plantAge?: string | null;
  zoneLabel?: string | null;
  retailPrice: number;
  wholesalePrice?: number;
  currentStock: number;
  available?: number;
  videoUrl?: string | null;
  photos: { id: string; url: string }[];
};

const serif = { fontFamily: '"Cormorant Garamond", Georgia, serif' };

export function StockShowcase() {
  const { code = '' } = useParams();
  const { t } = useTranslation();
  const [plant, setPlant] = useState<PublicStock | null>(null);
  const [missing, setMissing] = useState(false);
  const [photo, setPhoto] = useState(0);

  useEffect(() => {
    api.get(`/public/stock/${code}`)
      .then((res) => setPlant(res.data.data as PublicStock))
      .catch(() => setMissing(true));
  }, [code]);

  if (missing) {
    return <main className="grid min-h-screen place-items-center bg-[#f4efe6] px-6 text-center"><p style={serif} className="text-3xl">{t('propagation.stockMissing')}</p></main>;
  }
  if (!plant) return <main className="min-h-screen bg-[#f4efe6]" />;

  const current = plant.photos[photo];

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1c1915]">
      {current && (
        <div className="mx-auto max-w-lg bg-[#14221b]">
          <img src={current.url} alt={plant.commonName} className="aspect-[4/5] w-full object-cover" />
        </div>
      )}
      <article className="mx-auto max-w-lg bg-white px-5 py-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-[#8c7355]">{plant.nurseryName}</p>
        <h1 style={serif} className="mt-2 text-4xl leading-none">{plant.commonName}</h1>
        <p className="mt-2 text-sm text-slate-500">{plant.variety} · {plant.bagSize}</p>
        <p style={serif} className="mt-4 text-3xl text-[#8a5a2b]">{formatMoney(plant.retailPrice, plant.currencyCode)}</p>
        {plant.wholesalePrice != null && <p className="text-sm text-slate-500">{t('inventory.wholesale')} {formatMoney(plant.wholesalePrice, plant.currencyCode)}</p>}
        <p className="text-sm text-slate-500">{t('propagation.stockLeft', { count: plant.available ?? plant.currentStock })}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-[11px] uppercase tracking-widest text-[#8c7355]">{t('inventory.zone')}</dt><dd>{plant.zoneLabel || '—'}</dd></div>
          <div><dt className="text-[11px] uppercase tracking-widest text-[#8c7355]">{t('inventory.specs.height')}</dt><dd>{plant.plantHeight || '—'}</dd></div>
          <div><dt className="text-[11px] uppercase tracking-widest text-[#8c7355]">{t('inventory.specs.age')}</dt><dd>{plant.plantAge || '—'}</dd></div>
        </dl>
        {plant.photos.length > 1 && (
          <div className="mt-6">
            <h2 className="text-xs uppercase tracking-[0.28em] text-[#8c7355]">{t('showcase.gallery')}</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {plant.photos.map((item, index) => (
                <button key={item.id} type="button" onClick={() => setPhoto(index)} className={`overflow-hidden rounded-xl ring-2 ${index === photo ? 'ring-forest-700' : 'ring-transparent'}`}>
                  <img src={item.url} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
        {plant.videoUrl && (
          <div className="mt-6">
            <h2 className="text-xs uppercase tracking-[0.28em] text-[#8c7355]">{t('showcase.film')}</h2>
            <video src={plant.videoUrl} controls playsInline className="mt-3 w-full rounded-2xl bg-black" />
          </div>
        )}
        {plant.nurseryPhone && <p className="mt-6 text-sm text-slate-600">{plant.nurseryPhone}</p>}
      </article>
    </main>
  );
}
