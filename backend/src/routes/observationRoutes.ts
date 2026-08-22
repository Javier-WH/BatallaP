import { Router } from 'express';
import { getSectionObservations, saveObservation, getObservationForBoletin } from '@/controllers/observationController';

const router = Router();

router.get('/boletin', getObservationForBoletin);
router.get('/', getSectionObservations);
router.put('/', saveObservation);

export default router;
