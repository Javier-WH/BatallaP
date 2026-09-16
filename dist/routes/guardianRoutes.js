"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const guardianController_1 = require("../controllers/guardianController.js");
const router = (0, express_1.Router)();
router.get('/search', guardianController_1.searchGuardian);
router.post('/', guardianController_1.createGuardian);
router.get('/my-students', guardianController_1.getMyStudents);
exports.default = router;
