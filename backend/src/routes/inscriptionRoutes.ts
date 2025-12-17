import { Router } from 'express';
import {
  createInscription,
  getInscriptions,
  getInscriptionById,
  updateInscription,
  deleteInscription,
  addSubjectToInscription,
  removeSubjectFromInscription
} from '../controllers/inscriptionController';

const router = Router();

router.get('/', getInscriptions);
router.get('/:id', getInscriptionById);
router.post('/', createInscription);
router.put('/:id', updateInscription);
router.delete('/:id', deleteInscription);

// Sub-resource for subjects (manual management)
router.post('/:id/subjects', addSubjectToInscription);
router.delete('/:id/subjects/:subjectId', removeSubjectFromInscription);

export default router;
