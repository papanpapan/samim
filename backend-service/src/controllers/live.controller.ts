import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma, prismaBase } from '../config/database';
import { nextAlertCaseNo, presentAlert } from '../services/alertCase.service';
import { currentNurseryId, runWithNursery } from '../services/tenantContext';
import { phoneOrigin, safeOrigin } from '../utils/lanOrigin';
import { ApiError } from '../utils/apiError';

const alertDir = path.join(process.cwd(), 'uploads', 'alerts');
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const LIVE_MS = 4000;
const INTRUSION_MS = 20000;
const frames = new Map<string, { body: Buffer; at: number }>();

type IntrusionEvent = {
  id: string;
  nurseryId: string;
  nurseryName: string;
  cameraId: string;
  cameraName: string;
  kind: string;
  score: number;
  at: number;
};

const intrusions: IntrusionEvent[] = [];

export const cameraSchema = z.object({
  locationId: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
});

const alertWindowSchema = z.object({ from: clock, to: clock });

export const alertArmSchema = z.object({
  enabled: z.boolean(),
  always: z.boolean(),
  windows: z.array(alertWindowSchema).max(8),
}).superRefine((body, ctx) => {
  if (body.enabled && !body.always && body.windows.length < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Add a time', path: ['windows'] });
  }
});

export const intrusionSchema = z.object({
  kind: z.enum(['person', 'cow', 'sheep', 'dog', 'cat', 'bird']),
  score: z.number().min(0).max(1),
});

const frameParser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 300 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === 'image/jpeg');
  },
}).single('file');

export function receiveLiveFrame(req: Request, res: Response, next: NextFunction) {
  frameParser(req, res, () => next());
}

const MAX_CASE_VIDEO = 20 * 1024 * 1024;

function casePhotoExt(file: { mimetype: string; originalname: string }) {
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (file.mimetype === 'image/png' || ext === 'png') return 'png';
  if (file.mimetype === 'image/webp' || ext === 'webp') return 'webp';
  if (file.mimetype === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg') return 'jpg';
  return '';
}

function caseVideoExt(file: { mimetype: string; originalname: string }) {
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (file.mimetype === 'video/webm' || ext === 'webm') return 'webm';
  if (file.mimetype === 'video/mp4' || ext === 'mp4') return 'mp4';
  if (file.mimetype === 'video/quicktime' || ext === 'mov') return 'mov';
  return '';
}

const caseMediaParser = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      mkdir(alertDir, { recursive: true }).then(() => cb(null, alertDir)).catch((err: Error) => cb(err, alertDir));
    },
    filename: (_req, file, cb) => {
      const ext = file.fieldname === 'video' ? caseVideoExt(file) : casePhotoExt(file);
      cb(null, `${randomUUID()}.${ext || 'bin'}`);
    },
  }),
  limits: { fileSize: MAX_CASE_VIDEO },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'video') {
      cb(null, !!caseVideoExt(file));
      return;
    }
    cb(null, !!casePhotoExt(file));
  },
}).fields([
  { name: 'file', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]);

export function receiveIntrusionCase(req: Request, res: Response, next: NextFunction) {
  caseMediaParser(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
    if (code === 'LIMIT_FILE_SIZE') {
      next(ApiError.badRequest('That video is too large. Keep it under 20 MB.'));
      return;
    }
    next(ApiError.badRequest('Choose a JPEG photo and an MP4 or WebM video.'));
  });
}

export const intrusionCaseSchema = z.object({
  detectKind: z.string().trim().min(1).max(40),
  message: z.string().trim().max(500).optional(),
  history: z.string().trim().max(4000).optional(),
  score: z.coerce.number().min(0).max(1).optional(),
});

function assertLive(req: Request) {
  if (req.tenant?.isPlatformOwner || req.tenant?.features.includes('LIVE_CAMERA')) return;
  throw ApiError.forbidden('This feature is not enabled for this account');
}

function canEdit(req: Request) {
  return !!req.tenant?.isPlatformOwner || req.user?.role === 'ADMIN' || req.user?.role === 'MANAGER';
}

