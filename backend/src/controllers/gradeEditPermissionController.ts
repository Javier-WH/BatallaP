import { Request, Response } from 'express';
import { Op } from 'sequelize';
import {
  GradeEditPermission,
  GradeEditAudit,
  User,
  Person,
  SchoolPeriod,
  SubjectFinalGrade,
  InscriptionSubject,
  Subject,
  Inscription,
  Role
} from '@/models/index';

// Helper function to check if user has required role
const hasRole = (user: any, roles: string[]): boolean => {
  if (!user || !user.roles) return false;
  const userRoles = user.roles.map((r: any) => typeof r === 'string' ? r : r.name);
  console.log('[hasRole] User roles:', userRoles, 'Required roles:', roles, 'Has role:', roles.some(role => userRoles.includes(role)));
  return roles.some(role => userRoles.includes(role));
};

export const createPermission = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req.session as any).user;
    if (!sessionUser) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Only Master and Administrador can create permissions
    if (!hasRole(sessionUser, ['Master', 'Administrador'])) {
      return res.status(403).json({ message: 'Solo Master y Administrador pueden otorgar permisos' });
    }

    const { schoolPeriodId, grantedTo, actCode, observations } = req.body;

    if (!grantedTo || !actCode || !observations) {
      return res.status(400).json({ message: 'grantedTo, actCode y observations son requeridos' });
    }

    // Verify that grantedTo is a Control de Estudios user
    const targetUser = await User.findByPk(grantedTo, {
      include: [
        {
          model: Person,
          as: 'person',
          include: [
            {
              model: Role,
              as: 'roles'
            }
          ]
        }
      ]
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario receptor no encontrado' });
    }

    const targetRoles = (targetUser as any).person?.roles?.map((r: any) => r.name) || [];
    if (!targetRoles.includes('Control de Estudios')) {
      return res.status(400).json({ message: 'El permiso solo puede otorgarse a usuarios con rol Control de Estudios' });
    }

    // If schoolPeriodId is provided, verify it exists
    if (schoolPeriodId) {
      const period = await SchoolPeriod.findByPk(schoolPeriodId);
      if (!period) {
        return res.status(404).json({ message: 'Período escolar no encontrado' });
      }
    }

    const permission = await GradeEditPermission.create({
      schoolPeriodId: schoolPeriodId || null,
      grantedBy: sessionUser.id,
      grantedTo,
      actCode,
      observations,
      isActive: true,
      grantedAt: new Date()
    });

    // Fetch the permission with full relations
    const permissionWithRelations = await GradeEditPermission.findByPk(permission.id, {
      include: [
        {
          model: SchoolPeriod,
          as: 'schoolPeriod'
        },
        {
          model: User,
          as: 'granter',
          include: [{ model: Person, as: 'person' }]
        },
        {
          model: User,
          as: 'recipient',
          include: [{ model: Person, as: 'person' }]
        }
      ]
    });

    res.status(201).json(permissionWithRelations);
  } catch (error: any) {
    console.error('Error creating permission:', error);
    res.status(500).json({ message: 'Error al crear permiso', error: error.message });
  }
};

export const getPermissions = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req.session as any).user;
    if (!sessionUser) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Only Master and Administrador can view all permissions
    if (!hasRole(sessionUser, ['Master', 'Administrador'])) {
      return res.status(403).json({ message: 'Solo Master y Administrador pueden ver permisos' });
    }

    const permissions = await GradeEditPermission.findAll({
      include: [
        {
          model: SchoolPeriod,
          as: 'schoolPeriod'
        },
        {
          model: User,
          as: 'granter',
          include: [{ model: Person, as: 'person' }]
        },
        {
          model: User,
          as: 'recipient',
          include: [{ model: Person, as: 'person' }]
        },
        {
          model: User,
          as: 'revoker',
          include: [{ model: Person, as: 'person' }]
        }
      ],
      order: [['grantedAt', 'DESC']]
    });

    res.json(permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ message: 'Error al obtener permisos' });
  }
};

export const revokePermission = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req.session as any).user;
    if (!sessionUser) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Only Master and Administrador can revoke permissions
    if (!hasRole(sessionUser, ['Master', 'Administrador'])) {
      return res.status(403).json({ message: 'Solo Master y Administrador pueden revocar permisos' });
    }

    const { id } = req.params;
    const permission = await GradeEditPermission.findByPk(id);

    if (!permission) {
      return res.status(404).json({ message: 'Permiso no encontrado' });
    }

    if (!permission.isActive) {
      return res.status(400).json({ message: 'El permiso ya está revocado' });
    }

    await permission.update({
      isActive: false,
      revokedAt: new Date(),
      revokedBy: sessionUser.id
    });

    res.json({ message: 'Permiso revocado correctamente' });
  } catch (error) {
    console.error('Error revoking permission:', error);
    res.status(500).json({ message: 'Error al revocar permiso' });
  }
};

export const checkPermission = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req.session as any).user;
    if (!sessionUser) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const { schoolPeriodId } = req.params;
    const parsedPeriodId = Number(schoolPeriodId);

    // Check if user has Control de Estudios role
    if (!hasRole(sessionUser, ['Control de Estudios'])) {
      return res.json({ hasPermission: false, reason: 'Usuario no tiene rol Control de Estudios' });
    }

    // Check for global permission (schoolPeriodId is null)
    const globalPermission = await GradeEditPermission.findOne({
      where: {
        grantedTo: sessionUser.id,
        schoolPeriodId: null,
        isActive: true
      }
    });

    if (globalPermission) {
      return res.json({ hasPermission: true, permission: globalPermission, scope: 'global' });
    }

    // Check for specific period permission
    const specificPermission = await GradeEditPermission.findOne({
      where: {
        grantedTo: sessionUser.id,
        schoolPeriodId: parsedPeriodId,
        isActive: true
      },
      include: [
        {
          model: SchoolPeriod,
          as: 'schoolPeriod'
        }
      ]
    });

    if (specificPermission) {
      return res.json({ hasPermission: true, permission: specificPermission, scope: 'specific' });
    }

    res.json({ hasPermission: false, reason: 'No hay permiso activo para este período' });
  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({ message: 'Error al verificar permiso' });
  }
};

export const getAuditLog = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req.session as any).user;
    console.log('[getAuditLog] Session user:', sessionUser);
    console.log('[getAuditLog] Session user roles:', sessionUser?.roles);

    if (!sessionUser) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Only Master and Administrador can view audit log
    if (!hasRole(sessionUser, ['Master', 'Administrador'])) {
      console.log('[getAuditLog] User does not have required role');
      return res.status(403).json({ message: 'Solo Master y Administrador pueden ver el historial de auditoría' });
    }

    const { limit = 100, offset = 0 } = req.query;

    const audits = await GradeEditAudit.findAll({
      include: [
        {
          model: SubjectFinalGrade,
          as: 'subjectFinalGrade'
        },
        {
          model: GradeEditPermission,
          as: 'permission'
        },
        {
          model: User,
          as: 'editor'
        }
      ],
      order: [['editedAt', 'DESC']],
      limit: Number(limit),
      offset: Number(offset)
    });

    res.json(audits);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ message: 'Error al obtener historial de auditoría' });
  }
};
