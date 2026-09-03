import { Router } from 'express';
import { exportDiarios, exportDiariosHtml } from '@/controllers/diarioController';

const router = Router();

router.get('/export', exportDiarios);
router.get('/html', exportDiariosHtml);

export default router;
