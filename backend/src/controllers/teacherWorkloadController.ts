import { Request, Response } from 'express';
import { getTeacherWorkload } from '@/services/teacherWorkloadService';

const STAFF_ROLES = ['Master', 'Administrador', 'Control de Estudios'];

const hasRole = (user: any, roles: string[]): boolean => {
  if (!user || !user.roles) return false;
  const userRoles = user.roles.map((r: any) => (typeof r === 'string' ? r : r.name));
  return roles.some(role => userRoles.includes(role));
};

// GET /api/teacher-workload?schoolPeriodId=
// Weekly workload per teacher: teaching blocks/hours + administrative hours.
// Staff sees every teacher; a Profesor only sees their own row.
export const getWorkload = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = Number(req.query.schoolPeriodId);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es requerido' });
    }

    let data = await getTeacherWorkload(schoolPeriodId);

    if (!hasRole((req.session as any).user, STAFF_ROLES)) {
      const personId = (req.session as any)?.user?.personId;
      data = data.filter(d => d.teacherId === personId);
    }

    return res.json(data);
  } catch (error) {
    console.error('[getWorkload] Error:', error);
    return res.status(500).json({ message: 'Error al obtener carga horaria' });
  }
};
