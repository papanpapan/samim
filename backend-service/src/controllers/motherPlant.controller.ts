import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { PhenologyKind } from '@prisma/client';
import { prisma } from '../config/database';
import { withNursery, currentNurseryId } from '../services/tenantContext';
import { ApiError } from '../utils/apiError';
import { generateQrDataUrl } from '../services/qrEngine.service';
import { writeAudit } from '../services/audit.service';
import { phoneOrigin, safeOrigin } from '../utils/lanOrigin';
import { EXOTIC_CULTIVARS, MOTHER_CATEGORIES, MOTHER_HEALTH, MOTHER_METHODS } from '../constants/cultivarList';

const PLANT_LINKS: { plant: string; varieties: string[] }[] = [
  { plant: 'Guava', varieties: ['Black Diamond Guava', 'Red Diamond Guava', 'Red King Guava', 'Variegated Guava'] },
  { plant: 'Jamun', varieties: ['Thai King Jamun', 'Seedless Jamun'] },
  { plant: 'Jackfruit', varieties: ['Thai Jackfruit'] },
  { plant: 'Adenium', varieties: ['Thai Adenium'] },
  { plant: 'Mulberry', varieties: ['Mulberry'] },
  { plant: 'Blackberry', varieties: ['Blackberry'] },
  { plant: 'Blueberry', varieties: ['Blueberry'] },
];

function tidyName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

async function upsertPlantName(name: string) {
  const tidy = tidyName(name);
  const rows = await prisma.plantName.findMany({ select: { id: true, name: true } });
  const existing = rows.find((row) => row.name.toLowerCase() === tidy.toLowerCase());
  if (existing) return existing;
  return prisma.plantName.create({ data: { name: tidy }, select: { id: true, name: true } });
}

async function ensureVarietyMaster() {
  const count = await prisma.variety.count();
  if (count > 0) return;
  for (const group of PLANT_LINKS) {
    const plant = await upsertPlantName(group.plant);
    await prisma.variety.createMany({
      data: group.varieties.map((name) => ({ name, plantNameId: plant.id })),
      skipDuplicates: true,
    });
  }
  const linked = new Set(PLANT_LINKS.flatMap((group) => group.varieties));
  const leftover = EXOTIC_CULTIVARS.filter((name) => !linked.has(name));
  if (leftover.length > 0) {
    await prisma.variety.createMany({ data: leftover.map((name) => ({ name })), skipDuplicates: true });
  }
}

export const plantNameSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export async function listPlantNames(_req: Request, res: Response): Promise<void> {
  await ensureVarietyMaster();
  const rows = await prisma.plantName.findMany({ orderBy: { name: 'asc' }, select: { name: true } });
  res.json({ success: true, data: rows.map((row) => row.name) });
}

export async function createPlantName(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof plantNameSchema>;
  const existingRows = await prisma.plantName.findMany({ select: { id: true, name: true } });
  const tidy = tidyName(body.name);
  const already = existingRows.find((row) => row.name.toLowerCase() === tidy.toLowerCase());
  if (already) {
    res.json({ success: true, data: already.name });
    return;
  }
  const created = await prisma.plantName.create({ data: { name: tidy } });
  await writeAudit(req.user!.id, 'CREATE', 'PlantName', created.id, { name: created.name });
  res.status(201).json({ success: true, data: created.name });
}

export const varietySchema = z.object({
  name: z.string().trim().min(2).max(80),
  plantName: z.string().trim().min(2).max(80),
});

async function saveVariety(name: string, plantName: string) {
  const plant = await upsertPlantName(plantName);
  const rows = await prisma.variety.findMany({ select: { id: true, name: true, plantNameId: true, plantName: { select: { name: true } } } });
  const existing = rows.find((row) => row.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (existing.plantNameId && existing.plantNameId !== plant.id) {
      throw ApiError.badRequest(`This variety already belongs to ${existing.plantName?.name ?? 'another plant'}`);
    }
    if (!existing.plantNameId) {
      await prisma.variety.update({ where: { id: existing.id }, data: { plantNameId: plant.id } });
    }
    return { name: existing.name, plantName: plant.name, created: false as const, id: existing.id };
  }
  const created = await prisma.variety.create({ data: { name, plantNameId: plant.id } });
  return { name: created.name, plantName: plant.name, created: true as const, id: created.id };
}

