import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  createMotherPlant,
  createMotherPlantSchema,
  getMotherPlant,
  listMotherPlants,
  logScionHarvest,
  scionSchema,
} from '../../controllers/motherPlant.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listMotherPlants));
router.get('/:id', asyncHandler(getMotherPlant));
router.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  validate({ body: createMotherPlantSchema }),
  asyncHandler(createMotherPlant),
);
router.post(
  '/:id/scions',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: scionSchema }),
  asyncHandler(logScionHarvest),
);

export default router;
