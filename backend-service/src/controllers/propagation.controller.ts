import { randomBytes, randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { BatchStage, PropagationMethod, UnitStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { withNursery } from '../services/tenantContext';
import { ApiError } from '../utils/apiError';
import { assertTransition, batchRates, computeStageMove } from '../services/propagation.service';
import { applyStockDelta } from '../services/stockLedger.service';
import { cultivarCode } from '../constants/businessRules';
import { MOTHER_METHODS } from '../constants/cultivarList';
import { encodeLabelData, generateQrDataUrl } from '../services/qrEngine.service';
import { phoneOrigin, safeOrigin } from '../utils/lanOrigin';

export const createBatchSchema = z.object({
  motherPlantId: z.string().uuid(),
  method: z.nativeEnum(PropagationMethod),
  initialQuantity: z.coerce.number().int().min(1).max(1000),
});

const UNIT_CAP = 1000;

function unitRows(nurseryId: string, batchId: string, fromSerial: number, toSerial: number) {
  const rows: {
    id: string;
    nurseryId: string;
    batchId: string;
    serialNo: number;
    code: string;
    status: UnitStatus;
  }[] = [];
  for (let serialNo = fromSerial; serialNo <= toSerial; serialNo += 1) {
    rows.push({
      id: randomUUID(),
      nurseryId,
      batchId,
      serialNo,
      code: randomBytes(8).toString('hex'),
      status: UnitStatus.GROWING,
    });
  }
  return rows;
}

async function uniqueBatchShare() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shareCode = randomBytes(6).toString('hex');
    const existing = await prisma.propagationBatch.findFirst({ where: { shareCode } });
    if (!existing) return shareCode;
  }
  return randomBytes(8).toString('hex');
}

