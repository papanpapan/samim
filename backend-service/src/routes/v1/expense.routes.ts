import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middlewares/auth.middleware';
import { attachTenant, requireFeature, requireNursery } from '../../middlewares/tenant.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validator.middleware';
import { createExpense, createExpenseSchema, listExpenses } from '../../controllers/expense.controller';

const router = Router();
router.use(authenticate, asyncHandler(attachTenant), requireNursery, requireFeature('ACCOUNTS'));
router.use(authorize('ADMIN', 'MANAGER'));

router.get('/', asyncHandler(listExpenses));
router.post('/', validate({ body: createExpenseSchema }), asyncHandler(createExpense));

export default router;
