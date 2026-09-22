import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import type { PlantInventory } from '../types';
import { ErrorNote, Modal, PageHeader, Spinner } from '../components/ui';

interface LabelData {
  label: { sku: string; commonName: string; bagSize: string; mrp: string; sizeMm: string };
  encoded: string;
  pngDataUrl: string;
}

export function Inventory() {
  const [items, setItems] = useState<PlantInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [label, setLabel] = useState<LabelData | null>(null);
  const [labelLoading, setLabelLoading] = useState(false);

  const load = (q = '') => {
    setLoading(true);
    api
      .get('/inventory', { params: q ? { search: q } : {} })
      .then((res) => setItems(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const showLabel = async (id: string) => {
    setLabelLoading(true);
    try {
      const res = await api.get(`/inventory/${id}/label`);
      setLabel(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLabelLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Plant Inventory" subtitle="Ready stock, pricing & thermal QR labels (50×25mm)" />
      <ErrorNote message={error} />

      <div className="mb-4 flex gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search SKU or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(search)}
        />
        <button className="btn-ghost" onClick={() => load(search)}>
          Search
        </button>
      </div>

      {loading ? (
        <Spinner label="Loading inventory…" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-nursery-50 text-left text-xs uppercase tracking-wide text-nursery-600">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Plant</th>
                <th className="px-4 py-3">Bag</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Retail</th>
                <th className="px-4 py-3">Wholesale</th>
                <th className="px-4 py-3 text-right">Label</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nursery-50">
              {items.map((p) => {
                const low = p.currentStock <= p.reorderAlert;
                return (
                  <tr key={p.id} className="hover:bg-nursery-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-nursery-800">{p.sku}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.commonName}</div>
                      <div className="text-xs text-nursery-500">{p.category} · {p.variety}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{p.bagSize}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${low ? 'bg-rose-100 text-rose-700' : 'bg-nursery-100 text-nursery-800'}`}>
                        {p.currentStock}
                      </span>
                    </td>
                    <td className="px-4 py-3">৳{p.retailPrice}</td>
                    <td className="px-4 py-3">৳{p.wholesalePrice}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => showLabel(p.id)}>
                        QR / Barcode
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-nursery-400">
                    No inventory yet — mark a propagation batch “Ready for Sale”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!label || labelLoading} onClose={() => setLabel(null)} title="Thermal Label · 50×25mm" width="max-w-sm">
        {labelLoading || !label ? (
          <Spinner label="Generating label…" />
        ) : (
          <div>
            <div className="mx-auto w-[280px] rounded-lg border-2 border-dashed border-nursery-300 bg-white p-3">
              <div className="flex items-center gap-3">
                <img src={label.pngDataUrl} alt="QR code" className="h-24 w-24" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-nursery-700">Saba Nursery</div>
                  <div className="truncate text-sm font-bold text-nursery-900">{label.label.commonName}</div>
                  <div className="text-xs text-nursery-600">{label.label.bagSize}</div>
                  <div className="font-mono text-[10px] text-nursery-500">{label.label.sku}</div>
                  <div className="mt-1 text-base font-extrabold text-nursery-800">৳{label.label.mrp}</div>
                </div>
              </div>
            </div>
            <div className="mt-3 break-all rounded bg-nursery-50 p-2 text-[10px] text-nursery-500">
              {label.encoded}
            </div>
            <button className="btn-primary mt-4 w-full" onClick={() => window.print()}>
              Print Label
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
