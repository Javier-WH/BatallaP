import { Router } from 'express';
import { getWorkload } from '@/controllers/teacherWorkloadController';

const router = Router();

// GET /api/teacher-workload?schoolPeriodId= — weekly workload per teacher
router.get('/', getWorkload);

export default router;
