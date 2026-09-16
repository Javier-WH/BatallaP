"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ledgerController_1 = require("../controllers/ledgerController.js");
const router = (0, express_1.Router)();
// GET sections available for a period (for dropdown)
router.get('/sections/:schoolPeriodId', ledgerController_1.getSectionsForPeriod);
// GET ledger data for a grade+section in a period
router.get('/:schoolPeriodId/:gradeId/:sectionId', ledgerController_1.getLedgerBySection);
// POST create a payment
router.post('/payments', ledgerController_1.createPayment);
// POST create a charge (debt)
router.post('/charges', ledgerController_1.createCharge);
// POST bulk create charges
router.post('/charges/bulk', ledgerController_1.bulkCreateCharges);
// DELETE a payment
router.delete('/payments/:id', ledgerController_1.deletePayment);
// DELETE a charge
router.delete('/charges/:id', ledgerController_1.deleteCharge);
exports.default = router;
