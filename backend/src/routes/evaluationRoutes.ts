import { Router } from 'express';
import {
  getMyAssignments,
  getEvaluationPlan,
  createEvaluationItem,
  updateEvaluationItem,
  deleteEvaluationItem,
  getStudentsForAssignment,
  getQualifications,
  saveQualification
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

export default router;
