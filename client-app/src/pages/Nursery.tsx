import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { ErrorNote, FieldHint, ListSkeleton, PageHeader } from '../components/ui';

interface NurserySite {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  onboardedAt: string;
  plan: string;
  userLimit: number;
}

function showDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : iso;
}

/** Nursery profile card — people & role packs live on Staff & Team. */
export function Nursery() {
  const { t } = useTranslation();
  const [site, setSite] = useState<NurserySite | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/nursery')
      .then((res) => setSite(res.data.data as NurserySite))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setReady(true));
  }, []);

  return (
    <div>
      <PageHeader title={site?.name ?? t('site.title')} subtitle={t('site.subtitle')} />
      <ErrorNote message={error} />
      {!ready && !site ? (
        <div className="space-y-4">
          <div className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-2">
                <div className="skeleton h-3 w-16 rounded" />
                <div className="skeleton h-6 w-24 rounded" />
              </div>
            ))}
          </div>
          <ListSkeleton rows={3} />
        </div>
      ) : site ? (
        <>
          <section className="card mb-4 grid grid-cols-2 divide-y divide-slate-100 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            {(
              [
                [t('site.code'), t('site.hints.codeWhy'), t('site.hints.codeExample'), site.code],
                [t('site.phone'), t('site.hints.phoneWhy'), t('site.hints.phoneExample'), site.phone || '—'],
                [t('site.onboarded'), t('site.hints.onboardedWhy'), t('site.hints.onboardedExample'), showDate(site.onboardedAt)],
                [
                  t('site.plan'),
                  t('site.hints.planWhy'),
                  t('site.hints.planExample'),
                  t(`site.plans.${site.plan}`, { defaultValue: site.plan }),
                ],
              ] as const
            ).map(([label, why, example, value]) => (
              <div key={label} className="px-5 py-4">
                <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {label}
                  <FieldHint why={why} example={example} />
                </div>
                <div className="mt-1 font-sans text-sm font-semibold tabular-nums tracking-tight text-slate-900">
                  {value}
                </div>
              </div>
            ))}
          </section>

          <section className="card p-5">
            <h2 className="text-base font-bold text-slate-800">{t('staffTeam.title')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('site.peopleMovedHelp')}</p>
            <Link to="/staff-team" className="btn-primary mt-4 inline-flex min-h-11 items-center gap-2">
              {t('site.openStaffTeam')}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </section>
        </>
      ) : null}
    </div>
  );
}
