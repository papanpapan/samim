import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { attachTenant, requireFeature, requireNursery } from '../../middlewares/tenant.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  createUser,
  login,
  loginSchema,
  me,
  registerSchema,
  roleSchema,
  updateUserRole,
} from '../../controllers/auth.controller';
import { listUsers } from '../../controllers/admin.controller';

const router = Router();

/** Stricter than global API limit — slows password guessing. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

router.post('/login', loginLimiter, validate({ body: loginSchema }), asyncHandler(login));
router.get('/me', authenticate, asyncHandler(attachTenant), asyncHandler(me));
router.get('/users', authenticate, asyncHandler(attachTenant), requireNursery, requireFeature('NURSERY_ADMIN'), authorize('ADMIN'), asyncHandler(listUsers));
router.post(
  '/users',
  authenticate,
  asyncHandler(attachTenant),
  requireNursery,
  requireFeature('NURSERY_ADMIN'),
  authorize('ADMIN'),
  validate({ body: registerSchema }),
  asyncHandler(createUser),
);
router.patch(
  '/users/:id',
  authenticate,
  asyncHandler(attachTenant),
  requireNursery,
  requireFeature('NURSERY_ADMIN'),
  authorize('ADMIN'),
  validate({ body: roleSchema }),
  asyncHandler(updateUserRole),
);

export default router;