async function assertGranted(nurseryId: string) {
  const grant = await prisma.nurseryFeature.findFirst({
    where: { nurseryId, feature: 'LIVE_CAMERA', enabled: true },
  });
  if (!grant) throw ApiError.forbidden('Live camera is not enabled for this nursery');
}

export async function listBoard(req: Request, res: Response): Promise<void> {
  assertLive(req);
  const owner = !!req.tenant?.isPlatformOwner;
  const mine = currentNurseryId();
  const sites = await runWithNursery(null, () =>
    prisma.nursery.findMany({
      where: owner
        ? { status: 'ACTIVE', features: { some: { feature: 'LIVE_CAMERA', enabled: true } } }
        : { id: mine ?? '00000000-0000-0000-0000-000000000000' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        features: {
          where: { feature: 'CCTV_ALERTS', enabled: true },
          select: { feature: true },
        },
        locations: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            address: true,
            cameras: {
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
              select: {
                id: true,
                name: true,
                alertEnabled: true,
                alertAlways: true,
                alertConfigured: true,
                alertWindows: true,
              },
            },
          },
        },
      },
    }),
  );
  const now = Date.now();
  res.json({
    success: true,
    data: sites.map((site) => ({
      id: site.id,
      name: site.name,
      cctv: site.features.length > 0,
      fields: site.locations.map((field) => ({
        id: field.id,
        name: field.name.trim() || field.address,
        cameras: field.cameras.map((camera) => ({
          id: camera.id,
          name: camera.name,
          live: (frames.get(camera.id)?.at ?? 0) > now - LIVE_MS,
          alertEnabled: camera.alertEnabled,
          alertAlways: camera.alertAlways,
          alertConfigured: camera.alertConfigured,
          alertWindows: presentWindows(camera.alertWindows),
        })),
      })),
    })),
  });
}

export async function createCamera(req: Request, res: Response): Promise<void> {
  assertLive(req);
  if (!canEdit(req)) throw ApiError.forbidden('Only a manager can add a camera');
  const body = req.body as z.infer<typeof cameraSchema>;
  const place = await prisma.nurseryLocation.findFirst({ where: { id: body.locationId } });
  if (!place) throw ApiError.notFound('Field not found');
  if (!req.tenant?.isPlatformOwner && place.nurseryId !== currentNurseryId()) {
    throw ApiError.notFound('Field not found');
  }
  await assertGranted(place.nurseryId);
  const camera = await runWithNursery(place.nurseryId, () =>
    prisma.liveCamera.create({ data: { nurseryId: place.nurseryId, locationId: place.id, name: body.name } }),
  );
  res.status(201).json({ success: true, data: { id: camera.id, name: camera.name, live: false } });
}

export async function removeCamera(req: Request, res: Response): Promise<void> {
  assertLive(req);
  if (!canEdit(req)) throw ApiError.forbidden('Only a manager can remove a camera');
  const existing = await runWithNursery(null, () => prisma.liveCamera.findFirst({ where: { id: req.params.id } }));
  if (!existing) throw ApiError.notFound('Camera not found');
  if (!req.tenant?.isPlatformOwner && existing.nurseryId !== currentNurseryId()) {
    throw ApiError.notFound('Camera not found');
  }
  frames.delete(existing.id);
  await runWithNursery(existing.nurseryId, () => prisma.liveCamera.delete({ where: { id: existing.id } }));
  res.json({ success: true, data: { id: existing.id, removed: true } });
}

async function allowedCamera(req: Request, id: string) {
  assertLive(req);
  const camera = await prismaBase.liveCamera.findFirst({ where: { id } });
  if (!camera) throw ApiError.notFound('Camera not found');
  if (!req.tenant?.isPlatformOwner && camera.nurseryId !== currentNurseryId()) {
    throw ApiError.notFound('Camera not found');
  }
  await assertGranted(camera.nurseryId);
  return camera;
}

export async function saveLiveFrame(req: Request, res: Response): Promise<void> {
  const camera = await allowedCamera(req, req.params.id);
  if (req.file) frames.set(camera.id, { body: req.file.buffer, at: Date.now() });
  res.set('Cache-Control', 'no-store');
  res.status(204).end();
}

