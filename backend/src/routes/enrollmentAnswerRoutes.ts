import { Router } from 'express';
import { saveAnswersController, getAnswersByPerson } from '@/controllers/enrollmentAnswerController';

const router = Router();

router.get('/:personId', getAnswersByPerson);
router.post('/', saveAnswersController);
router.post('/:personId', saveAnswersController);

export default router;
