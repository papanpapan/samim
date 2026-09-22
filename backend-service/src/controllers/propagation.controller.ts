import { Request, Response } from 'express';
import { z } from 'zod';
import { BatchStage, PropagationMethod } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/apiError';
import { assertTransition, computeStageMove } from '../services/propagation.service';
import { applyStockDelta } from '../services/stockLedger.service';
import { cultivarCode } from '../constants/businessRules';
import { encodeLabelData } from '../services/qrEngine.service';

export const createBatchSchema = z.object({
  motherPlantId: z.string().uuid(),
  method: z.nativeEnum(PropagationMethod),
  initialQuantity: z.coerce.number().int().positive(),
});

async function nextBatchCode(cultivar: string): Promise<string> {
  const year = new Date().getFullYear();
  const code = cultivarCode(cultivar);
  const prefix = `BATCH-${year}-${code}-`;
  const count = await prisma.propagationBatch.count({
    where: { batchCode: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, '0')}`;
}

export async function listBatches(_req: Request, res: Response): Promise<void> {
  const items = await prisma.propagationBatch.findMany({
    orderBy: { startDate: 'desc' },
    include: { motherPlant: { select: { tagNumber: true, varietyName: true } } },
  });
  res.json({ success: true, data: items });
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

  const batchCode = await nextBatchCode(mother.varietyName);
  const batch = await prisma.propagationBatch.create({
    data: {
      batchCode,
      motherPlantId: body.motherPlantId,
      method: body.method,
      initialQuantity: body.initialQuantity,
      currentQuantity: body.initialQuantity,
      stage: BatchStage.INITIATED,
    },
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

  res.json({
    success: true,
    data: updated,
    meta: {
      mortalityDelta: move.mortalityDelta,
      mortalityPct: Number(move.mortalityPct.toFixed(2)),
    },
  });
}

export const markReadySchema = z.object({
  commonName: z.string().min(2),
  variety: z.string().min(1),
  category: z.string().min(1),
  bagSize: z.string().min(1),
  costPrice: z.coerce.number().nonnegative(),
  retailPrice: z.coerce.number().nonnegative(),
  wholesalePrice: z.coerce.number().nonnegative(),
  reorderAlert: z.coerce.number().int().nonnegative().default(15),
});

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

    const plant = await tx.plantInventory.create({
      data: {
        sku,
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
      },
    });

    await applyStockDelta({
      tx,
      plantId: plant.id,
      deltaQty: batch.currentQuantity,
      actionType: 'PROPAGATION_READY',
      recordedBy,
      referenceNo: batch.batchCode,
    });

    await tx.propagationBatch.update({
      where: { id: batch.id },
      data: { stage: BatchStage.READY_FOR_SALE, readyDate: new Date() },
    });

    return tx.plantInventory.findUnique({ where: { id: plant.id } });
  });

  res.status(201).json({ success: true, data: result });
}
