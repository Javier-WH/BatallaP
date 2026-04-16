import { Router } from 'express';
import { generate, listByPerson, getByUuid } from '@/controllers/enrollmentReportController';

const router = Router();

router.post('/generate/:matriculationId', generate);
router.get('/person/:personId', listByPerson);
router.get('/:uuid', getByUuid);

export default router;