async function nextBatchCode(cultivar: string): Promise<string> {
  const year = new Date().getFullYear();
  const code = cultivarCode(cultivar);
  const prefix = `BATCH-${year}-${code}-`;
  const count = await prisma.propagationBatch.count({
    where: { batchCode: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, '0')}`;
}

const motherSelect = {
  tagNumber: true,
  plantName: true,
  varietyName: true,
  plotLocation: true,
  plantCount: true,
  category: true,
  listPrice: true,
  propagationMethods: true,
} as const;

function presentBatch<T extends { motherPlant: { listPrice: { toString(): string } | null } | null }>(batch: T) {
  if (!batch.motherPlant) return batch;
  const price = batch.motherPlant.listPrice;
  return {
    ...batch,
    motherPlant: {
      ...batch.motherPlant,
      listPrice: price == null ? null : Number(price),
    },
  };
}

export async function listBatches(_req: Request, res: Response): Promise<void> {
  const items = await prisma.propagationBatch.findMany({
    orderBy: { startDate: 'desc' },
    include: { motherPlant: { select: motherSelect } },
  });
  res.json({ success: true, data: items.map(presentBatch) });
}

export async function getBatch(req: Request, res: Response): Promise<void> {
  const batch = await prisma.propagationBatch.findUnique({
    where: { id: req.params.id },
    include: { motherPlant: true, plants: true },
  });
  if (!batch) throw ApiError.notFound('Batch not found');
  res.json({ success: true, data: batch });
}

export async function createBatch(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof createBatchSchema>;
  const mother = await prisma.motherPlant.findUnique({ where: { id: body.motherPlantId } });
  if (!mother) throw ApiError.notFound('Mother plant not found');

  const registered = mother.propagationMethods.filter((method) =>
    (MOTHER_METHODS as readonly string[]).includes(method),
  );
  if (!registered.includes(body.method)) {
    throw ApiError.badRequest('Choose a propagation method saved on this mother plant');
  }

  const batchCode = await nextBatchCode(mother.varietyName);
  const batch = await prisma.$transaction(async (tx) => {
    const shareCode = await uniqueBatchShare();
    const created = await tx.propagationBatch.create({
      data: withNursery({
      batchCode,
        shareCode,
      motherPlantId: body.motherPlantId,
      method: body.method,
      initialQuantity: body.initialQuantity,
      currentQuantity: body.initialQuantity,
      stage: BatchStage.INITIATED,
      }),
    });
    const rows = unitRows(mother.nurseryId, created.id, 1, body.initialQuantity);
    for (let index = 0; index < rows.length; index += 200) {
      await tx.propagationUnit.createMany({ data: rows.slice(index, index + 200) });
    }
    await tx.motherPlant.update({
      where: { id: mother.id },
      data: { scionsHarvested: { increment: body.initialQuantity } },
    });
    return created;
  });
  res.status(201).json({ success: true, data: batch });
}

export const moveStageSchema = z.object({
  toStage: z.nativeEnum(BatchStage),
  survivedCount: z.coerce.number().int().nonnegative(),
});

// Moves a batch to the next lifecycle stage, recording mortality (US-PROP-02).
export async function moveStage(req: Request, res: Response): Promise<void> {
  const { toStage, survivedCount } = req.body as z.infer<typeof moveStageSchema>;
  const batch = await prisma.propagationBatch.findUnique({ where: { id: req.params.id } });
  if (!batch) throw ApiError.notFound('Batch not found');

  assertTransition(batch.stage, toStage);
  const move = computeStageMove(batch.currentQuantity, survivedCount, batch.mortalityCount);

  const stamp: Record<string, Date> = {};
  if (toStage === BatchStage.MIST_CHAMBER) stamp.mistChamberDate = new Date();
  if (toStage === BatchStage.HARDENING_SHADE) stamp.hardeningDate = new Date();

  const updated = await prisma.propagationBatch.update({
    where: { id: batch.id },
    data: {
      stage: toStage,
      currentQuantity: move.currentQuantity,
      mortalityCount: move.totalMortality,
      ...stamp,
    },
  });

  if (move.mortalityDelta > 0) {
    const growing = await prisma.propagationUnit.findMany({
      where: { batchId: batch.id, status: UnitStatus.GROWING },
      orderBy: { serialNo: 'desc' },
      take: move.mortalityDelta,
      select: { id: true },
    });
    if (growing.length > 0) {
      await prisma.propagationUnit.updateMany({
        where: { id: { in: growing.map((unit) => unit.id) } },
        data: { status: UnitStatus.LOST },
      });
    }
  }

  res.json({
    success: true,
    data: updated,
    meta: {
      mortalityDelta: move.mortalityDelta,
      mortalityPct: Number(move.mortalityPct.toFixed(2)),
    },
  });
}

const stockPhotoSchema = z.object({
  dataUrl: z.string().startsWith('data:image/').max(2_500_000),
});

export const markReadySchema = z.object({
  commonName: z.string().min(2),
  variety: z.string().min(1),
  category: z.string().min(1),
  bagSize: z.string().min(1),
  costPrice: z.coerce.number().nonnegative(),
  retailPrice: z.coerce.number().nonnegative(),
  wholesalePrice: z.coerce.number().nonnegative(),
  reorderAlert: z.coerce.number().int().nonnegative().default(15),
  photos: z.array(stockPhotoSchema).max(6).optional(),
});

const stockUploadDir = path.join(process.cwd(), 'uploads', 'stock');
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

function stockVideoExtension(file: { mimetype: string; originalname: string }) {
  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (file.mimetype === 'video/quicktime' || ext === 'mov') return 'mov';
  if (file.mimetype === 'video/webm' || ext === 'webm') return 'webm';
  if (file.mimetype === 'video/mp4' || ext === 'mp4' || ext === 'm4v') return 'mp4';
  return '';
}

async function saveStockPhotos(plantId: string, photos: { dataUrl: string }[]) {
  if (photos.length === 0) return;
  await mkdir(stockUploadDir, { recursive: true });
  const rows: { plantId: string; storedName: string }[] = [];
  for (const photo of photos) {
    const match = photo.dataUrl.match(/^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) throw ApiError.badRequest('Each photo must be a JPEG, PNG, or WebP image');
    const bytes = Buffer.from(match[1], 'base64');
    if (bytes.length < 32 || bytes.length > 1_800_000) throw ApiError.badRequest('Each photo must be under 1.8 MB');
    const storedName = `${randomUUID()}.jpg`;
    await writeFile(path.join(stockUploadDir, storedName), bytes);
    rows.push({ plantId, storedName });
  }
  await prisma.plantStockPhoto.createMany({ data: rows });
}

const stockVideoParser = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      mkdir(stockUploadDir, { recursive: true })
        .then(() => cb(null, stockUploadDir))
        .catch((err: Error) => cb(err, stockUploadDir));
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}.${stockVideoExtension(file) || 'mp4'}`);
    },
  }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!stockVideoExtension(file)) {
      cb(new Error('VIDEO_TYPE'));
      return;
    }
    cb(null, true);
  },
}).single('video');

