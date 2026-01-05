import { Router } from 'express';
import { getControlPanelMetrics, getMasterDashboardMetrics } from '@/controllers/dashboardController';

const router = Router();

router.get('/control', getControlPanelMetrics);
router.get('/master', getMasterDashboardMetrics);

export default router;
