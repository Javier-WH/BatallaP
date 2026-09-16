"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboardContentController_1 = require("../controllers/dashboardContentController.js");
const dashboardImageUploadMiddleware_1 = __importDefault(require("../middlewares/dashboardImageUploadMiddleware.js"));
const router = (0, express_1.Router)();
// Get dashboard content (public)
router.get('/', dashboardContentController_1.getContent);
// Update dashboard content (Master/Admin only - will be protected by middleware)
router.put('/', dashboardContentController_1.updateContent);
// Upload dashboard image
router.post('/images', dashboardImageUploadMiddleware_1.default.single('image'), dashboardContentController_1.uploadDashboardImage);
// Delete dashboard image
router.delete('/images/:filename', dashboardContentController_1.deleteDashboardImage);
exports.default = router;
