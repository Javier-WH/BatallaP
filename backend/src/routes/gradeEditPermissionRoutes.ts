import { Router } from 'express';
import {
  createPermission,
  getPermissions,
  revokePermission,
  checkPermission,
  getAuditLog,
  getUnifiedAuditLog
} from '@/controllers/gradeEditPermissionController';

const router = Router();

// All routes require authentication (handled by middleware in app.ts)

// Create permission (Master/Admin only)
router.post('/', createPermission);

// Get all permissions (Master/Admin only)
router.get('/', getPermissions);

// Revoke permission (Master/Admin only)
router.delete('/:id', revokePermission);

// Check if user has permission for a specific period (Control de Estudios)
router.get('/check/:schoolPeriodId', checkPermission);

// Get audit log (Master/Admin only) — legacy, per-final-grade
router.get('/audit', getAuditLog);

// Unified audit log (Master/Admin only) — all grade types
router.get('/unified-audit', getUnifiedAuditLog);

export default router;
