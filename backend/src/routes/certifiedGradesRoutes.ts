import { Router } from 'express';
import { exportCertifiedGrades, exportCertifiedGradesBySection, getCertifiedGradesData } from '@/controllers/certifiedGradesController';

const router = Router();

router.get('/export', exportCertifiedGrades);
router.get('/export-section', exportCertifiedGradesBySection);
router.get('/data', getCertifiedGradesData);

export default router;