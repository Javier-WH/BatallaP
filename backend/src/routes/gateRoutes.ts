import { Router } from 'express';
import * as attendanceController from '@/controllers/attendanceController';

const router = Router();

// Gate check-in endpoint for future RFID readers (hardware not deployed yet).
router.post('/checkins', attendanceController.postGateCheckin);

export default router;
