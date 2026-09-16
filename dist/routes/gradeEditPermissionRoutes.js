"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gradeEditPermissionController_1 = require("../controllers/gradeEditPermissionController.js");
const router = (0, express_1.Router)();
// All routes require authentication (handled by middleware in app.ts)
// Create permission (Master/Admin only)
router.post('/', gradeEditPermissionController_1.createPermission);
// Get all permissions (Master/Admin only)
router.get('/', gradeEditPermissionController_1.getPermissions);
// Revoke permission (Master/Admin only)
router.delete('/:id', gradeEditPermissionController_1.revokePermission);
// Check if user has permission for a specific period (Control de Estudios)
router.get('/check/:schoolPeriodId', gradeEditPermissionController_1.checkPermission);
// Get audit log (Master/Admin only) — legacy, per-final-grade
router.get('/audit', gradeEditPermissionController_1.getAuditLog);
// Unified audit log (Master/Admin only) — all grade types
router.get('/unified-audit', gradeEditPermissionController_1.getUnifiedAuditLog);
exports.default = router;
