import { Router } from 'express';
import { verifyPayment } from '@/controllers/bankVerificationController';

const router = Router();

router.post('/verify', verifyPayment);

export default router;
