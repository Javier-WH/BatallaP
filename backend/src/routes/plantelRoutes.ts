import { Router } from 'express';
import { listPlanteles, getPlantel } from '@/controllers/plantelController';

const router = Router();

router.get('/', listPlanteles);
router.get('/:code', getPlantel);

export default router;
