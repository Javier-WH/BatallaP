import { Router } from 'express';
import {
  createPermission,
  getPermissions,
  revokePermission,
  checkPermission,
  getAuditLog
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

// Get audit log (Master/Admin only)
router.get('/audit', getAuditLog);

export default router;
