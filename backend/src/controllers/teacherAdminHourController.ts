import { Request, Response } from 'express';
import sequelize from '@/config/database';
import { TeacherAdminHour } from '@/models';

const STAFF_ROLES = ['Master', 'Administrador', 'Control de Estudios'];

const hasRole = (user: any, roles: string[]): boolean => {
  if (!user || !user.roles) return false;
  const userRoles = user.roles.map((r: any) => (typeof r === 'string' ? r : r.name));
  return roles.some(role => userRoles.includes(role));
};

// GET /api/teacher-admin-hours/summary?schoolPeriodId=
// Hour count per teacher for a period (quantification for future payroll work).
export const getAdminHoursSummary = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = Number(req.query.schoolPeriodId);
    if (!schoolPeriodId) return res.status(400).json({ message: 'schoolPeriodId es requerido' });

    const rows = await TeacherAdminHour.findAll({
      where: { schoolPeriodId },
      attributes: ['teacherId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['teacherId'],
      raw: true,
    });
    return res.json(rows);
  } catch (error) {
    console.error('[getAdminHoursSummary] Error:', error);
    return res.status(500).json({ message: 'Error al obtener resumen de horas administrativas' });
  }
};

// GET /api/teacher-admin-hours/:teacherId?schoolPeriodId=
// Response: { "Lunes|m1": "admin", ... }
export const getTeacherAdminHours = async (req: Request, res: Response) => {
  try {
    const teacherId = Number(req.params.teacherId);
    const schoolPeriodId = Number(req.query.schoolPeriodId);
    if (!schoolPeriodId) return res.status(400).json({ message: 'schoolPeriodId es requerido' });

    const rows = await TeacherAdminHour.findAll({ where: { teacherId, schoolPeriodId } });
    const map: Record<string, string> = {};
    rows.forEach(r => { map[`${r.day}|${r.periodId}`] = 'admin'; });
    return res.json(map);
  } catch (error) {
    console.error('[getTeacherAdminHours] Error:', error);
    return res.status(500).json({ message: 'Error al obtener horas administrativas' });
  }
};

// POST /api/teacher-admin-hours/:teacherId — bulk-replace painted cells (Control de Estudios only)
// Body: { schoolPeriodId: number, cells: { "Lunes|m1": "admin", ... } }
export const saveTeacherAdminHours = async (req: Request, res: Response) => {
  try {
    if (!hasRole((req.session as any).user, STAFF_ROLES)) {
      return res.status(403).json({ message: 'Solo Control de Estudios puede asignar horas administrativas' });
    }

    const teacherId = Number(req.params.teacherId);
    const { schoolPeriodId, cells } = req.body as { schoolPeriodId: number; cells: Record<string, string> };
    if (!schoolPeriodId || !cells || typeof cells !== 'object') {
      return res.status(400).json({ message: 'schoolPeriodId y cells son requeridos' });
    }

    const t = await sequelize.transaction();
    try {
      await TeacherAdminHour.destroy({ where: { teacherId, schoolPeriodId }, transaction: t });

      const rows: Array<{ teacherId: number; schoolPeriodId: number; day: string; periodId: string }> = [];
      for (const key of Object.keys(cells)) {
        const [day, periodId] = key.split('|');
        if (day && periodId) rows.push({ teacherId, schoolPeriodId, day, periodId });
      }
      if (rows.length > 0) await TeacherAdminHour.bulkCreate(rows, { transaction: t });

      await t.commit();
      return res.json({ message: 'Horas administrativas guardadas', count: rows.length });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    console.error('[saveTeacherAdminHours] Error:', error);
    return res.status(500).json({ message: 'Error al guardar horas administrativas' });
  }
};
