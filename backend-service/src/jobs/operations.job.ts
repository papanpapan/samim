import { prisma } from '../config/database';
import { logger } from '../config/logger';

const HUMIDITY_LOW = 70;
const HUMIDITY_HIGH = 95;
const TEMP_LOW = 20;
const TEMP_HIGH = 35;

/** Days in stage before auto-advance (variety-agnostic defaults; override later per cultivar). */
const DAYS_TO_MIST = 3;
const DAYS_TO_HARDEN = 14;
const DAYS_TO_READY = 21;

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function autoAdvanceBatches(): Promise<number> {
  let moved = 0;
  const mistDue = await prisma.propagationBatch.findMany({
    where: { stage: 'INITIATED', startDate: { lte: daysAgo(DAYS_TO_MIST) } },
    take: 40,
  });
  for (const batch of mistDue) {
    await prisma.propagationBatch.update({
      where: { id: batch.id },
      data: { stage: 'MIST_CHAMBER', mistChamberDate: new Date() },
    });
    moved += 1;
  }

  const hardenDue = await prisma.propagationBatch.findMany({
    where: {
      stage: 'MIST_CHAMBER',
      OR: [
        { mistChamberDate: { lte: daysAgo(DAYS_TO_HARDEN) } },
        { mistChamberDate: null, startDate: { lte: daysAgo(DAYS_TO_MIST + DAYS_TO_HARDEN) } },
      ],
    },
    take: 40,
  });
  for (const batch of hardenDue) {
    await prisma.propagationBatch.update({
      where: { id: batch.id },
      data: { stage: 'HARDENING_SHADE', hardeningDate: new Date() },
    });
    moved += 1;
  }

  const readyDue = await prisma.propagationBatch.findMany({
    where: {
      stage: 'HARDENING_SHADE',
      OR: [
        { hardeningDate: { lte: daysAgo(DAYS_TO_READY) } },
        { hardeningDate: null, startDate: { lte: daysAgo(DAYS_TO_MIST + DAYS_TO_HARDEN + DAYS_TO_READY) } },
      ],
    },
    take: 40,
  });
  for (const batch of readyDue) {
    // Flag stage READY — stock create still happens via explicit Ready-for-sale API (photos/SKU).
    await prisma.propagationBatch.update({
      where: { id: batch.id },
      data: { stage: 'READY_FOR_SALE', readyDate: new Date() },
    });
    moved += 1;
  }
  return moved;
}

async function smartReorderHints(): Promise<number> {
  const low = await prisma.plantInventory.findMany({
    where: {},
    take: 200,
  });
  let n = 0;
  for (const plant of low) {
    if (plant.currentStock > plant.reorderAlert) continue;
    n += 1;
    logger.info('Low stock reorder hint', {
      sku: plant.sku,
      stock: plant.currentStock,
      reorderAlert: plant.reorderAlert,
      nurseryId: plant.nurseryId,
    });
  }
  return n;
}

/** Open-Meteo free weather (no key) — adjusts care task notes for today. */
async function weatherCareAdjust(): Promise<void> {
  try {
    const nurseries = await prisma.nursery.findMany({
      where: { status: 'ACTIVE', latitude: { not: null }, longitude: { not: null } },
      select: { id: true, latitude: true, longitude: true, name: true },
      take: 20,
    });
    for (const nursery of nurseries) {
      if (nursery.latitude == null || nursery.longitude == null) continue;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${nursery.latitude}&longitude=${nursery.longitude}&current=temperature_2m,precipitation&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        current?: { temperature_2m?: number; precipitation?: number };
      };
      const temp = data.current?.temperature_2m;
      const rain = data.current?.precipitation ?? 0;
      logger.info('Weather sync', {
        nursery: nursery.name,
        temp,
        rain,
        skipWateringHint: rain > 2,
        heatSprayHint: typeof temp === 'number' && temp >= 36,
      });
    }
  } catch (err) {
    logger.warn('Weather sync skipped', { error: err instanceof Error ? err.message : err });
  }
}

// Hourly nursery check: low stock, beds due, mist exceptions, stage auto-advance, weather.
export async function runOperationsCheck(): Promise<void> {
  const [lowRows, beds, readings, stagesMoved, reorderHints] = await Promise.all([
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "PlantInventory"
      WHERE "currentStock" <= "reorderAlert"`,
    prisma.vermicompostBed.count({
      where: { harvestedDate: null, expectedDate: { lte: new Date() } },
    }),
    prisma.mistReading.findMany({
      orderBy: { recordedAt: 'desc' },
      distinct: ['batchId'],
      take: 50,
    }),
    autoAdvanceBatches(),
    smartReorderHints(),
  ]);
  const lowStock = Number(lowRows[0]?.count ?? 0);

  const exceptions = readings.filter((r) => {
    const humidity = Number(r.humidityPct);
    const temp = Number(r.temperatureC);
    return humidity < HUMIDITY_LOW || humidity > HUMIDITY_HIGH || temp < TEMP_LOW || temp > TEMP_HIGH;
  });

  await weatherCareAdjust();

  logger.info('Nursery operations check', {
    bedsReady: beds,
    mistExceptions: exceptions.length,
    lowStockHint: lowStock,
    stagesAutoMoved: stagesMoved,
    reorderHints,
  });
}

export function startOperationsScheduler(): void {
  const hour = 60 * 60 * 1000;
  void runOperationsCheck().catch((err) => {
    logger.error('Operations check failed', { error: err instanceof Error ? err.message : err });
  });
  setInterval(() => {
    void runOperationsCheck().catch((err) => {
      logger.error('Operations check failed', { error: err instanceof Error ? err.message : err });
    });
  }, hour);
}
