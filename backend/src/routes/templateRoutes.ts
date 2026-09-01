import { Router } from 'express';
import templateUpload from '@/middlewares/templateUploadMiddleware';
import {
  listTemplates,
  uploadTemplate,
  deleteTemplate,
  getTemplateForGrade,
  listTemplateAssignments,
  assignTemplateToGrade,
  unassignTemplateFromGrade,
  listCertifiedTemplateAssignments,
  assignCertifiedTemplate,
  unassignCertifiedTemplate,
} from '@/controllers/templateController';

const router = Router();

router.get('/', listTemplates);
router.post('/', templateUpload.single('file'), uploadTemplate);
router.delete('/:name', deleteTemplate);

// Template assignment to grades (optionally scoped to a section)
router.get('/assignments', listTemplateAssignments);
router.get('/assignment/:gradeId', getTemplateForGrade);
router.post('/assignment', assignTemplateToGrade);
router.delete('/assignment/:gradeId', unassignTemplateFromGrade);

// Certified grades template assignments (per period category)
router.get('/certified-assignments', listCertifiedTemplateAssignments);
router.post('/certified-assignment', assignCertifiedTemplate);
router.delete('/certified-assignment/:periodKey', unassignCertifiedTemplate);

export default router;