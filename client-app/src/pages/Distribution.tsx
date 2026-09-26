import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../api/client';
import { ErrorNote, Field, ListSkeleton, PageHeader } from '../components/ui';

interface Booking {
  id: string;
  customerName: string;
  variety: string;
  quantity: number;
  status: string;
  customerCity?: string | null;
}

interface Manifest {
  id: string;
  manifestNo: string;
  destination: string;
  cargoSummary: string;
  status: string;
  vehicleNo?: string | null;
}

interface Lead {
  id: string;
  source: string;
  contactName: string;
  productInterest: string;
  quantity: number;
  status: string;
}

const BOOKING_STATUS = ['PENDING', 'CONFIRMED', 'FULFILLED', 'CANCELLED'] as const;
const MANIFEST_STATUS = ['DRAFT', 'DISPATCHED', 'DELIVERED'] as const;
const LEAD_STATUS = ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'] as const;
const SOURCES = ['INDIAMART', 'MEESHO', 'AMAZON'] as const;

export function Distribution() {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState({ customerName: '', variety: '', quantity: 100, customerCity: '' });
  const [manifest, setManifest] = useState({ destination: '', cargoSummary: '', vehicleNo: '' });
  const [lead, setLead] = useState({ source: 'INDIAMART', contactName: '', productInterest: '', quantity: 50 });

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/distribution/bookings'),
      api.get('/distribution/manifests'),
      api.get('/distribution/leads'),
    ])
      .then(([b, m, l]) => {
        setBookings(b.data.data);
        setManifests(m.data.data);
        setLeads(l.data.data);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const saveBooking = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/distribution/bookings', { ...booking, customerCity: booking.customerCity || undefined });
      setBooking({ customerName: '', variety: '', quantity: 100, customerCity: '' });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const saveManifest = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/distribution/manifests', { ...manifest, vehicleNo: manifest.vehicleNo || undefined });
      setManifest({ destination: '', cargoSummary: '', vehicleNo: '' });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const saveLead = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/distribution/leads', lead);
      setLead({ source: 'INDIAMART', contactName: '', productInterest: '', quantity: 50 });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const patch = async (path: string, status: string) => {
    try {
      await api.patch(path, { status });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader title={t('distribution.title')} subtitle={t('distribution.subtitle')} />
      <ErrorNote message={error} />
      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">{t('distribution.bookings')}</h2>
            <ul className="mb-4 space-y-2">
              {bookings.map((row) => (
                <li key={row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <div className="font-medium">{row.customerName}</div>
                  <div className="text-xs text-slate-500">{row.variety} · {row.quantity}</div>
                  <select className="input mt-2" value={row.status} onChange={(e) => patch(`/distribution/bookings/${row.id}`, e.target.value)}>
                    {BOOKING_STATUS.map((s) => <option key={s} value={s}>{t(`distribution.bookingStatus.${s}`)}</option>)}
                  </select>
                </li>
              ))}
              {bookings.length === 0 && <li className="text-sm text-slate-400">{t('distribution.empty')}</li>}
            </ul>
            <form onSubmit={saveBooking} className="space-y-2 border-t border-slate-100 pt-3">
              <Field label={t('distribution.customer')}><input className="input" value={booking.customerName} onChange={(e) => setBooking({ ...booking, customerName: e.target.value })} required /></Field>
              <Field label={t('distribution.variety')}><input className="input" value={booking.variety} onChange={(e) => setBooking({ ...booking, variety: e.target.value })} required /></Field>
              <Field label={t('distribution.qty')}><input type="number" min={1} className="input" value={booking.quantity} onChange={(e) => setBooking({ ...booking, quantity: Number(e.target.value) })} /></Field>
              <button className="btn-primary w-full">{t('distribution.saveBooking')}</button>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">{t('distribution.manifests')}</h2>
            <ul className="mb-4 space-y-2">
              {manifests.map((row) => (
                <li key={row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <div className="font-mono font-semibold">{row.manifestNo}</div>
                  <div className="text-xs text-slate-500">{row.destination} · {row.cargoSummary}</div>
                  <select className="input mt-2" value={row.status} onChange={(e) => patch(`/distribution/manifests/${row.id}`, e.target.value)}>
                    {MANIFEST_STATUS.map((s) => <option key={s} value={s}>{t(`distribution.manifestStatus.${s}`)}</option>)}
                  </select>
                </li>
              ))}
              {manifests.length === 0 && <li className="text-sm text-slate-400">{t('distribution.empty')}</li>}
            </ul>
            <form onSubmit={saveManifest} className="space-y-2 border-t border-slate-100 pt-3">
              <Field label={t('distribution.destination')}><input className="input" value={manifest.destination} onChange={(e) => setManifest({ ...manifest, destination: e.target.value })} required /></Field>
              <Field label={t('distribution.cargo')}><input className="input" value={manifest.cargoSummary} onChange={(e) => setManifest({ ...manifest, cargoSummary: e.target.value })} required /></Field>
              <Field label={t('distribution.vehicle')}><input className="input" value={manifest.vehicleNo} onChange={(e) => setManifest({ ...manifest, vehicleNo: e.target.value })} /></Field>
              <button className="btn-primary w-full">{t('distribution.saveManifest')}</button>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">{t('distribution.leads')}</h2>
            <ul className="mb-4 space-y-2">
              {leads.map((row) => (
                <li key={row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <div className="font-medium">{row.contactName}</div>
                  <div className="text-xs text-slate-500">{row.source} · {row.productInterest} · {row.quantity}</div>
                  <select className="input mt-2" value={row.status} onChange={(e) => patch(`/distribution/leads/${row.id}`, e.target.value)}>
                    {LEAD_STATUS.map((s) => <option key={s} value={s}>{t(`distribution.leadStatus.${s}`)}</option>)}
                  </select>
                </li>
              ))}
              {leads.length === 0 && <li className="text-sm text-slate-400">{t('distribution.empty')}</li>}
            </ul>
            <form onSubmit={saveLead} className="space-y-2 border-t border-slate-100 pt-3">
              <Field label={t('distribution.source')}>
                <select className="input" value={lead.source} onChange={(e) => setLead({ ...lead, source: e.target.value })}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label={t('distribution.contact')}><input className="input" value={lead.contactName} onChange={(e) => setLead({ ...lead, contactName: e.target.value })} required /></Field>
              <Field label={t('distribution.interest')}><input className="input" value={lead.productInterest} onChange={(e) => setLead({ ...lead, productInterest: e.target.value })} required /></Field>
              <button className="btn-primary w-full">{t('distribution.saveLead')}</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
