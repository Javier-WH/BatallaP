import { Router } from 'express';
import * as pendingSubjectController from '@/controllers/pendingSubjectController';

const router = Router();

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

export default router;
