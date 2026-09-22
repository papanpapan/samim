import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  createBatch,
  createBatchSchema,
  getBatch,
  listBatches,
  markReadyForSale,
  markReadySchema,
  moveStage,
  moveStageSchema,
} from '../../controllers/propagation.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listBatches));
router.get('/:id', asyncHandler(getBatch));
router.post(
  '/',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: createBatchSchema }),
  asyncHandler(createBatch),
);
router.patch(
  '/:id/stage',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: moveStageSchema }),
  asyncHandler(moveStage),
);
router.post(
  '/:id/ready',
  authorize('ADMIN', 'MANAGER'),
  validate({ body: markReadySchema }),
  asyncHandler(markReadyForSale),
);

export default router;
