import { Router } from 'express';
import {
  // Exchange rate types
  listExchangeRateTypes,
  createExchangeRateType,
  updateExchangeRateType,
  deleteExchangeRateType,
  // Exchange rates
  listExchangeRates,
  upsertExchangeRate,
  bulkImportExchangeRates,
  // Fees
  listFees,
  upsertFee,
  updateFee,
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

// ── Exchange Rate Types ──
router.get('/exchange-rate-types', listExchangeRateTypes);
router.post('/exchange-rate-types', createExchangeRateType);
router.put('/exchange-rate-types/:id', updateExchangeRateType);
router.delete('/exchange-rate-types/:id', deleteExchangeRateType);

// ── Exchange Rates (historical) ──
router.get('/exchange-rates', listExchangeRates);
router.post('/exchange-rates', upsertExchangeRate);
router.post('/exchange-rates/bulk', bulkImportExchangeRates);

// ── Fees ──
router.get('/fees', listFees);
router.post('/fees', upsertFee);
router.put('/fees/:id', updateFee);

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
