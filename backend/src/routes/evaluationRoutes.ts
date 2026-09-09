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
  exportPlanningExcel,
  copyEvaluationPlan,
  recalculatePeriodGrades,
  createQualificationEditRequest,
  getPendingQualificationEditRequests,
  reviewQualificationEditRequest,
  resetQualificationTimer
} from '@/controllers/evaluationController';

const router = Router();

router.get('/my-assignments', getMyAssignments);
router.get('/plan/:periodGradeSubjectId', getEvaluationPlan);
router.post('/plan', createEvaluationItem);
router.post('/copy-plan', copyEvaluationPlan);
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
router.post('/recalculate/:schoolPeriodId', recalculatePeriodGrades);

// Qualification edit request (timer-locked grade permission flow)
router.post('/grade-edit-request', createQualificationEditRequest);
router.get('/grade-edit-requests/pending', getPendingQualificationEditRequests);
router.put('/grade-edit-request/:id/review', reviewQualificationEditRequest);
router.post('/reset-timer', resetQualificationTimer);

export default router;
