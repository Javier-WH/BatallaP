import { Router } from 'express';
import { requireSession, requirePaymentsAccess } from '@/middlewares/paymentsAccessMiddleware';
import bankIconUpload from '@/middlewares/bankIconUploadMiddleware';
import { listBanks, createBank, updateBank } from '@/controllers/bankController';

const router = Router();

// Read is open to any session (payment modal uses the catalog);
// writes require the payments-module role guard.
router.get('/', requireSession, listBanks);
router.post('/', requirePaymentsAccess, bankIconUpload.single('icon'), createBank);
router.put('/:id', requirePaymentsAccess, bankIconUpload.single('icon'), updateBank);

export default router;
