import { Router } from 'express';
import {
  getClosedSections,
  getClosureStatus,
  closeSection,
  reopenSection,
} from '@/controllers/termSectionClosureController';

const router = Router({ mergeParams: true });

router.get('/:termId/section-closures', getClosedSections);
router.get('/:termId/closure-status', getClosureStatus);
router.post('/:termId/section-closures', closeSection);
router.delete('/:termId/section-closures/:sectionId/:gradeId', reopenSection);

export default router;
