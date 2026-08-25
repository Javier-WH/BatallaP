import { Router } from 'express';
import * as revisionPeriodController from '@/controllers/revisionPeriodController';

const router = Router();

router.get('/:schoolPeriodId', revisionPeriodController.getRevisionPeriod);
router.post('/:schoolPeriodId/open', revisionPeriodController.openRevisionPeriod);
router.post('/:schoolPeriodId/close', revisionPeriodController.closeRevisionPeriod);
router.post('/:schoolPeriodId/recalculate', revisionPeriodController.recalculateRevisionPeriod);
router.post('/:schoolPeriodId/reset', revisionPeriodController.resetRevisionPeriod);
router.get('/:schoolPeriodId/students', revisionPeriodController.getRevisionStudents);
router.get('/:schoolPeriodId/grades', revisionPeriodController.getRevisionGrades);
router.put('/:schoolPeriodId/revisions/bulk', revisionPeriodController.bulkSaveRevisionGrades);
router.put('/:schoolPeriodId/revisions/:revisionId', revisionPeriodController.saveRevisionGrade);

export default router;
