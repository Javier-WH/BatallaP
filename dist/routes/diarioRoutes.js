"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const diarioController_1 = require("../controllers/diarioController.js");
const router = (0, express_1.Router)();
router.get('/export', diarioController_1.exportDiarios);
router.get('/html', diarioController_1.exportDiariosHtml);
exports.default = router;
