"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const revisionPeriodController = __importStar(require("../controllers/revisionPeriodController.js"));
const router = (0, express_1.Router)();
router.get('/:schoolPeriodId', revisionPeriodController.getRevisionPeriod);
router.post('/:schoolPeriodId/open', revisionPeriodController.openRevisionPeriod);
router.post('/:schoolPeriodId/lock', revisionPeriodController.lockRevisionPeriod);
router.post('/:schoolPeriodId/reopen', revisionPeriodController.reopenRevisionPeriod);
router.post('/:schoolPeriodId/recalculate', revisionPeriodController.recalculateRevisionPeriod);
router.post('/:schoolPeriodId/reset', revisionPeriodController.resetRevisionPeriod);
router.put('/:schoolPeriodId/max-opportunities', revisionPeriodController.updateMaxOpportunities);
router.post('/:schoolPeriodId/advance-opportunity', revisionPeriodController.advanceOpportunity);
router.get('/:schoolPeriodId/students', revisionPeriodController.getRevisionStudents);
router.get('/:schoolPeriodId/grades', revisionPeriodController.getRevisionGrades);
router.get('/:schoolPeriodId/export-nomina', revisionPeriodController.exportRevisionNominaExcel);
router.post('/:schoolPeriodId/finalize-revision-grades', revisionPeriodController.finalizeRevisionGrades);
router.post('/:schoolPeriodId/unfinalize-revision-grades', revisionPeriodController.unfinalizeRevisionGrades);
router.put('/:schoolPeriodId/revisions/bulk', revisionPeriodController.bulkSaveRevisionGrades);
router.put('/:schoolPeriodId/revisions/:revisionId', revisionPeriodController.saveRevisionGrade);
router.put('/:schoolPeriodId/revisions/:revisionId/override', revisionPeriodController.overrideRevisionGrade);
router.get('/:schoolPeriodId/revision-audits', revisionPeriodController.getRevisionGradeAudits);
router.get('/:schoolPeriodId/revisions/:revisionId/audits', revisionPeriodController.getRevisionGradeAudits);
exports.default = router;
