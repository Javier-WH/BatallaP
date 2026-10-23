import { Router } from 'express';
import { requirePaymentsAccess, requireSession } from '@/middlewares/paymentsAccessMiddleware';
import itemIconUpload from '@/middlewares/itemIconUploadMiddleware';
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
  updateParSettlement,
  listDiscountReasons,
  createDiscountReason,
  updateDiscountReason,
  listCurrencyDiscounts,
  createCurrencyDiscount,
  updateCurrencyDiscount,
  deleteCurrencyDiscount,
  previewChargeSync,
  applyChargeSync,
  // Sellable items
  listSellableItems,
  createSellableItem,
  updateSellableItem,
  deleteSellableItem,
  uploadSellableItemIcon,
  clearSellableItemIcon,
  getInventorySummary,
  getSellableItemInventory,
  createInventoryMovement,
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

// ── Discount reasons ──
router.get('/discount-reasons', listDiscountReasons);
router.post('/discount-reasons', createDiscountReason);
router.put('/discount-reasons/:id', updateDiscountReason);

// ── Currency discounts (paying in USDT, USD, …) ──
router.get('/currency-discounts', listCurrencyDiscounts);
router.post('/currency-discounts', createCurrencyDiscount);
router.put('/currency-discounts/:id', updateCurrencyDiscount);
router.delete('/currency-discounts/:id', deleteCurrencyDiscount);

// ── Charge generation / sync (whole period) ──
router.post('/charges/preview', previewChargeSync);
router.post('/charges/apply', applyChargeSync);

// ── Billing calendar ──
router.put('/billing-calendar/:schoolPeriodId', updateBillingCalendar);
router.put('/par-settlement/:schoolPeriodId', updateParSettlement);

// ── Sellable Items ──
router.get('/sellable-items', listSellableItems);
router.post('/sellable-items', createSellableItem);
router.put('/sellable-items/:id', updateSellableItem);
router.put('/sellable-items/:id/icon', itemIconUpload.single('icon'), uploadSellableItemIcon);
router.delete('/sellable-items/:id/icon', clearSellableItemIcon);
router.delete('/sellable-items/:id', deleteSellableItem);
// Sizes stock: summary, per-item detail and audited movements
router.get('/inventory-summary', getInventorySummary);
router.get('/sellable-items/:id/inventory', getSellableItemInventory);
router.post('/sellable-items/:id/inventory-movements', createInventoryMovement);

// ── Enrollment Plans ──
router.get('/enrollment-plans', listEnrollmentPlans);
router.get('/enrollment-plans/:id', getEnrollmentPlan);
router.post('/enrollment-plans', createEnrollmentPlan);
router.put('/enrollment-plans/:id', updateEnrollmentPlan);
router.delete('/enrollment-plans/:id', deleteEnrollmentPlan);
router.get('/enrollment-plans/:id/calculate', calculateEnrollmentPlan);

export default router;
