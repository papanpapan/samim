import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { PlantInventory } from '../../types';
import { formatMoney } from '../../utils/money';
import { ErrorNote, Field, Modal } from '../ui';

type DetectedCode = { rawValue: string };
type Detector = { detect: (source: HTMLVideoElement) => Promise<DetectedCode[]> };
type DetectorCtor = new (options: { formats: string[] }) => Detector;

function codeFromScan(raw: string) {
  const trimmed = raw.trim();
  const sku = trimmed.match(/SKU:([^|]+)/)?.[1];
  if (sku) return sku;
  try {
    const url = new URL(trimmed);
    return url.pathname.split('/').filter(Boolean).pop() ?? trimmed;
  } catch {
    return trimmed.split('/').filter(Boolean).pop() ?? trimmed;
  }
}

export function InventoryScanner({ onClose, onAdd }: { onClose: () => void; onAdd?: (plant: PlantInventory) => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const currency = user?.nursery?.currencyCode;
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [code, setCode] = useState('');
  const [hit, setHit] = useState<PlantInventory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(null);

  const lookup = async (raw: string) => {
    const token = codeFromScan(raw);
    if (!token) return;
    setPending(true);
    setError(null);
    try {
      const res = await api.get(`/inventory/scan/${encodeURIComponent(token)}`);
      setHit(res.data.data as PlantInventory);
    } catch (err) {
      setHit(null);
      setError(apiErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

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
          stopped = true;
          stream?.getTracks().forEach((track) => track.stop());
          setCode(codeFromScan(value));
          await lookup(value);
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void lookup(code);
  };

  return (
    <Modal open onClose={onClose} title={t('inventory.scanTitle')} width="max-w-lg">
      <ErrorNote message={error} />
      {cameraNote && <p className="mb-3 text-sm text-slate-500">{cameraNote}</p>}
      <video ref={videoRef} className="mb-3 aspect-video w-full rounded-xl bg-slate-950" muted playsInline />
      <form onSubmit={submit} className="flex gap-2">
        <Field label={t('inventory.scanCode')}>
          <input className="input" value={code} onChange={(event) => setCode(event.target.value)} placeholder={t('inventory.scanPlaceholder')} />
        </Field>
      </form>
      <button type="button" className="btn-primary mt-3" disabled={pending || !code.trim()} onClick={() => void lookup(code)}>
        {pending ? t('inventory.scanning') : t('inventory.scanCheck')}
      </button>
      {hit && (
        <div className="mt-4 rounded-xl border border-slate-200 p-3 text-sm">
          <p className="font-mono text-[11px] text-slate-400">{hit.sku}</p>
          <p className="text-lg font-semibold text-slate-900">{hit.commonName}</p>
          <p className="text-slate-500">{hit.variety} · {hit.bagSize}</p>
          <p className="mt-2">{formatMoney(hit.retailPrice, currency)} · {t('inventory.wholesale')} {formatMoney(hit.wholesalePrice, currency)}</p>
          <p className="text-slate-500">{hit.zoneLabel || t('inventory.noZone')} · {t('inventory.specs.available')} {Math.max(0, hit.currentStock - (hit.reservedQty ?? 0))}</p>
          <button
            type="button"
            className="btn-primary mt-3"
            onClick={() => {
              if (onAdd) {
                onAdd(hit);
                onClose();
                return;
              }
              navigate(`/pos?sku=${encodeURIComponent(hit.sku)}`);
            }}
          >
            {t('inventory.addToSale')}
          </button>
        </div>
      )}
    </Modal>
  );
}
