import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { attachTenant, requireFeature, requireNursery } from '../../middlewares/tenant.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { listAudit } from '../../controllers/admin.controller';

const router = Router();
router.use(authenticate, asyncHandler(attachTenant), requireNursery, requireFeature('NURSERY_ADMIN'), authorize('ADMIN'));
router.get('/', asyncHandler(listAudit));

export default router;
