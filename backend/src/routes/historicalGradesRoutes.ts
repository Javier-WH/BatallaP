import { Router } from 'express';
import * as historicalGradesController from '@/controllers/historicalGradesController';

const router = Router();

router.get('/by-section', historicalGradesController.getHistoricalGradesBySection);
router.post('/save', historicalGradesController.saveHistoricalGrades);
router.post('/person-planteles', historicalGradesController.savePersonPlanteles);
router.post('/group-subject-name', historicalGradesController.saveGroupSubjectName);

export default router;
