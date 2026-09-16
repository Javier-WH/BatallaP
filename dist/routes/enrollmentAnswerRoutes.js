"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const enrollmentAnswerController_1 = require("../controllers/enrollmentAnswerController.js");
const router = (0, express_1.Router)();
router.get('/:personId', enrollmentAnswerController_1.getAnswersByPerson);
router.post('/', enrollmentAnswerController_1.saveAnswersController);
router.post('/:personId', enrollmentAnswerController_1.saveAnswersController);
exports.default = router;