export function receiveStockVideo(req: Request, res: Response, next: NextFunction) {
  stockVideoParser(req, res, (err: unknown) => {
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

// Marks a hardened batch READY_FOR_SALE: creates the inventory SKU and
// atomically pushes the surviving quantity into stock (SOP-02 / FR-INV-01).
export async function markReadyForSale(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof markReadySchema>;
  const recordedBy = req.user!.id;

  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.propagationBatch.findUnique({
      where: { id: req.params.id },
      include: { motherPlant: true },
    });
    if (!batch) throw ApiError.notFound('Batch not found');
    assertTransition(batch.stage, BatchStage.READY_FOR_SALE);

    const code = cultivarCode(batch.motherPlant.varietyName);
    const bagToken = body.bagSize.replace(/[^0-9a-zA-Z]/g, '').slice(0, 4).toUpperCase();
    const skuCount = await tx.plantInventory.count({
      where: { sku: { startsWith: `PLT-${code}-${bagToken}-` } },
    });
    const sku = `PLT-${code}-${bagToken}-${String(skuCount + 1).padStart(2, '0')}`;
    const shareCode = randomBytes(6).toString('hex');

    const plant = await tx.plantInventory.create({
      data: withNursery({
        sku,
        shareCode,
        commonName: body.commonName,
        variety: body.variety,
        category: body.category,
        bagSize: body.bagSize,
        currentStock: 0,
        reorderAlert: body.reorderAlert,
        costPrice: body.costPrice,
        retailPrice: body.retailPrice,
        wholesalePrice: body.wholesalePrice,
        batchId: batch.id,
        qrCodeData: encodeLabelData({
          sku,
          commonName: body.commonName,
          bagSize: body.bagSize,
          mrp: body.retailPrice,
          batchCode: batch.batchCode,
        }),
      }),
    });

    await applyStockDelta({
      tx,
      plantId: plant.id,
      deltaQty: batch.currentQuantity,
      actionType: 'PROPAGATION_READY',
      recordedBy,
      referenceNo: batch.batchCode,
    });

    await tx.propagationUnit.updateMany({
      where: { batchId: batch.id, status: UnitStatus.GROWING },
      data: { status: UnitStatus.READY },
    });

    await tx.propagationBatch.update({
      where: { id: batch.id },
      data: { stage: BatchStage.READY_FOR_SALE, readyDate: new Date() },
    });

    return tx.plantInventory.findUnique({ where: { id: plant.id } });
  });

  if (!result) throw ApiError.notFound('Stock was not created');
  if (body.photos && body.photos.length > 0) await saveStockPhotos(result.id, body.photos);
  const origin = phoneOrigin(safeOrigin(req.query.origin));
  const publicUrl = result.shareCode && origin ? `${origin}/stock/${result.shareCode}` : '';
  res.status(201).json({
    success: true,
    data: {
      ...result,
      publicUrl,
      qrDataUrl: publicUrl ? await generateQrDataUrl(publicUrl) : '',
    },
  });
}

export async function attachStockVideo(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) throw ApiError.badRequest('Choose an MP4, WebM, or MOV video.');
  const plant = await prisma.plantInventory.findUnique({ where: { id: req.params.plantId } });
  if (!plant) {
    await unlink(file.path).catch(() => undefined);
    throw ApiError.notFound('Stock not found');
  }
  await prisma.plantInventory.update({ where: { id: plant.id }, data: { videoStoredName: file.filename } });
  if (plant.videoStoredName) await unlink(path.join(stockUploadDir, plant.videoStoredName)).catch(() => undefined);
  res.json({ success: true, data: { videoUrl: `/api/uploads/stock/${file.filename}` } });
}

export const climateSchema = z.object({
  temperatureC: z.coerce.number().min(-5).max(60),
  humidityPct: z.coerce.number().min(0).max(100),
});

export async function listClimate(req: Request, res: Response): Promise<void> {
  const batch = await prisma.propagationBatch.findUnique({ where: { id: req.params.id } });
  if (!batch) throw ApiError.notFound('Batch not found');
  const readings = await prisma.mistReading.findMany({
    where: { batchId: batch.id },
    orderBy: { recordedAt: 'desc' },
    take: 30,
  });
  res.json({ success: true, data: readings });
}

export async function logClimate(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof climateSchema>;
  const batch = await prisma.propagationBatch.findUnique({ where: { id: req.params.id } });
  if (!batch) throw ApiError.notFound('Batch not found');
  const reading = await prisma.mistReading.create({
    data: {
      batchId: batch.id,
      temperatureC: body.temperatureC,
      humidityPct: body.humidityPct,
      recordedBy: req.user!.id,
    },
  });
  res.status(201).json({ success: true, data: reading });
}

async function ensureUnits(batch: { id: string; nurseryId: string; currentQuantity: number }) {
  const existing = await prisma.propagationUnit.count({ where: { batchId: batch.id } });
  if (existing > 0 || batch.currentQuantity < 1) return;
  const count = Math.min(batch.currentQuantity, UNIT_CAP);
  const rows = unitRows(batch.nurseryId, batch.id, 1, count);
  for (let index = 0; index < rows.length; index += 200) {
    await prisma.propagationUnit.createMany({ data: rows.slice(index, index + 200) });
  }
}

