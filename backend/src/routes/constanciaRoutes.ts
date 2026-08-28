import { Router } from 'express';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  generatePreview,
  getVariables,
  analyzeTemplate,
} from '@/controllers/constanciaController';

const router = Router();

// Variables metadata (for editor)
router.get('/variables', getVariables);

// Analyze template variables
router.get('/analyze/:id', analyzeTemplate);

// Template CRUD
router.get('/', listTemplates);
router.get('/:id', getTemplate);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

// Generate
router.post('/preview', generatePreview);

export default router;
