"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const observationController_1 = require("../controllers/observationController.js");
const router = (0, express_1.Router)();
router.get('/boletin', observationController_1.getObservationForBoletin);
router.get('/', observationController_1.getSectionObservations);
router.put('/', observationController_1.saveObservation);
exports.default = router;
