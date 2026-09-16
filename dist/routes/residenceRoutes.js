"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const residenceController_1 = require("../controllers/residenceController.js");
const router = (0, express_1.Router)();
router.get('/:personId', residenceController_1.getResidenceByPerson);
router.put('/:personId', residenceController_1.upsertResidenceByPerson);
exports.default = router;
