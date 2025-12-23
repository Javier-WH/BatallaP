import { Router } from 'express';
import {
  listPlanteles,
  getPlantel,
  searchPlanteles,
  createPlantel,
  updatePlantel,
  deletePlantel
} from '@/controllers/plantelController';

const router = Router();

// GET /api/planteles - List all planteles with optional filtering
router.get('/', listPlanteles);

// GET /api/planteles/search - Search planteles with suggestions
router.get('/search', searchPlanteles);

// GET /api/planteles/:code - Get plantel by code or name
router.get('/:code', getPlantel);

// POST /api/planteles - Create new plantel
router.post('/', createPlantel);

// PUT /api/planteles/:id - Update plantel
router.put('/:id', updatePlantel);

// DELETE /api/planteles/:id - Delete plantel
router.delete('/:id', deletePlantel);

export default router;
