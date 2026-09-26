import { prisma } from '../config/database';
import { logger } from '../config/logger';

const HUMIDITY_LOW = 70;
const HUMIDITY_HIGH = 95;
const TEMP_LOW = 20;
const TEMP_HIGH = 35;

// Hourly nursery check: low stock, beds due for sieving, and mist-chamber exceptions.
export async function runOperationsCheck(): Promise<void> {
  const [lowRows, beds, readings] = await Promise.all([
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
  ]);
  const lowStock = Number(lowRows[0]?.count ?? 0);

  const exceptions = readings.filter((r) => {
    const humidity = Number(r.humidityPct);
    const temp = Number(r.temperatureC);
    return humidity < HUMIDITY_LOW || humidity > HUMIDITY_HIGH || temp < TEMP_LOW || temp > TEMP_HIGH;
  });

  logger.info('Nursery operations check', {
    bedsReady: beds,
    mistExceptions: exceptions.length,
    lowStockHint: lowStock,
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
