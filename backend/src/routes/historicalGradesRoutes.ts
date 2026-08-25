import { Router } from 'express';
import * as historicalGradesController from '@/controllers/historicalGradesController';

const router = Router();

router.get('/by-section', historicalGradesController.getHistoricalGradesBySection);
router.post('/save', historicalGradesController.saveHistoricalGrades);

export default router;
