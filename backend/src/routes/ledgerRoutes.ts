import { Router } from 'express';
import {
  getLedgerBySection,
  createPayment,
  createCharge,
  bulkCreateCharges,
  deletePayment,
  deleteCharge,
  getSectionsForPeriod,
} from '@/controllers/ledgerController';

const router = Router();

// GET sections available for a period (for dropdown)
router.get('/sections/:schoolPeriodId', getSectionsForPeriod);

// GET ledger data for a grade+section in a period
router.get('/:schoolPeriodId/:gradeId/:sectionId', getLedgerBySection);

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
