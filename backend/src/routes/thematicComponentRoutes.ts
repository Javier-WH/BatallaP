import { Router } from 'express';
import {
  getThematicComponents,
  createThematicComponent,
  updateThematicComponent,
  deleteThematicComponent,
  createThematicContent,
  updateThematicContent,
  deleteThematicContent,
  reorderThematicContents,
  createExpectedLearning,
  updateExpectedLearning,
  deleteExpectedLearning,
} from '@/controllers/thematicComponentController';

const router = Router();

// Thematic Components
router.get('/', getThematicComponents);
router.post('/', createThematicComponent);
router.put('/:id', updateThematicComponent);
router.delete('/:id', deleteThematicComponent);

// Thematic Contents (nested under component)
router.post('/:id/contents', createThematicContent);
router.put('/contents/:id', updateThematicContent);
router.delete('/contents/:id', deleteThematicContent);
router.patch('/contents/reorder', reorderThematicContents);

// Expected Learnings
router.post('/learnings', createExpectedLearning);
router.put('/learnings/:id', updateExpectedLearning);
router.delete('/learnings/:id', deleteExpectedLearning);

export default router;
