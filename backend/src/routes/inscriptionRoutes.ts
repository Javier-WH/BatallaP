import { Router } from 'express';
import {
  createInscription,
  getInscriptions,
  getInscriptionById,
  updateInscription,
  deleteInscription,
  addSubjectToInscription,
  removeSubjectFromInscription,
  registerAndEnroll,
  quickRegister
} from '../controllers/inscriptionController';

const router = Router();

router.get('/', getInscriptions);
router.get('/:id', getInscriptionById);
router.post('/', createInscription);
router.post('/register', registerAndEnroll); // New: Register Person + Enroll (no User)
router.post('/quick-register', quickRegister); // Minimal data enrollment (Admin)
router.put('/:id', updateInscription);
router.patch('/:id', updateInscription); // Same handler as PUT for partial updates
router.delete('/:id', deleteInscription);

// Sub-resource for subjects (manual management)
router.post('/:id/subjects', addSubjectToInscription);
router.delete('/:id/subjects/:subjectId', removeSubjectFromInscription);

export default router;
