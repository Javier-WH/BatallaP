import { Router } from 'express';
import { searchGuardian, getMyStudents } from '@/controllers/guardianController';

const router = Router();

router.get('/search', searchGuardian);
router.get('/my-students', getMyStudents);

export default router;
