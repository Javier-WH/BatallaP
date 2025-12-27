import { Router } from 'express';
import {
  getClosureStatus,
  upsertChecklistEntry
} from '@/controllers/periodClosureController';

const router = Router();

router.get('/:periodId/status', getClosureStatus);
router.post('/:periodId/checklist', upsertChecklistEntry);

export default router;
