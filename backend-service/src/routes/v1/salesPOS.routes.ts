import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  createSale,
  createSaleSchema,
  getSale,
  listSales,
} from '../../controllers/posSale.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listSales));
router.get('/:id', asyncHandler(getSale));
router.post(
  '/',
  authorize('ADMIN', 'MANAGER', 'CASHIER'),
  validate({ body: createSaleSchema }),
  asyncHandler(createSale),
);

export default router;
