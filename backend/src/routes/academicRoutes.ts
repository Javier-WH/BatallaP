import { Router } from 'express';
import * as academic from '@/controllers/academicController';

const router = Router();

// Periods
router.get('/periods', academic.getPeriods);
router.get('/active', academic.getActivePeriod);
router.post('/periods', academic.createPeriod);
router.put('/periods/:id/activate', academic.togglePeriodActive);
router.put('/periods/:id', academic.updatePeriod);
router.delete('/periods/:id', academic.deletePeriod);

// Catalogs
router.get('/grades', academic.getGrades);
router.post('/grades', academic.createGrade);
router.put('/grades/:id', academic.updateGrade);
router.delete('/grades/:id', academic.deleteGrade);

router.get('/sections', academic.getSections);
router.post('/sections', academic.createSection);
router.put('/sections/:id', academic.updateSection);
router.delete('/sections/:id', academic.deleteSection);

router.get('/subjects', academic.getSubjects);
router.post('/subjects', academic.createSubject);
router.put('/subjects/:id', academic.updateSubject);
router.delete('/subjects/:id', academic.deleteSubject);

router.get('/specializations', academic.getSpecializations);
router.post('/specializations', academic.createSpecialization);
router.put('/specializations/:id', academic.updateSpecialization);
router.delete('/specializations/:id', academic.deleteSpecialization);

// Structure
router.get('/structure/:periodId', academic.getPeriodStructure);
router.post('/structure/period-grade', academic.addGradeToPeriod);
router.delete('/structure/period-grade/:id', academic.removeGradeFromPeriod);
router.post('/structure/section', academic.addSectionToGrade);
router.post('/structure/section/remove', academic.removeSectionFromGrade);
router.post('/structure/subject', academic.addSubjectToGrade);
router.post('/structure/subject/remove', academic.removeSubjectFromGrade); // Using POST because of composite key body

export default router;
