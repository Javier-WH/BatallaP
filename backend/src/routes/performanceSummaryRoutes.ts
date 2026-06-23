import { Router } from 'express';
import { exportPerformanceSummary } from '@/controllers/performanceSummaryController';

const router = Router();

router.get('/export', exportPerformanceSummary);

export default router;
