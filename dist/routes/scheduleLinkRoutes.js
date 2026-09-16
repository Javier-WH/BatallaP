"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const scheduleLinkController_1 = require("../controllers/scheduleLinkController.js");
const router = (0, express_1.Router)();
router.get('/', scheduleLinkController_1.listLinks);
router.post('/', scheduleLinkController_1.createLink);
router.delete('/:id', scheduleLinkController_1.deleteLink);
exports.default = router;
