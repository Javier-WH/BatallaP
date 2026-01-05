import { Router } from 'express';
import { getControlPanelMetrics } from '@/controllers/dashboardController';

const router = Router();

router.get('/control', getControlPanelMetrics);

export default router;
