import { randomUUID } from 'crypto';
import { mkdir, unlink } from 'fs/promises';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma, prismaBase } from '../config/database';
import { rankLeaves } from '../constants/leafGuide';
import { nextAlertCaseNo, presentAlert } from '../services/alertCase.service';
import { answerVoice } from '../services/voiceQuery.service';
import { withNursery } from '../services/tenantContext';
import { phoneOrigin, safeOrigin } from '../utils/lanOrigin';
import { ApiError } from '../utils/apiError';

const zoneSchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
});

const ALERT_KINDS = ['FIRE', 'INTRUSION', 'HEAT', 'DISEASE', 'FLOOD', 'OTHER'] as const;
const alertUploadDir = path.join(process.cwd(), 'uploads', 'alerts');
const MAX_ALERT_PHOTO = 8 * 1024 * 1024;
const MAX_ALERT_VIDEO = 20 * 1024 * 1024;

const alertSchema = z.object({
  zoneId: z.union([z.string().uuid(), z.literal('')]).optional(),
  kind: z.enum(ALERT_KINDS),
  severity: z.enum(['HIGH', 'MEDIUM']).default('HIGH'),
  message: z.string().trim().max(500).optional(),
  history: z.string().trim().max(4000).optional(),
  cameraId: z.string().uuid().optional(),
  cameraName: z.string().trim().max(80).optional(),
  detectKind: z.string().trim().max(40).optional(),
});

const alertStatusSchema = z.object({
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'CLOSED']),
  message: z.string().trim().max(500).optional(),
  history: z.string().trim().max(4000).optional(),
  closeNotes: z.string().trim().max(2000).optional(),
});

