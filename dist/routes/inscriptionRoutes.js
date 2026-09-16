"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inscriptionController_1 = require("../controllers/inscriptionController");
const router = (0, express_1.Router)();
router.get('/', inscriptionController_1.getInscriptions);
// /stats must be registered before /:id to avoid the param route capturing "stats".
router.get('/stats', inscriptionController_1.getInscriptionsStats);
router.get('/:id', inscriptionController_1.getInscriptionById);
router.post('/', inscriptionController_1.createInscription);
router.post('/register', inscriptionController_1.registerAndEnroll); // New: Register Person + Enroll (no User)
router.post('/quick-register', inscriptionController_1.quickRegister); // Minimal data enrollment (Admin)
router.put('/:id', inscriptionController_1.updateInscription);
router.patch('/:id', inscriptionController_1.updateInscription); // Same handler as PUT for partial updates
router.delete('/:id', inscriptionController_1.deleteInscription);
// Sub-resource for subjects (manual management)
router.post('/:id/subjects', inscriptionController_1.addSubjectToInscription);
router.delete('/:id/subjects/:subjectId', inscriptionController_1.removeSubjectFromInscription);
// Per-term group subject choices (backfill + validation)
router.get('/:id/group-choices', inscriptionController_1.getGroupSubjectChoices);
router.put('/:id/group-choices', inscriptionController_1.setGroupSubjectForTerm);
router.post('/:id/group-choices/check', inscriptionController_1.checkGroupSubjectChangeImpact);
// Withdraw / reactivate (retire student from section, preserve academic data)
router.post('/:id/withdraw', inscriptionController_1.withdrawInscription);
router.post('/:id/reactivate', inscriptionController_1.reactivateInscription);
// Un-matriculate: send back to "No Matriculados" without deleting anything
router.post('/:id/unmatriculate', inscriptionController_1.unmatriculateInscription);
exports.default = router;
