import { Router } from 'express';
import {
  verifyPayment, listProviders, listConnections, createConnection, updateConnection, deleteConnection,
} from '@/controllers/bankVerificationController';

const router = Router();

router.get('/providers', listProviders);
router.get('/connections', listConnections);
router.post('/connections', createConnection);
router.put('/connections/:id', updateConnection);
router.delete('/connections/:id', deleteConnection);
router.post('/verify', verifyPayment);

export default router;
