import { Router } from 'express';
import { exportDiarios } from '@/controllers/diarioController';

const router = Router();

router.get('/export', exportDiarios);

export default router;
