import { prisma } from '../config/database';
import { FEATURE_KEYS } from '../constants/features';
import { activeFeatureKeys } from './catalog.service';
import { ApiError } from '../utils/apiError';

export interface NurserySnapshot {
  id: string;
  name: string;
  code: string;
  status: string;
  currencyCode: string;
}

export interface AccessProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  isPlatformOwner: boolean;
  nursery: NurserySnapshot | null;
  features: string[];
}

function effectiveFeatures(
  nurseryFeatures: { feature: string; enabled: boolean }[],
  roleGrants: { feature: string; enabled: boolean }[],
  grants: { feature: string; enabled: boolean }[],
  isPlatformOwner: boolean,
  allowedKeys: Set<string>,
): string[] {
  const nurseryOn = nurseryFeatures
    .filter((row) => row.enabled && allowedKeys.has(row.feature))
    .map((row) => row.feature);
  if (isPlatformOwner) return [...allowedKeys];
  let allowed = nurseryOn;
  if (roleGrants.length > 0) {
    const roleOn = new Set(roleGrants.filter((row) => row.enabled).map((row) => row.feature));
    allowed = allowed.filter((feature) => roleOn.has(feature));
  }
  if (grants.length > 0) {
    const userOn = new Set(grants.filter((row) => row.enabled).map((row) => row.feature));
    allowed = allowed.filter((feature) => userOn.has(feature));
  }
  return allowed;
}

export async function resolveAccess(userId: string, nurseryHeader?: string | null): Promise<AccessProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { featureGrants: true },
  });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  let nurseryId = user.nurseryId;
  if (user.isPlatformOwner && nurseryHeader) {
    nurseryId = nurseryHeader;
  }

  let nursery: NurserySnapshot | null = null;
  let features: string[] = [];
  const allowedKeys = new Set(await activeFeatureKeys());
  if (nurseryId) {
    const row = await prisma.nursery.findUnique({
      where: { id: nurseryId },
      include: { features: true, roleFeatures: { where: { role: user.role } } },
    });
    if (!row) {
      throw ApiError.notFound('Nursery not found');
    }
    if (!user.isPlatformOwner && user.nurseryId !== row.id) {
      throw ApiError.forbidden('This account belongs to another nursery');
    }
    if (!user.isPlatformOwner && row.status !== 'ACTIVE') {
      throw ApiError.forbidden('This nursery is suspended. Ask the platform owner.');
    }
    nursery = {
      id: row.id,
      name: row.name,
      code: row.code,
      status: row.status,
      currencyCode: row.currencyCode === 'INR' ? 'INR' : 'BDT',
    };
    features = effectiveFeatures(row.features, row.roleFeatures, user.featureGrants, user.isPlatformOwner, allowedKeys);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isPlatformOwner: user.isPlatformOwner,
    nursery,
    features,
  };
}

export function blankFeatureRows(enabled: string[] = FEATURE_KEYS) {
  const on = new Set(enabled);
  return FEATURE_KEYS.map((feature) => ({ feature, enabled: on.has(feature) }));
}
