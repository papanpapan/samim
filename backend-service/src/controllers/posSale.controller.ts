import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma, PaymentMode } from '@prisma/client';
import { prisma } from '../config/database';
import { withNursery } from '../services/tenantContext';
import { ApiError } from '../utils/apiError';
import { applyStockDelta } from '../services/stockLedger.service';
import { NURSERY_UPI_VPA, wholesaleDiscountPct } from '../constants/businessRules';
import { generateQrDataUrl } from '../services/qrEngine.service';
import { writeAudit } from '../services/audit.service';
import { enabledChannels } from '../services/channelAccess.service';
import { currentNurseryId } from '../services/tenantContext';

export const createSaleSchema = z.object({
  channel: z.string().regex(/^[A-Z][A-Z0-9_]{1,31}$/).default('RETAIL_COUNTER'),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  customerCity: z.string().optional(),
  paymentMode: z.nativeEnum(PaymentMode).default(PaymentMode.CASH),
  /** GST / VAT percent on (subTotal − discount). Testing-phase local calc only — not IRP e-invoice. */
  taxPct: z.coerce.number().min(0).max(28).default(0),
  items: z
    .array(
      z.object({
        plantId: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
      }),
    )
    .min(1),
});

async function nextInvoiceNumber(tx: { sale: { count: (args: { where: { invoiceNumber: { startsWith: string } } }) => Promise<number> } }): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const count = await tx.sale.count({ where: { invoiceNumber: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

// High-speed checkout: prices items by channel, applies wholesale tiers,
// decrements stock atomically and writes the immutable ledger (FR-POS-01).
export async function createSale(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof createSaleSchema>;
  const nurseryId = currentNurseryId();
  if (nurseryId) {
    const allowed = await enabledChannels(nurseryId);
    if (!allowed.includes(body.channel)) {
      throw ApiError.badRequest('This nursery cannot sell on that channel');
    }
  }
  const recordedBy = req.user!.id;
  const isWholesale = body.channel === 'WHOLESALE_ORCHARDIST';

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
      const offer = await tx.plantChannelPrice.findUnique({
        where: { plantId_channel: { plantId: plant.id, channel: body.channel } },
      });
      const unitPrice = offer
        ? Number(offer.price)
        : Number(isWholesale ? plant.wholesalePrice : plant.retailPrice);
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
    const taxable = subTotal - discountAmount;
    const taxPct = body.taxPct ?? 0;
    const taxAmount = Math.round(((taxable * taxPct) / 100) * 100) / 100;
    const netTotal = taxable + taxAmount;
    const invoiceNumber = await nextInvoiceNumber(tx);

    const created = await tx.sale.create({
      data: withNursery({
        invoiceNumber,
        channel: body.channel,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerCity: body.customerCity,
        paymentMode: body.paymentMode,
        subTotal,
        discountAmount,
        taxPct,
        taxAmount,
        netTotal,
        items: { create: lineItems },
      }),
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

    return { created, discountPct, taxPct };
  });

  await writeAudit(recordedBy, 'SALE', 'Sale', sale.created.id, {
    invoiceNumber: sale.created.invoiceNumber,
    netTotal: Number(sale.created.netTotal),
  });

  res.status(201).json({
    success: true,
    data: sale.created,
    meta: { discountPct: sale.discountPct, taxPct: sale.taxPct },
  });
}

export const upiQrSchema = z.object({
  amount: z.coerce.number().positive(),
});

export async function upiQr(req: Request, res: Response): Promise<void> {
  const amount = Number(req.query.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw ApiError.badRequest('A positive amount is required');
  }
  const payload = `upi://pay?pa=${encodeURIComponent(NURSERY_UPI_VPA)}&pn=${encodeURIComponent('Saba Nursery')}&am=${amount.toFixed(2)}&cu=INR`;
  const qrDataUrl = await generateQrDataUrl(payload);
  res.json({ success: true, data: { vpa: NURSERY_UPI_VPA, amount, qrDataUrl } });
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
