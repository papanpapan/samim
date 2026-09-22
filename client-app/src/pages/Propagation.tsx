import { FormEvent, useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import type { MotherPlant, PropagationBatch } from '../types';
import { ErrorNote, Field, Modal, PageHeader, Spinner, StageBadge } from '../components/ui';

const METHODS = [
  'AIR_LAYERING',
  'SOFTWOOD_GRAFTING',
  'CLEFT_GRAFTING',
  'PATCH_BUDDING',
  'CUTTING',
  'SEEDLING',
];

export function Propagation() {
  const [batches, setBatches] = useState<PropagationBatch[]>([]);
  const [mothers, setMothers] = useState<MotherPlant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [openNew, setOpenNew] = useState(false);
  const [newForm, setNewForm] = useState({ motherPlantId: '', method: 'AIR_LAYERING', initialQuantity: 500 });
  const [saving, setSaving] = useState(false);

  const [readyBatch, setReadyBatch] = useState<PropagationBatch | null>(null);
  const [readyForm, setReadyForm] = useState({
    commonName: '',
    variety: 'Thai Hybrid',
    category: 'Fruit',
    bagSize: '5x7 inch',
    costPrice: 45,
    retailPrice: 180,
    wholesalePrice: 120,
  });

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/propagation'), api.get('/mother-plants')])
      .then(([b, m]) => {
        setBatches(b.data.data);
        setMothers(m.data.data);
        if (!newForm.motherPlantId && m.data.data[0]) {
          setNewForm((f) => ({ ...f, motherPlantId: m.data.data[0].id }));
        }
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const createBatch = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.post('/propagation', newForm);
      setNote(`Batch ${res.data.data.batchCode} created`);
      setOpenNew(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const move = async (batch: PropagationBatch, toStage: string) => {
    const survived = Number(
      prompt(`Survivors moving to ${toStage.replace(/_/g, ' ')} (current ${batch.currentQuantity})?`, String(batch.currentQuantity)),
    );
    if (Number.isNaN(survived)) return;
    try {
      const res = await api.patch(`/propagation/${batch.id}/stage`, { toStage, survivedCount: survived });
      setNote(`Moved to ${toStage.replace(/_/g, ' ')} · mortality +${res.data.meta.mortalityDelta} (${res.data.meta.mortalityPct}%)`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openReady = (batch: PropagationBatch) => {
    setReadyForm((f) => ({ ...f, commonName: batch.motherPlant?.varietyName ?? '' }));
    setReadyBatch(batch);
  };

  const submitReady = async (e: FormEvent) => {
    e.preventDefault();
    if (!readyBatch) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post(`/propagation/${readyBatch.id}/ready`, readyForm);
      setNote(`${res.data.data.sku} created with ${res.data.data.currentStock} plants in stock`);
      setReadyBatch(null);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const nextAction = (b: PropagationBatch) => {
    switch (b.stage) {
      case 'INITIATED':
        return (
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => move(b, 'MIST_CHAMBER')}>
            → Mist Chamber
          </button>
        );
      case 'MIST_CHAMBER':
        return (
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => move(b, 'HARDENING_SHADE')}>
            → Hardening
          </button>
        );
      case 'HARDENING_SHADE':
        return (
          <button className="btn-primary px-2 py-1 text-xs" onClick={() => openReady(b)}>
            Mark Ready
          </button>
        );
      default:
        return <span className="text-xs text-nursery-400">—</span>;
    }
  };

  return (
    <div>
      <PageHeader
        title="Propagation Hub"
        subtitle="Grafting → Mist Chamber → Hardening → Ready for Sale"
        action={
          <button className="btn-primary" onClick={() => setOpenNew(true)}>
            + New Batch
          </button>
        }
      />
      <ErrorNote message={error} />
      {note && (
        <div className="mb-3 rounded-lg border border-nursery-200 bg-nursery-50 px-3 py-2 text-sm text-nursery-700">
          {note}
        </div>
      )}
      {loading ? (
        <Spinner label="Loading batches…" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-nursery-50 text-left text-xs uppercase tracking-wide text-nursery-600">
              <tr>
                <th className="px-4 py-3">Batch Code</th>
                <th className="px-4 py-3">Mother / Variety</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Mortality</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nursery-50">
              {batches.map((b) => {
                const lossPct = b.initialQuantity ? ((b.mortalityCount / b.initialQuantity) * 100).toFixed(1) : '0';
                return (
                  <tr key={b.id} className="hover:bg-nursery-50/50">
                    <td className="px-4 py-3 font-mono font-semibold text-nursery-800">{b.batchCode}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{b.motherPlant?.varietyName}</div>
                      <div className="text-xs text-nursery-500">{b.motherPlant?.tagNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{b.method.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{b.currentQuantity}</span>
                      <span className="text-xs text-nursery-400"> / {b.initialQuantity}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {b.mortalityCount} <span className="text-nursery-400">({lossPct}%)</span>
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge stage={b.stage} />
                    </td>
                    <td className="px-4 py-3 text-right">{nextAction(b)}</td>
                  </tr>
                );
              })}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-nursery-400">
                    No propagation batches yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New batch modal */}
      <Modal open={openNew} onClose={() => setOpenNew(false)} title="Create Propagation Batch">
        <form onSubmit={createBatch} className="space-y-4">
          <Field label="Mother Plant">
            <select
              className="input"
              value={newForm.motherPlantId}
              onChange={(e) => setNewForm({ ...newForm, motherPlantId: e.target.value })}
              required
            >
              {mothers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.tagNumber} — {m.varietyName}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Method">
              <select
                className="input"
                value={newForm.method}
                onChange={(e) => setNewForm({ ...newForm, method: e.target.value })}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Initial Quantity">
              <input
                type="number"
                min={1}
                className="input"
                value={newForm.initialQuantity}
                onChange={(e) => setNewForm({ ...newForm, initialQuantity: Number(e.target.value) })}
                required
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpenNew(false)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Start Batch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Mark ready modal */}
      <Modal open={!!readyBatch} onClose={() => setReadyBatch(null)} title={`Mark Ready · ${readyBatch?.batchCode ?? ''}`}>
        <p className="mb-4 text-sm text-nursery-600">
          {readyBatch?.currentQuantity} surviving plants will be pushed into sellable stock.
        </p>
        <form onSubmit={submitReady} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Common Name">
              <input className="input" value={readyForm.commonName} onChange={(e) => setReadyForm({ ...readyForm, commonName: e.target.value })} required />
            </Field>
            <Field label="Category">
              <select className="input" value={readyForm.category} onChange={(e) => setReadyForm({ ...readyForm, category: e.target.value })}>
                <option>Fruit</option>
                <option>Ornamental</option>
                <option>Indoor</option>
              </select>
            </Field>
            <Field label="Bag Size">
              <select className="input" value={readyForm.bagSize} onChange={(e) => setReadyForm({ ...readyForm, bagSize: e.target.value })}>
                <option>5x7 inch</option>
                <option>8x10 inch</option>
                <option>12 inch Tob</option>
              </select>
            </Field>
            <Field label="Variety">
              <input className="input" value={readyForm.variety} onChange={(e) => setReadyForm({ ...readyForm, variety: e.target.value })} />
            </Field>
            <Field label="Cost Price ৳">
              <input type="number" className="input" value={readyForm.costPrice} onChange={(e) => setReadyForm({ ...readyForm, costPrice: Number(e.target.value) })} />
            </Field>
            <Field label="Retail Price ৳">
              <input type="number" className="input" value={readyForm.retailPrice} onChange={(e) => setReadyForm({ ...readyForm, retailPrice: Number(e.target.value) })} />
            </Field>
            <Field label="Wholesale Price ৳">
              <input type="number" className="input" value={readyForm.wholesalePrice} onChange={(e) => setReadyForm({ ...readyForm, wholesalePrice: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setReadyBatch(null)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Processing…' : 'Create Stock & QR'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
