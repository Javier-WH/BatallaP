"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const thematicComponentController_1 = require("../controllers/thematicComponentController.js");
const router = (0, express_1.Router)();
// Thematic Components
router.get('/', thematicComponentController_1.getThematicComponents);
router.post('/', thematicComponentController_1.createThematicComponent);
router.put('/:id', thematicComponentController_1.updateThematicComponent);
router.delete('/:id', thematicComponentController_1.deleteThematicComponent);
router.patch('/reorder', thematicComponentController_1.reorderThematicComponents);
// Thematic Contents (nested under component)
router.post('/:id/contents', thematicComponentController_1.createThematicContent);
router.put('/contents/:id', thematicComponentController_1.updateThematicContent);
router.delete('/contents/:id', thematicComponentController_1.deleteThematicContent);
router.patch('/contents/reorder', thematicComponentController_1.reorderThematicContents);
// Expected Learnings
router.post('/learnings', thematicComponentController_1.createExpectedLearning);
router.put('/learnings/:id', thematicComponentController_1.updateExpectedLearning);
router.delete('/learnings/:id', thematicComponentController_1.deleteExpectedLearning);
exports.default = router;
