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
const revisionGradeController = __importStar(require("../controllers/revisionGradeController.js"));
const router = (0, express_1.Router)();
router.get('/my-assignments', revisionGradeController.getMyRevisionAssignments);
router.get('/my-assignments/:periodGradeSubjectId', revisionGradeController.getMyRevisionAssignmentDetail);
router.get('/thematic-selection', revisionGradeController.getRevisionThematicSelection);
router.put('/thematic-selection', revisionGradeController.saveRevisionThematicSelection);
router.get('/opportunity-dates', revisionGradeController.getRevisionOpportunityDates);
router.put('/opportunity-dates', revisionGradeController.saveRevisionOpportunityDates);
router.get('/export/:periodGradeSubjectId', revisionGradeController.exportRepairExcel);
exports.default = router;
