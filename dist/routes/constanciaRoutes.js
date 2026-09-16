"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const constanciaController_1 = require("../controllers/constanciaController.js");
const router = (0, express_1.Router)();
// Variables metadata (for editor)
router.get('/variables', constanciaController_1.getVariables);
// Analyze template variables
router.get('/analyze/:id', constanciaController_1.analyzeTemplate);
// Template CRUD
router.get('/', constanciaController_1.listTemplates);
router.get('/:id', constanciaController_1.getTemplate);
router.post('/', constanciaController_1.createTemplate);
router.put('/:id', constanciaController_1.updateTemplate);
router.delete('/:id', constanciaController_1.deleteTemplate);
// Generate
router.post('/preview', constanciaController_1.generatePreview);
exports.default = router;
