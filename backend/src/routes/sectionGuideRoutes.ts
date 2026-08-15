import { Router } from 'express';
import { getTeachersForSection, setSectionGuide, getSectionGuide, getAllGuidesForPeriod } from '@/controllers/sectionGuideController';

const router = Router();

router.get('/all', getAllGuidesForPeriod);
router.get('/teachers', getTeachersForSection);
router.get('/', getSectionGuide);
router.post('/', setSectionGuide);

export default router;
