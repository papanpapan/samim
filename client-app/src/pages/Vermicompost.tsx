import { FormEvent, useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import { ErrorNote, Field, Modal, PageHeader, Spinner } from '../components/ui';

interface Bed {
  id: string;
  bedCode: string;
  rawBiomassKg: string;
  cowDungKg: string;
  startDate: string;
  expectedDate: string;
  harvestedDate?: string | null;
  actualYieldKg?: string | null;
  qualityGrade?: string | null;
  status: string;
  readyForSieving: boolean;
}

export function Vermicompost() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ bedCode: '', cowDungKg: 1000, rawBiomassKg: 300, startDate: '2026-07-01', curingDays: 65 });

  const load = () => {
    setLoading(true);
    api
      .get('/vermicompost')
      .then((res) => setBeds(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/vermicompost', form);
      setOpen(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const harvest = async (id: string) => {
    const kg = Number(prompt('Harvested yield (kg)?', '720'));
    if (!kg || kg <= 0) return;
    try {
      await api.post(`/vermicompost/${id}/harvest`, { actualYieldKg: kg, qualityGrade: 'Grade A' });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Vermicompost Hub"
        subtitle="Bed-wise organic soil production & yield tracking"
        action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Register Bed</button>}
      />
      <ErrorNote message={error} />
      {loading ? (
        <Spinner label="Loading beds…" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {beds.map((b) => (
            <div key={b.id} className="card p-5">
              <div className="flex items-center justify-between">
                <div className="font-mono font-bold text-nursery-800">{b.bedCode}</div>
                <span className={`badge ${b.harvestedDate ? 'bg-nursery-100 text-nursery-800' : b.readyForSieving ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                  {b.harvestedDate ? 'Harvested' : b.readyForSieving ? 'Ready to sieve' : 'Decomposing'}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-nursery-600">
                <div>Cow dung: <b>{b.cowDungKg} kg</b></div>
                <div>Biomass: <b>{b.rawBiomassKg} kg</b></div>
                <div>Expected: {new Date(b.expectedDate).toLocaleDateString()}</div>
                {b.actualYieldKg && <div className="text-nursery-800">Yield: <b>{b.actualYieldKg} kg</b> ({b.qualityGrade})</div>}
              </div>
              {!b.harvestedDate && (
                <button className="btn-ghost mt-4 w-full text-sm" onClick={() => harvest(b.id)}>
                  Harvest Bed
                </button>
              )}
            </div>
          ))}
          {beds.length === 0 && <div className="text-nursery-400">No beds registered yet.</div>}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Register Vermicompost Bed">
        <form onSubmit={create} className="space-y-4">
          <Field label="Bed Code">
            <input className="input" placeholder="V-BED-02" value={form.bedCode} onChange={(e) => setForm({ ...form, bedCode: e.target.value })} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cow Dung (kg)">
              <input type="number" className="input" value={form.cowDungKg} onChange={(e) => setForm({ ...form, cowDungKg: Number(e.target.value) })} />
            </Field>
            <Field label="Raw Biomass (kg)">
              <input type="number" className="input" value={form.rawBiomassKg} onChange={(e) => setForm({ ...form, rawBiomassKg: Number(e.target.value) })} />
            </Field>
            <Field label="Start Date">
              <input type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="Curing Days">
              <input type="number" className="input" value={form.curingDays} onChange={(e) => setForm({ ...form, curingDays: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Register Bed'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
