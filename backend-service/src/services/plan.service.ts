import { prisma } from '../config/database';
import { ApiError } from '../utils/apiError';

const PLANS = ['FREE', 'SILVER', 'GOLDEN', 'PLATINUM'] as const;
export type PlanCode = (typeof PLANS)[number];

export function isPlanCode(value: string): value is PlanCode {
  return (PLANS as readonly string[]).includes(value);
}

export async function listPackages() {
  const rows = await prisma.packagePlan.findMany({ orderBy: { sortOrder: 'asc' } });
  return rows.map((row) => ({
    code: row.code,
    label: row.label,
    price: Number(row.price),
    userLimit: row.userLimit,
    plantLimit: row.plantLimit,
  }));
}

export async function uniqueNurseryCode(name: string): Promise<string> {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'NUR';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const code = `${base}-${suffix}`;
    const existing = await prisma.nursery.findUnique({ where: { code } });
    if (!existing) return code;
  }
  return `NUR-${Date.now().toString(36).toUpperCase()}`;
}

export async function assertUserCapacity(nurseryId: string): Promise<void> {
  const nursery = await prisma.nursery.findUnique({ where: { id: nurseryId } });
  if (!nursery || nursery.userLimit <= 0) return;
  const count = await prisma.user.count({
    where: { nurseryId, isActive: true, isPlatformOwner: false },
  });
  if (count >= nursery.userLimit) {
    throw ApiError.forbidden(`This plan allows ${nursery.userLimit} people.`);
  }
}

export async function assertPlantCapacity(nurseryId: string): Promise<void> {
  const nursery = await prisma.nursery.findUnique({ where: { id: nurseryId } });
  if (!nursery || nursery.plantLimit <= 0) return;
  const count = await prisma.plantInventory.count({ where: { nurseryId } });
  if (count >= nursery.plantLimit) {
    throw ApiError.forbidden(`This plan allows ${nursery.plantLimit} plant records.`);
  }
}