export const labelQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
  origin: z.string().max(200).optional(),
});

export async function batchLabels(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as z.infer<typeof labelQuerySchema>;
  const batch = await prisma.propagationBatch.findUnique({
    where: { id: req.params.id },
    include: { motherPlant: { select: { plantName: true, varietyName: true, tagNumber: true } } },
  });
  if (!batch) throw ApiError.notFound('Batch not found');
  await ensureUnits(batch);
  const where = { batchId: batch.id, status: { not: UnitStatus.LOST } };
  const [total, units] = await Promise.all([
    prisma.propagationUnit.count({ where }),
    prisma.propagationUnit.findMany({
      where,
      orderBy: { serialNo: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  const origin = phoneOrigin(safeOrigin(query.origin));
  const labels = await Promise.all(units.map(async (unit) => {
    const publicUrl = origin ? `${origin}/unit/${unit.code}` : unit.code;
    return {
      serialNo: unit.serialNo,
      serial: `${batch.batchCode}-${String(unit.serialNo).padStart(4, '0')}`,
      code: unit.code,
      status: unit.status,
      publicUrl,
      qrDataUrl: await generateQrDataUrl(publicUrl),
    };
  }));
  res.json({
    success: true,
    data: {
      batchCode: batch.batchCode,
      plantName: batch.motherPlant.plantName,
      varietyName: batch.motherPlant.varietyName,
      tagNumber: batch.motherPlant.tagNumber,
      page: query.page,
      pageSize: query.pageSize,
      total,
      labels,
    },
  });
}

export async function batchTag(req: Request, res: Response): Promise<void> {
  const batch = await prisma.propagationBatch.findUnique({
    where: { id: req.params.id },
    include: { motherPlant: { select: { plantName: true, varietyName: true, tagNumber: true } } },
  });
  if (!batch) throw ApiError.notFound('Batch not found');
  let shareCode = batch.shareCode;
  if (!shareCode) {
    shareCode = await uniqueBatchShare();
    await prisma.propagationBatch.update({ where: { id: batch.id }, data: { shareCode } });
  }
  const origin = phoneOrigin(safeOrigin(req.query.origin));
  const publicUrl = origin ? `${origin}/batch/${shareCode}` : shareCode;
  const rates = batchRates(batch.initialQuantity, batch.currentQuantity, batch.mortalityCount);
  res.json({
    success: true,
    data: {
      batchCode: batch.batchCode,
      shareCode,
      plantName: batch.motherPlant.plantName,
      varietyName: batch.motherPlant.varietyName,
      tagNumber: batch.motherPlant.tagNumber,
      stage: batch.stage,
      publicUrl,
      qrDataUrl: await generateQrDataUrl(publicUrl),
      ...rates,
    },
  });
}

export async function scanCode(req: Request, res: Response): Promise<void> {
  const raw = req.params.code.trim();
  const code = raw.split('/').filter(Boolean).pop() ?? raw;
  const unit = await prisma.propagationUnit.findFirst({
    where: { code },
    include: {
      batch: {
        include: { motherPlant: { select: { plantName: true, varietyName: true, tagNumber: true } } },
      },
    },
  });
  if (unit) {
    const rates = batchRates(unit.batch.initialQuantity, unit.batch.currentQuantity, unit.batch.mortalityCount);
    res.json({
      success: true,
      data: {
        kind: 'unit',
        serial: `${unit.batch.batchCode}-${String(unit.serialNo).padStart(4, '0')}`,
        status: unit.status,
        batchCode: unit.batch.batchCode,
        stage: unit.batch.stage,
        plantName: unit.batch.motherPlant.plantName,
        varietyName: unit.batch.motherPlant.varietyName,
        tagNumber: unit.batch.motherPlant.tagNumber,
        ...rates,
      },
    });
    return;
  }
  const batch = await prisma.propagationBatch.findFirst({
    where: { OR: [{ shareCode: code }, { batchCode: code }] },
    include: { motherPlant: { select: { plantName: true, varietyName: true, tagNumber: true } } },
  });
  if (!batch) throw ApiError.notFound('Code not found');
  const rates = batchRates(batch.initialQuantity, batch.currentQuantity, batch.mortalityCount);
  res.json({
    success: true,
    data: {
      kind: 'batch',
      batchCode: batch.batchCode,
      stage: batch.stage,
      plantName: batch.motherPlant.plantName,
      varietyName: batch.motherPlant.varietyName,
      tagNumber: batch.motherPlant.tagNumber,
      currentQuantity: batch.currentQuantity,
      initialQuantity: batch.initialQuantity,
      ...rates,
    },
  });
}
