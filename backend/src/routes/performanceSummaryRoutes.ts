import { Router } from 'express';
import { exportPerformanceSummary, exportRevisionSummary, getBoletinData, getGeneralAverages, getTituloData } from '@/controllers/performanceSummaryController';

const router = Router();

router.get('/export', exportPerformanceSummary);
router.get('/export-revision', exportRevisionSummary);
router.get('/boletin-data', getBoletinData);
router.get('/general-averages', getGeneralAverages);
router.get('/titulo-data', getTituloData);

export default router;
