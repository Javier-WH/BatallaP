import { Router } from 'express';
import {
  getTerms,
  getTerm,
  createTerm,
  updateTerm,
  deleteTerm,
  reorderTerms
} from '@/controllers/termController';

const router = Router();

// GET /terms - Get all terms (optionally filter by schoolPeriodId)
router.get('/', getTerms);

// GET /terms/:id - Get specific term
router.get('/:id', getTerm);

// POST /terms - Create new term
router.post('/', createTerm);

// PUT /terms/:id - Update term
router.put('/:id', updateTerm);

// DELETE /terms/:id - Delete term
router.delete('/:id', deleteTerm);

// POST /terms/reorder - Reorder terms
router.post('/reorder', reorderTerms);

export default router;
