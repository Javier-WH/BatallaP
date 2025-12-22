import { Router } from 'express';
import { getResidenceByPerson, upsertResidenceByPerson } from '@/controllers/residenceController';

const router = Router();

router.get('/:personId', getResidenceByPerson);
router.put('/:personId', upsertResidenceByPerson);

export default router;
