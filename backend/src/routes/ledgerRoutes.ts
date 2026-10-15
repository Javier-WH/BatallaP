import { Router } from 'express';
import { requirePaymentsAccess } from '@/middlewares/paymentsAccessMiddleware';
import {
  getLedgerBySection,
  createPayment,
  createCharge,
  bulkCreateCharges,
  deletePayment,
  deleteCharge,
  getSectionsForPeriod,
  updateEntryMonth,
} from '@/controllers/ledgerController';

const router = Router();

router.use(requirePaymentsAccess);

// GET sections available for a period (for dropdown)
router.get('/sections/:schoolPeriodId', getSectionsForPeriod);

// GET ledger data for a grade+section in a period
router.get('/:schoolPeriodId/:gradeId/:sectionId', getLedgerBySection);

// PUT change the entry month of an inscription (generates the debts it now owes)
router.put('/inscriptions/:id/entry-month', updateEntryMonth);

// POST create a payment
router.post('/payments', createPayment);

// POST create a charge (debt)
router.post('/charges', createCharge);

// POST bulk create charges
router.post('/charges/bulk', bulkCreateCharges);

// DELETE a payment
router.delete('/payments/:id', deletePayment);

// DELETE a charge
router.delete('/charges/:id', deleteCharge);

export default router;
