import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validator.middleware';
import { attachTenant, requireNursery } from '../../middlewares/tenant.middleware';
import {
  executeSchema,
  executeVoiceAgent,
  parseSchema,
  parseVoiceAgent,
} from '../../controllers/voiceAgent.controller';

const router = Router();

router.use(authenticate, asyncHandler(attachTenant), requireNursery);

router.post('/parse', validate({ body: parseSchema }), asyncHandler(parseVoiceAgent));
router.post('/execute', validate({ body: executeSchema }), asyncHandler(executeVoiceAgent));

export default router;
