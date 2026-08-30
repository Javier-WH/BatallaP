import { Router } from 'express';
import { listExceptions, createException, updateException, deleteException } from '@/controllers/scheduleExceptionController';

const router = Router();

router.get('/', listExceptions);
router.post('/', createException);
router.put('/:id', updateException);
router.delete('/:id', deleteException);

export default router;
