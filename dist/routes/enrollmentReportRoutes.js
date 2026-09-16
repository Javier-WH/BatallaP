"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const enrollmentReportController_1 = require("../controllers/enrollmentReportController.js");
const router = (0, express_1.Router)();
router.post('/generate/:matriculationId', enrollmentReportController_1.generate);
router.get('/person/:personId', enrollmentReportController_1.listByPerson);
router.get('/:uuid', enrollmentReportController_1.getByUuid);
exports.default = router;
