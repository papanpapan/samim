import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { attachTenant, requireFeature, requireNursery } from '../../middlewares/tenant.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  batchLabels,
  batchTag,
  createBatch,
  createBatchSchema,
  getBatch,
  labelQuerySchema,
  listBatches,
  listClimate,
  logClimate,
  climateSchema,
  attachStockVideo,
  markReadyForSale,
  markReadySchema,
  receiveStockVideo,
  moveStage,
  moveStageSchema,
  scanCode,
} from '../../controllers/propagation.controller';

const router = Router();

router.use(authenticate, asyncHandler(attachTenant), requireNursery, requireFeature('PROPAGATION'));

router.get('/', asyncHandler(listBatches));
router.get('/scan/:code', asyncHandler(scanCode));
router.get('/:id/labels', validate({ query: labelQuerySchema }), asyncHandler(batchLabels));
router.get('/:id/tag', asyncHandler(batchTag));
router.get('/:id/climate', asyncHandler(listClimate));
router.post(
  '/:id/climate',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: climateSchema }),
  asyncHandler(logClimate),
);
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
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: markReadySchema }),
  asyncHandler(markReadyForSale),
);
router.post(
  '/stock/:plantId/video',
  authorize('ADMIN', 'MANAGER'),
  receiveStockVideo,
  asyncHandler(attachStockVideo),
);

export default router;
