import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { attachTenant, requireFeature, requireNursery } from '../../middlewares/tenant.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  adjustStock,
  adjustStockSchema,
  customerTag,
  createInventory,
  createInventorySchema,
  getLabel,
  inventoryDetailsSchema,
  inventoryLabelSheet,
  inventoryPriceSchema,
  labelSheetSchema,
  listInventory,
  listInventorySchema,
  lookupBySku,
  scanInventory,
  updateInventoryDetails,
  updateInventoryPrice,
  stockLedger,
} from '../../controllers/plantInventory.controller';

const router = Router();

router.use(authenticate, asyncHandler(attachTenant), requireNursery, requireFeature('INVENTORY'));

router.get('/', validate({ query: listInventorySchema }), asyncHandler(listInventory));
router.get('/sku/:sku', asyncHandler(lookupBySku));
router.get('/scan/:code', asyncHandler(scanInventory));
router.post(
  '/labels',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: labelSheetSchema }),
  asyncHandler(inventoryLabelSheet),
);
router.get('/:id/label', asyncHandler(getLabel));
router.get('/:id/customer', asyncHandler(customerTag));
router.patch(
  '/:id/details',
  authorize('ADMIN', 'MANAGER'),
  validate({ body: inventoryDetailsSchema }),
  asyncHandler(updateInventoryDetails),
);
router.patch(
  '/:id/price',
  authorize('ADMIN', 'MANAGER'),
  validate({ body: inventoryPriceSchema }),
  asyncHandler(updateInventoryPrice),
);
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
