"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const locationController_1 = require("../controllers/locationController.js");
const router = (0, express_1.Router)();
router.get('/venezuela', locationController_1.getVenezuelaLocations);
exports.default = router;