export async function listVarieties(_req: Request, res: Response): Promise<void> {
  await ensureVarietyMaster();
  const rows = await prisma.variety.findMany({
    orderBy: { name: 'asc' },
    select: { name: true, plantName: { select: { name: true } } },
  });
  res.json({
    success: true,
    data: rows.map((row) => ({ name: row.name, plantName: row.plantName?.name ?? null })),
  });
}

export async function createVariety(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof varietySchema>;
  const saved = await saveVariety(tidyName(body.name), tidyName(body.plantName));
  if (saved.created) {
    await writeAudit(req.user!.id, 'CREATE', 'Variety', saved.id, { name: saved.name, plantName: saved.plantName });
    res.status(201).json({ success: true, data: { name: saved.name, plantName: saved.plantName } });
    return;
  }
  res.json({ success: true, data: { name: saved.name, plantName: saved.plantName } });
}

const photoSchema = z.object({
  kind: z.enum(['PLANT', 'FRUIT']),
  dataUrl: z.string().startsWith('data:image/').max(2_500_000),
});

export const createMotherPlantSchema = z.object({
  category: z.enum(MOTHER_CATEGORIES),
  plantName: z.string().trim().min(2).max(80),
  varietyName: z.string().trim().min(2).max(80),
  scientificName: z.string().optional(),
  sourceCountry: z.string().trim().max(80).optional(),
  sourceVendor: z.string().trim().max(120).optional(),
  plantingDate: z.coerce.date(),
  locationId: z.string().uuid(),
  plantCount: z.number().int().min(1).max(100000),
  propagationMethods: z.array(z.enum(MOTHER_METHODS)).min(1).max(4),
  healthStatus: z.enum(MOTHER_HEALTH).default('HEALTHY'),
  seasonCapacity: z.number().int().min(0).max(100000).optional(),
  listPrice: z.number().min(0).max(10000000).optional(),
  notes: z.string().max(2000).optional(),
  description: z.string().max(2000).optional(),
  photos: z.array(photoSchema).max(10).optional(),
});

export const updateMotherPlantSchema = createMotherPlantSchema.omit({ listPrice: true, seasonCapacity: true }).extend({
  listPrice: z.number().min(0).max(10000000).nullable().optional(),
  seasonCapacity: z.number().int().min(0).max(100000).nullable().optional(),
  removePhotoIds: z.array(z.string().uuid()).max(10).optional(),
  removeVideo: z.boolean().optional(),
});

export const motherPriceSchema = z.object({
  listPrice: z.number().min(0).max(10000000).nullable(),
});

const uploadDir = path.join(process.cwd(), 'uploads', 'mother-plants');
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

function videoFileExtension(file: { mimetype: string; originalname: string }) {
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (file.mimetype === 'video/quicktime' || ext === 'mov') return 'mov';
  if (file.mimetype === 'video/webm' || ext === 'webm') return 'webm';
  if (file.mimetype === 'video/mp4' || ext === 'mp4' || ext === 'm4v') return 'mp4';
  return '';
}

