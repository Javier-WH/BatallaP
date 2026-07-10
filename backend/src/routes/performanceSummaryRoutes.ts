import { Router } from 'express';
import { exportPerformanceSummary, getBoletinData } from '@/controllers/performanceSummaryController';

const router = Router();

router.get('/export', exportPerformanceSummary);
router.get('/boletin-data', getBoletinData);

export default router;
