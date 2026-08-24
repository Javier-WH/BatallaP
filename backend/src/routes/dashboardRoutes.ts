import { Router } from 'express';
import { getControlPanelMetrics, getMasterDashboardMetrics, getAdminDashboardStats } from '@/controllers/dashboardController';

const router = Router();

router.get('/control', getControlPanelMetrics);
router.get('/master', getMasterDashboardMetrics);
router.get('/admin-stats', getAdminDashboardStats);

export default router;
