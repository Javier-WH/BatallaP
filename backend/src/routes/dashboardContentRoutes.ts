import { Router } from 'express';
import { getContent, updateContent, uploadDashboardImage, deleteDashboardImage } from '@/controllers/dashboardContentController';
import dashboardImageUpload from '@/middlewares/dashboardImageUploadMiddleware';

const router = Router();

// Get dashboard content (any authenticated user)
router.get('/', getContent);

// Update dashboard content (staff roles only — enforced in controller)
router.put('/', updateContent);

// Upload dashboard image (staff roles only — enforced in controller)
router.post('/images', dashboardImageUpload.single('image'), uploadDashboardImage);

// Delete dashboard image (staff roles only — enforced in controller)
router.delete('/images/:filename', deleteDashboardImage);

export default router;
