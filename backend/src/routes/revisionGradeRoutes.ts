import { Router } from 'express';
import * as revisionGradeController from '@/controllers/revisionGradeController';

const router = Router();

router.get('/my-assignments', revisionGradeController.getMyRevisionAssignments);
router.get('/my-assignments/:periodGradeSubjectId', revisionGradeController.getMyRevisionAssignmentDetail);
router.get('/thematic-selection', revisionGradeController.getRevisionThematicSelection);
router.put('/thematic-selection', revisionGradeController.saveRevisionThematicSelection);
router.get('/opportunity-dates', revisionGradeController.getRevisionOpportunityDates);
router.put('/opportunity-dates', revisionGradeController.saveRevisionOpportunityDates);
router.get('/export/:periodGradeSubjectId', revisionGradeController.exportRepairExcel);

export default router;
