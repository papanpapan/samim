import { PrismaClient } from '@prisma/client';
import { env } from './environment';
import { currentNurseryId } from '../services/tenantContext';
import { ApiError } from '../utils/apiError';

const base = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/** Unscoped client — skips the tenant nursery filter. Use only for cross-nursery lookups. */
export const prismaBase = base;

const TENANT_MODELS = new Set([
  'MotherPlant',
  'PropagationBatch',
  'PropagationUnit',
  'PlantInventory',
  'MarketingMedia',
  'PlantChannelPrice',
  'VermicompostBed',
  'Sale',
  'CareSchedule',
  'Expense',
  'Booking',
  'TransportManifest',
  'MarketplaceLead',
  'DiseaseLog',
  'AuditLog',
  'LiveCamera',
  'CameraZone',
  'DangerAlert',
  'TreatmentPlan',
  'PlantIdentification',
  'FeatureNote',
]);

const FILTERED = new Set([
  'findMany',
  'findFirst',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

function delegate(model: string) {
  const key = model.charAt(0).toLowerCase() + model.slice(1);
  return (base as unknown as Record<string, { findFirst: (args: object) => Promise<{ nurseryId?: string | null } | null> }>)[key];
}

/**
 * findUnique compound keys (e.g. plantId_channel: { plantId, channel }) are not valid
 * in findFirst. Flatten them before the tenant ownership check.
 */
function flattenCompoundUniqueWhere(where: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!where) return {};
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(where)) {
    const isCompound =
      key.includes('_')
      && key !== 'AND'
      && key !== 'OR'
      && key !== 'NOT'
      && typeof value === 'object'
      && value !== null
      && !Array.isArray(value)
      && Object.values(value as Record<string, unknown>).every(
        (entry) =>
          entry === null
          || typeof entry === 'string'
          || typeof entry === 'number'
          || typeof entry === 'boolean'
          || typeof entry === 'bigint'
          || entry instanceof Date,
      );
    if (isCompound) {
      Object.assign(flat, value as object);
    } else {
      flat[key] = value;
    }
  }
  return flat;
}

export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const nurseryId = currentNurseryId();
        if (!model || !TENANT_MODELS.has(model) || !nurseryId) {
          return query(args);
        }
        const scoped = args as { where?: Record<string, unknown>; data?: unknown };

        if (operation === 'create' && scoped.data && typeof scoped.data === 'object' && !Array.isArray(scoped.data)) {
          scoped.data = { ...(scoped.data as object), nurseryId };
        }
        if (operation === 'createMany' && Array.isArray(scoped.data)) {
          scoped.data = scoped.data.map((row) => ({ ...(row as object), nurseryId }));
        }
        if (FILTERED.has(operation)) {
          scoped.where = { AND: [scoped.where ?? {}, { nurseryId }] };
        }
        if (operation === 'findUnique' || operation === 'update' || operation === 'delete' || operation === 'upsert') {
          const existing = await delegate(model).findFirst({
            where: flattenCompoundUniqueWhere(scoped.where),
            select: { nurseryId: true },
          });
          if (existing && existing.nurseryId && existing.nurseryId !== nurseryId) {
            throw ApiError.notFound('Record not found');
          }
          if (operation === 'upsert') {
            const upsertArgs = args as { create?: Record<string, unknown> };
            if (upsertArgs.create) upsertArgs.create = { ...upsertArgs.create, nurseryId };
          }
        }
        return query(args);
      },
    },
  },
});

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
