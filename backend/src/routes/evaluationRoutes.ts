import { Router } from 'express';
import {
  getMyAssignments,
  getEvaluationPlan,
  createEvaluationItem,
  updateEvaluationItem,
  deleteEvaluationItem,
  getStudentsForAssignment,
  getQualifications,
  saveQualification,
  getStudentFullAcademicRecord,
  updateFinalGrade,
  getFinalGradesByPeriod,
  exportGradesExcel,
  exportGradesExcelOficial,
  getAllAssignments,
  getQualificationAudits,
  getAllQualificationAudits,
  exportPlanningExcel
} from '@/controllers/evaluationController';

const router = Router();

router.get('/my-assignments', getMyAssignments);
router.get('/plan/:periodGradeSubjectId', getEvaluationPlan);
router.post('/plan', createEvaluationItem);
router.put('/plan/:id', updateEvaluationItem);
router.delete('/plan/:id', deleteEvaluationItem);
router.get('/students/:assignmentId', getStudentsForAssignment);
router.get('/qualifications/:inscriptionSubjectId', getQualifications);
router.post('/qualifications', saveQualification);
router.get('/student-record/:personId', getStudentFullAcademicRecord);
router.put('/final-grade/:id', updateFinalGrade);
router.get('/final-grades-by-period', getFinalGradesByPeriod);
router.get('/export-planning/:assignmentId', exportPlanningExcel);
router.get('/export-grades/:assignmentId', exportGradesExcel);
router.get('/export-grades-oficial/:assignmentId', exportGradesExcelOficial);
router.get('/all-assignments', getAllAssignments);
router.get('/qualification-audits/:assignmentId', getQualificationAudits);
router.get('/all-qualification-audits', getAllQualificationAudits);

export default router;
