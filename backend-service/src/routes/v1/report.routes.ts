import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { dashboard, profitability } from '../../controllers/report.controller';

const router = Router();

router.use(authenticate);

router.get('/dashboard', asyncHandler(dashboard));
router.get('/profitability', asyncHandler(profitability));

export default router;
