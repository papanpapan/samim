import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { attachTenant, requireFeature, requireNursery } from '../../middlewares/tenant.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  createSale,
  createSaleSchema,
  getSale,
  listSales,
  upiQr,
} from '../../controllers/posSale.controller';
import {
  createMarketingMedia,
  deleteMarketingMedia,
  listMarketingMedia,
  receiveMarketingFile,
} from '../../controllers/marketing.controller';

const router = Router();

router.use(authenticate, asyncHandler(attachTenant), requireNursery, requireFeature('POS'));

router.get('/', asyncHandler(listSales));
router.get('/upi-qr', asyncHandler(upiQr));
router.get('/marketing', asyncHandler(listMarketingMedia));
router.post(
  '/marketing',
  authorize('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'),
  receiveMarketingFile,
  asyncHandler(createMarketingMedia),
);
router.delete(
  '/marketing/:id',
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(deleteMarketingMedia),
);
router.get('/:id', asyncHandler(getSale));
router.post(
  '/',
  authorize('ADMIN', 'MANAGER', 'CASHIER', 'STAFF'),
  validate({ body: createSaleSchema }),
  asyncHandler(createSale),
);

export default router;
