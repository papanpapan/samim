import { prisma } from '../config/database';
import { FEATURES } from '../constants/features';

export async function listCatalog() {
  const rows = await prisma.featureCatalog.findMany({ orderBy: { sortOrder: 'asc' } });
  if (rows.length > 0) return rows;
  return FEATURES.map((item, index) => ({
    key: item.key,
    label: item.label,
    description: null as string | null,
    system: true,
    active: true,
    sortOrder: (index + 1) * 10,
  }));
}

export async function activeFeatureKeys(): Promise<string[]> {
  const rows = await listCatalog();
  return rows.filter((row) => row.active).map((row) => row.key);
}
