import { Router } from 'express';
import * as revisionGradeController from '@/controllers/revisionGradeController';

const router = Router();

router.get('/my-assignments', revisionGradeController.getMyRevisionAssignments);
router.get('/my-assignments/:periodGradeSubjectId', revisionGradeController.getMyRevisionAssignmentDetail);

export default router;
