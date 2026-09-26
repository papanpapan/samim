import { NextFunction, Request, Response } from 'express';
import { resolveAccess } from '../services/access.service';
import { enterNursery } from '../services/tenantContext';
import { ApiError } from '../utils/apiError';

export interface TenantContext {
  nurseryId: string | null;
  nurseryName: string | null;
  nurseryCode: string | null;
  nurseryStatus: string | null;
  isPlatformOwner: boolean;
  features: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

export async function attachTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  const header = req.header('x-nursery-id');
  const access = await resolveAccess(req.user.id, header);
  req.tenant = {
    nurseryId: access.nursery?.id ?? null,
    nurseryName: access.nursery?.name ?? null,
    nurseryCode: access.nursery?.code ?? null,
    nurseryStatus: access.nursery?.status ?? null,
    isPlatformOwner: access.isPlatformOwner,
    features: access.features,
  };
  enterNursery(access.nursery?.id ?? null);
  next();
}

export function requireNursery(req: Request, _res: Response, next: NextFunction): void {
  if (!req.tenant?.nurseryId) {
    throw ApiError.forbidden('Choose a nursery first');
  }
  next();
}

export function requireFeature(feature: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.tenant?.isPlatformOwner) {
      next();
      return;
    }
    if (!req.tenant?.features.includes(feature)) {
      throw ApiError.forbidden('This feature is not enabled for this account');
    }
    next();
  };
}

export function requirePlatformOwner(req: Request, _res: Response, next: NextFunction): void {
  if (!req.tenant?.isPlatformOwner) {
    throw ApiError.forbidden('Only the platform owner can do this');
  }
  next();
}
