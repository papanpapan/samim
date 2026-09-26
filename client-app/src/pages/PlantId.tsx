import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../api/client';
import { ErrorNote, Field, ListSkeleton, PageHeader } from '../components/ui';

interface Match {
  name: string;
  note: string;
  score: number;
}

const SHAPES = ['OVAL', 'LANCE', 'ROUND', 'THICK'] as const;
const EDGES = ['SMOOTH', 'TOOTHED', 'WAVY'] as const;
const COLORS = ['DARK_GREEN', 'RED_FLUSH', 'VARIEGATED', 'PALE_GREEN'] as const;
const VEINS = ['PINNATE', 'THICK'] as const;

function colorFromPhoto(file: File): Promise<typeof COLORS[number]> {
  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve('DARK_GREEN');
        return;
      }
      ctx.drawImage(image, 0, 0, 32, 32);
      const data = ctx.getImageData(0, 0, 32, 32).data;
      let red = 0;
      let green = 0;
      let light = 0;
      let dark = 0;
      const pixels = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        red += data[i];
        green += data[i + 1];
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (lum > 180) light += 1;
        if (lum < 80) dark += 1;
      }
      URL.revokeObjectURL(url);
      const avgRed = red / pixels;
      const avgGreen = green / pixels;
      if (light / pixels > 0.18 && dark / pixels > 0.08) resolve('VARIEGATED');
      else if (avgRed > avgGreen * 0.85 && avgRed > 90) resolve('RED_FLUSH');
      else if (avgGreen > 140) resolve('PALE_GREEN');
      else resolve('DARK_GREEN');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('DARK_GREEN');
    };
    image.src = url;
  });
}

export function PlantId() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ shape: 'OVAL', edge: 'SMOOTH', color: 'DARK_GREEN', veins: 'PINNATE' });
  const [preview, setPreview] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [history, setHistory] = useState<{ id: string; matchName: string; confidence: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/smart/identify')
      .then((res) => setHistory(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    const color = await colorFromPhoto(file);
    setForm((current) => ({ ...current, color }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const res = await api.post('/smart/identify', form);
      setMatches(res.data.data.matches);
      const saved = await api.get('/smart/identify');
      setHistory(saved.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader title={t('plantId.title')} subtitle={t('plantId.subtitle')} />
      <ErrorNote message={error} />
      <form onSubmit={submit} className="card grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="label">{t('plantId.photo')}</span>
          <input className="input" type="file" accept="image/*" capture="environment" onChange={(e) => void onPhoto(e.target.files?.[0])} />
        </label>
        {preview && <img src={preview} alt="" className="max-h-48 w-full rounded-xl object-cover sm:col-span-2" />}
        <Field label={t('plantId.shape')}>
          <select className="input" value={form.shape} onChange={(e) => setForm({ ...form, shape: e.target.value })}>
            {SHAPES.map((item) => <option key={item} value={item}>{t(`plantId.shapes.${item}`)}</option>)}
          </select>
        </Field>
        <Field label={t('plantId.edge')}>
          <select className="input" value={form.edge} onChange={(e) => setForm({ ...form, edge: e.target.value })}>
            {EDGES.map((item) => <option key={item} value={item}>{t(`plantId.edges.${item}`)}</option>)}
          </select>
        </Field>
        <Field label={t('plantId.color')}>
          <select className="input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}>
            {COLORS.map((item) => <option key={item} value={item}>{t(`plantId.colors.${item}`)}</option>)}
          </select>
        </Field>
        <Field label={t('plantId.veins')}>
          <select className="input" value={form.veins} onChange={(e) => setForm({ ...form, veins: e.target.value })}>
            {VEINS.map((item) => <option key={item} value={item}>{t(`plantId.veinsOpt.${item}`)}</option>)}
          </select>
        </Field>
        <button className="btn-primary sm:col-span-2">{t('plantId.match')}</button>
      </form>
      {matches.length > 0 && (
        <ol className="mt-4 space-y-3">
          {matches.map((match, index) => (
            <li key={match.name} className="card p-4">
              <div className="text-xs font-semibold uppercase text-slate-400">{index === 0 ? t('plantId.best') : t('plantId.also')}</div>
              <div className="text-lg font-bold text-slate-800">{match.name}</div>
              <div className="text-sm text-slate-600">{match.note}</div>
              <div className="text-xs text-slate-400">{match.score}%</div>
            </li>
          ))}
        </ol>
      )}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">{t('plantId.history')}</h2>
        {loading ? <ListSkeleton rows={3} /> : (
          <ul className="space-y-2">
            {history.map((row) => (
              <li key={row.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{row.matchName} · {row.confidence}%</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
