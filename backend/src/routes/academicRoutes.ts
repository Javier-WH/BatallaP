import { Router } from 'express';
import * as academic from '@/controllers/academicController';

const router = Router();

// Periods
router.get('/periods', academic.getPeriods);
router.post('/periods', academic.createPeriod);
router.put('/periods/:id/activate', academic.togglePeriodActive);

// Catalogs
router.get('/grades', academic.getGrades);
router.post('/grades', academic.createGrade);
router.put('/grades/:id', academic.updateGrade);
router.delete('/grades/:id', academic.deleteGrade);

router.get('/sections', academic.getSections);
router.post('/sections', academic.createSection);
router.put('/sections/:id', academic.updateSection);
router.delete('/sections/:id', academic.deleteSection);

// Structure
router.get('/structure/:periodId', academic.getPeriodStructure);
router.post('/structure/period-grade', academic.addGradeToPeriod);
router.delete('/structure/period-grade/:id', academic.removeGradeFromPeriod);
router.post('/structure/section', academic.addSectionToGrade);
router.post('/structure/section/remove', academic.removeSectionFromGrade); // Using POST because of composite key body

export default router;
