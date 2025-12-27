import { Router } from 'express';
import {
  getPeriodOutcomes,
  getPendingSubjects,
  resolvePendingSubject
} from '@/controllers/periodOutcomeController';

const router = Router();

router.get('/:periodId/outcomes', getPeriodOutcomes);
router.get('/:periodId/pending-subjects', getPendingSubjects);
router.post('/pending-subjects/:pendingSubjectId/resolve', resolvePendingSubject);

export default router;