export async function saveCameraAlert(req: Request, res: Response): Promise<void> {
  const camera = await allowedCamera(req, req.params.id);
  const body = req.body as z.infer<typeof alertArmSchema>;
  const place = await prismaBase.nurseryLocation.findFirst({ where: { id: camera.locationId } });
  const nurseryId = place?.nurseryId ?? camera.nurseryId;
  const saved = await prismaBase.liveCamera.update({
    where: { id: camera.id },
    data: {
      nurseryId,
      alertEnabled: body.enabled,
      alertAlways: body.always,
      alertConfigured: true,
      alertWindows: body.windows,
    },
  });
  res.json({
    success: true,
    data: {
      id: saved.id,
      alertEnabled: saved.alertEnabled,
      alertAlways: saved.alertAlways,
      alertConfigured: saved.alertConfigured,
      alertWindows: presentWindows(saved.alertWindows),
    },
  });
}

export async function raiseCameraDanger(req: Request, res: Response): Promise<void> {
  const camera = await allowedCamera(req, req.params.id);
  const place = await prismaBase.nurseryLocation.findFirst({ where: { id: camera.locationId } });
  const nurseryId = place?.nurseryId ?? camera.nurseryId;
  const today = kolkataDate();
  if (!alertDue(camera.alertEnabled, camera.alertAlways, camera.alertWindows) || camera.alertRaisedOn === today || !req.file) {
    res.set('Cache-Control', 'no-store');
    res.status(204).end();
    return;
  }
  const photoName = `${randomUUID()}.jpg`;
  const filePath = path.join(alertDir, photoName);
  await mkdir(alertDir, { recursive: true });
  await writeFile(filePath, req.file.buffer);
  try {
    const caseNo = await nextAlertCaseNo(nurseryId);
    const history = `Live camera ${camera.name} · daily danger frame`;
    await prismaBase.dangerAlert.create({
      data: {
        nurseryId,
        caseNo,
        kind: 'OTHER',
        severity: 'HIGH',
        message: history,
        history,
        photoName,
        cameraId: camera.id,
        cameraName: camera.name,
        status: 'ACKNOWLEDGED',
        ackAt: new Date(),
      },
    });
    await prismaBase.liveCamera.update({
      where: { id: camera.id },
      data: { nurseryId, alertRaisedOn: today },
    });
  } catch (err) {
    await unlink(filePath).catch(() => undefined);
    throw err;
  }
  res.status(201).json({ success: true, data: { raised: true } });
}

export async function createIntrusionCase(req: Request, res: Response): Promise<void> {
  const camera = await allowedCamera(req, req.params.id);
  const files = req.files as { file?: Express.Multer.File[]; video?: Express.Multer.File[] } | undefined;
  const photo = files?.file?.[0];
  const video = files?.video?.[0];
  const parsed = intrusionCaseSchema.safeParse(req.body);
  if (!parsed.success) {
    if (photo) await unlink(photo.path).catch(() => undefined);
    if (video) await unlink(video.path).catch(() => undefined);
    throw ApiError.badRequest('Detection kind is required for an intrusion case.');
  }
  if (!photo && !video) {
    throw ApiError.badRequest('Attach a photo or a short video from the alarm.');
  }
  const place = await prismaBase.nurseryLocation.findFirst({ where: { id: camera.locationId } });
  const nurseryId = place?.nurseryId ?? camera.nurseryId;
  const nursery = await prismaBase.nursery.findFirst({ where: { id: nurseryId }, select: { name: true } });
  const body = parsed.data;
  const caseNo = await nextAlertCaseNo(nurseryId);
  const when = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' });
  const history = body.history?.trim()
    || [
      `ACK case ${caseNo}`,
      `Nursery: ${nursery?.name ?? 'Nursery'}`,
      `Camera: ${camera.name}`,
      `Detected: ${body.detectKind}`,
      body.score !== undefined ? `Score: ${Math.round(body.score * 100)}%` : undefined,
      `Raised: ${when} (Asia/Kolkata)`,
      'Evidence captured while the danger alert was sounding until Stop alert.',
    ].filter(Boolean).join('\n');
  const message = body.message?.trim() || `Intrusion · ${body.detectKind} · ${camera.name}`;
  try {
    const alert = await prismaBase.dangerAlert.create({
      data: {
        nurseryId,
        caseNo,
        kind: 'INTRUSION',
        severity: 'HIGH',
        message,
        history,
        ...(photo ? { photoName: photo.filename } : {}),
        ...(video ? { videoName: video.filename } : {}),
        cameraId: camera.id,
        cameraName: camera.name,
        detectKind: body.detectKind,
        status: 'ACKNOWLEDGED',
        ackAt: new Date(),
      },
      include: { zone: { select: { name: true, location: true } } },
    });
    res.status(201).json({ success: true, data: await presentAlert(alert, phoneOrigin(safeOrigin(req.get('origin') ?? ''))) });
  } catch (err) {
    if (photo) await unlink(photo.path).catch(() => undefined);
    if (video) await unlink(video.path).catch(() => undefined);
    throw err;
  }
}

