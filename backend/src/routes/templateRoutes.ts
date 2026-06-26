import { Router } from 'express';
import templateUpload from '@/middlewares/templateUploadMiddleware';
import { listTemplates, uploadTemplate, deleteTemplate } from '@/controllers/templateController';

const router = Router();

router.get('/', listTemplates);
router.post('/', templateUpload.single('file'), uploadTemplate);
router.delete('/:name', deleteTemplate);

export default router;