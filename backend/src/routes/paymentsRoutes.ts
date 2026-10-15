import { Router } from 'express';
import { requirePaymentsAccess, requireSession } from '@/middlewares/paymentsAccessMiddleware';
import {
  // Exchange rate types
  listExchangeRateTypes,
  createExchangeRateType,
  updateExchangeRateType,
  deleteExchangeRateType,
  // Exchange rates
  listExchangeRates,
  upsertExchangeRate,
  getRatesAtDate,
  bulkImportExchangeRates,
  fetchBcvRates,
  // Fees
  listFees,
  upsertFee,
  updateFee,
  updateBillingCalendar,
  previewChargeSync,
  applyChargeSync,
  // Sellable items
  listSellableItems,
  createSellableItem,
  updateSellableItem,
  deleteSellableItem,
  // Enrollment plans
  listEnrollmentPlans,
  getEnrollmentPlan,
  createEnrollmentPlan,
  updateEnrollmentPlan,
  deleteEnrollmentPlan,
  calculateEnrollmentPlan,
} from '@/controllers/paymentsController';

const router = Router();

// Read-only exchange rates are consumed by every role (header calculator,
// SchoolContext, offline snapshot): session only.
router.get('/exchange-rates', requireSession, listExchangeRates);
router.get('/exchange-rates/at-date', requireSession, getRatesAtDate);

// Everything else requires Master/Administrador
router.use(requirePaymentsAccess);

// ── Exchange Rate Types ──
router.get('/exchange-rate-types', listExchangeRateTypes);
router.post('/exchange-rate-types', createExchangeRateType);
router.put('/exchange-rate-types/:id', updateExchangeRateType);
router.delete('/exchange-rate-types/:id', deleteExchangeRateType);

// ── Exchange Rates (writes) ──
router.post('/exchange-rates', upsertExchangeRate);
router.post('/exchange-rates/bulk', bulkImportExchangeRates);
router.post('/exchange-rates/fetch-bcv', fetchBcvRates);

// ── Fees ──
router.get('/fees', listFees);
router.post('/fees', upsertFee);
router.put('/fees/:id', updateFee);

// ── Charge generation / sync (whole period) ──
router.post('/charges/preview', previewChargeSync);
router.post('/charges/apply', applyChargeSync);

// ── Billing calendar ──
router.put('/billing-calendar/:schoolPeriodId', updateBillingCalendar);

// ── Sellable Items ──
router.get('/sellable-items', listSellableItems);
router.post('/sellable-items', createSellableItem);
router.put('/sellable-items/:id', updateSellableItem);
router.delete('/sellable-items/:id', deleteSellableItem);

// ── Enrollment Plans ──
router.get('/enrollment-plans', listEnrollmentPlans);
router.get('/enrollment-plans/:id', getEnrollmentPlan);
router.post('/enrollment-plans', createEnrollmentPlan);
router.put('/enrollment-plans/:id', updateEnrollmentPlan);
router.delete('/enrollment-plans/:id', deleteEnrollmentPlan);
router.get('/enrollment-plans/:id/calculate', calculateEnrollmentPlan);

export default router;
