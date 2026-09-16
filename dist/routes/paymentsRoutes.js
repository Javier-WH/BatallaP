"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentsController_1 = require("../controllers/paymentsController.js");
const router = (0, express_1.Router)();
// ── Exchange Rate Types ──
router.get('/exchange-rate-types', paymentsController_1.listExchangeRateTypes);
router.post('/exchange-rate-types', paymentsController_1.createExchangeRateType);
router.put('/exchange-rate-types/:id', paymentsController_1.updateExchangeRateType);
router.delete('/exchange-rate-types/:id', paymentsController_1.deleteExchangeRateType);
// ── Exchange Rates (historical) ──
router.get('/exchange-rates', paymentsController_1.listExchangeRates);
router.get('/exchange-rates/at-date', paymentsController_1.getRatesAtDate);
router.post('/exchange-rates', paymentsController_1.upsertExchangeRate);
router.post('/exchange-rates/bulk', paymentsController_1.bulkImportExchangeRates);
router.post('/exchange-rates/fetch-bcv', paymentsController_1.fetchBcvRates);
// ── Fees ──
router.get('/fees', paymentsController_1.listFees);
router.post('/fees', paymentsController_1.upsertFee);
router.put('/fees/:id', paymentsController_1.updateFee);
// ── Sellable Items ──
router.get('/sellable-items', paymentsController_1.listSellableItems);
router.post('/sellable-items', paymentsController_1.createSellableItem);
router.put('/sellable-items/:id', paymentsController_1.updateSellableItem);
router.delete('/sellable-items/:id', paymentsController_1.deleteSellableItem);
// ── Enrollment Plans ──
router.get('/enrollment-plans', paymentsController_1.listEnrollmentPlans);
router.get('/enrollment-plans/:id', paymentsController_1.getEnrollmentPlan);
router.post('/enrollment-plans', paymentsController_1.createEnrollmentPlan);
router.put('/enrollment-plans/:id', paymentsController_1.updateEnrollmentPlan);
router.delete('/enrollment-plans/:id', paymentsController_1.deleteEnrollmentPlan);
router.get('/enrollment-plans/:id/calculate', paymentsController_1.calculateEnrollmentPlan);
exports.default = router;
