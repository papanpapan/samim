import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma, prismaBase } from '../config/database';
import { ApiError } from '../utils/apiError';
import { batchRates } from '../services/propagation.service';

export const publicBookingSchema = z.object({
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().trim().min(6).max(20),
  customerCity: z.string().trim().max(80).optional(),
  quantity: z.coerce.number().int().min(1).max(5000),
  neededBy: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
});

function photoUrl(storedName: string) {
  return `/api/uploads/mother-plants/${storedName}`;
}

async function plantByCode(code: string) {
  return prisma.motherPlant.findFirst({
    where: { shareCode: code },
    include: {
      photos: { orderBy: { createdAt: 'asc' } },
      nursery: { select: { name: true, address: true, phone: true, currencyCode: true } },
    },
  });
}

export async function publicPlant(req: Request, res: Response): Promise<void> {
  const plant = await plantByCode(req.params.code);
  if (!plant) throw ApiError.notFound('Plant not found');
  res.json({
    success: true,
    data: {
      shareCode: plant.shareCode,
      nurseryName: plant.nursery.name,
      nurseryAddress: plant.nursery.address,
      nurseryPhone: plant.nursery.phone,
      currencyCode: plant.nursery.currencyCode === 'INR' ? 'INR' : 'BDT',
      plantName: plant.plantName,
      varietyName: plant.varietyName,
      category: plant.category,
      sourceCountry: plant.sourceCountry,
      healthStatus: plant.healthStatus,
      description: plant.notes,
      listPrice: plant.listPrice == null ? null : Number(plant.listPrice),
      plantCount: plant.plantCount,
      place: plant.plotLocation,
      videoUrl: plant.videoStoredName ? photoUrl(plant.videoStoredName) : null,
      photos: plant.photos.map((photo) => ({ id: photo.id, kind: photo.kind, url: photoUrl(photo.storedName) })),
    },
  });
}

export async function publicBooking(req: Request, res: Response): Promise<void> {
  const plant = await plantByCode(req.params.code);
  if (!plant) throw ApiError.notFound('Plant not found');
  const body = req.body as z.infer<typeof publicBookingSchema>;
  const booking = await prisma.booking.create({
    data: {
      nurseryId: plant.nurseryId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerCity: body.customerCity || null,
      variety: plant.varietyName,
      quantity: body.quantity,
      neededBy: body.neededBy ?? null,
      notes: [body.notes, `Public plant page ${plant.shareCode}`].filter(Boolean).join('\n'),
    },
  });
  res.status(201).json({
    success: true,
    data: { reference: booking.id.slice(0, 8).toUpperCase() },
  });
}

export async function publicBatch(req: Request, res: Response): Promise<void> {
  const batch = await prisma.propagationBatch.findFirst({
    where: { shareCode: req.params.code },
    include: {
      motherPlant: { select: { plantName: true, varietyName: true, tagNumber: true, plotLocation: true } },
      nursery: { select: { name: true, phone: true } },
    },
  });
  if (!batch) throw ApiError.notFound('Batch not found');
  const [growing, lost, ready] = await Promise.all([
    prisma.propagationUnit.count({ where: { batchId: batch.id, status: 'GROWING' } }),
    prisma.propagationUnit.count({ where: { batchId: batch.id, status: 'LOST' } }),
    prisma.propagationUnit.count({ where: { batchId: batch.id, status: 'READY' } }),
  ]);
  res.json({
    success: true,
    data: {
      batchCode: batch.batchCode,
      nurseryName: batch.nursery.name,
      nurseryPhone: batch.nursery.phone,
      plantName: batch.motherPlant.plantName,
      varietyName: batch.motherPlant.varietyName,
      tagNumber: batch.motherPlant.tagNumber,
      place: batch.motherPlant.plotLocation,
      method: batch.method,
      stage: batch.stage,
      startDate: batch.startDate,
      initialQuantity: batch.initialQuantity,
      currentQuantity: batch.currentQuantity,
      mortalityCount: batch.mortalityCount,
      growing,
      lost,
      ready,
      ...batchRates(batch.initialQuantity, batch.currentQuantity, batch.mortalityCount),
    },
  });
}

export async function publicStock(req: Request, res: Response): Promise<void> {
  const plant = await prisma.plantInventory.findFirst({
    where: { shareCode: req.params.code },
    include: {
      photos: { orderBy: { createdAt: 'asc' } },
      nursery: { select: { name: true, phone: true, address: true, currencyCode: true } },
    },
  });
  if (!plant) throw ApiError.notFound('Stock not found');
  res.json({
    success: true,
    data: {
      commonName: plant.commonName,
      variety: plant.variety,
      category: plant.category,
      bagSize: plant.bagSize,
      plantHeight: plant.plantHeight,
      plantAge: plant.plantAge,
      zoneLabel: plant.zoneLabel,
      retailPrice: Number(plant.retailPrice),
      wholesalePrice: Number(plant.wholesalePrice),
      currentStock: plant.currentStock,
      reservedQty: plant.reservedQty,
      available: Math.max(0, plant.currentStock - plant.reservedQty),
      nurseryName: plant.nursery.name,
      nurseryPhone: plant.nursery.phone,
      nurseryAddress: plant.nursery.address,
      currencyCode: plant.nursery.currencyCode === 'INR' ? 'INR' : 'BDT',
      videoUrl: plant.videoStoredName ? `/api/uploads/stock/${plant.videoStoredName}` : null,
      photos: plant.photos.map((photo) => ({ id: photo.id, url: `/api/uploads/stock/${photo.storedName}` })),
    },
  });
}

export async function publicUnit(req: Request, res: Response): Promise<void> {
  const unit = await prisma.propagationUnit.findFirst({
    where: { code: req.params.code },
    include: {
      batch: {
        include: {
          motherPlant: { select: { plantName: true, varietyName: true, tagNumber: true } },
          nursery: { select: { name: true } },
        },
      },
    },
  });
  if (!unit) throw ApiError.notFound('Plant tag not found');
  res.json({
    success: true,
    data: {
      serial: `${unit.batch.batchCode}-${String(unit.serialNo).padStart(4, '0')}`,
      status: unit.status,
      nurseryName: unit.batch.nursery.name,
      batchCode: unit.batch.batchCode,
      stage: unit.batch.stage,
      method: unit.batch.method,
      plantName: unit.batch.motherPlant.plantName,
      varietyName: unit.batch.motherPlant.varietyName,
      tagNumber: unit.batch.motherPlant.tagNumber,
    },
  });
}

export async function publicAlert(req: Request, res: Response): Promise<void> {
  const code = String(req.params.code ?? '').trim();
  if (!code) throw ApiError.notFound('Alert case not found');
  const alert = await prismaBase.dangerAlert.findFirst({
    where: {
      OR: [{ id: code }, { caseNo: code }],
    },
    include: {
      nursery: { select: { name: true, address: true, phone: true } },
      zone: { select: { name: true, location: true } },
    },
  });
  if (!alert) throw ApiError.notFound('Alert case not found');
  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    data: {
      id: alert.id,
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
      cameraName: alert.cameraName,
      detectKind: alert.detectKind,
      nurseryName: alert.nursery.name,
      nurseryAddress: alert.nursery.address,
      nurseryPhone: alert.nursery.phone,
      zone: alert.zone,
      photoUrl: alert.photoName ? `/api/uploads/alerts/${alert.photoName}` : null,
      videoUrl: alert.videoName ? `/api/uploads/alerts/${alert.videoName}` : null,
    },
  });
}
