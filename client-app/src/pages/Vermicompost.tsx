import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { FIELD_ROLES, hasRole } from '../auth/roles';
import { ErrorNote, Field, ListSkeleton, Modal, PageHeader } from '../components/ui';
import { AudioAssistTrigger } from '../components/AudioAssistTrigger';
import { formatMoney } from '../utils/money';

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
  allocation?: string | null;
  costPerKg?: string | null;
  status: string;
  readyForSieving: boolean;
}

export function Vermicompost() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManageBeds = hasRole(user?.role, FIELD_ROLES);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ bedCode: '', cowDungKg: 1000, rawBiomassKg: 300, startDate: '2026-07-01', curingDays: 65 });
  const [harvestBed, setHarvestBed] = useState<Bed | null>(null);
  const [harvestForm, setHarvestForm] = useState({ actualYieldKg: 720, qualityGrade: 'Grade A', allocation: 'INTERNAL_POTTING' });
  const [moistureBed, setMoistureBed] = useState<Bed | null>(null);
  const [moistureLogs, setMoistureLogs] = useState<{ id: string; moisturePct: string; recordedAt: string }[]>([]);
  const [moisturePct, setMoisturePct] = useState(60);

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

  const harvest = async (e: FormEvent) => {
    e.preventDefault();
    if (!harvestBed) return;
    try {
      await api.post(`/vermicompost/${harvestBed.id}/harvest`, harvestForm);
      setHarvestBed(null);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openMoisture = async (bed: Bed) => {
    setMoistureBed(bed);
    try {
      const res = await api.get(`/vermicompost/${bed.id}/moisture`);
      setMoistureLogs(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const saveMoisture = async (e: FormEvent) => {
    e.preventDefault();
    if (!moistureBed) return;
    try {
      await api.post(`/vermicompost/${moistureBed.id}/moisture`, { moisturePct });
      const res = await api.get(`/vermicompost/${moistureBed.id}/moisture`);
      setMoistureLogs(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title={t('vermi.title')}
        subtitle={t('vermi.subtitle')}
        action={
          canManageBeds ? (
            <div className="flex items-center gap-2">
              <button className="btn-primary" onClick={() => setOpen(true)} data-speak={t('voice.registerBed')}>
                <Plus className="h-4 w-4" aria-hidden />
                {t('vermi.register')}
              </button>
              <AudioAssistTrigger textKey="voice.registerBed" />
            </div>
          ) : undefined
        }
      />
      <ErrorNote message={error} />
      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {beds.map((b) => (
            <div key={b.id} className="card p-5">
              <div className="flex items-center justify-between">
                <div className="font-mono font-bold text-nursery-800">{b.bedCode}</div>
                <span className={`badge ${b.harvestedDate ? 'bg-nursery-100 text-nursery-800' : b.readyForSieving ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                  {b.harvestedDate ? t('vermi.harvested') : b.readyForSieving ? t('vermi.ready') : t('vermi.decomposing')}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-nursery-600">
                <div>{t('vermi.cowDung')}: <b>{b.cowDungKg} kg</b></div>
                <div>{t('vermi.biomass')}: <b>{b.rawBiomassKg} kg</b></div>
                <div>{t('vermi.expected')}: {new Date(b.expectedDate).toLocaleDateString()}</div>
                {b.actualYieldKg && (
                  <div className="text-nursery-800">
                    {t('vermi.yield')}: <b>{b.actualYieldKg} kg</b> ({b.qualityGrade})
                    {b.allocation ? ` · ${t(`vermi.allocations.${b.allocation}`)}` : ''}
                    {b.costPerKg ? ` · ${formatMoney(b.costPerKg, user?.nursery?.currencyCode)}/kg` : ''}
                  </div>
                )}
              </div>
              {canManageBeds && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button className="btn-ghost" onClick={() => openMoisture(b)}>{t('vermi.moisture')}</button>
                  {!b.harvestedDate && (
                    <button className="btn-ghost" onClick={() => setHarvestBed(b)} data-speak={t('voice.harvestBed')}>
                      {t('vermi.harvest')}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {beds.length === 0 && <div className="text-nursery-400">{t('vermi.empty')}</div>}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t('vermi.modalTitle')}>
        <form onSubmit={create} className="space-y-4">
          <Field label={t('vermi.bedCode')} speakKey="voice.bedCode">
            <input className="input" placeholder="V-BED-02" value={form.bedCode} onChange={(e) => setForm({ ...form, bedCode: e.target.value })} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('vermi.cowDungKg')} speakKey="voice.cowDung">
              <input type="number" className="input" value={form.cowDungKg} onChange={(e) => setForm({ ...form, cowDungKg: Number(e.target.value) })} />
            </Field>
            <Field label={t('vermi.biomassKg')} speakKey="voice.biomass">
              <input type="number" className="input" value={form.rawBiomassKg} onChange={(e) => setForm({ ...form, rawBiomassKg: Number(e.target.value) })} />
            </Field>
            <Field label={t('vermi.startDate')} speakKey="voice.plantingDate">
              <input type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label={t('vermi.curingDays')} speakKey="voice.curing">
              <input type="number" className="input" value={form.curingDays} onChange={(e) => setForm({ ...form, curingDays: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
            <button className="btn-primary" disabled={saving} data-speak={t('voice.registerBed')}>{saving ? t('vermi.saving') : t('vermi.save')}</button>
            <AudioAssistTrigger textKey="voice.registerBed" />
          </div>
        </form>
      </Modal>

      <Modal open={!!harvestBed} onClose={() => setHarvestBed(null)} title={t('vermi.harvest')}>
        <form onSubmit={harvest} className="space-y-3">
          <Field label={t('vermi.yieldKg')}>
            <input type="number" min={1} className="input" value={harvestForm.actualYieldKg} onChange={(e) => setHarvestForm({ ...harvestForm, actualYieldKg: Number(e.target.value) })} required />
          </Field>
          <Field label={t('vermi.grade')}>
            <input className="input" value={harvestForm.qualityGrade} onChange={(e) => setHarvestForm({ ...harvestForm, qualityGrade: e.target.value })} />
          </Field>
          <Field label={t('vermi.allocation')}>
            <select className="input" value={harvestForm.allocation} onChange={(e) => setHarvestForm({ ...harvestForm, allocation: e.target.value })}>
              <option value="INTERNAL_POTTING">{t('vermi.allocations.INTERNAL_POTTING')}</option>
              <option value="RETAIL_PACKETS">{t('vermi.allocations.RETAIL_PACKETS')}</option>
            </select>
          </Field>
          <button className="btn-primary">{t('vermi.harvest')}</button>
        </form>
      </Modal>

      <Modal open={!!moistureBed} onClose={() => setMoistureBed(null)} title={t('vermi.moisture')}>
        <ul className="mb-3 space-y-1 text-sm">
          {moistureLogs.map((row) => (
            <li key={row.id}>{Number(row.moisturePct)}% · {new Date(row.recordedAt).toLocaleString()}</li>
          ))}
          {moistureLogs.length === 0 && <li className="text-slate-400">{t('vermi.noMoisture')}</li>}
        </ul>
        <form onSubmit={saveMoisture} className="space-y-3">
          <Field label={t('vermi.moisturePct')}>
            <input type="number" min={0} max={100} className="input" value={moisturePct} onChange={(e) => setMoisturePct(Number(e.target.value))} required />
          </Field>
          <button className="btn-primary">{t('vermi.logMoisture')}</button>
        </form>
      </Modal>
    </div>
  );
}
