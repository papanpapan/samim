import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  createBed,
  createBedSchema,
  harvestBed,
  harvestSchema,
  listBeds,
} from '../../controllers/vermicompost.controller';

const router = Router();

router.use(authenticate);

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

export default router;
