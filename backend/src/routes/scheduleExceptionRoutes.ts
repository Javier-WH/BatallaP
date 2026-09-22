import { Router } from 'express';
import {
  listExceptions, createException, updateException, deleteException,
  listDayTurnExceptions, createDayTurnException, deleteDayTurnException,
} from '@/controllers/scheduleExceptionController';

const router = Router();

router.get('/day-turn', listDayTurnExceptions);
router.post('/day-turn', createDayTurnException);
router.delete('/day-turn/:id', deleteDayTurnException);

router.get('/', listExceptions);
router.post('/', createException);
router.put('/:id', updateException);
router.delete('/:id', deleteException);

export default router;
