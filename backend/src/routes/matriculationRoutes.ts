import { Router } from 'express';
import { getMatriculations, getMatriculationsStats, getMatriculationById, enrollMatriculatedStudent, updateMatriculation, toggleMatriculationVisibility, bulkToggleMatriculationVisibility, withdrawMatriculation, reactivateMatriculation } from '@/controllers/inscriptionController';

const router = Router();

router.get('/', getMatriculations);
// /stats must be registered before /:id to avoid the param route capturing "stats".
router.get('/stats', getMatriculationsStats);
router.post('/bulk-visibility', bulkToggleMatriculationVisibility);
router.get('/:id', getMatriculationById);
router.patch('/:id', updateMatriculation);
router.post('/:id/enroll', enrollMatriculatedStudent);
router.patch('/:id/visibility', toggleMatriculationVisibility);
router.post('/:id/withdraw', withdrawMatriculation); // Retirar (Admin) — also for not-yet-matriculated students
router.post('/:id/reactivate', reactivateMatriculation); // Reactivar (Admin) → back to "No Matriculados"

export default router;
