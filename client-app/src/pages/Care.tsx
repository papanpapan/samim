import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { FIELD_ROLES, hasRole } from '../auth/roles';
import type { PlantInventory } from '../types';
import { ErrorNote, Field, ListSkeleton, PageHeader } from '../components/ui';

interface CareTask {
  id: string;
  taskType: string;
  frequency: string;
  scheduledOn: string;
  status: string;
  staffNotes?: string | null;
  plant: { sku: string; commonName: string };
}

interface Disease {
  id: string;
  subject: string;
  diagnosis: string;
  treatment?: string | null;
  status: string;
  observedOn: string;
}

const TASKS = ['WATERING', 'NPK_SPRAY', 'FUNGICIDE', 'INSECTICIDE', 'PRUNING'] as const;
const FREQUENCIES = ['DAILY', 'WEEKLY', 'BI_WEEKLY', 'ONCE'] as const;

export function Care() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = hasRole(user?.role, FIELD_ROLES);
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [plants, setPlants] = useState<PlantInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({
    plantId: '',
    taskType: 'WATERING',
    frequency: 'DAILY',
    scheduledOn: new Date().toISOString().slice(0, 10),
  });
  const [diseaseForm, setDiseaseForm] = useState({ subject: '', diagnosis: '', treatment: '' });

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/care'), api.get('/inventory')])
      .then(([care, inventory]) => {
        setTasks(care.data.data.tasks);
        setDiseases(care.data.data.diseases);
        const rows: PlantInventory[] = inventory.data.data;
        setPlants(rows);
        setTaskForm((f) => ({ ...f, plantId: f.plantId || rows[0]?.id || '' }));
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const addTask = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/care', taskForm);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const complete = async (id: string) => {
    try {
      await api.post(`/care/${id}/complete`, {});
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const addDisease = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/care/disease', diseaseForm);
      setDiseaseForm({ subject: '', diagnosis: '', treatment: '' });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const resolve = async (id: string) => {
    try {
      await api.post(`/care/disease/${id}/resolve`, {});
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const pending = tasks.filter((task) => task.status === 'PENDING');

  return (
    <div>
      <PageHeader title={t('care.title')} subtitle={t('care.subtitle')} />
      <ErrorNote message={error} />
      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">{t('care.checklist')}</h2>
            <ul className="space-y-2">
              {pending.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                  <div>
                    <div className="font-medium text-slate-800">{t(`care.tasks.${task.taskType}`)}</div>
                    <div className="text-xs text-slate-500">
                      {task.plant.commonName} · {t(`care.frequencies.${task.frequency}`)} · {new Date(task.scheduledOn).toLocaleDateString()}
                    </div>
                  </div>
                  {canWrite && (
                    <button className="btn-ghost" onClick={() => complete(task.id)}>
                      <Check className="h-4 w-4" aria-hidden />
                      {t('care.complete')}
                    </button>
                  )}
                </li>
              ))}
              {pending.length === 0 && <li className="text-sm text-slate-400">{t('care.empty')}</li>}
            </ul>
            {canWrite && (
              <form onSubmit={addTask} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <Field label={t('care.plant')}>
                  <select className="input" value={taskForm.plantId} onChange={(e) => setTaskForm({ ...taskForm, plantId: e.target.value })} required>
                    {plants.map((p) => (
                      <option key={p.id} value={p.id}>{p.commonName} · {p.sku}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('care.task')}>
                    <select className="input" value={taskForm.taskType} onChange={(e) => setTaskForm({ ...taskForm, taskType: e.target.value })}>
                      {TASKS.map((key) => <option key={key} value={key}>{t(`care.tasks.${key}`)}</option>)}
                    </select>
                  </Field>
                  <Field label={t('care.frequency')}>
                    <select className="input" value={taskForm.frequency} onChange={(e) => setTaskForm({ ...taskForm, frequency: e.target.value })}>
                      {FREQUENCIES.map((key) => <option key={key} value={key}>{t(`care.frequencies.${key}`)}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label={t('care.when')}>
                  <input type="date" className="input" value={taskForm.scheduledOn} onChange={(e) => setTaskForm({ ...taskForm, scheduledOn: e.target.value })} required />
                </Field>
                <button className="btn-primary" disabled={!taskForm.plantId}>
                  <Plus className="h-4 w-4" aria-hidden />
                  {t('care.add')}
                </button>
              </form>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">{t('care.diseaseTitle')}</h2>
            <ul className="space-y-2">
              {diseases.map((d) => (
                <li key={d.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-slate-800">{d.subject}</div>
                    <span className={`badge ${d.status === 'RESOLVED' ? 'bg-nursery-100 text-nursery-800' : 'bg-amber-100 text-amber-700'}`}>
                      {t(`care.${d.status === 'RESOLVED' ? 'resolved' : 'open'}`)}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600">{d.diagnosis}</div>
                  {d.treatment && <div className="text-xs text-slate-500">{d.treatment}</div>}
                  {canWrite && d.status !== 'RESOLVED' && (
                    <button className="btn-ghost mt-2" onClick={() => resolve(d.id)}>{t('care.resolve')}</button>
                  )}
                </li>
              ))}
              {diseases.length === 0 && <li className="text-sm text-slate-400">{t('care.noDisease')}</li>}
            </ul>
            {canWrite && (
              <form onSubmit={addDisease} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <Field label={t('care.subject')}>
                  <input className="input" value={diseaseForm.subject} onChange={(e) => setDiseaseForm({ ...diseaseForm, subject: e.target.value })} required />
                </Field>
                <Field label={t('care.diagnosis')}>
                  <input className="input" value={diseaseForm.diagnosis} onChange={(e) => setDiseaseForm({ ...diseaseForm, diagnosis: e.target.value })} required />
                </Field>
                <Field label={t('care.treatment')}>
                  <input className="input" value={diseaseForm.treatment} onChange={(e) => setDiseaseForm({ ...diseaseForm, treatment: e.target.value })} />
                </Field>
                <button className="btn-primary">{t('care.logDisease')}</button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
