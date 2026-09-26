import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { currentNurseryId, withNursery } from '../services/tenantContext';
import { assertPlantCapacity } from '../services/plan.service';
import { ApiError } from '../utils/apiError';
import {
  encodeLabelData,
  generateQrDataUrl,
  generateQrSvg,
} from '../services/qrEngine.service';
import { applyStockDelta } from '../services/stockLedger.service';
import { phoneOrigin, safeOrigin } from '../utils/lanOrigin';
import { enabledChannels } from '../services/channelAccess.service';

const inventoryInclude = {
  photos: { orderBy: { createdAt: 'asc' as const } },
  channelPrices: { orderBy: { channel: 'asc' as const } },
};

export const listInventorySchema = z.object({
  search: z.string().optional(),
  lowStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

function presentInventory(plant: {
  retailPrice: { toString(): string };
  wholesalePrice: { toString(): string };
  costPrice: { toString(): string };
  videoStoredName: string | null;
  photos: { id: string; storedName: string }[];
  channelPrices?: { channel: string; price: { toString(): string } }[];
}) {
  return {
    ...plant,
    retailPrice: Number(plant.retailPrice),
    wholesalePrice: Number(plant.wholesalePrice),
    costPrice: Number(plant.costPrice),
    channelPrices: (plant.channelPrices ?? []).map((row) => ({ channel: row.channel, price: Number(row.price) })),
    videoUrl: plant.videoStoredName ? `/api/uploads/stock/${plant.videoStoredName}` : null,
    photos: plant.photos.map((photo) => ({ id: photo.id, url: `/api/uploads/stock/${photo.storedName}` })),
  };
}

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
    include: inventoryInclude,
  });
  res.json({ success: true, data: items.map(presentInventory) });
}

