import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { ErrorNote, ListSkeleton, PageHeader } from '../components/ui';

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  user: { name: string; role: string };
}

export function Admin() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get('/audit')
      .then((res) => setLogs(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title={t('admin.title')} subtitle={t('admin.subtitle')} />
      <ErrorNote message={error} />
      <section className="card mb-4 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">{t('admin.peopleHeading')}</h2>
        <p className="mt-2 text-sm text-slate-500">{t('admin.peopleHelp')}</p>
        <Link
          to="/nursery"
          className="btn-primary mt-4 inline-flex items-center gap-2"
        >
          {t('admin.managePeople')}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>
      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <section className="card overflow-hidden">
          <h2 className="px-5 pt-5 text-sm font-bold uppercase tracking-wide text-slate-700">{t('admin.audit')}</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="bg-nursery-50 text-left text-xs uppercase tracking-wide text-nursery-600">
              <tr>
                <th className="px-4 py-3">{t('admin.when')}</th>
                <th className="px-4 py-3">{t('admin.who')}</th>
                <th className="px-4 py-3">{t('admin.what')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nursery-50">
              {logs.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-xs">{new Date(row.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-3">{row.user.name}</td>
                  <td className="px-4 py-3">{row.action} {row.entity}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">{t('admin.emptyAudit')}</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
