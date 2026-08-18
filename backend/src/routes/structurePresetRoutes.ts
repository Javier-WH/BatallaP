import { Router } from 'express';
import {
  listStructurePresets,
  createStructurePreset,
  deleteStructurePreset,
  applyStructurePreset
} from '@/controllers/structurePresetController';

const router = Router();

router.get('/', listStructurePresets);
router.post('/', createStructurePreset);
router.delete('/:id', deleteStructurePreset);
router.post('/:id/apply', applyStructurePreset);

export default router;
