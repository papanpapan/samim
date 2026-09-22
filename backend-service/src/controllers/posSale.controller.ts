import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma, SalesChannel, PaymentMode } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/apiError';
import { applyStockDelta } from '../services/stockLedger.service';
import { wholesaleDiscountPct } from '../constants/businessRules';

export const createSaleSchema = z.object({
  channel: z.nativeEnum(SalesChannel).default(SalesChannel.RETAIL_COUNTER),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  customerCity: z.string().optional(),
  paymentMode: z.nativeEnum(PaymentMode).default(PaymentMode.CASH),
  items: z
    .array(
      z.object({
        plantId: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
      }),
    )
    .min(1),
});

async function nextInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const count = await tx.sale.count({ where: { invoiceNumber: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

// High-speed checkout: prices items by channel, applies wholesale tiers,
// decrements stock atomically and writes the immutable ledger (FR-POS-01).
export async function createSale(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof createSaleSchema>;
  const recordedBy = req.user!.id;
  const isWholesale = body.channel === SalesChannel.WHOLESALE_ORCHARDIST;

  const sale = await prisma.$transaction(async (tx) => {
    const totalQty = body.items.reduce((sum, i) => sum + i.quantity, 0);
    const discountPct = isWholesale ? wholesaleDiscountPct(totalQty) : 0;

    let subTotal = 0;
    const lineItems: {
      plantId: string;
      quantity: number;
      unitPrice: number;
      itemTotalPrice: number;
    }[] = [];

    for (const item of body.items) {
      const plant = await tx.plantInventory.findUnique({ where: { id: item.plantId } });
      if (!plant) throw ApiError.notFound(`Plant ${item.plantId} not found`);
      const unitPrice = Number(
        isWholesale ? plant.wholesalePrice : plant.retailPrice,
      );
      const itemTotal = unitPrice * item.quantity;
      subTotal += itemTotal;
      lineItems.push({
        plantId: item.plantId,
        quantity: item.quantity,
        unitPrice,
        itemTotalPrice: itemTotal,
      });
    }

    const discountAmount = (subTotal * discountPct) / 100;
    const netTotal = subTotal - discountAmount;
    const invoiceNumber = await nextInvoiceNumber(tx);

    const created = await tx.sale.create({
      data: {
        invoiceNumber,
        channel: body.channel,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerCity: body.customerCity,
        paymentMode: body.paymentMode,
        subTotal,
        discountAmount,
        netTotal,
        items: { create: lineItems },
      },
      include: { items: { include: { plant: true } } },
    });

    // Decrement stock atomically; raises 409 if insufficient (NFR-ACID-01).
    for (const item of body.items) {
      await applyStockDelta({
        tx,
        plantId: item.plantId,
        deltaQty: -item.quantity,
        actionType: 'SALE',
        recordedBy,
        referenceNo: invoiceNumber,
      });
    }

    return { created, discountPct };
  });

  res.status(201).json({
    success: true,
    data: sale.created,
    meta: { discountPct: sale.discountPct },
  });
}

export async function listSales(_req: Request, res: Response): Promise<void> {
  const sales = await prisma.sale.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { items: true },
  });
  res.json({ success: true, data: sales });
}

export async function getSale(req: Request, res: Response): Promise<void> {
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { plant: true } } },
  });
  if (!sale) throw ApiError.notFound('Sale not found');
  res.json({ success: true, data: sale });
}
