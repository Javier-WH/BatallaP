import { Router } from 'express';
import { exportPerformanceSummary, exportRevisionSummary, getBoletinData, getGeneralAverages, getTituloData, getGroupTeachers, setGroupSigner } from '@/controllers/performanceSummaryController';

const router = Router();

router.get('/export', exportPerformanceSummary);
router.get('/export-revision', exportRevisionSummary);
router.get('/boletin-data', getBoletinData);
router.get('/general-averages', getGeneralAverages);
router.get('/titulo-data', getTituloData);
router.get('/group-teachers', getGroupTeachers);
router.post('/group-signer', setGroupSigner);

export default router;
