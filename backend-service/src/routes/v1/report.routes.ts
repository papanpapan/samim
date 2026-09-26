import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { attachTenant, requireFeature, requireNursery } from '../../middlewares/tenant.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { dashboard, profitability } from '../../controllers/report.controller';

const router = Router();

router.use(authenticate, asyncHandler(attachTenant), requireNursery);

router.get('/dashboard', asyncHandler(dashboard));
router.get('/profitability', requireFeature('ACCOUNTS'), authorize('ADMIN', 'MANAGER'), asyncHandler(profitability));

export default router;
