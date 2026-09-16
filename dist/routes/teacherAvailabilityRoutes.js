"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const teacherAvailabilityController_1 = require("../controllers/teacherAvailabilityController.js");
const router = (0, express_1.Router)();
// GET /api/teacher-availability — current user's availability
router.get('/', teacherAvailabilityController_1.getMyAvailability);
// POST /api/teacher-availability — save current user's availability
router.post('/', teacherAvailabilityController_1.saveMyAvailability);
// GET /api/teacher-availability/all — all teachers' availability (for Control de Estudios)
router.get('/all', teacherAvailabilityController_1.getAllAvailability);
// GET /api/teacher-availability/:personId — specific teacher's availability
router.get('/:personId', teacherAvailabilityController_1.getTeacherAvailability);
// POST /api/teacher-availability/:personId — save specific teacher's availability (for Control de Estudios)
router.post('/:personId', teacherAvailabilityController_1.saveTeacherAvailability);
exports.default = router;
