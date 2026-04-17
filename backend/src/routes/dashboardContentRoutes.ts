import { Router } from 'express';
import { getContent, updateContent, uploadDashboardImage, deleteDashboardImage } from '@/controllers/dashboardContentController';
import dashboardImageUpload from '@/middlewares/dashboardImageUploadMiddleware';

const router = Router();

// Get dashboard content (public)
router.get('/', getContent);

// Update dashboard content (Master/Admin only - will be protected by middleware)
router.put('/', updateContent);

// Upload dashboard image
router.post('/images', dashboardImageUpload.single('image'), uploadDashboardImage);

// Delete dashboard image
router.delete('/images/:filename', deleteDashboardImage);

export default router;
