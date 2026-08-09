import { Router } from 'express';
import excelUpload from '@/middlewares/excelUploadMiddleware';
import {
  bulkRegister,
  bulkProcessExcel,
  createInscription,
  downloadBulkTemplate,
  getExternalGradesForPerson,
  listGrades,
  listSubjects,
  removeGrade,
  resolvePlantel,
  updateGrade,
  upsertGrade,
} from '@/controllers/externalGradeController';

const router = Router();

// External grades management (transferencia / equivalencia)

// GET /api/external-grades/persons/:personId - External inscriptions + grades for a student
router.get('/persons/:personId', getExternalGradesForPerson);

// GET /api/external-grades/grades - List external grades (filters: personId, plantelId)
router.get('/grades', listGrades);

// GET /api/external-grades/subjects - Subject catalog for selectors
router.get('/subjects', listSubjects);

// GET /api/external-grades/bulk/template - Download Excel template
router.get('/bulk/template', downloadBulkTemplate);

// POST /api/external-grades/planteles - Resolve or create external plantel
router.post('/planteles', resolvePlantel);

// POST /api/external-grades/inscriptions - Create external inscription
router.post('/inscriptions', createInscription);

// POST /api/external-grades/grades - Upsert external grade
router.post('/grades', upsertGrade);

// PUT /api/external-grades/grades/:id - Update external grade
router.put('/grades/:id', updateGrade);

// DELETE /api/external-grades/grades/:id - Delete external grade
router.delete('/grades/:id', removeGrade);

// POST /api/external-grades/bulk - Bulk register external grades (JSON array)
router.post('/bulk', bulkRegister);

// POST /api/external-grades/bulk/process - Process uploaded Excel file
router.post('/bulk/process', excelUpload.single('file'), bulkProcessExcel);

export default router;
