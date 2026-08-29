import { Router } from 'express';
import { getMyAvailability, saveMyAvailability, getAllAvailability } from '@/controllers/teacherAvailabilityController';

const router = Router();

// GET /api/teacher-availability — current user's availability
router.get('/', getMyAvailability);

// POST /api/teacher-availability — save current user's availability
router.post('/', saveMyAvailability);

// GET /api/teacher-availability/all — all teachers' availability (for Control de Estudios)
router.get('/all', getAllAvailability);

export default router;
