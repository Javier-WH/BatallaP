import { Router } from 'express';
import { getMatriculations, getMatriculationById, enrollMatriculatedStudent } from '@/controllers/inscriptionController';

const router = Router();

router.get('/', getMatriculations);
router.get('/:id', getMatriculationById);
router.post('/:id/enroll', enrollMatriculatedStudent);

export default router;
