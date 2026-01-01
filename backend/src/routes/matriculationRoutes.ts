import { Router } from 'express';
import { getMatriculations, getMatriculationById, enrollMatriculatedStudent, updateMatriculation } from '@/controllers/inscriptionController';

const router = Router();

router.get('/', getMatriculations);
router.get('/:id', getMatriculationById);
router.patch('/:id', updateMatriculation);
router.post('/:id/enroll', enrollMatriculatedStudent);

export default router;
