"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const termController_1 = require("../controllers/termController.js");
const router = (0, express_1.Router)();
// GET /terms - Get all terms (optionally filter by schoolPeriodId)
router.get('/', termController_1.getTerms);
// GET /terms/:id - Get specific term
router.get('/:id', termController_1.getTerm);
// POST /terms - Create new term
router.post('/', termController_1.createTerm);
// PUT /terms/:id - Update term
router.put('/:id', termController_1.updateTerm);
// DELETE /terms/:id - Delete term
router.delete('/:id', termController_1.deleteTerm);
// POST /terms/reorder - Reorder terms
router.post('/reorder', termController_1.reorderTerms);
// PUT /terms/:id/council-date-override - Master-only council date override
router.put('/:id/council-date-override', termController_1.setCouncilDateOverride);
exports.default = router;
