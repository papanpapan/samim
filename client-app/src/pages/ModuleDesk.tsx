import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorNote, PageHeader } from '../components/ui';

interface Note {
  id: string;
  body: string;
  createdAt: string;
}

export function ModuleDesk() {
  const { feature = '' } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const allowed = !user?.features || user.features.includes(feature);

  const load = () => {
    if (!feature || !allowed) return;
    api.get('/smart/notes', { params: { feature } })
      .then((res) => setNotes(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)));
  };
  useEffect(load, [feature, allowed]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await api.post('/smart/notes', { feature, body });
      setBody('');
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (!allowed) return <p className="text-slate-500">{t('module.blocked')}</p>;

  return (
    <div>
      <PageHeader title={t(`platform.featureLabels.${feature}`, { defaultValue: feature })} subtitle={t('module.subtitle')} />
      <ErrorNote message={error} />
      <form onSubmit={save} className="card mb-4 space-y-3 p-5">
        <textarea className="input min-h-24" required value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('module.placeholder')} />
        <button className="btn-primary">{t('common.save')}</button>
      </form>
      <ul className="space-y-2">
        {notes.map((note) => (
          <li key={note.id} className="card p-4 text-sm text-slate-700">
            <div>{note.body}</div>
            <div className="mt-1 text-xs text-slate-400">{new Date(note.createdAt).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