const motherVideoParser = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      mkdir(uploadDir, { recursive: true })
        .then(() => cb(null, uploadDir))
        .catch((err: Error) => cb(err, uploadDir));
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}.${videoFileExtension(file) || 'mp4'}`);
    },
  }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!videoFileExtension(file)) {
      cb(new Error('VIDEO_TYPE'));
      return;
    }
    cb(null, true);
  },
}).single('video');

export function receiveMotherVideo(req: Request, res: Response, next: NextFunction) {
  motherVideoParser(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
    const message = err instanceof Error ? err.message : '';
    if (code === 'LIMIT_FILE_SIZE') {
      next(ApiError.badRequest('The video must be under 500 MB.'));
      return;
    }
    if (message === 'VIDEO_TYPE') {
      next(ApiError.badRequest('Choose an MP4, WebM, or MOV video.'));
      return;
    }
    next(err);
  });
}

function photoUrl(storedName: string) {
  return `/api/uploads/mother-plants/${storedName}`;
}

async function placeInNursery(locationId: string, nurseryId: string) {
  const place = await prisma.nurseryLocation.findFirst({ where: { id: locationId, nurseryId } });
  if (!place) throw ApiError.badRequest('Choose a place in this nursery');
  const label = place.name.trim() || place.address.trim();
  return { id: place.id, label: label.slice(0, 160) };
}

function presentPlant<T extends {
  notes: string | null;
  listPrice?: { toString(): string } | null;
  videoStoredName?: string | null;
  photos?: { id: string; kind: string; storedName: string }[];
}>(plant: T) {
  const { photos, videoStoredName, listPrice, ...rest } = plant;
  return {
    ...rest,
    listPrice: listPrice == null ? null : Number(listPrice),
    videoUrl: videoStoredName ? photoUrl(videoStoredName) : null,
    description: plant.notes,
    photos: (photos ?? []).map((photo) => ({ id: photo.id, kind: photo.kind, url: photoUrl(photo.storedName) })),
  };
}

async function uniqueShareCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const shareCode = `${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 8)}`;
    const existing = await prisma.motherPlant.findFirst({ where: { shareCode } });
    if (!existing) return shareCode;
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function uniqueMotherTag(nurseryId: string, varietyName: string): Promise<string> {
  const words = varietyName.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const base = (words.length > 1 ? words.map((word) => word[0]).join('') : (words[0] ?? 'PLANT')).slice(0, 6) || 'PLANT';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const tagNumber = `MP-${base}-${suffix}`;
    const existing = await prisma.motherPlant.findFirst({ where: { nurseryId, tagNumber } });
    if (!existing) return tagNumber;
  }
  return `MP-${Date.now().toString(36).toUpperCase()}`;
}

async function savePhotos(motherPlantId: string, photos: z.infer<typeof photoSchema>[]) {
  if (photos.length === 0) return;
  await mkdir(uploadDir, { recursive: true });
  const rows: { motherPlantId: string; kind: string; storedName: string }[] = [];
  for (const photo of photos) {
    const match = photo.dataUrl.match(/^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) throw ApiError.badRequest('Each photo must be a JPEG, PNG, or WebP image');
    const bytes = Buffer.from(match[1], 'base64');
    if (bytes.length < 32 || bytes.length > 1_800_000) throw ApiError.badRequest('Each photo must be under 1.8 MB');
    const storedName = `${randomUUID()}.jpg`;
    await writeFile(path.join(uploadDir, storedName), bytes);
    rows.push({ motherPlantId, kind: photo.kind, storedName });
  }
  await prisma.motherPlantPhoto.createMany({ data: rows });
}

export async function listMotherPlants(_req: Request, res: Response): Promise<void> {
  const [items, total, scionAgg] = await Promise.all([
    prisma.motherPlant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { photos: { orderBy: { createdAt: 'asc' } }, _count: { select: { propagations: true } } },
    }),
    prisma.motherPlant.count(),
    prisma.motherPlant.aggregate({ _sum: { scionsHarvested: true } }),
  ]);
  res.json({
    success: true,
    data: items.map(presentPlant),
    meta: { total, totalScionsHarvested: scionAgg._sum.scionsHarvested ?? 0 },
  });
}

export async function getMotherPlant(req: Request, res: Response): Promise<void> {
  const plant = await prisma.motherPlant.findUnique({
    where: { id: req.params.id },
    include: { propagations: true },
  });
  if (!plant) throw ApiError.notFound('Mother plant not found');
  res.json({ success: true, data: plant });
}

export async function createMotherPlant(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof createMotherPlantSchema>;
  const photos = body.photos ?? [];
  const nurseryId = currentNurseryId();
  if (!nurseryId) throw ApiError.forbidden('Choose a nursery first');
  const catalog = await saveVariety(tidyName(body.varietyName), tidyName(body.plantName));
  const place = await placeInNursery(body.locationId, nurseryId);
  const tagNumber = await uniqueMotherTag(nurseryId, catalog.name);
  const shareCode = await uniqueShareCode();
  const plant = await prisma.motherPlant.create({
    data: withNursery({
      tagNumber,
      shareCode,
      category: body.category,
      plantName: catalog.plantName,
      varietyName: catalog.name,
      scientificName: body.scientificName,
      sourceCountry: body.sourceCountry,
      sourceVendor: body.sourceVendor?.trim() || null,
      plantingDate: body.plantingDate,
      plotLocation: place.label,
      locationId: place.id,
      plantCount: body.plantCount,
      propagationMethods: body.propagationMethods,
      healthStatus: body.healthStatus,
      seasonCapacity: body.seasonCapacity ?? null,
      listPrice: body.listPrice ?? null,
      notes: (body.description ?? body.notes)?.trim() || null,
    }),
  });
  try {
    await savePhotos(plant.id, photos);
  } catch (err) {
    await prisma.motherPlant.delete({ where: { id: plant.id } });
    throw err;
  }
  const saved = await prisma.motherPlant.findUnique({
    where: { id: plant.id },
    include: { photos: { orderBy: { createdAt: 'asc' } } },
  });
  await writeAudit(req.user!.id, 'CREATE', 'MotherPlant', plant.id, { tagNumber: plant.tagNumber, photos: photos.length });
  res.status(201).json({ success: true, data: saved ? presentPlant(saved) : plant });
}

export async function updateMotherPlant(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof updateMotherPlantSchema>;
  const plant = await prisma.motherPlant.findUnique({
    where: { id: req.params.id },
    include: { photos: true },
  });
  if (!plant) throw ApiError.notFound('Mother plant not found');
  const removeIds = new Set(body.removePhotoIds ?? []);
  const kept = plant.photos.filter((photo) => !removeIds.has(photo.id));
  const incoming = body.photos ?? [];
  if (kept.length + incoming.length > 10) throw ApiError.badRequest('You can keep 10 photos at most');
  const catalog = await saveVariety(tidyName(body.varietyName), tidyName(body.plantName));
  const nurseryId = currentNurseryId();
  if (!nurseryId) throw ApiError.forbidden('Choose a nursery first');
  const place = await placeInNursery(body.locationId, nurseryId);
  await prisma.motherPlant.update({
    where: { id: plant.id },
    data: {
      category: body.category,
      plantName: catalog.plantName,
      varietyName: catalog.name,
      scientificName: body.scientificName,
      sourceCountry: body.sourceCountry?.trim() || null,
      sourceVendor: body.sourceVendor?.trim() || null,
      plantingDate: body.plantingDate,
      plotLocation: place.label,
      locationId: place.id,
      plantCount: body.plantCount,
      propagationMethods: body.propagationMethods,
      healthStatus: body.healthStatus,
      seasonCapacity: body.seasonCapacity ?? null,
      listPrice: body.listPrice ?? null,
      notes: (body.description ?? body.notes)?.trim() || null,
      videoStoredName: body.removeVideo ? null : plant.videoStoredName,
    },
  });
  const removed = plant.photos.filter((photo) => removeIds.has(photo.id));
  if (removed.length > 0) {
    await prisma.motherPlantPhoto.deleteMany({ where: { id: { in: removed.map((photo) => photo.id) }, motherPlantId: plant.id } });
    await Promise.all(removed.map((photo) => unlink(path.join(uploadDir, photo.storedName)).catch(() => undefined)));
  }
  if (body.removeVideo && plant.videoStoredName) {
    await unlink(path.join(uploadDir, plant.videoStoredName)).catch(() => undefined);
  }
  await savePhotos(plant.id, incoming);
  const saved = await prisma.motherPlant.findUnique({
    where: { id: plant.id },
    include: { photos: { orderBy: { createdAt: 'asc' } }, _count: { select: { propagations: true } } },
  });
  await writeAudit(req.user!.id, 'UPDATE', 'MotherPlant', plant.id, { tagNumber: plant.tagNumber });
  res.json({ success: true, data: saved ? presentPlant(saved) : plant });
}

export async function updateMotherPrice(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof motherPriceSchema>;
  const plant = await prisma.motherPlant.findUnique({ where: { id: req.params.id } });
  if (!plant) throw ApiError.notFound('Mother plant not found');
  const saved = await prisma.motherPlant.update({
    where: { id: plant.id },
    data: { listPrice: body.listPrice },
    include: { photos: { orderBy: { createdAt: 'asc' } }, _count: { select: { propagations: true } } },
  });
  await writeAudit(req.user!.id, 'UPDATE', 'MotherPlant', plant.id, { listPrice: body.listPrice, tagNumber: plant.tagNumber });
  res.json({ success: true, data: presentPlant(saved) });
}

export async function attachMotherVideo(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) throw ApiError.badRequest('Choose an MP4, WebM, or MOV video.');
  const plant = await prisma.motherPlant.findUnique({ where: { id: req.params.id } });
  if (!plant) {
    await unlink(file.path).catch(() => undefined);
    throw ApiError.notFound('Mother plant not found');
  }
  await prisma.motherPlant.update({ where: { id: plant.id }, data: { videoStoredName: file.filename } });
  if (plant.videoStoredName) await unlink(path.join(uploadDir, plant.videoStoredName)).catch(() => undefined);
  const saved = await prisma.motherPlant.findUnique({
    where: { id: plant.id },
    include: { photos: { orderBy: { createdAt: 'asc' } } },
  });
  res.json({ success: true, data: saved ? presentPlant(saved) : plant });
}

export async function deleteMotherPlant(req: Request, res: Response): Promise<void> {
  const plant = await prisma.motherPlant.findUnique({
    where: { id: req.params.id },
    include: { photos: true },
  });
  if (!plant) throw ApiError.notFound('Mother plant not found');
  await prisma.motherPlant.delete({ where: { id: plant.id } });
  const names = [...plant.photos.map((photo) => photo.storedName), plant.videoStoredName].filter((name): name is string => !!name);
  await Promise.all(names.map((name) => unlink(path.join(uploadDir, name)).catch(() => undefined)));
  res.json({ success: true });
}

export const phenologySchema = z.object({
  kind: z.nativeEnum(PhenologyKind),
  observedOn: z.coerce.date(),
  notes: z.string().optional(),
});

export async function listPhenology(req: Request, res: Response): Promise<void> {
  const plant = await prisma.motherPlant.findUnique({ where: { id: req.params.id } });
  if (!plant) throw ApiError.notFound('Mother plant not found');
  const logs = await prisma.phenologyLog.findMany({
    where: { motherPlantId: plant.id },
    orderBy: { observedOn: 'desc' },
  });
  res.json({ success: true, data: logs });
}

export async function logPhenology(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof phenologySchema>;
  const plant = await prisma.motherPlant.findUnique({ where: { id: req.params.id } });
  if (!plant) throw ApiError.notFound('Mother plant not found');
  const log = await prisma.phenologyLog.create({
    data: { motherPlantId: plant.id, kind: body.kind, observedOn: body.observedOn, notes: body.notes },
  });
  await writeAudit(req.user!.id, 'CREATE', 'PhenologyLog', log.id, { kind: log.kind, tag: plant.tagNumber });
  res.status(201).json({ success: true, data: log });
}

export async function motherPlantTag(req: Request, res: Response): Promise<void> {
  const plant = await prisma.motherPlant.findUnique({ where: { id: req.params.id } });
  if (!plant) throw ApiError.notFound('Mother plant not found');
  let shareCode = plant.shareCode;
  if (!shareCode) {
    shareCode = await uniqueShareCode();
    await prisma.motherPlant.update({ where: { id: plant.id }, data: { shareCode } });
  }
  const origin = phoneOrigin(safeOrigin(req.query.origin));
  const publicUrl = `${origin || ''}/plant/${shareCode}`;
  const qrDataUrl = await generateQrDataUrl(origin ? publicUrl : shareCode);
  res.json({
    success: true,
    data: {
      tagNumber: plant.tagNumber,
      plantName: plant.plantName,
      varietyName: plant.varietyName,
      plotLocation: plant.plotLocation,
      sourceCountry: plant.sourceCountry,
      shareCode,
      publicUrl,
      qrDataUrl,
    },
  });
}

export const scionSchema = z.object({ quantity: z.coerce.number().int().positive() });

// Logs scion harvest, incrementing the running count (US-MP-01).
export async function logScionHarvest(req: Request, res: Response): Promise<void> {
  const { quantity } = req.body as z.infer<typeof scionSchema>;
  const plant = await prisma.motherPlant.update({
    where: { id: req.params.id },
    data: { scionsHarvested: { increment: quantity } },
  });
  res.json({ success: true, data: plant });
}
