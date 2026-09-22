import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { ApiError } from '../utils/apiError';

// Role based access control (ADMIN, MANAGER, STAFF, CASHIER).
export function authorize(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    if (!allowed.includes(req.user.role)) {
      throw ApiError.forbidden(
        `Role ${req.user.role} is not permitted to perform this action`,
      );
    }
    next();
  };
}