function alertPhotoExtension(file: { mimetype: string; originalname: string }) {
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (file.mimetype === 'image/png' || ext === 'png') return 'png';
  if (file.mimetype === 'image/webp' || ext === 'webp') return 'webp';
  if (file.mimetype === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg') return 'jpg';
  return '';
}

function alertVideoExtension(file: { mimetype: string; originalname: string }) {
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (file.mimetype === 'video/webm' || ext === 'webm') return 'webm';
  if (file.mimetype === 'video/mp4' || ext === 'mp4') return 'mp4';
  if (file.mimetype === 'video/quicktime' || ext === 'mov') return 'mov';
  return '';
}

function mediaExtension(file: Express.Multer.File) {
  if (file.fieldname === 'video') return alertVideoExtension(file);
  return alertPhotoExtension(file);
}

const alertMediaParser = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      mkdir(alertUploadDir, { recursive: true }).then(() => cb(null, alertUploadDir)).catch((err: Error) => cb(err, alertUploadDir));
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}.${mediaExtension(file) || 'bin'}`);
    },
  }),
  limits: { fileSize: MAX_ALERT_VIDEO },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'video') {
      if (!alertVideoExtension(file)) {
        cb(new Error('VIDEO_TYPE'));
        return;
      }
      cb(null, true);
      return;
    }
    if (!alertPhotoExtension(file)) {
      cb(new Error('PHOTO_TYPE'));
      return;
    }
    cb(null, true);
  },
}).fields([
  { name: 'file', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]);

export function receiveAlertPhoto(req: Request, res: Response, next: NextFunction) {
  alertMediaParser(req, res, (err: unknown) => {
    if (!err) {
      const files = req.files as { file?: Express.Multer.File[]; video?: Express.Multer.File[] } | undefined;
      const photo = files?.file?.[0];
      if (photo && photo.size > MAX_ALERT_PHOTO) {
        void unlink(photo.path).catch(() => undefined);
        next(ApiError.badRequest('That photo is too large. Keep it under 8 MB.'));
        return;
      }
      next();
      return;
    }
    const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
    const message = err instanceof Error ? err.message : '';
    if (code === 'LIMIT_FILE_SIZE') {
      next(ApiError.badRequest('That media file is too large. Keep the video under 20 MB.'));
      return;
    }
    if (message === 'PHOTO_TYPE') {
      next(ApiError.badRequest('Choose a JPEG, PNG, or WebP photo.'));
      return;
    }
    if (message === 'VIDEO_TYPE') {
      next(ApiError.badRequest('Choose an MP4, WebM, or MOV video.'));
      return;
    }
    next(err);
  });
}

function alertFiles(req: Request) {
  const files = req.files as { file?: Express.Multer.File[]; video?: Express.Multer.File[] } | undefined;
  return {
    photo: files?.file?.[0],
    video: files?.video?.[0],
  };
}

async function cleanupAlertFiles(req: Request) {
  const { photo, video } = alertFiles(req);
  if (photo) await unlink(photo.path).catch(() => undefined);
  if (video) await unlink(video.path).catch(() => undefined);
}

const treatmentSchema = z.object({
  plantName: z.string().min(2),
  problem: z.string().min(2),
  product: z.string().min(2),
  dose: z.string().min(1),
  method: z.string().min(2),
  notes: z.string().optional(),
});

const identifySchema = z.object({
  shape: z.enum(['OVAL', 'LANCE', 'ROUND', 'THICK']),
  edge: z.enum(['SMOOTH', 'TOOTHED', 'WAVY']),
  color: z.enum(['DARK_GREEN', 'RED_FLUSH', 'VARIEGATED', 'PALE_GREEN']),
  veins: z.enum(['PINNATE', 'THICK']),
});

const noteSchema = z.object({
  feature: z.string().min(3),
  body: z.string().min(2),
});

const voiceSchema = z.object({
  text: z.string().trim().min(2).max(500),
});

export { zoneSchema, alertSchema, alertStatusSchema, treatmentSchema, identifySchema, noteSchema, voiceSchema };

export async function listZones(_req: Request, res: Response): Promise<void> {
  const zones = await prisma.cameraZone.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: zones });
}

export async function createZone(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof zoneSchema>;
  const zone = await prisma.cameraZone.create({
    data: withNursery({ name: body.name.trim(), location: body.location.trim() }),
  });
  res.status(201).json({ success: true, data: zone });
}

function alertOrigin(req: Request) {
  return phoneOrigin(safeOrigin(req.get('origin') ?? req.get('referer') ?? ''));
}

export async function listAlerts(req: Request, res: Response): Promise<void> {
  const origin = alertOrigin(req);
  const owner = !!req.tenant?.isPlatformOwner;
  // Platform owner: every nursery. Onboarded nursery staff: only their nursery (tenant filter).
  const client = owner ? prismaBase : prisma;

  const qNurseryRaw = typeof req.query.nurseryId === 'string' ? req.query.nurseryId.trim() : '';
  const qPlaceRaw = typeof req.query.placeId === 'string' ? req.query.placeId.trim() : '';
  const qNursery = z.string().uuid().safeParse(qNurseryRaw).success ? qNurseryRaw : '';
  const qPlace = z.string().uuid().safeParse(qPlaceRaw).success ? qPlaceRaw : '';

  type AlertWhere = {
    nurseryId?: string;
    cameraId?: string | { in: string[] } | null;
    OR?: Array<{ cameraId?: string | { in: string[] } | null; nurseryId?: string }>;
  };
  const where: AlertWhere = {};

  // Owner may narrow to one nursery; staff already scoped by tenant prisma.
  if (owner && qNursery) where.nurseryId = qNursery;

  if (qPlace) {
    const placeRow = await prismaBase.nurseryLocation.findFirst({
      where: { id: qPlace },
      select: { id: true, nurseryId: true },
    });
    const placeCams = placeRow
      ? await prismaBase.liveCamera.findMany({
        where: {
          locationId: qPlace,
          ...(owner && qNursery ? { nurseryId: qNursery } : {}),
        },
        select: { id: true },
      })
      : [];
    const camIds = placeCams.map((row) => row.id);
    // Camera cases at this place + phone/legacy cases of the same nursery (no camera yet).
    const placeNurseryId = placeRow?.nurseryId;
    if (camIds.length > 0 && placeNurseryId) {
      where.OR = [
        { cameraId: { in: camIds } },
        { cameraId: null, nurseryId: placeNurseryId },
      ];
      delete where.nurseryId;
      if (owner && qNursery && qNursery !== placeNurseryId) {
        where.OR = [{ cameraId: '00000000-0000-0000-0000-000000000000' }];
      }
    } else if (camIds.length > 0) {
      where.cameraId = { in: camIds };
    } else if (placeNurseryId) {
      where.cameraId = null;
      where.nurseryId = placeNurseryId;
    } else {
      where.cameraId = '00000000-0000-0000-0000-000000000000';
    }
  }

  const alerts = await client.dangerAlert.findMany({
    where,
    orderBy: { raisedAt: 'desc' },
    take: owner ? 500 : 150,
    include: {
      zone: { select: { name: true, location: true } },
      nursery: { select: { id: true, name: true, code: true } },
    },
  });

  const cameraIds = [...new Set(alerts.map((row) => row.cameraId).filter((id): id is string => !!id))];
  const cameras = cameraIds.length > 0
    ? await prismaBase.liveCamera.findMany({
      where: { id: { in: cameraIds } },
      select: {
        id: true,
        locationId: true,
        location: { select: { id: true, name: true, address: true, nurseryId: true } },
      },
    })
    : [];
  const camById = new Map(cameras.map((row) => [row.id, row]));

  const placeLabel = (name: string | null | undefined, address?: string | null) => {
    const titled = name?.trim();
    if (titled) return titled;
    const addr = address?.trim();
    return addr || 'Place';
  };

  const data = await Promise.all(alerts.map(async (row) => {
    const cam = row.cameraId ? camById.get(row.cameraId) : undefined;
    const base = await presentAlert(row, origin);
    return {
      ...base,
      nurseryId: row.nurseryId,
      nurseryName: row.nursery.name,
      nurseryCode: row.nursery.code,
      placeId: cam?.locationId ?? null,
      placeName: cam
        ? placeLabel(cam.location.name, cam.location.address)
        : (row.zone?.name ?? null),
    };
  }));

  const nurseryId = req.tenant?.nurseryId;
  const placeRows = owner
    ? await prismaBase.nurseryLocation.findMany({
      orderBy: [{ nurseryId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        address: true,
        nurseryId: true,
        nursery: { select: { name: true } },
      },
    })
    : await prismaBase.nurseryLocation.findMany({
      where: { nurseryId: nurseryId ?? '00000000-0000-0000-0000-000000000000' },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        address: true,
        nurseryId: true,
      },
    });

  const placeIds = placeRows.map((row) => row.id);
  const placeCameras = placeIds.length > 0
    ? await prismaBase.liveCamera.findMany({
      where: { locationId: { in: placeIds } },
      select: { id: true, locationId: true },
    })
    : [];
  const camsByPlace = new Map<string, string[]>();
  for (const cam of placeCameras) {
    const list = camsByPlace.get(cam.locationId) ?? [];
    list.push(cam.id);
    camsByPlace.set(cam.locationId, list);
  }

  const nurseryRows = owner
    ? await prismaBase.nursery.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    })
    : [];

  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    data,
    filters: {
      nurseries: nurseryRows.map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
      })),
      places: placeRows.map((row) => {
        const cams = camsByPlace.get(row.id) ?? [];
        return {
          id: row.id,
          name: placeLabel(row.name, row.address),
          nurseryId: row.nurseryId,
          nurseryName: 'nursery' in row ? row.nursery?.name : undefined,
          cameraIds: cams,
        };
      }),
    },
  });
}

export async function createAlert(req: Request, res: Response): Promise<void> {
  const parsed = alertSchema.safeParse(req.body);
  const { photo, video } = alertFiles(req);
  if (!parsed.success) {
    await cleanupAlertFiles(req);
    throw ApiError.badRequest('Choose a danger kind, then add a photo or a short note.');
  }
  const body = parsed.data;
  const note = body.message?.trim() ?? '';
  if (note.length < 3 && !photo && !video) {
    await cleanupAlertFiles(req);
    throw ApiError.badRequest('Take a photo, or write what happened.');
  }
  const caseNo = await nextAlertCaseNo();
  const history = body.history?.trim() || (note.length >= 3 ? note : 'Photo from the phone.');
  const alert = await prisma.dangerAlert.create({
    data: withNursery({
      caseNo,
      ...(body.zoneId ? { zoneId: body.zoneId } : {}),
      kind: body.kind,
      severity: body.severity,
      message: note.length >= 3 ? note : history,
      history,
      ...(photo ? { photoName: photo.filename } : {}),
      ...(video ? { videoName: video.filename } : {}),
      ...(body.cameraId ? { cameraId: body.cameraId } : {}),
      ...(body.cameraName ? { cameraName: body.cameraName } : {}),
      ...(body.detectKind ? { detectKind: body.detectKind } : {}),
    }),
    include: { zone: { select: { name: true, location: true } } },
  });
  res.status(201).json({ success: true, data: await presentAlert(alert, alertOrigin(req)) });
}

export async function updateAlert(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof alertStatusSchema>;
  const existing = await prisma.dangerAlert.findFirst({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Alert not found');
  const alert = await prisma.dangerAlert.update({
    where: { id: existing.id },
    data: {
      status: body.status,
      ...(body.message !== undefined ? { message: body.message } : {}),
      ...(body.history !== undefined ? { history: body.history } : {}),
      ...(body.closeNotes !== undefined ? { closeNotes: body.closeNotes || null } : {}),
      ackAt: body.status === 'ACKNOWLEDGED' ? (existing.ackAt ?? new Date()) : existing.ackAt,
      closedAt: body.status === 'CLOSED' ? new Date() : null,
    },
    include: { zone: { select: { name: true, location: true } } },
  });
  res.json({ success: true, data: await presentAlert(alert, alertOrigin(req)) });
}

export async function listTreatments(_req: Request, res: Response): Promise<void> {
  const rows = await prisma.treatmentPlan.findMany({ orderBy: { treatedOn: 'desc' }, take: 100 });
  res.json({ success: true, data: rows });
}

export async function createTreatment(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof treatmentSchema>;
  const row = await prisma.treatmentPlan.create({
    data: withNursery({
      plantName: body.plantName.trim(),
      problem: body.problem.trim(),
      product: body.product.trim(),
      dose: body.dose.trim(),
      method: body.method.trim(),
      notes: body.notes?.trim() || null,
    }),
  });
  res.status(201).json({ success: true, data: row });
}

export async function completeTreatment(req: Request, res: Response): Promise<void> {
  const existing = await prisma.treatmentPlan.findFirst({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Treatment not found');
  const row = await prisma.treatmentPlan.update({
    where: { id: existing.id },
    data: { status: 'DONE', treatedOn: new Date() },
  });
  res.json({ success: true, data: row });
}

export async function identifyPlant(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof identifySchema>;
  const ranked = rankLeaves(body);
  const best = ranked[0];
  const saved = await prisma.plantIdentification.create({
    data: withNursery({
      traits: `${body.shape} ${body.edge} ${body.color} ${body.veins}`,
      matchName: best?.name ?? 'Unknown',
      confidence: best?.score ?? 0,
    }),
  });
  res.json({ success: true, data: { id: saved.id, matches: ranked } });
}

export async function listIdentifications(_req: Request, res: Response): Promise<void> {
  const rows = await prisma.plantIdentification.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
  res.json({ success: true, data: rows });
}

export async function askVoice(req: Request, res: Response): Promise<void> {
  const text = (req.body as z.infer<typeof voiceSchema>).text;
  const data = await answerVoice(text);
  res.json({ success: true, data });
}

function assertOwnFeature(req: Request, feature: string) {
  if (!req.tenant?.features.includes(feature)) {
    throw ApiError.forbidden('This feature is not enabled for this account');
  }
}

export async function listNotes(req: Request, res: Response): Promise<void> {
  const feature = String(req.query.feature ?? '');
  if (feature) assertOwnFeature(req, feature);
  const rows = await prisma.featureNote.findMany({
    where: feature ? { feature } : { feature: { in: req.tenant?.features ?? [] } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ success: true, data: rows });
}

export async function createNote(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof noteSchema>;
  assertOwnFeature(req, body.feature);
  const row = await prisma.featureNote.create({
    data: withNursery({ feature: body.feature, body: body.body.trim() }),
  });
  res.status(201).json({ success: true, data: row });
}
