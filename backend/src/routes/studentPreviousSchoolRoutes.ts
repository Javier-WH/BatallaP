import { Router } from 'express';
import {
  listStudentPreviousSchools,
  getStudentPreviousSchool,
  createStudentPreviousSchool,
  updateStudentPreviousSchool,
  deleteStudentPreviousSchool,
  replaceStudentPreviousSchools
} from '@/controllers/studentPreviousSchoolController';

const router = Router({ mergeParams: true });

router.get('/', listStudentPreviousSchools);
router.get('/:id', getStudentPreviousSchool);
router.post('/', createStudentPreviousSchool);
router.put('/:id', updateStudentPreviousSchool);
router.delete('/:id', deleteStudentPreviousSchool);
router.put('/', replaceStudentPreviousSchools);

export default router;
