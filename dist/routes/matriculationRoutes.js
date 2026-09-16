"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inscriptionController_1 = require("../controllers/inscriptionController.js");
const router = (0, express_1.Router)();
router.get('/', inscriptionController_1.getMatriculations);
// /stats must be registered before /:id to avoid the param route capturing "stats".
router.get('/stats', inscriptionController_1.getMatriculationsStats);
router.post('/bulk-visibility', inscriptionController_1.bulkToggleMatriculationVisibility);
router.get('/:id', inscriptionController_1.getMatriculationById);
router.patch('/:id', inscriptionController_1.updateMatriculation);
router.post('/:id/enroll', inscriptionController_1.enrollMatriculatedStudent);
router.patch('/:id/visibility', inscriptionController_1.toggleMatriculationVisibility);
exports.default = router;
