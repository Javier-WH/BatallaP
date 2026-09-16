"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settingController_1 = require("../controllers/settingController.js");
const router = (0, express_1.Router)();
router.get('/', settingController_1.getSettings);
router.post('/', settingController_1.updateSettings);
router.get('/:key', settingController_1.getSettingByKey);
exports.default = router;
