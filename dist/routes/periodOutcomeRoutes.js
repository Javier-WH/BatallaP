"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const periodOutcomeController_1 = require("../controllers/periodOutcomeController.js");
const router = (0, express_1.Router)();
router.get('/:periodId/outcomes', periodOutcomeController_1.getPeriodOutcomes);
router.get('/:periodId/pending-subjects', periodOutcomeController_1.getPendingSubjects);
router.post('/pending-subjects/:pendingSubjectId/resolve', periodOutcomeController_1.resolvePendingSubject);
exports.default = router;
