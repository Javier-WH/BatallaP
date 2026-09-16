"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const templateUploadMiddleware_1 = __importDefault(require("../middlewares/templateUploadMiddleware.js"));
const templateController_1 = require("../controllers/templateController.js");
const router = (0, express_1.Router)();
router.get('/', templateController_1.listTemplates);
router.post('/', templateUploadMiddleware_1.default.single('file'), templateController_1.uploadTemplate);
router.delete('/:name', templateController_1.deleteTemplate);
// Template assignment to grades (optionally scoped to a section)
router.get('/assignments', templateController_1.listTemplateAssignments);
router.get('/assignment/:gradeId', templateController_1.getTemplateForGrade);
router.post('/assignment', templateController_1.assignTemplateToGrade);
router.delete('/assignment/:gradeId', templateController_1.unassignTemplateFromGrade);
// Certified grades template assignments (per period category)
router.get('/certified-assignments', templateController_1.listCertifiedTemplateAssignments);
router.post('/certified-assignment', templateController_1.assignCertifiedTemplate);
router.delete('/certified-assignment/:periodKey', templateController_1.unassignCertifiedTemplate);
exports.default = router;
