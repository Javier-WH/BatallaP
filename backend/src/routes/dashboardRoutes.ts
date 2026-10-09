import { Router } from 'express';
import { getControlPanelMetrics, getMasterDashboardMetrics, getAdminDashboardStats, getAdminInconsistencies, getActivityLog } from '@/controllers/dashboardController';

const router = Router();

router.get('/control', getControlPanelMetrics);
router.get('/master', getMasterDashboardMetrics);
router.get('/admin-stats', getAdminDashboardStats);
router.get('/admin-inconsistencies', getAdminInconsistencies);
router.get('/activity-log', getActivityLog);

export default router;
