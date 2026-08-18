import { Router } from 'express';
import {
  listPresets,
  getPreset,
  createPreset,
  updatePreset,
  deletePreset,
  applyPreset
} from '@/controllers/subjectPresetController';

const router = Router();

router.get('/', listPresets);
router.get('/:id', getPreset);
router.post('/', createPreset);
router.put('/:id', updatePreset);
router.delete('/:id', deletePreset);
router.post('/:id/apply', applyPreset);

export default router;
