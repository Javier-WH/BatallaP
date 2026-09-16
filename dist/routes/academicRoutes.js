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
const academic = __importStar(require("../controllers/academicController.js"));
const router = (0, express_1.Router)();
// Periods
router.get('/periods', academic.getPeriods);
router.get('/active', academic.getActivePeriod);
router.get('/periods/active', academic.getActivePeriod);
router.get('/preinscription', academic.getPreinscriptionPeriod);
router.get('/periods/preinscription', academic.getPreinscriptionPeriod);
router.post('/periods/ensure-preinscription', academic.ensurePreinscriptionPeriod);
router.post('/periods', academic.createPeriod);
router.put('/periods/:id/activate', academic.togglePeriodActive);
router.put('/periods/:id', academic.updatePeriod);
router.delete('/periods/:id', academic.deletePeriod);
router.get('/periods/:periodId/outcomes', academic.getStudentPeriodOutcomes);
// Catalogs
router.get('/grades', academic.getGrades);
router.post('/grades', academic.createGrade);
router.put('/grades/:id', academic.updateGrade);
router.delete('/grades/:id', academic.deleteGrade);
router.post('/grades/reorder', academic.updateGradeOrder);
router.get('/sections', academic.getSections);
router.post('/sections', academic.createSection);
router.put('/sections/:id', academic.updateSection);
router.delete('/sections/:id', academic.deleteSection);
router.get('/subjects', academic.getSubjects);
router.post('/subjects', academic.createSubject);
router.put('/subjects/:id', academic.updateSubject);
router.delete('/subjects/:id', academic.deleteSubject);
// Subject Groups
router.get('/subject-groups', academic.getSubjectGroups);
router.post('/subject-groups', academic.createSubjectGroup);
router.put('/subject-groups/:id', academic.updateSubjectGroup);
router.delete('/subject-groups/:id', academic.deleteSubjectGroup);
router.get('/specializations', academic.getSpecializations);
router.post('/specializations', academic.createSpecialization);
router.put('/specializations/:id', academic.updateSpecialization);
router.delete('/specializations/:id', academic.deleteSpecialization);
// Structure
router.get('/structure/:periodId', academic.getPeriodStructure);
router.post('/structure/period-grade', academic.addGradeToPeriod);
router.delete('/structure/period-grade/:id', academic.removeGradeFromPeriod);
router.post('/structure/section', academic.addSectionToGrade);
router.post('/structure/section/remove', academic.removeSectionFromGrade);
router.delete('/structure/section/:periodGradeId/:sectionId', academic.removeSectionFromGrade);
router.put('/structure/section/:periodGradeId/:sectionId/color', academic.updateSectionColor);
router.put('/structure/grade/:periodGradeId/color', academic.updateGradeColor);
router.post('/structure/subject', academic.addSubjectToGrade);
router.post('/structure/subject/remove', academic.removeSubjectFromGrade);
router.post('/structure/subject/reorder', academic.updateSubjectOrderForGrade);
router.post('/structure/subject/toggle-average', academic.toggleSubjectIncludeInAverage);
router.post('/structure/subject/toggle-repairable', academic.toggleSubjectNotRepairable);
router.post('/structure/subject/weekly-blocks', academic.updateSubjectWeeklyBlocks);
router.get('/structure/subject/:periodGradeId/:subjectId', academic.getPeriodGradeSubject);
// Using POST because of composite key body
exports.default = router;
