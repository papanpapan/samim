import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../api/client';
import { ErrorNote, Field, ListSkeleton, PageHeader } from '../components/ui';

interface Plan {
  id: string;
  plantName: string;
  problem: string;
  product: string;
  dose: string;
  method: string;
  status: string;
  notes: string | null;
}

const empty = { plantName: '', problem: '', product: '', dose: '', method: '', notes: '' };

export function Treatment() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Plan[]>([]);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/smart/treatments')
      .then((res) => setRows(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await api.post('/smart/treatments', form);
      setForm(empty);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const done = async (id: string) => {
    setError(null);
    try {
      await api.patch(`/smart/treatments/${id}/done`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader title={t('treatment.title')} subtitle={t('treatment.subtitle')} />
      <ErrorNote message={error} />
      <form onSubmit={save} className="card mb-4 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
        <Field label={t('treatment.plant')}><input className="input" required value={form.plantName} onChange={(e) => setForm({ ...form, plantName: e.target.value })} /></Field>
        <Field label={t('treatment.problem')}><input className="input" required value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} /></Field>
        <Field label={t('treatment.product')}><input className="input" required value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} /></Field>
        <Field label={t('treatment.dose')}><input className="input" required value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} /></Field>
        <Field label={t('treatment.method')}><input className="input" required value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} /></Field>
        <Field label={t('treatment.notes')}><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <button className="btn-primary sm:col-span-2">{t('treatment.save')}</button>
      </form>
      {loading ? <ListSkeleton rows={3} /> : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold text-slate-800">{row.plantName}</div>
                <div className="text-sm text-slate-600">{row.problem}</div>
                <div className="text-sm text-slate-500">{row.product} · {row.dose} · {row.method}</div>
              </div>
              {row.status === 'DONE' ? (
                <span className="badge bg-slate-100 text-slate-700">{t('treatment.done')}</span>
              ) : (
                <button className="btn-primary" type="button" onClick={() => done(row.id)}>{t('treatment.markDone')}</button>
              )}
            </li>
          ))}
          {rows.length === 0 && <li className="text-center text-slate-400">{t('treatment.empty')}</li>}
        </ul>
      )}
    </div>
  );
}
