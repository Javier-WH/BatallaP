import { Router } from 'express';
import { getAdminHoursSummary, getTeacherAdminHours, saveTeacherAdminHours } from '@/controllers/teacherAdminHourController';

const router = Router();

// GET /api/teacher-admin-hours/summary?schoolPeriodId= — hour count per teacher
router.get('/summary', getAdminHoursSummary);

// GET /api/teacher-admin-hours/:teacherId?schoolPeriodId= — painted cells for a teacher
router.get('/:teacherId', getTeacherAdminHours);

// POST /api/teacher-admin-hours/:teacherId — bulk-replace painted cells (Control de Estudios)
router.post('/:teacherId', saveTeacherAdminHours);

export default router;
