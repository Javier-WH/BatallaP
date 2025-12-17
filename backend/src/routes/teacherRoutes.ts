import { Router } from 'express';
import { getTeachers, getAvailableSubjectsForPeriod, assignTeacherToSubject, removeTeacherAssignment } from '@/controllers/teacherController';

const router = Router();

router.get('/', getTeachers);
router.get('/available/:periodId', getAvailableSubjectsForPeriod);
router.post('/assign', assignTeacherToSubject);
router.delete('/assign/:id', removeTeacherAssignment);

export default router;
