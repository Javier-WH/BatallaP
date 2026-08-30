import { Router } from 'express';
import * as revisionGradeController from '@/controllers/revisionGradeController';

const router = Router();

router.get('/my-assignments', revisionGradeController.getMyRevisionAssignments);
router.get('/my-assignments/:periodGradeSubjectId', revisionGradeController.getMyRevisionAssignmentDetail);
router.get('/thematic-selection', revisionGradeController.getRevisionThematicSelection);
router.put('/thematic-selection', revisionGradeController.saveRevisionThematicSelection);

export default router;
