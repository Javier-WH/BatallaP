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
const pendingSubjectController = __importStar(require("../controllers/pendingSubjectController.js"));
const router = (0, express_1.Router)();
// Structure & management
router.get('/structure', pendingSubjectController.getMpStructure);
router.get('/students/:gradeId', pendingSubjectController.getStudentsForMpRegistration);
router.post('/register', pendingSubjectController.registerStudentsInMp);
router.delete('/remove/:inscriptionSubjectId', pendingSubjectController.removeStudentFromMp);
// Nóminas — must be before /:pendingSubjectId/* to avoid param capture
router.get('/nomina/:gradeId/encounter', pendingSubjectController.getMpNominaByEncounter);
router.get('/nomina/:gradeId', pendingSubjectController.getMpNomina);
router.get('/nomina-final/:gradeId', pendingSubjectController.getMpNominaFinal);
// Teacher panel
router.get('/teacher-assignments', pendingSubjectController.getMpTeacherAssignments);
router.get('/assignment/:periodGradeSubjectId', pendingSubjectController.getMpAssignmentDetail);
router.get('/assignment/:periodGradeSubjectId/encounters', pendingSubjectController.getMpAssignmentEncounters);
// Encounter dates by periodGradeSubjectId (CE — works without students)
router.get('/encounter-dates/:periodGradeSubjectId', pendingSubjectController.getMpEncounterDatesByPgs);
router.put('/encounter-dates/:periodGradeSubjectId', pendingSubjectController.updateMpEncounterDatesByPgs);
// Locked encounters (CE controls which encounters teachers can edit)
router.get('/locked-encounters', pendingSubjectController.getMpLockedEncounters);
router.put('/locked-encounters', pendingSubjectController.updateMpLockedEncounters);
// Grades
router.post('/final-grade', pendingSubjectController.saveMpFinalGrade);
router.post('/evaluation-plan', pendingSubjectController.createMpEvaluationItem);
router.put('/evaluation-plan/:id', pendingSubjectController.updateMpEvaluationItem);
router.delete('/evaluation-plan/:id', pendingSubjectController.deleteMpEvaluationItem);
router.post('/qualification', pendingSubjectController.saveMpQualification);
// Encounters (new system)
router.get('/:pendingSubjectId/encounters', pendingSubjectController.getMpEncounters);
router.put('/:pendingSubjectId/encounters', pendingSubjectController.updateMpEncounterDates);
router.post('/:pendingSubjectId/encounters/:encounterNumber/score', pendingSubjectController.saveMpEncounterScore);
// Content (Tema General + Contenidos)
router.get('/:pendingSubjectId/content', pendingSubjectController.getMpContent);
router.put('/:pendingSubjectId/content', pendingSubjectController.updateMpContent);
exports.default = router;
