import { Router } from 'express';
import { searchGuardian, getMyStudents, createGuardian } from '@/controllers/guardianController';

const router = Router();

router.get('/search', searchGuardian);
router.post('/', createGuardian);
router.get('/my-students', getMyStudents);

export default router;
