import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { attachTenant, requireNursery } from '../../middlewares/tenant.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  addPlaceUser,
  getMyNursery,
  listMyChannels,
  personUpdateSchema,
  placeUserSchema,
  removePlaceUser,
  roleFeatureSchema,
  updatePlaceUser,
  updateRoleFeatures,
} from '../../controllers/nursery.controller';

const router = Router();

router.use(authenticate, asyncHandler(attachTenant), requireNursery);

router.get('/', authorize('ADMIN', 'MANAGER'), asyncHandler(getMyNursery));
router.get('/channels', asyncHandler(listMyChannels));
router.patch(
  '/roles/:role/features',
  authorize('ADMIN', 'MANAGER'),
  validate({ body: roleFeatureSchema }),
  asyncHandler(updateRoleFeatures),
);
router.post(
  '/places/:locationId/users',
  authorize('ADMIN'),
  validate({ body: placeUserSchema }),
  asyncHandler(addPlaceUser),
);
router.patch(
  '/users/:id',
  authorize('ADMIN'),
  validate({ body: personUpdateSchema }),
  asyncHandler(updatePlaceUser),
);
router.delete('/users/:id', authorize('ADMIN'), asyncHandler(removePlaceUser));

export default router;
