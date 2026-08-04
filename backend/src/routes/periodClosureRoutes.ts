import { Router } from 'express';
import {
  getClosureStatus,
  getChecklistEntry,
  upsertChecklistEntry,
  validateClosure,
  executeClosure,
  getPreviewOutcomes
} from '@/controllers/periodClosureController';

const router = Router();

router.get('/:periodId/status', getClosureStatus);
router.get('/:periodId/checklist', getChecklistEntry);
router.post('/:periodId/checklist', upsertChecklistEntry);
router.get('/:periodId/validate', validateClosure);
router.get('/:periodId/preview', getPreviewOutcomes);
router.post('/:periodId/execute', executeClosure);

export default router;
