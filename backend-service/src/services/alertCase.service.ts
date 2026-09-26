import { prismaBase } from '../config/database';
import { currentNurseryId } from './tenantContext';
import { generateQrDataUrl } from './qrEngine.service';

export type AlertRecord = {
  id: string;
  nurseryId: string;
  zoneId: string | null;
  caseNo: string;
  kind: string;
  severity: string;
  message: string;
  history: string | null;
  closeNotes: string | null;
  photoName: string | null;
  videoName: string | null;
  cameraId: string | null;
  cameraName: string | null;
  detectKind: string | null;
  status: string;
  raisedAt: Date;
  ackAt: Date | null;
  closedAt: Date | null;
  zone?: { name: string; location: string } | null;
};

function kolkataStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((row) => row.type === type)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}`;
}

/** Next ACK-YYMMDD-#### case number for the nursery. */
export async function nextAlertCaseNo(nurseryId = currentNurseryId()): Promise<string> {
  if (!nurseryId) throw new Error('Nursery required');
  const stamp = kolkataStamp();
  const prefix = `ACK-${stamp}-`;
  const latest = await prismaBase.dangerAlert.findFirst({
    where: { nurseryId, caseNo: { startsWith: prefix } },
    orderBy: { caseNo: 'desc' },
    select: { caseNo: true },
  });
  const last = latest?.caseNo.slice(prefix.length) ?? '0000';
  const next = String(Number.parseInt(last, 10) + 1).padStart(4, '0');
  return `${prefix}${next}`;
}

export function encodeAlertQr(alert: AlertRecord, origin = '') {
  if (origin) return `${origin}/alert/${alert.id}`;
  return [
    `ACK:${alert.caseNo}`,
    `KIND:${alert.kind}`,
    `ID:${alert.id}`,
  ].join('|');
}

export async function presentAlert(alert: AlertRecord, origin = '') {
  const publicUrl = origin ? `${origin}/alert/${alert.id}` : '';
  const qrDataUrl = await generateQrDataUrl(encodeAlertQr(alert, origin));
  return {
    id: alert.id,
    zoneId: alert.zoneId,
    caseNo: alert.caseNo,
    kind: alert.kind,
    severity: alert.severity,
    message: alert.message,
    history: alert.history,
    closeNotes: alert.closeNotes,
    status: alert.status,
    raisedAt: alert.raisedAt,
    ackAt: alert.ackAt,
    closedAt: alert.closedAt,
    cameraId: alert.cameraId,
    cameraName: alert.cameraName,
    detectKind: alert.detectKind,
    zone: alert.zone ?? null,
    photoUrl: alert.photoName ? `/api/uploads/alerts/${alert.photoName}` : null,
    videoUrl: alert.videoName ? `/api/uploads/alerts/${alert.videoName}` : null,
    publicUrl,
    qrDataUrl,
  };
}
