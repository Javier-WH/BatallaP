import { Router } from 'express';
import { requirePaymentsAccess, requireDebtView } from '@/middlewares/paymentsAccessMiddleware';
import {
  getLedgerBySection,
  createPayment,
  createCharge,
  bulkCreateCharges,
  deletePayment,
  deleteCharge,
  getSectionsForPeriod,
  updateEntryMonth,
  getInscriptionDebt,
  releasePapers,
  listInscriptionDiscounts,
  createInscriptionDiscount,
  updateInscriptionDiscount,
  deleteInscriptionDiscount,
} from '@/controllers/ledgerController';

const router = Router();

// Debt summary of one inscription (all periods) + manual release of the
// document hold of a withdrawn student. Registered BEFORE the payments guard:
// Control de Estudios uses them in the withdrawal flow.
router.get('/inscriptions/:id/debt', requireDebtView, getInscriptionDebt);
router.post('/inscriptions/:id/release-papers', requireDebtView, releasePapers);

router.use(requirePaymentsAccess);

// GET sections available for a period (for dropdown)
router.get('/sections/:schoolPeriodId', getSectionsForPeriod);

// Discounts / scholarships of an inscription.
// Declared BEFORE the generic /:schoolPeriodId/:gradeId/:sectionId route, which would swallow the GET.
router.get('/inscriptions/:id/discounts', listInscriptionDiscounts);
router.post('/inscriptions/:id/discounts', createInscriptionDiscount);
router.put('/discounts/:id', updateInscriptionDiscount);
router.delete('/discounts/:id', deleteInscriptionDiscount);

// PUT change the entry month of an inscription (generates the debts it now owes)
router.put('/inscriptions/:id/entry-month', updateEntryMonth);

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
