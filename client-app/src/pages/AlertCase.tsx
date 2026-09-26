import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Camera, MapPin, Phone, Shield } from 'lucide-react';
import { api } from '../api/client';

type PublicAlert = {
  id: string;
  caseNo: string;
  kind: string;
  severity: string;
  message: string;
  history: string | null;
  closeNotes: string | null;
  status: string;
  raisedAt: string;
  ackAt: string | null;
  closedAt: string | null;
  cameraName: string | null;
  detectKind: string | null;
  nurseryName: string;
  nurseryAddress: string | null;
  nurseryPhone: string | null;
  zone: { name: string; location: string } | null;
  photoUrl: string | null;
  videoUrl: string | null;
};

const ease = 'duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]';

export function AlertCase() {
  const { code = '' } = useParams();
  const { t } = useTranslation();
  const [row, setRow] = useState<PublicAlert | null>(null);
  const [missing, setMissing] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setMissing(false);
    setRow(null);
    setShown(false);
    api
      .get(`/public/alerts/${encodeURIComponent(code)}`)
      .then((res) => {
        setRow(res.data.data as PublicAlert);
        window.setTimeout(() => setShown(true), 40);
      })
      .catch(() => setMissing(true));
  }, [code]);

  if (missing) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0c1222] px-6 text-center text-white">
        <div>
          <Shield className="mx-auto mb-4 h-10 w-10 text-white/40" aria-hidden />
          <p className="text-2xl font-semibold tracking-tight">{t('alertCase.missing')}</p>
          <p className="mt-2 text-sm text-white/50">{t('alertCase.missingHelp')}</p>
        </div>
      </main>
    );
  }

  if (!row) {
    return <main className="min-h-screen bg-[#0c1222]" />;
  }

  return (
    <main className="min-h-screen bg-[#0c1222] text-white">
      <div
        className={`mx-auto flex min-h-screen max-w-5xl flex-col transition ${ease} ${shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
      >
        <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-6 sm:px-8 sm:pt-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-300/90">{t('alertCase.kicker')}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{row.caseNo}</h1>
            <p className="mt-1 text-sm text-white/60">{row.nurseryName}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.status === 'CLOSED' ? 'bg-white/10 text-white/70' : 'bg-rose-600 text-white'}`}>
            {row.status}
          </span>
        </header>

        <section className="relative mx-3 overflow-hidden rounded-[28px] bg-black ring-1 ring-white/10 sm:mx-6">
          {row.videoUrl ? (
            <video
              src={row.videoUrl}
              controls
              autoPlay
              playsInline
              className="aspect-video w-full bg-black object-contain"
            />
          ) : row.photoUrl ? (
            <img src={row.photoUrl} alt="" className="aspect-video w-full object-cover" />
          ) : (
            <div className="grid aspect-video place-items-center bg-gradient-to-br from-slate-900 to-black">
              <AlertTriangle className="h-16 w-16 text-amber-300/80" aria-hidden />
            </div>
          )}
          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold backdrop-blur">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-300" aria-hidden />
            {t(`alerts.kinds.${row.kind}`)} · {row.severity}
          </div>
        </section>

        <section className="grid gap-4 px-5 py-6 sm:grid-cols-2 sm:px-8">
          <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
            <h2 className="text-xs font-bold uppercase tracking-wide text-white/45">{t('alertCase.summary')}</h2>
            <p className="mt-3 text-base leading-relaxed text-white/90">{row.message}</p>
            <dl className="mt-5 space-y-3 text-sm">
              {row.cameraName && (
                <div className="flex gap-3">
                  <Camera className="mt-0.5 h-4 w-4 shrink-0 text-white/40" aria-hidden />
                  <div>
                    <dt className="text-white/45">{t('alerts.camera')}</dt>
                    <dd className="font-medium">{row.cameraName}</dd>
                  </div>
                </div>
              )}
              {row.detectKind && (
                <div className="flex gap-3">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-white/40" aria-hidden />
                  <div>
                    <dt className="text-white/45">{t('alerts.detect')}</dt>
                    <dd className="font-medium">{row.detectKind}</dd>
                  </div>
                </div>
              )}
              {(row.zone || row.nurseryAddress) && (
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/40" aria-hidden />
                  <div>
                    <dt className="text-white/45">{t('alerts.zone')}</dt>
                    <dd className="font-medium">{row.zone?.name ?? row.nurseryAddress}</dd>
                    {row.zone?.location && <dd className="text-xs text-white/45">{row.zone.location}</dd>}
                  </div>
                </div>
              )}
              {row.nurseryPhone && (
                <div className="flex gap-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-white/40" aria-hidden />
                  <div>
                    <dt className="text-white/45">{t('alertCase.phone')}</dt>
                    <dd className="font-medium">{row.nurseryPhone}</dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
            <h2 className="text-xs font-bold uppercase tracking-wide text-white/45">{t('alerts.history')}</h2>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/80">
              {row.history?.trim() || t('alertCase.noHistory')}
            </pre>
            <div className="mt-5 space-y-1 border-t border-white/10 pt-4 text-xs text-white/45">
              <p>{t('alerts.raised')}: {new Date(row.raisedAt).toLocaleString()}</p>
              {row.ackAt && <p>{t('alerts.acked')}: {new Date(row.ackAt).toLocaleString()}</p>}
              {row.closedAt && <p>{t('alerts.closedAt')}: {new Date(row.closedAt).toLocaleString()}</p>}
            </div>
            {row.closeNotes && (
              <div className="mt-4 rounded-xl bg-black/30 p-3 text-sm text-white/75">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{t('alerts.closeNotes')}</p>
                <p className="mt-1">{row.closeNotes}</p>
              </div>
            )}
          </div>
        </section>

        {row.photoUrl && row.videoUrl && (
          <section className="px-5 pb-8 sm:px-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-white/45">{t('alerts.evidencePhoto')}</h2>
            <img src={row.photoUrl} alt="" className="max-h-80 w-full rounded-2xl object-cover ring-1 ring-white/10" />
          </section>
        )}

        <footer className="mt-auto border-t border-white/10 px-5 py-4 text-center text-[11px] text-white/35 sm:px-8">
          {t('alertCase.footer', { nursery: row.nurseryName })}
        </footer>
      </div>
    </main>
  );
}
