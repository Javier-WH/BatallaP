import { Router } from 'express';
import * as attendanceController from '@/controllers/attendanceController';

const router = Router();

// Teacher module
router.get('/my-sessions', attendanceController.getMySessions);
router.get('/sessions/:id', attendanceController.getSession);
router.put('/sessions/:id/records', attendanceController.putSessionRecords);
router.post('/sessions/:id/clear-block', attendanceController.postClearSessionBlock);
router.post('/records/:id/clear', attendanceController.postClearRecord);
router.get('/records/:id/audits', attendanceController.getRecordAudits);

// Shared catalog
router.get('/clearance-reasons', attendanceController.getClearanceReasons);

// Staff views
router.get('/sessions', attendanceController.listSessions);
router.get('/students/:personId/summary', attendanceController.getStudentSummary);

export default router;
