import { Router } from 'express';
import {
  createInscription,
  getInscriptions,
  getInscriptionsStats,
  getInscriptionById,
  updateInscription,
  deleteInscription,
  addSubjectToInscription,
  removeSubjectFromInscription,
  registerAndEnroll,
  quickRegister,
  getGroupSubjectChoices,
  setGroupSubjectForTerm,
  checkGroupSubjectChangeImpact,
  withdrawInscription,
  reactivateInscription,
  unmatriculateInscription,
} from '../controllers/inscriptionController';

const router = Router();

router.get('/', getInscriptions);
// /stats must be registered before /:id to avoid the param route capturing "stats".
router.get('/stats', getInscriptionsStats);
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

// Per-term group subject choices (backfill + validation)
router.get('/:id/group-choices', getGroupSubjectChoices);
router.put('/:id/group-choices', setGroupSubjectForTerm);
router.post('/:id/group-choices/check', checkGroupSubjectChangeImpact);

// Withdraw / reactivate (retire student from section, preserve academic data)
router.post('/:id/withdraw', withdrawInscription);
router.post('/:id/reactivate', reactivateInscription);
// Un-matriculate: send back to "No Matriculados" without deleting anything
router.post('/:id/unmatriculate', unmatriculateInscription);

export default router;
