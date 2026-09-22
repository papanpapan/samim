import { Request, Response } from 'express';
import { prisma } from '../config/database';

// Dashboard KPI snapshot (specification section 8 - dashboard).
export async function dashboard(_req: Request, res: Response): Promise<void> {
  const [
    motherPlants,
    activeBatches,
    inventory,
    lowStock,
    salesAgg,
    saleCount,
    vermibeds,
  ] = await Promise.all([
    prisma.motherPlant.count(),
    prisma.propagationBatch.count({ where: { stage: { not: 'CLOSED' } } }),
    prisma.plantInventory.findMany({
      select: { currentStock: true, reorderAlert: true, costPrice: true, retailPrice: true },
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "PlantInventory"
      WHERE "currentStock" <= "reorderAlert"`,
    prisma.sale.aggregate({ _sum: { netTotal: true } }),
    prisma.sale.count(),
    prisma.vermicompostBed.aggregate({ _sum: { actualYieldKg: true } }),
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
  const items = await prisma.saleItem.findMany({
    include: { plant: { select: { commonName: true, costPrice: true } } },
  });
  let revenue = 0;
  let cost = 0;
  for (const it of items) {
    revenue += Number(it.itemTotalPrice);
    cost += Number(it.plant.costPrice) * it.quantity;
  }
  res.json({
    success: true,
    data: {
      revenue: Number(revenue.toFixed(2)),
      cost: Number(cost.toFixed(2)),
      grossProfit: Number((revenue - cost).toFixed(2)),
      marginPct: revenue === 0 ? 0 : Number((((revenue - cost) / revenue) * 100).toFixed(2)),
    },
  });
}
