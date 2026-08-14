import { Router } from 'express';
import { getMatriculations, getMatriculationById, enrollMatriculatedStudent, updateMatriculation, toggleMatriculationVisibility, bulkToggleMatriculationVisibility } from '@/controllers/inscriptionController';

const router = Router();

router.get('/', getMatriculations);
router.get('/:id', getMatriculationById);
router.patch('/:id', updateMatriculation);
router.post('/:id/enroll', enrollMatriculatedStudent);
router.patch('/:id/visibility', toggleMatriculationVisibility);
router.post('/bulk-visibility', bulkToggleMatriculationVisibility);

export default router;
