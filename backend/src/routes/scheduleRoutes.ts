import { Router } from 'express';
import { listSchedules, getSchedule, createSchedule, updateSchedule, saveScheduleEntries, getTeacherSchedule, getSectionScheduleOptions, checkTeacherConflict } from '@/controllers/scheduleController';

const router = Router();

router.get('/', listSchedules);
router.get('/conflicts', checkTeacherConflict);
router.get('/section/:sectionId/options', getSectionScheduleOptions);
router.get('/teacher/:personId', getTeacherSchedule);
router.get('/:id', getSchedule);
router.post('/', createSchedule);
router.put('/:id', updateSchedule);
router.put('/:id/entries', saveScheduleEntries);

export default router;
