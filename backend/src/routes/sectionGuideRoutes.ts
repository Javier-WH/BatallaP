import { Router } from 'express';
import { getTeachersForSection, setSectionGuide, getSectionGuide } from '@/controllers/sectionGuideController';

const router = Router();

router.get('/teachers', getTeachersForSection);
router.get('/', getSectionGuide);
router.post('/', setSectionGuide);

export default router;
