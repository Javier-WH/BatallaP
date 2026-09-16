"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const excelUploadMiddleware_1 = __importDefault(require("../middlewares/excelUploadMiddleware.js"));
const externalGradeController_1 = require("../controllers/externalGradeController.js");
const router = (0, express_1.Router)();
// External grades management (transferencia / equivalencia)
// GET /api/external-grades/persons/:personId - External inscriptions + grades for a student
router.get('/persons/:personId', externalGradeController_1.getExternalGradesForPerson);
// GET /api/external-grades/grades - List external grades (filters: personId, plantelId)
router.get('/grades', externalGradeController_1.listGrades);
// GET /api/external-grades/subjects - Subject catalog for selectors
router.get('/subjects', externalGradeController_1.listSubjects);
// GET /api/external-grades/bulk/template - Download Excel template
router.get('/bulk/template', externalGradeController_1.downloadBulkTemplate);
// POST /api/external-grades/planteles - Resolve or create external plantel
router.post('/planteles', externalGradeController_1.resolvePlantel);
// POST /api/external-grades/inscriptions - Create external inscription
router.post('/inscriptions', externalGradeController_1.createInscription);
// POST /api/external-grades/grades - Upsert external grade
router.post('/grades', externalGradeController_1.upsertGrade);
// PUT /api/external-grades/grades/:id - Update external grade
router.put('/grades/:id', externalGradeController_1.updateGrade);
// DELETE /api/external-grades/grades/:id - Delete external grade
router.delete('/grades/:id', externalGradeController_1.removeGrade);
// POST /api/external-grades/bulk - Bulk register external grades (JSON array)
router.post('/bulk', externalGradeController_1.bulkRegister);
// POST /api/external-grades/bulk/process - Process uploaded Excel file
router.post('/bulk/process', excelUploadMiddleware_1.default.single('file'), externalGradeController_1.bulkProcessExcel);
exports.default = router;
