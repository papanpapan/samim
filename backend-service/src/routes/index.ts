import { Router } from 'express';
import authRoutes from './v1/auth.routes';
import motherPlantRoutes from './v1/motherPlant.routes';
import propagationRoutes from './v1/propagation.routes';
import plantInventoryRoutes from './v1/plantInventory.routes';
import vermicompostRoutes from './v1/vermicompost.routes';
import salesPOSRoutes from './v1/salesPOS.routes';
import reportRoutes from './v1/report.routes';
import careRoutes from './v1/care.routes';
import expenseRoutes from './v1/expense.routes';
import distributionRoutes from './v1/distribution.routes';
import auditRoutes from './v1/audit.routes';
import platformRoutes from './v1/platform.routes';
import nurseryRoutes from './v1/nursery.routes';
import smartRoutes from './v1/smart.routes';
import liveRoutes from './v1/live.routes';
import publicRoutes from './v1/public.routes';

const router = Router();

router.use('/public', publicRoutes);
router.use('/auth', authRoutes);
router.use('/mother-plants', motherPlantRoutes);
router.use('/propagation', propagationRoutes);
router.use('/inventory', plantInventoryRoutes);
router.use('/vermicompost', vermicompostRoutes);
router.use('/sales', salesPOSRoutes);
router.use('/reports', reportRoutes);
router.use('/care', careRoutes);
router.use('/expenses', expenseRoutes);
router.use('/distribution', distributionRoutes);
router.use('/audit', auditRoutes);
router.use('/platform', platformRoutes);
router.use('/nursery', nurseryRoutes);
router.use('/smart', smartRoutes);
router.use('/live', liveRoutes);

export default router;
