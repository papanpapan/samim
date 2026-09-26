import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { currentNurseryId } from '../services/tenantContext';
import { ApiError } from '../utils/apiError';

// Dashboard KPI snapshot (specification section 8 - dashboard).
export async function dashboard(_req: Request, res: Response): Promise<void> {
  const nurseryId = currentNurseryId();
  if (!nurseryId) throw ApiError.forbidden('Choose a nursery first');
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const [
    motherPlants,
    activeBatches,
    inventory,
    lowStock,
    salesAgg,
    saleCount,
    vermibeds,
    pendingCare,
    bedsReady,
    openBookings,
    newLeads,
    expenseAgg,
    openDangerAlerts,
    attentionBatches,
    unhealthyMothers,
  ] = await Promise.all([
    prisma.motherPlant.count(),
    prisma.propagationBatch.count({ where: { stage: { not: 'CLOSED' } } }),
    prisma.plantInventory.findMany({
      select: { currentStock: true, reorderAlert: true, costPrice: true, retailPrice: true },
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "PlantInventory"
      WHERE "nurseryId" = ${nurseryId}
        AND "currentStock" <= "reorderAlert"`,
    prisma.sale.aggregate({ _sum: { netTotal: true } }),
    prisma.sale.count(),
    prisma.vermicompostBed.aggregate({ _sum: { actualYieldKg: true } }),
    prisma.careSchedule.count({ where: { status: 'PENDING', scheduledOn: { lte: endOfToday } } }),
    prisma.vermicompostBed.count({ where: { harvestedDate: null, expectedDate: { lte: new Date() } } }),
    prisma.booking.count({ where: { status: { in: ['PENDING', 'CONFIRMED'] } } }),
    prisma.marketplaceLead.count({ where: { status: 'NEW' } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
    prisma.dangerAlert.count({ where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } } }),
    prisma.propagationBatch.count({
      where: { stage: { in: ['HARDENING_SHADE', 'READY_FOR_SALE'] } },
    }),
    prisma.motherPlant.count({ where: { healthStatus: { not: 'HEALTHY' } } }),
  ]);

  const totalStockUnits = inventory.reduce((s, p) => s + p.currentStock, 0);
  const stockValueCost = inventory.reduce(
    (s, p) => s + p.currentStock * Number(p.costPrice),
    0,
  );
  const stockValueRetail = inventory.reduce(
    (s, p) => s + p.currentStock * Number(p.retailPrice),
    0,
  );

  res.json({
    success: true,
    data: {
      motherPlants,
      activeBatches,
      skuCount: inventory.length,
      totalStockUnits,
      lowStockCount: Number(lowStock[0]?.count ?? 0),
      totalSalesValue: Number(salesAgg._sum.netTotal ?? 0),
      salesCount: saleCount,
      vermicompostYieldKg: Number(vermibeds._sum.actualYieldKg ?? 0),
      pendingCare,
      bedsReady,
      openBookings,
      newLeads,
      openDangerAlerts,
      attentionBatches,
      unhealthyMothers,
      operatingExpenses: Number(expenseAgg._sum.amount ?? 0),
      inventoryValuation: {
        cost: Number(stockValueCost.toFixed(2)),
        retail: Number(stockValueRetail.toFixed(2)),
        potentialProfit: Number((stockValueRetail - stockValueCost).toFixed(2)),
      },
    },
  });
}

// Profitability per sale item: revenue vs cost (Financial Ledger domain).
export async function profitability(_req: Request, res: Response): Promise<void> {
  const nurseryId = currentNurseryId();
  if (!nurseryId) throw ApiError.forbidden('Choose a nursery first');
  const items = await prisma.saleItem.findMany({
    where: { sale: { nurseryId } },
    include: { plant: { select: { commonName: true, costPrice: true } } },
  });
  const expenseAgg = await prisma.expense.aggregate({ _sum: { amount: true } });
  const expenses = Number(expenseAgg._sum.amount ?? 0);
  let revenue = 0;
  let cost = 0;
  for (const it of items) {
    revenue += Number(it.itemTotalPrice);
    cost += Number(it.plant.costPrice) * it.quantity;
  }
  const grossProfit = revenue - cost - expenses;
  res.json({
    success: true,
    data: {
      revenue: Number(revenue.toFixed(2)),
      cost: Number(cost.toFixed(2)),
      expenses: Number(expenses.toFixed(2)),
      grossProfit: Number(grossProfit.toFixed(2)),
      marginPct: revenue === 0 ? 0 : Number(((grossProfit / revenue) * 100).toFixed(2)),
    },
  });
}