// Fast SKU/barcode lookup for the POS scanner (FR-QR-01, target < 200ms).
export async function lookupBySku(req: Request, res: Response): Promise<void> {
  const sku = req.params.sku;
  const plant = await prisma.plantInventory.findFirst({ where: { sku } });
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
  const nurseryId = currentNurseryId();
  if (nurseryId) await assertPlantCapacity(nurseryId);

  const created = await prisma.$transaction(async (tx) => {
    const plant = await tx.plantInventory.create({
      data: withNursery({
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
      }),
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

export const inventoryPriceSchema = z.object({
  offers: z.array(z.object({
    channel: z.string().regex(/^[A-Z][A-Z0-9_]{1,31}$/),
    price: z.coerce.number().nonnegative(),
  })).min(1).max(40),
});

export async function updateInventoryPrice(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof inventoryPriceSchema>;
  const offers = new Map(body.offers.map((offer) => [offer.channel, offer.price]));
  const nurseryIdForChannels = currentNurseryId();
  if (nurseryIdForChannels) {
    const allowed = new Set(await enabledChannels(nurseryIdForChannels));
    if ([...offers.keys()].some((channel) => !allowed.has(channel))) {
      throw ApiError.badRequest('This nursery cannot price that sales channel');
    }
  }
  const plant = await prisma.plantInventory.findUnique({
    where: { id: req.params.id },
    include: { batch: { select: { batchCode: true } } },
  });
  if (!plant) throw ApiError.notFound('Plant not found');
  const nurseryId = plant.nurseryId;
  const retail = offers.get('RETAIL_COUNTER');
  const wholesale = offers.get('WHOLESALE_ORCHARDIST');
  const updated = await prisma.$transaction(async (tx) => {
    for (const [channel, price] of offers) {
      await tx.plantChannelPrice.upsert({
        where: { plantId_channel: { plantId: plant.id, channel } },
        create: { nurseryId, plantId: plant.id, channel, price },
        update: { price },
      });
    }
    return tx.plantInventory.update({
      where: { id: plant.id },
      data: {
        ...(retail != null
          ? {
              retailPrice: retail,
              qrCodeData: encodeLabelData({
                sku: plant.sku,
                commonName: plant.commonName,
                bagSize: plant.bagSize,
                mrp: retail,
                batchCode: plant.batch?.batchCode,
              }),
            }
          : {}),
        ...(wholesale != null ? { wholesalePrice: wholesale } : {}),
      },
      include: inventoryInclude,
    });
  });
  res.json({ success: true, data: presentInventory(updated) });
}

export const inventoryDetailsSchema = z.object({
  plantHeight: z.string().max(40).optional(),
  plantAge: z.string().max(40).optional(),
  zoneLabel: z.string().max(80).optional(),
  reservedQty: z.coerce.number().int().nonnegative().optional(),
  reorderAlert: z.coerce.number().int().nonnegative().optional(),
  wholesalePrice: z.coerce.number().nonnegative().optional(),
});

export async function updateInventoryDetails(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof inventoryDetailsSchema>;
  const plant = await prisma.plantInventory.findUnique({ where: { id: req.params.id } });
  if (!plant) throw ApiError.notFound('Plant not found');
  if (body.reservedQty != null && body.reservedQty > plant.currentStock) {
    throw ApiError.badRequest('Reserved quantity cannot be more than the plants in stock');
  }
  if (body.wholesalePrice != null) {
    await prisma.plantChannelPrice.upsert({
      where: { plantId_channel: { plantId: plant.id, channel: 'WHOLESALE_ORCHARDIST' } },
      create: { nurseryId: plant.nurseryId, plantId: plant.id, channel: 'WHOLESALE_ORCHARDIST', price: body.wholesalePrice },
      update: { price: body.wholesalePrice },
    });
  }
  const updated = await prisma.plantInventory.update({
    where: { id: plant.id },
    data: {
      plantHeight: body.plantHeight?.trim() || null,
      plantAge: body.plantAge?.trim() || null,
      zoneLabel: body.zoneLabel?.trim() || null,
      ...(body.reservedQty != null ? { reservedQty: body.reservedQty } : {}),
      ...(body.reorderAlert != null ? { reorderAlert: body.reorderAlert } : {}),
      ...(body.wholesalePrice != null ? { wholesalePrice: body.wholesalePrice } : {}),
    },
    include: inventoryInclude,
  });
  res.json({ success: true, data: presentInventory(updated) });
}

async function ensureShareCode(plantId: string, current: string | null) {
  if (current) return current;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shareCode = randomBytes(6).toString('hex');
    const taken = await prisma.plantInventory.findFirst({ where: { shareCode } });
    if (taken) continue;
    await prisma.plantInventory.update({ where: { id: plantId }, data: { shareCode } });
    return shareCode;
  }
  throw ApiError.badRequest('Could not create a customer code');
}

export const labelSheetSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(48),
});

export async function inventoryLabelSheet(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof labelSheetSchema>;
  const origin = phoneOrigin(safeOrigin(req.query.origin));
  const plants = await prisma.plantInventory.findMany({ where: { id: { in: body.ids } } });
  const labels = [];
  for (const plant of plants) {
    const shareCode = await ensureShareCode(plant.id, plant.shareCode);
    const publicUrl = origin ? `${origin}/stock/${shareCode}` : '';
    labels.push({
      id: plant.id,
      sku: plant.sku,
      commonName: plant.commonName,
      variety: plant.variety,
      bagSize: plant.bagSize,
      zoneLabel: plant.zoneLabel,
      retailPrice: Number(plant.retailPrice),
      wholesalePrice: Number(plant.wholesalePrice),
      publicUrl,
      qrDataUrl: publicUrl ? await generateQrDataUrl(publicUrl) : '',
    });
  }
  res.json({ success: true, data: { labels } });
}

function scanToken(raw: string) {
  const trimmed = raw.trim();
  const sku = trimmed.match(/SKU:([^|]+)/)?.[1];
  const share = trimmed.includes('/stock/') ? trimmed.split('/stock/').pop()?.split(/[?#]/)[0] : undefined;
  return { trimmed, sku, share };
}

export async function scanInventory(req: Request, res: Response): Promise<void> {
  const token = scanToken(req.params.code);
  const plant = await prisma.plantInventory.findFirst({
    where: {
      OR: [
        { sku: token.trimmed },
        ...(token.sku ? [{ sku: token.sku }] : []),
        ...(token.share ? [{ shareCode: token.share }] : []),
        { shareCode: token.trimmed },
      ],
    },
    include: { photos: { orderBy: { createdAt: 'asc' }, take: 1 }, channelPrices: { orderBy: { channel: 'asc' } } },
  });
  if (!plant) throw ApiError.notFound('Stock not found');
  res.json({
    success: true,
    data: {
      ...presentInventory(plant),
      available: Math.max(0, plant.currentStock - plant.reservedQty),
    },
  });
}

export async function customerTag(req: Request, res: Response): Promise<void> {
  const plant = await prisma.plantInventory.findUnique({ where: { id: req.params.id } });
  if (!plant?.shareCode) throw ApiError.notFound('Customer page is not ready');
  const origin = phoneOrigin(safeOrigin(req.query.origin));
  const publicUrl = origin ? `${origin}/stock/${plant.shareCode}` : '';
  res.json({
    success: true,
    data: {
      sku: plant.sku,
      publicUrl,
      qrDataUrl: publicUrl ? await generateQrDataUrl(publicUrl) : '',
    },
  });
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
  const shareCode = await ensureShareCode(plant.id, plant.shareCode);
  const origin = phoneOrigin(safeOrigin(req.query.origin));
  const data = origin
    ? `${origin}/stock/${shareCode}`
    : plant.qrCodeData ??
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
