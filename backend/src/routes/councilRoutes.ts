import { Router } from 'express';
import * as councilController from '@/controllers/councilController';

const router = Router();

router.get('/data', councilController.getCouncilData);
router.post('/save', councilController.saveCouncilPoint);
router.post('/bulk-save', councilController.bulkSaveCouncilPoints);

export default router;
