import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../api/client';
import { formatMoney } from '../utils/money';

type PublicPlant = {
  nurseryName: string;
  nurseryAddress?: string | null;
  nurseryPhone?: string | null;
  currencyCode?: string;
  plantName: string;
  varietyName: string;
  category: string;
  sourceCountry?: string | null;
  healthStatus: string;
  description?: string | null;
  listPrice: number | null;
  plantCount?: number;
  place?: string;
  videoUrl?: string | null;
  photos: { id: string; kind: string; url: string }[];
};

const serif = { fontFamily: '"Cormorant Garamond", Georgia, serif' };

export function PlantShowcase() {
  const { code = '' } = useParams();
  const { t } = useTranslation();
  const [plant, setPlant] = useState<PublicPlant | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerCity: '', quantity: '1', neededBy: '', notes: '' });

  useEffect(() => {
    setMissing(false);
    setPlant(null);
    api
      .get(`/public/plants/${code}`)
      .then((res) => setPlant(res.data.data))
      .catch(() => setMissing(true));
  }, [code]);

  const book = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await api.post(`/public/plants/${code}/bookings`, {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerCity: form.customerCity.trim() || undefined,
        quantity: Number(form.quantity),
        neededBy: form.neededBy || undefined,
        notes: form.notes.trim() || undefined,
      });
      setReference(res.data.data.reference as string);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (missing) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4efe6] px-6 text-center text-[#1c1915]">
        <p style={serif} className="text-3xl">{t('showcase.missing')}</p>
      </main>
    );
  }

  if (!plant) {
    return <main className="min-h-screen bg-[#f4efe6]" />;
  }

  const banner = plant.photos[0]?.url;
  const price = plant.listPrice == null
    ? t('showcase.priceOnRequest')
    : formatMoney(plant.listPrice, plant.currencyCode);
  const category = t(`mother.categories.${plant.category}`, { defaultValue: plant.category });
  const health = t(`mother.healthOptions.${plant.healthStatus}`, { defaultValue: plant.healthStatus });

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1c1915]">
      <header className="relative min-h-[70vh] overflow-hidden bg-[#14221b] text-[#f6f1e7]">
        {banner && <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#14221b] via-[#14221b]/35 to-transparent" />
        <div className="relative mx-auto flex min-h-[70vh] max-w-5xl flex-col justify-end px-6 pb-12 pt-16">
          <p className="text-xs uppercase tracking-[0.35em] text-[#e7d7c1]">{plant.nurseryName}</p>
          <h1 style={serif} className="mt-3 max-w-3xl text-5xl leading-none sm:text-7xl">{plant.plantName || plant.varietyName}</h1>
          <p className="mt-4 text-lg text-[#f6f1e7]/90">{plant.varietyName}</p>
          <p style={serif} className="mt-6 text-3xl text-[#f3d7a1]">{price}</p>
          <p className="mt-1 text-sm text-[#f6f1e7]/80">{t('showcase.perReady')}</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[1.3fr_0.9fr]">
        <section className="space-y-8">
          <p className="text-xs uppercase tracking-[0.28em] text-[#8c7355]">{t('showcase.eyebrow')}</p>
          {plant.description && <p style={serif} className="text-2xl leading-snug text-[#2b2620]">{plant.description}</p>}
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-widest text-[#8c7355]">{t('mother.category')}</dt>
              <dd className="mt-1">{category}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-[#8c7355]">{t('showcase.origin')}</dt>
              <dd className="mt-1">{plant.sourceCountry || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-[#8c7355]">{t('showcase.health')}</dt>
              <dd className="mt-1">{health}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-[#8c7355]">{t('showcase.place')}</dt>
              <dd className="mt-1">{plant.place || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-[#8c7355]">{t('showcase.motherCount')}</dt>
              <dd className="mt-1 tabular-nums">{plant.plantCount ?? 1}</dd>
            </div>
          </dl>
          {plant.nurseryAddress && <p className="text-sm text-[#5c5348]">{plant.nurseryAddress}{plant.nurseryPhone ? ` · ${plant.nurseryPhone}` : ''}</p>}

          {plant.photos.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-[0.28em] text-[#8c7355]">{t('showcase.gallery')}</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {plant.photos.map((photo) => (
                  <img key={photo.id} src={photo.url} alt="" className="aspect-[4/5] w-full rounded-2xl object-cover" />
                ))}
              </div>
            </div>
          )}

          {plant.videoUrl && (
            <div>
              <h2 className="text-xs uppercase tracking-[0.28em] text-[#8c7355]">{t('showcase.film')}</h2>
              <video src={plant.videoUrl} controls className="mt-3 w-full rounded-2xl bg-black" />
            </div>
          )}
        </section>

        <aside className="h-fit rounded-3xl bg-white p-6 shadow-sm lg:sticky lg:top-6">
          {reference ? (
            <div>
              <h2 style={serif} className="text-4xl">{t('showcase.thanks')}</h2>
              <p className="mt-3 text-sm leading-6 text-[#5c5348]">{t('showcase.thanksBody', { ref: reference })}</p>
            </div>
          ) : (
            <form onSubmit={book} className="space-y-3">
              <h2 style={serif} className="text-4xl">{t('showcase.book')}</h2>
              <p className="text-sm leading-6 text-[#5c5348]">{t('showcase.bookHelp')}</p>
              {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
              <label className="block text-xs uppercase tracking-widest text-[#8c7355]">
                {t('showcase.name')}
                <input className="input mt-1" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} required minLength={2} />
              </label>
              <label className="block text-xs uppercase tracking-widest text-[#8c7355]">
                {t('showcase.phone')}
                <input className="input mt-1" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} required minLength={6} />
              </label>
              <label className="block text-xs uppercase tracking-widest text-[#8c7355]">
                {t('showcase.city')}
                <input className="input mt-1" value={form.customerCity} onChange={(e) => setForm({ ...form, customerCity: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs uppercase tracking-widest text-[#8c7355]">
                  {t('showcase.quantity')}
                  <input className="input mt-1" type="number" min={1} max={5000} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
                </label>
                <label className="block text-xs uppercase tracking-widest text-[#8c7355]">
                  {t('showcase.neededBy')}
                  <input className="input mt-1" type="date" value={form.neededBy} onChange={(e) => setForm({ ...form, neededBy: e.target.value })} />
                </label>
              </div>
              <label className="block text-xs uppercase tracking-widest text-[#8c7355]">
                {t('showcase.note')}
                <textarea className="input mt-1 min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} />
              </label>
              <button className="btn-primary w-full" disabled={sending}>{sending ? t('showcase.sending') : t('showcase.submit')}</button>
            </form>
          )}
        </aside>
      </div>
    </main>
  );
}
