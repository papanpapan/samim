import { Router } from 'express';
import authRoutes from './v1/auth.routes';
import motherPlantRoutes from './v1/motherPlant.routes';
import propagationRoutes from './v1/propagation.routes';
import plantInventoryRoutes from './v1/plantInventory.routes';
import vermicompostRoutes from './v1/vermicompost.routes';
import salesPOSRoutes from './v1/salesPOS.routes';
import reportRoutes from './v1/report.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/mother-plants', motherPlantRoutes);
router.use('/propagation', propagationRoutes);
router.use('/inventory', plantInventoryRoutes);
router.use('/vermicompost', vermicompostRoutes);
router.use('/sales', salesPOSRoutes);
router.use('/reports', reportRoutes);

export default router;
