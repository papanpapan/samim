import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { attachTenant, requireFeature, requireNursery } from '../../middlewares/tenant.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  completeCare,
  completeCareSchema,
  createCare,
  createCareSchema,
  createDisease,
  diseaseSchema,
  listCare,
  resolveDisease,
  resolveDiseaseSchema,
} from '../../controllers/care.controller';

const router = Router();
router.use(authenticate, asyncHandler(attachTenant), requireNursery, requireFeature('CARE'));

router.get('/', asyncHandler(listCare));
router.post(
  '/',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: createCareSchema }),
  asyncHandler(createCare),
);
router.post(
  '/disease',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: diseaseSchema }),
  asyncHandler(createDisease),
);
router.post(
  '/disease/:id/resolve',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: resolveDiseaseSchema }),
  asyncHandler(resolveDisease),
);
router.post(
  '/:id/complete',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: completeCareSchema }),
  asyncHandler(completeCare),
);

export default router;
