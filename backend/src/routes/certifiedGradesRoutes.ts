import { Router } from 'express';
import { exportCertifiedGrades, getCertifiedGradesData } from '@/controllers/certifiedGradesController';

const router = Router();

router.get('/export', exportCertifiedGrades);
router.get('/data', getCertifiedGradesData);

export default router;