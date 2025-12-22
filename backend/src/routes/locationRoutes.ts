import { Router } from 'express';
import { getVenezuelaLocations } from '@/controllers/locationController';

const router = Router();

router.get('/venezuela', getVenezuelaLocations);

export default router;
