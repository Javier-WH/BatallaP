"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const plantelController_1 = require("../controllers/plantelController.js");
const router = (0, express_1.Router)();
// GET /api/planteles - List all planteles with optional filtering
router.get('/', plantelController_1.listPlanteles);
// GET /api/planteles/search - Search planteles with suggestions
router.get('/search', plantelController_1.searchPlanteles);
// GET /api/planteles/by-id/:id - Get plantel by numeric ID
router.get('/by-id/:id', plantelController_1.getPlantelById);
// GET /api/planteles/:code - Get plantel by code or name
router.get('/:code', plantelController_1.getPlantel);
// POST /api/planteles - Create new plantel
router.post('/', plantelController_1.createPlantel);
// PUT /api/planteles/:id - Update plantel
router.put('/:id', plantelController_1.updatePlantel);
// DELETE /api/planteles/:id - Delete plantel
router.delete('/:id', plantelController_1.deletePlantel);
exports.default = router;
