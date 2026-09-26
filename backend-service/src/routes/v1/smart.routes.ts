import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validator.middleware';
import { attachTenant, requireFeature, requireNursery } from '../../middlewares/tenant.middleware';
import {
  alertStatusSchema,
  askVoice,
  completeTreatment,
  createAlert,
  createNote,
  receiveAlertPhoto,
  createTreatment,
  createZone,
  identifyPlant,
  identifySchema,
  listAlerts,
  listIdentifications,
  listNotes,
  listTreatments,
  listZones,
  noteSchema,
  treatmentSchema,
  updateAlert,
  voiceSchema,
  zoneSchema,
} from '../../controllers/smart.controller';

const router = Router();

router.use(authenticate, asyncHandler(attachTenant), requireNursery);

router.get('/zones', requireFeature('CCTV_ALERTS'), asyncHandler(listZones));
router.post('/zones', requireFeature('CCTV_ALERTS'), validate({ body: zoneSchema }), asyncHandler(createZone));
router.get('/alerts', requireFeature('CCTV_ALERTS'), asyncHandler(listAlerts));
router.post('/alerts', requireFeature('CCTV_ALERTS'), receiveAlertPhoto, asyncHandler(createAlert));
router.patch('/alerts/:id', requireFeature('CCTV_ALERTS'), validate({ body: alertStatusSchema }), asyncHandler(updateAlert));

router.get('/treatments', requireFeature('PLANT_TREATMENT'), asyncHandler(listTreatments));
router.post('/treatments', requireFeature('PLANT_TREATMENT'), validate({ body: treatmentSchema }), asyncHandler(createTreatment));
router.patch('/treatments/:id/done', requireFeature('PLANT_TREATMENT'), asyncHandler(completeTreatment));

router.get('/identify', requireFeature('PLANT_ID'), asyncHandler(listIdentifications));
router.post('/identify', requireFeature('PLANT_ID'), validate({ body: identifySchema }), asyncHandler(identifyPlant));

router.post('/voice', requireFeature('VOICE_DESK'), validate({ body: voiceSchema }), asyncHandler(askVoice));

router.get('/notes', asyncHandler(listNotes));
router.post('/notes', validate({ body: noteSchema }), asyncHandler(createNote));

export default router;
