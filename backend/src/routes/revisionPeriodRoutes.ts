import { Router } from 'express';
import * as revisionPeriodController from '@/controllers/revisionPeriodController';

const router = Router();

router.get('/:schoolPeriodId', revisionPeriodController.getRevisionPeriod);
router.post('/:schoolPeriodId/open', revisionPeriodController.openRevisionPeriod);
router.post('/:schoolPeriodId/complete', revisionPeriodController.completeRevisionPeriod);
router.post('/:schoolPeriodId/lock', revisionPeriodController.lockRevisionPeriod);
router.post('/:schoolPeriodId/reopen', revisionPeriodController.reopenRevisionPeriod);
router.post('/:schoolPeriodId/recalculate', revisionPeriodController.recalculateRevisionPeriod);
router.post('/:schoolPeriodId/reset', revisionPeriodController.resetRevisionPeriod);
router.put('/:schoolPeriodId/max-opportunities', revisionPeriodController.updateMaxOpportunities);
router.post('/:schoolPeriodId/advance-opportunity', revisionPeriodController.advanceOpportunity);
router.get('/:schoolPeriodId/students', revisionPeriodController.getRevisionStudents);
router.get('/:schoolPeriodId/grades', revisionPeriodController.getRevisionGrades);
router.get('/:schoolPeriodId/export-nomina', revisionPeriodController.exportRevisionNominaExcel);
router.post('/:schoolPeriodId/finalize-revision-grades', revisionPeriodController.finalizeRevisionGrades);
router.put('/:schoolPeriodId/revisions/bulk', revisionPeriodController.bulkSaveRevisionGrades);
router.put('/:schoolPeriodId/revisions/:revisionId', revisionPeriodController.saveRevisionGrade);
router.put('/:schoolPeriodId/revisions/:revisionId/override', revisionPeriodController.overrideRevisionGrade);
router.get('/:schoolPeriodId/revision-audits', revisionPeriodController.getRevisionGradeAudits);
router.get('/:schoolPeriodId/revisions/:revisionId/audits', revisionPeriodController.getRevisionGradeAudits);

export default router;
