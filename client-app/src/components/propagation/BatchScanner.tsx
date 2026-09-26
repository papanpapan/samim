import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../../api/client';
import { ErrorNote, Field, Modal } from '../ui';

type ScanHit = {
  kind: 'unit' | 'batch';
  serial?: string;
  status?: string;
  batchCode: string;
  stage: string;
  plantName?: string;
  varietyName: string;
  successPct: number;
  mortalityPct: number;
  currentQuantity?: number;
  initialQuantity?: number;
};

type DetectedCode = { rawValue: string };
type Detector = { detect: (source: HTMLVideoElement) => Promise<DetectedCode[]> };
type DetectorCtor = new (options: { formats: string[] }) => Detector;

function codeFromScan(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    const part = url.pathname.split('/').filter(Boolean).pop();
    return part ?? trimmed;
  } catch {
    return trimmed.split('/').filter(Boolean).pop() ?? trimmed;
  }
}

export function BatchScanner({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [code, setCode] = useState('');
  const [hit, setHit] = useState<ScanHit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const host = window as Window & { BarcodeDetector?: DetectorCtor };
    if (!video || !host.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      setCameraNote(t('propagation.cameraFallback'));
      return undefined;
    }
    let stopped = false;
    let stream: MediaStream | null = null;
    const detector = new host.BarcodeDetector({ formats: ['qr_code'] });
    const tick = async () => {
      if (stopped || !videoRef.current) return;
      try {
        const found = await detector.detect(videoRef.current);
        const value = found[0]?.rawValue;
        if (value) {
          setCode(codeFromScan(value));
          stopped = true;
          stream?.getTracks().forEach((track) => track.stop());
          return;
        }
      } catch {
        setCameraNote(t('propagation.cameraFallback'));
        return;
      }
      window.setTimeout(() => { void tick(); }, 400);
    };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((next) => {
        stream = next;
        video.srcObject = next;
        return video.play();
      })
      .then(() => tick())
      .catch(() => setCameraNote(t('propagation.cameraFallback')));
    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [t]);

  const lookup = async (event?: FormEvent) => {
    event?.preventDefault();
    const token = codeFromScan(code);
    if (!token) return;
    setPending(true);
    setError(null);
    setHit(null);
    try {
      const res = await api.get(`/propagation/scan/${encodeURIComponent(token)}`);
      setHit(res.data.data as ScanHit);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={t('propagation.scanTitle')}>
      <ErrorNote message={error} />
      <video ref={videoRef} className="mb-3 aspect-video w-full rounded-xl bg-slate-900 object-cover" muted playsInline />
      {cameraNote && <p className="mb-3 text-sm text-slate-500">{cameraNote}</p>}
      <form onSubmit={lookup} className="space-y-3">
        <Field label={t('propagation.scanCode')}>
          <input className="input" value={code} onChange={(event) => setCode(event.target.value)} placeholder={t('propagation.scanPlaceholder')} />
        </Field>
        <button className="btn-primary" disabled={pending || !code.trim()}>{pending ? t('propagation.creating') : t('propagation.scanCheck')}</button>
      </form>
      {hit && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold">{hit.plantName || hit.varietyName} · {hit.varietyName}</p>
          <p className="font-mono text-xs">{hit.kind === 'unit' ? hit.serial : hit.batchCode}</p>
          <p>{t(`stages.${hit.stage}`, { defaultValue: hit.stage })}{hit.status ? ` · ${t(`propagation.unitStatus.${hit.status}`, { defaultValue: hit.status })}` : ''}</p>
          <p>{t('propagation.successRate', { pct: hit.successPct })} · {t('propagation.mortalityRate', { pct: hit.mortalityPct })}</p>
        </div>
      )}
    </Modal>
  );
}
