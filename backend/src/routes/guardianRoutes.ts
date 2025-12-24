import { Router } from 'express';
import { searchGuardian } from '@/controllers/guardianController';

const router = Router();

router.get('/search', searchGuardian);

export default router;
