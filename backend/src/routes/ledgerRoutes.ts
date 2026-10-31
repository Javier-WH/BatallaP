import { Router } from 'express';
import { requirePaymentsAccess, requireDebtView } from '@/middlewares/paymentsAccessMiddleware';
import {
  getLedgerBySection,
  createPayment,
  createSharedPayment,
  previewSharedPayment,
  getSharedStudents,
  createCharge,
  bulkCreateCharges,
  deletePayment,
  movePayment,
  reSharePayment,
  listPaymentAudit,
  getPaymentsReport,
  deleteCharge,
  getSectionsForPeriod,
  searchWithdrawnStudents,
  updateEntryMonth,
  getInscriptionPlan,
  setInscriptionPlan,
  getInscriptionDebt,
  releasePapers,
  listInscriptionDiscounts,
  createInscriptionDiscount,
  updateInscriptionDiscount,
  deleteInscriptionDiscount,
  deliverItemUnits,
  undoItemDelivery,
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

// GET withdrawn students (latest inscription withdrawn) by name/document —
// powers the "add debt to a withdrawn student" flow.
router.get('/withdrawn-students', searchWithdrawnStudents);

// Discounts / scholarships of an inscription.
// Declared BEFORE the generic /:schoolPeriodId/:gradeId/:sectionId route, which would swallow the GET.
router.get('/inscriptions/:id/discounts', listInscriptionDiscounts);
router.post('/inscriptions/:id/discounts', createInscriptionDiscount);
router.put('/discounts/:id', updateInscriptionDiscount);
router.delete('/discounts/:id', deleteInscriptionDiscount);

// PUT change the entry month of an inscription (generates the debts it now owes)
router.put('/inscriptions/:id/entry-month', updateEntryMonth);
router.get('/inscriptions/:id/shared-students', getSharedStudents);
router.get('/inscriptions/:id/enrollment-plan', getInscriptionPlan);
router.put('/inscriptions/:id/enrollment-plan', setInscriptionPlan);

// GET ledger data for a grade+section in a period
router.get('/:schoolPeriodId/:gradeId/:sectionId', getLedgerBySection);

// POST create a payment
router.post('/payments', createPayment);

// POST one physical payment shared by several students of the same representative
router.post('/payments/shared/preview', previewSharedPayment);
router.post('/payments/shared', createSharedPayment);

// POST create a charge (debt)
router.post('/charges', createCharge);

// POST bulk create charges
router.post('/charges/bulk', bulkCreateCharges);

// DELETE a payment
router.delete('/payments/:id', deletePayment);

// POST move a payment entered under the wrong student to the right one
router.post('/payments/:id/move', movePayment);
router.post('/payments/:id/re-share', reSharePayment);

// GET corrections (deleted / moved payments) of a student
router.get('/payments/audit', listPaymentAudit);

// GET flat list of registered payments (movements summary sheet)
router.get('/payments/report', getPaymentsReport);

// DELETE a charge
router.delete('/charges/:id', deleteCharge);

// POST record hand-over of N units of an item charge (audited: who delivered)
router.post('/charges/:id/deliveries', deliverItemUnits);

// DELETE undo a mistaken delivery record
router.delete('/deliveries/:id', undoItemDelivery);

export default router;
