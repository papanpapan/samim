import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { attachTenant, requireFeature, requireNursery } from '../../middlewares/tenant.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  bookingSchema,
  bookingStatusSchema,
  createBooking,
  createLead,
  createManifest,
  leadSchema,
  leadStatusSchema,
  listBookings,
  listLeads,
  listManifests,
  manifestSchema,
  manifestStatusSchema,
  updateBookingStatus,
  updateLeadStatus,
  updateManifestStatus,
} from '../../controllers/distribution.controller';

const router = Router();
router.use(authenticate, asyncHandler(attachTenant), requireNursery, requireFeature('DISTRIBUTION'));
router.use(authorize('ADMIN', 'MANAGER', 'CASHIER'));

router.get('/bookings', asyncHandler(listBookings));
router.post('/bookings', validate({ body: bookingSchema }), asyncHandler(createBooking));
router.patch('/bookings/:id', validate({ body: bookingStatusSchema }), asyncHandler(updateBookingStatus));

router.get('/manifests', asyncHandler(listManifests));
router.post('/manifests', validate({ body: manifestSchema }), asyncHandler(createManifest));
router.patch('/manifests/:id', validate({ body: manifestStatusSchema }), asyncHandler(updateManifestStatus));

router.get('/leads', asyncHandler(listLeads));
router.post('/leads', validate({ body: leadSchema }), asyncHandler(createLead));
router.patch('/leads/:id', validate({ body: leadStatusSchema }), asyncHandler(updateLeadStatus));

export default router;
