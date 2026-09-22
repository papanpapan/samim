import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  adjustStock,
  adjustStockSchema,
  createInventory,
  createInventorySchema,
  getLabel,
  listInventory,
  listInventorySchema,
  lookupBySku,
  stockLedger,
} from '../../controllers/plantInventory.controller';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listInventorySchema }), asyncHandler(listInventory));
router.get('/sku/:sku', asyncHandler(lookupBySku));
router.get('/:id/label', asyncHandler(getLabel));
router.get('/:id/ledger', asyncHandler(stockLedger));
router.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  validate({ body: createInventorySchema }),
  asyncHandler(createInventory),
);
router.post(
  '/:id/adjust',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: adjustStockSchema }),
  asyncHandler(adjustStock),
);

export default router;
