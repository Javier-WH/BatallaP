import { Router } from 'express';
import { getMyAvailability, saveMyAvailability, getAllAvailability, getTeacherAvailability, saveTeacherAvailability } from '@/controllers/teacherAvailabilityController';

const router = Router();

// GET /api/teacher-availability — current user's availability
router.get('/', getMyAvailability);

// POST /api/teacher-availability — save current user's availability
router.post('/', saveMyAvailability);

// GET /api/teacher-availability/all — all teachers' availability (for Control de Estudios)
router.get('/all', getAllAvailability);

// GET /api/teacher-availability/:personId — specific teacher's availability
router.get('/:personId', getTeacherAvailability);

// POST /api/teacher-availability/:personId — save specific teacher's availability (for Control de Estudios)
router.post('/:personId', saveTeacherAvailability);

export default router;
