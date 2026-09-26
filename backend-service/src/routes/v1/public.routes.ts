import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validator.middleware';
import { publicAlert, publicBatch, publicBooking, publicBookingSchema, publicPlant, publicStock, publicUnit } from '../../controllers/public.controller';

const router = Router();

router.get('/plants/:code', asyncHandler(publicPlant));
router.get('/batches/:code', asyncHandler(publicBatch));
router.get('/units/:code', asyncHandler(publicUnit));
router.get('/stock/:code', asyncHandler(publicStock));
router.get('/alerts/:code', asyncHandler(publicAlert));
router.post('/plants/:code/bookings', validate({ body: publicBookingSchema }), asyncHandler(publicBooking));

export default router;
