import { FormEvent, useRef, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import type { PlantInventory, Sale } from '../types';
import { ErrorNote, Modal, PageHeader } from '../components/ui';

interface CartLine {
  plant: PlantInventory;
  quantity: number;
}

const CHANNELS = [
  { value: 'RETAIL_COUNTER', label: 'Retail Counter' },
  { value: 'WHOLESALE_ORCHARDIST', label: 'Wholesale Orchardist' },
  { value: 'INDIAMART', label: 'IndiaMART' },
  { value: 'MEESHO', label: 'Meesho' },
];
const PAYMENTS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI_PHONEPE_GPAY', label: 'UPI (PhonePe/GPay)' },
  { value: 'BANK_NEFT_IMPS', label: 'Bank NEFT/IMPS' },
];

export function POS() {
  const [scan, setScan] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [channel, setChannel] = useState('RETAIL_COUNTER');
  const [payment, setPayment] = useState('CASH');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invoice, setInvoice] = useState<(Sale & { meta?: { discountPct: number } }) | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const isWholesale = channel === 'WHOLESALE_ORCHARDIST';
  const unitPrice = (p: PlantInventory) => Number(isWholesale ? p.wholesalePrice : p.retailPrice);
  const subTotal = cart.reduce((s, l) => s + unitPrice(l.plant) * l.quantity, 0);
  const totalQty = cart.reduce((s, l) => s + l.quantity, 0);
  const discountPct = isWholesale ? (totalQty >= 500 ? 20 : totalQty >= 100 ? 10 : 0) : 0;
  const discount = (subTotal * discountPct) / 100;
  const net = subTotal - discount;

  const addBySku = async (e: FormEvent) => {
    e.preventDefault();
    const sku = scan.trim();
    if (!sku) return;
    setError(null);
    try {
      const res = await api.get(`/inventory/sku/${encodeURIComponent(sku)}`);
      const plant: PlantInventory = res.data.data;
      setCart((prev) => {
        const found = prev.find((l) => l.plant.id === plant.id);
        if (found) {
          return prev.map((l) => (l.plant.id === plant.id ? { ...l, quantity: l.quantity + 1 } : l));
        }
        return [...prev, { plant, quantity: 1 }];
      });
      setScan('');
      scanRef.current?.focus();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const setQty = (id: string, qty: number) =>
    setCart((prev) => prev.map((l) => (l.plant.id === id ? { ...l, quantity: Math.max(1, qty) } : l)));
  const removeLine = (id: string) => setCart((prev) => prev.filter((l) => l.plant.id !== id));

  const checkout = async () => {
    if (cart.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/sales', {
        channel,
        paymentMode: payment,
        customerName,
        customerPhone: customerPhone || undefined,
        items: cart.map((l) => ({ plantId: l.plant.id, quantity: l.quantity })),
      });
      setInvoice({ ...res.data.data, meta: res.data.meta });
      setCart([]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Sales POS" subtitle="Scan QR/barcode · tiered wholesale pricing · atomic stock ledger" />
      <ErrorNote message={error} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Cart */}
        <div className="lg:col-span-2">
          <form onSubmit={addBySku} className="mb-3 flex gap-2">
            <input
              ref={scanRef}
              autoFocus
              className="input font-mono"
              placeholder="Scan or type SKU (e.g. PLT-BDG-5X7-01) and press Enter"
              value={scan}
              onChange={(e) => setScan(e.target.value)}
            />
            <button className="btn-primary whitespace-nowrap">Add</button>
          </form>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-nursery-50 text-left text-xs uppercase tracking-wide text-nursery-600">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Unit ৳</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Total ৳</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nursery-50">
                {cart.map((l) => (
                  <tr key={l.plant.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.plant.commonName}</div>
                      <div className="font-mono text-[11px] text-nursery-500">{l.plant.sku} · {l.plant.bagSize}</div>
                    </td>
                    <td className="px-4 py-3">{unitPrice(l.plant)}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        className="input w-20 py-1"
                        value={l.quantity}
                        onChange={(e) => setQty(l.plant.id, Number(e.target.value))}
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold">{(unitPrice(l.plant) * l.quantity).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-rose-500 hover:text-rose-700" onClick={() => removeLine(l.plant.id)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-nursery-400">
                      Cart is empty. Scan a plant SKU to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Checkout panel */}
        <div className="card h-fit space-y-3 p-5">
          <div>
            <span className="label">Channel</span>
            <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">Customer</span>
            <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <span className="label">Phone</span>
            <input className="input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <span className="label">Payment</span>
            <select className="input" value={payment} onChange={(e) => setPayment(e.target.value)}>
              {PAYMENTS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-nursery-50 p-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>৳{subTotal.toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between text-nursery-600">
              <span>Discount {discountPct > 0 && `(${discountPct}%)`}</span>
              <span>− ৳{discount.toLocaleString('en-IN')}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-nursery-200 pt-2 text-lg font-bold text-nursery-900">
              <span>Net Total</span><span>৳{net.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <button className="btn-primary w-full" disabled={busy || cart.length === 0} onClick={checkout}>
            {busy ? 'Processing…' : 'Complete Sale & Print'}
          </button>
        </div>
      </div>

      <Modal open={!!invoice} onClose={() => setInvoice(null)} title="Sale Complete" width="max-w-sm">
        {invoice && (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-nursery-100 text-3xl">✅</div>
            <div className="text-lg font-bold text-nursery-900">{invoice.invoiceNumber}</div>
            <div className="text-sm text-nursery-500">{invoice.customerName} · {invoice.paymentMode.replace(/_/g, ' ')}</div>
            <div className="mt-4 rounded-xl bg-nursery-50 p-4 text-left text-sm">
              <div className="flex justify-between"><span>Channel</span><span>{invoice.channel.replace(/_/g, ' ')}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>{invoice.meta?.discountPct ?? 0}%</span></div>
              <div className="mt-2 flex justify-between border-t border-nursery-200 pt-2 text-base font-bold">
                <span>Net Total</span><span>৳{Number(invoice.netTotal).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-nursery-500">Stock decremented atomically · ledger updated</p>
            <button className="btn-primary mt-4 w-full" onClick={() => setInvoice(null)}>Done</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
