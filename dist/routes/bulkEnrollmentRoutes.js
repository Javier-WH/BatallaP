"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const excelUploadMiddleware_1 = __importDefault(require("../middlewares/excelUploadMiddleware.js"));
const bulkEnrollmentController_1 = require("../controllers/bulkEnrollmentController.js");
const router = (0, express_1.Router)();
router.get('/template', bulkEnrollmentController_1.downloadTemplate);
router.post('/preview', excelUploadMiddleware_1.default.single('file'), bulkEnrollmentController_1.previewBulk);
router.post('/process', bulkEnrollmentController_1.processBulk);
router.post('/retry-single', bulkEnrollmentController_1.retrySingleRow);
exports.default = router;
