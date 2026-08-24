import { Router } from 'express';
import { getMatriculations, getMatriculationsStats, getMatriculationById, enrollMatriculatedStudent, updateMatriculation, toggleMatriculationVisibility, bulkToggleMatriculationVisibility } from '@/controllers/inscriptionController';

const router = Router();

router.get('/', getMatriculations);
// /stats must be registered before /:id to avoid the param route capturing "stats".
router.get('/stats', getMatriculationsStats);
router.post('/bulk-visibility', bulkToggleMatriculationVisibility);
router.get('/:id', getMatriculationById);
router.patch('/:id', updateMatriculation);
router.post('/:id/enroll', enrollMatriculatedStudent);
router.patch('/:id/visibility', toggleMatriculationVisibility);

export default router;
