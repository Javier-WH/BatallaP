import { Router } from 'express';
import {
  getClosureStatus,
  upsertChecklistEntry,
  validateClosure,
  executeClosure,
  getPreviewOutcomes
} from '@/controllers/periodClosureController';

const router = Router();

router.get('/:periodId/status', getClosureStatus);
router.post('/:periodId/checklist', upsertChecklistEntry);
router.get('/:periodId/validate', validateClosure);
router.get('/:periodId/preview', getPreviewOutcomes);
router.post('/:periodId/execute', executeClosure);

export default router;
