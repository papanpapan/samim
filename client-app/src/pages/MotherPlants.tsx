import { FormEvent, useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import type { MotherPlant } from '../types';
import { ErrorNote, Field, Modal, PageHeader, Spinner } from '../components/ui';

const CULTIVARS = [
  'Black Diamond Guava',
  'Red Diamond Guava',
  'Red King Guava',
  'Variegated Guava',
  'Thai King Jamun',
  'Seedless Jamun',
  'Thai Jackfruit',
  'Thai Adenium',
  'Mulberry',
  'Blackberry',
  'Blueberry',
];
const COUNTRIES = ['Thailand', 'Vietnam', 'Malaysia', 'India'];

export function MotherPlants() {
  const [items, setItems] = useState<MotherPlant[]>([]);
  const [meta, setMeta] = useState<{ total: number; totalScionsHarvested: number }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tagNumber: '',
    varietyName: CULTIVARS[0],
    sourceCountry: COUNTRIES[0],
    plantingDate: '2025-06-01',
    plotLocation: '',
  });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/mother-plants')
      .then((res) => {
        setItems(res.data.data);
        setMeta(res.data.meta);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/mother-plants', form);
      setOpen(false);
      setForm({ ...form, tagNumber: '', plotLocation: '' });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const harvest = async (id: string) => {
    const qty = Number(prompt('Scion stems harvested?', '25'));
    if (!qty || qty <= 0) return;
    try {
      await api.post(`/mother-plants/${id}/scions`, { quantity: qty });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Mother Plant Registry"
        subtitle={
          meta
            ? `${meta.total} mother trees · ${meta.totalScionsHarvested} scions harvested`
            : 'Exotic cultivar & mother plant master'
        }
        action={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            + Add Mother Plant
          </button>
        }
      />
      <ErrorNote message={error} />
      {loading ? (
        <Spinner label="Loading mother plants…" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-nursery-50 text-left text-xs uppercase tracking-wide text-nursery-600">
              <tr>
                <th className="px-4 py-3">Tag</th>
                <th className="px-4 py-3">Variety</th>
                <th className="px-4 py-3">Origin</th>
                <th className="px-4 py-3">Plot</th>
                <th className="px-4 py-3">Batches</th>
                <th className="px-4 py-3">Scions</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nursery-50">
              {items.map((m) => (
                <tr key={m.id} className="hover:bg-nursery-50/50">
                  <td className="px-4 py-3 font-mono font-semibold text-nursery-800">{m.tagNumber}</td>
                  <td className="px-4 py-3">{m.varietyName}</td>
                  <td className="px-4 py-3">{m.sourceCountry ?? '—'}</td>
                  <td className="px-4 py-3 text-nursery-600">{m.plotLocation}</td>
                  <td className="px-4 py-3">{m._count?.propagations ?? 0}</td>
                  <td className="px-4 py-3 font-semibold">{m.scionsHarvested}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => harvest(m.id)}>
                      Log scion
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-nursery-400">
                    No mother plants yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Register Mother Plant">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tag Number">
              <input
                className="input"
                placeholder="MP-BDG-02"
                value={form.tagNumber}
                onChange={(e) => setForm({ ...form, tagNumber: e.target.value })}
                required
              />
            </Field>
            <Field label="Variety">
              <select
                className="input"
                value={form.varietyName}
                onChange={(e) => setForm({ ...form, varietyName: e.target.value })}
              >
                {CULTIVARS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Source Country">
              <select
                className="input"
                value={form.sourceCountry}
                onChange={(e) => setForm({ ...form, sourceCountry: e.target.value })}
              >
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Planting Date">
              <input
                type="date"
                className="input"
                value={form.plantingDate}
                onChange={(e) => setForm({ ...form, plantingDate: e.target.value })}
                required
              />
            </Field>
          </div>
          <Field label="Plot Location">
            <input
              className="input"
              placeholder="Plot A, Line 4, Tree 12"
              value={form.plotLocation}
              onChange={(e) => setForm({ ...form, plotLocation: e.target.value })}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save & Generate Tag'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
