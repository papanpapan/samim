import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import {
  createUser,
  login,
  loginSchema,
  me,
  registerSchema,
} from '../../controllers/auth.controller';

const router = Router();

router.post('/login', validate({ body: loginSchema }), asyncHandler(login));
router.get('/me', authenticate, asyncHandler(me));
router.post(
  '/users',
  authenticate,
  authorize('ADMIN'),
  validate({ body: registerSchema }),
  asyncHandler(createUser),
);

export default router;
