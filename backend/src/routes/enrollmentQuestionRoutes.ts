import { Router } from 'express';
import {
  listEnrollmentQuestions,
  createEnrollmentQuestion,
  updateEnrollmentQuestion,
  reorderEnrollmentQuestions,
  setEnrollmentQuestionStatus,
  deactivateEnrollmentQuestion
} from '@/controllers/enrollmentQuestionController';

const router = Router();

router.get('/', listEnrollmentQuestions);
router.post('/', createEnrollmentQuestion);
router.put('/:id', updateEnrollmentQuestion);
router.patch('/reorder', reorderEnrollmentQuestions);
router.patch('/:id/status', setEnrollmentQuestionStatus);
router.patch('/:id/deactivate', deactivateEnrollmentQuestion);

export default router;
