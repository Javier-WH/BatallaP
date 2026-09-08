import { Router } from 'express';
import { getControlPanelMetrics, getMasterDashboardMetrics, getAdminDashboardStats, getActivityLog } from '@/controllers/dashboardController';

const router = Router();

router.get('/control', getControlPanelMetrics);
router.get('/master', getMasterDashboardMetrics);
router.get('/admin-stats', getAdminDashboardStats);
router.get('/activity-log', getActivityLog);

export default router;
