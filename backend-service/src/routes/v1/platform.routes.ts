import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validator.middleware';
import { attachTenant, requirePlatformOwner } from '../../middlewares/tenant.middleware';
import { placeHere, searchPlaces } from '../../controllers/places.controller';
import {
  catalogCreateSchema,
  catalogUpdateSchema,
  createFeature,
  createNurseryUser,
  deleteFeature,
  deleteNurseryUser,
  featureSchema,
  listFeatureCatalog,
  listNurseries,
  listPackagePlans,
  packageSchema,
  nurseryUpdateSchema,
  onboardNursery,
  onboardSchema,
  platformUserSchema,
  platformUserUpdateSchema,
  statusSchema,
  updateNursery,
  updateNurseryFeatures,
  nurseryChannelSchema,
  updateNurseryChannels,
  channelCreateSchema,
  listChannels,
  createChannel,
  deleteChannel,
  updatePackagePlan,
  updateFeature,
  updateNurseryStatus,
  updateNurseryUser,
  updateUserFeatures,
} from '../../controllers/platform.controller';

const router = Router();

router.use(authenticate, asyncHandler(attachTenant), requirePlatformOwner);

router.get('/features', asyncHandler(listFeatureCatalog));
router.post('/features', validate({ body: catalogCreateSchema }), asyncHandler(createFeature));
router.patch('/features/:key', validate({ body: catalogUpdateSchema }), asyncHandler(updateFeature));
router.delete('/features/:key', asyncHandler(deleteFeature));
router.get('/packages', asyncHandler(listPackagePlans));
router.patch('/packages/:code', validate({ body: packageSchema }), asyncHandler(updatePackagePlan));
router.get('/places', asyncHandler(searchPlaces));
router.get('/places/here', asyncHandler(placeHere));
router.get('/channels', asyncHandler(listChannels));
router.post('/channels', validate({ body: channelCreateSchema }), asyncHandler(createChannel));
router.delete('/channels/:code', asyncHandler(deleteChannel));
router.get('/nurseries', asyncHandler(listNurseries));
router.post('/nurseries', validate({ body: onboardSchema }), asyncHandler(onboardNursery));
router.patch('/nurseries/:id', validate({ body: nurseryUpdateSchema }), asyncHandler(updateNursery));
router.patch('/nurseries/:id/features', validate({ body: featureSchema }), asyncHandler(updateNurseryFeatures));
router.patch('/nurseries/:id/channels', validate({ body: nurseryChannelSchema }), asyncHandler(updateNurseryChannels));
router.patch('/nurseries/:id/status', validate({ body: statusSchema }), asyncHandler(updateNurseryStatus));
router.post('/nurseries/:id/users', validate({ body: platformUserSchema }), asyncHandler(createNurseryUser));
router.patch('/users/:id/features', validate({ body: featureSchema }), asyncHandler(updateUserFeatures));
router.patch('/users/:id', validate({ body: platformUserUpdateSchema }), asyncHandler(updateNurseryUser));
router.delete('/users/:id', asyncHandler(deleteNurseryUser));

export default router;
