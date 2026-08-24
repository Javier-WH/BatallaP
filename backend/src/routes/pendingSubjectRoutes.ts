import { Router } from 'express';
import * as pendingSubjectController from '@/controllers/pendingSubjectController';

const router = Router();

// Structure & management
router.get('/structure', pendingSubjectController.getMpStructure);
router.get('/students/:gradeId', pendingSubjectController.getStudentsForMpRegistration);
router.post('/register', pendingSubjectController.registerStudentsInMp);
router.delete('/remove/:inscriptionSubjectId', pendingSubjectController.removeStudentFromMp);
router.get('/nomina/:gradeId', pendingSubjectController.getMpNomina);

// Teacher panel
router.get('/teacher-assignments', pendingSubjectController.getMpTeacherAssignments);
router.get('/assignment/:periodGradeSubjectId', pendingSubjectController.getMpAssignmentDetail);

// Grades
router.post('/final-grade', pendingSubjectController.saveMpFinalGrade);
router.post('/evaluation-plan', pendingSubjectController.createMpEvaluationItem);
router.put('/evaluation-plan/:id', pendingSubjectController.updateMpEvaluationItem);
router.delete('/evaluation-plan/:id', pendingSubjectController.deleteMpEvaluationItem);
router.post('/qualification', pendingSubjectController.saveMpQualification);

export default router;
