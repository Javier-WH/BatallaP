import { Router } from 'express';
import { listAssignments, createAssignment, deleteAssignment, getGridState, saveGridState } from '@/controllers/classroomAssignmentController';

const router = Router();

router.get('/grid/:schoolPeriodId', getGridState);
router.put('/grid/:schoolPeriodId', saveGridState);
router.get('/', listAssignments);
router.post('/', createAssignment);
router.delete('/:id', deleteAssignment);

export default router;