export async function reportIntrusion(req: Request, res: Response): Promise<void> {
  const camera = await allowedCamera(req, req.params.id);
  const body = req.body as z.infer<typeof intrusionSchema>;
  if (!alertDue(camera.alertEnabled, camera.alertAlways, camera.alertWindows)) {
    res.status(204).end();
    return;
  }
  const place = await prismaBase.nurseryLocation.findFirst({ where: { id: camera.locationId } });
  const nurseryId = place?.nurseryId ?? camera.nurseryId;
  const nursery = await prismaBase.nursery.findFirst({ where: { id: nurseryId }, select: { name: true } });
  const now = Date.now();
  const recent = intrusions.find(
    (row) => row.cameraId === camera.id && row.kind === body.kind && now - row.at < 5000,
  );
  if (recent) {
    res.json({ success: true, data: recent });
    return;
  }
  const event: IntrusionEvent = {
    id: randomUUID(),
    nurseryId,
    nurseryName: nursery?.name ?? 'Nursery',
    cameraId: camera.id,
    cameraName: camera.name,
    kind: body.kind,
    score: body.score,
    at: now,
  };
  intrusions.unshift(event);
  while (intrusions.length > 40) intrusions.pop();
  res.status(201).json({ success: true, data: event });
}

export async function listIntrusions(req: Request, res: Response): Promise<void> {
  assertLive(req);
  const owner = !!req.tenant?.isPlatformOwner;
  const mine = currentNurseryId();
  const now = Date.now();
  const fresh = intrusions.filter((row) => now - row.at <= INTRUSION_MS);
  const rows = owner ? fresh : fresh.filter((row) => row.nurseryId === mine);
  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      nurseryId: row.nurseryId,
      nurseryName: row.nurseryName,
      cameraId: row.cameraId,
      cameraName: row.cameraName,
      kind: row.kind,
      score: row.score,
      at: row.at,
    })),
  });
}

function kolkataParts() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
}

function kolkataDate() {
  const parts = kolkataParts();
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function presentWindows(value: unknown) {
  if (!Array.isArray(value)) return [];
  const windows: { from: string; to: string }[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const from = 'from' in row ? row.from : '';
    const to = 'to' in row ? row.to : '';
    if (typeof from !== 'string' || typeof to !== 'string') continue;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(from) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(to)) continue;
    windows.push({ from, to });
  }
  return windows;
}

function alertDue(enabled: boolean, always: boolean, windows: unknown) {
  if (!enabled) return false;
  if (always) return true;
  const now = kolkataMinutes();
  return presentWindows(windows).some((row) => clockCovers(now, row.from, row.to));
}

function kolkataMinutes() {
  const parts = kolkataParts();
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function clockCovers(now: number, from: string, to: string) {
  const start = clockMinutes(from);
  const end = clockMinutes(to);
  if (start === end) return true;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

function clockMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export async function readLiveFrame(req: Request, res: Response): Promise<void> {
  const camera = await allowedCamera(req, req.params.id);
  const frame = frames.get(camera.id);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  if (!frame || Date.now() - frame.at > LIVE_MS) {
    res.status(204).end();
    return;
  }
  res.type('image/jpeg').send(frame.body);
}
