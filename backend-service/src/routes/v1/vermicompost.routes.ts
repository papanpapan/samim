import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { attachTenant, requireFeature, requireNursery } from '../../middlewares/tenant.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  createBed,
  createBedSchema,
  harvestBed,
  harvestSchema,
  listBeds,
  listMoisture,
  logMoisture,
  moistureSchema,
} from '../../controllers/vermicompost.controller';

const router = Router();

router.use(authenticate, asyncHandler(attachTenant), requireNursery, requireFeature('VERMICOMPOST'));

router.get('/', asyncHandler(listBeds));
router.post(
  '/',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: createBedSchema }),
  asyncHandler(createBed),
);
router.post(
  '/:id/harvest',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: harvestSchema }),
  asyncHandler(harvestBed),
);
router.get('/:id/moisture', asyncHandler(listMoisture));
router.post(
  '/:id/moisture',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: moistureSchema }),
  asyncHandler(logMoisture),
);

export default router;
