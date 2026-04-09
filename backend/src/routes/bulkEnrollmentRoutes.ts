import { Router } from 'express';
import excelUpload from '@/middlewares/excelUploadMiddleware';
import { downloadTemplate, previewBulk, processBulk, retrySingleRow } from '@/controllers/bulkEnrollmentController';

const router = Router();

router.get('/template', downloadTemplate);
router.post('/preview', excelUpload.single('file'), previewBulk);
router.post('/process', processBulk);
router.post('/retry-single', retrySingleRow);

export default router;
