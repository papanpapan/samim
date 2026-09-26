import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { attachTenant, requireFeature, requireNursery } from '../../middlewares/tenant.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  attachMotherVideo,
  createMotherPlant,
  createMotherPlantSchema,
  createPlantName,
  deleteMotherPlant,
  createVariety,
  getMotherPlant,
  listMotherPlants,
  listPlantNames,
  listVarieties,
  logPhenology,
  logScionHarvest,
  motherPriceSchema,
  updateMotherPlant,
  updateMotherPlantSchema,
  updateMotherPrice,
  listPhenology,
  motherPlantTag,
  phenologySchema,
  receiveMotherVideo,
  plantNameSchema,
  scionSchema,
  varietySchema,
} from '../../controllers/motherPlant.controller';

const router = Router();

router.use(authenticate, asyncHandler(attachTenant), requireNursery, requireFeature('MOTHER_PLANTS'));

router.get('/plants', asyncHandler(listPlantNames));
router.post('/plants', authorize('ADMIN', 'MANAGER'), validate({ body: plantNameSchema }), asyncHandler(createPlantName));
router.get('/varieties', asyncHandler(listVarieties));
router.post('/varieties', authorize('ADMIN', 'MANAGER'), validate({ body: varietySchema }), asyncHandler(createVariety));
router.get('/', asyncHandler(listMotherPlants));
router.get('/:id/tag', asyncHandler(motherPlantTag));
router.get('/:id/phenology', asyncHandler(listPhenology));
router.post(
  '/:id/phenology',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: phenologySchema }),
  asyncHandler(logPhenology),
);
router.get('/:id', asyncHandler(getMotherPlant));
router.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  validate({ body: createMotherPlantSchema }),
  asyncHandler(createMotherPlant),
);
router.patch('/:id/price', authorize('ADMIN', 'MANAGER'), validate({ body: motherPriceSchema }), asyncHandler(updateMotherPrice));
router.patch('/:id', authorize('ADMIN', 'MANAGER'), validate({ body: updateMotherPlantSchema }), asyncHandler(updateMotherPlant));
router.post('/:id/video', authorize('ADMIN', 'MANAGER'), receiveMotherVideo, asyncHandler(attachMotherVideo));
router.delete('/:id', authorize('ADMIN', 'MANAGER'), asyncHandler(deleteMotherPlant));
router.post(
  '/:id/scions',
  authorize('ADMIN', 'MANAGER', 'STAFF'),
  validate({ body: scionSchema }),
  asyncHandler(logScionHarvest),
);

export default router;
