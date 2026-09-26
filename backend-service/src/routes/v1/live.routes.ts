import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validator.middleware';
import { attachTenant } from '../../middlewares/tenant.middleware';
import {
  alertArmSchema,
  cameraSchema,
  createCamera,
  createIntrusionCase,
  intrusionSchema,
  listBoard,
  listIntrusions,
  raiseCameraDanger,
  readLiveFrame,
  receiveIntrusionCase,
  receiveLiveFrame,
  removeCamera,
  reportIntrusion,
  saveCameraAlert,
  saveLiveFrame,
} from '../../controllers/live.controller';

const router = Router();

router.use(authenticate, asyncHandler(attachTenant));

router.get('/board', asyncHandler(listBoard));
router.get('/intrusions', asyncHandler(listIntrusions));
router.post('/cameras', validate({ body: cameraSchema }), asyncHandler(createCamera));
router.patch('/cameras/:id/alert', validate({ body: alertArmSchema }), asyncHandler(saveCameraAlert));
router.post('/cameras/:id/intrusion', validate({ body: intrusionSchema }), asyncHandler(reportIntrusion));
router.post('/cameras/:id/case', receiveIntrusionCase, asyncHandler(createIntrusionCase));
router.post('/cameras/:id/danger', receiveLiveFrame, asyncHandler(raiseCameraDanger));
router.delete('/cameras/:id', asyncHandler(removeCamera));
router.post('/cameras/:id/frame', receiveLiveFrame, asyncHandler(saveLiveFrame));
router.get('/cameras/:id/frame', asyncHandler(readLiveFrame));

export default router;
