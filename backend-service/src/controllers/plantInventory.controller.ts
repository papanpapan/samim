import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { ApiError } from '../utils/apiError';
import {
  encodeLabelData,
  generateQrDataUrl,
  generateQrSvg,
} from '../services/qrEngine.service';
import { applyStockDelta } from '../services/stockLedger.service';

export const listInventorySchema = z.object({
  search: z.string().optional(),
  lowStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export async function listInventory(req: Request, res: Response): Promise<void> {
  const { search } = req.query as unknown as z.infer<typeof listInventorySchema>;
  const items = await prisma.plantInventory.findMany({
    where: search
      ? {
          OR: [
            { sku: { contains: String(search), mode: 'insensitive' } },
            { commonName: { contains: String(search), mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: items });
}

// Fast SKU/barcode lookup for the POS scanner (FR-QR-01, target < 200ms).
export async function lookupBySku(req: Request, res: Response): Promise<void> {
  const sku = req.params.sku;
  const plant = await prisma.plantInventory.findUnique({ where: { sku } });
  if (!plant) throw ApiError.notFound(`No plant found for SKU ${sku}`);
  res.json({ success: true, data: plant });
}

export const createInventorySchema = z.object({
  commonName: z.string().min(2),
  variety: z.string().min(1),
  category: z.string().min(1),
  bagSize: z.string().min(1),
  costPrice: z.coerce.number().nonnegative(),
  retailPrice: z.coerce.number().nonnegative(),
  wholesalePrice: z.coerce.number().nonnegative(),
  initialStock: z.coerce.number().int().nonnegative().default(0),
  reorderAlert: z.coerce.number().int().nonnegative().default(15),
  sku: z.string().min(3),
});

export async function createInventory(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof createInventorySchema>;
  const recordedBy = req.user!.id;

  const created = await prisma.$transaction(async (tx) => {
    const plant = await tx.plantInventory.create({
      data: {
        sku: body.sku,
        commonName: body.commonName,
        variety: body.variety,
        category: body.category,
        bagSize: body.bagSize,
        currentStock: 0,
        reorderAlert: body.reorderAlert,
        costPrice: body.costPrice,
        retailPrice: body.retailPrice,
        wholesalePrice: body.wholesalePrice,
        qrCodeData: encodeLabelData({
          sku: body.sku,
          commonName: body.commonName,
          bagSize: body.bagSize,
          mrp: body.retailPrice,
        }),
      },
    });
    if (body.initialStock > 0) {
      await applyStockDelta({
        tx,
        plantId: plant.id,
        deltaQty: body.initialStock,
        actionType: 'PURCHASE',
        recordedBy,
      });
    }
    return tx.plantInventory.findUnique({ where: { id: plant.id } });
  });

  res.status(201).json({ success: true, data: created });
}

export const adjustStockSchema = z.object({
  deltaQty: z.coerce.number().int(),
  actionType: z.enum(['PURCHASE', 'MORTALITY', 'ADJUSTMENT']),
  referenceNo: z.string().optional(),
});

export async function adjustStock(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof adjustStockSchema>;
  const updated = await prisma.$transaction((tx) =>
    applyStockDelta({
      tx,
      plantId: req.params.id,
      deltaQty: body.deltaQty,
      actionType: body.actionType,
      recordedBy: req.user!.id,
      referenceNo: body.referenceNo,
    }),
  );
  res.json({ success: true, data: updated });
}

// Returns the thermal label (50x25mm) QR as PNG data URL + SVG (SOP-03).
export async function getLabel(req: Request, res: Response): Promise<void> {
  const plant = await prisma.plantInventory.findUnique({ where: { id: req.params.id } });
  if (!plant) throw ApiError.notFound('Plant not found');
  const data =
    plant.qrCodeData ??
    encodeLabelData({
      sku: plant.sku,
      commonName: plant.commonName,
      bagSize: plant.bagSize,
      mrp: String(plant.retailPrice),
    });
  const [pngDataUrl, svg] = await Promise.all([
    generateQrDataUrl(data),
    generateQrSvg(data),
  ]);
  res.json({
    success: true,
    data: {
      label: {
        sku: plant.sku,
        commonName: plant.commonName,
        bagSize: plant.bagSize,
        mrp: plant.retailPrice,
        sizeMm: '50x25',
      },
      encoded: data,
      pngDataUrl,
      svg,
    },
  });
}

export async function stockLedger(req: Request, res: Response): Promise<void> {
  const ledgers = await prisma.stockLedger.findMany({
    where: { plantId: req.params.id },
    orderBy: { timestamp: 'desc' },
    take: 100,
  });
  res.json({ success: true, data: ledgers });
}
