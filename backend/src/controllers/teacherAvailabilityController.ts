import { Request, Response } from 'express';
import { TeacherAvailability } from '@/models';

// GET /api/teacher-availability — returns the current user's availability as a map
// Response: { "Lunes|m1": "available", "Lunes|m2": "busy", ... }
export const getMyAvailability = async (req: Request, res: Response) => {
  try {
    const personId = (req.session as any)?.user?.personId;
    if (!personId) return res.status(400).json({ message: 'No hay persona asociada' });

    const rows = await TeacherAvailability.findAll({ where: { personId } });
    const map: Record<string, string> = {};
    rows.forEach(r => {
      map[`${r.day}|${r.periodId}`] = r.status;
    });
    return res.json(map);
  } catch (error) {
    console.error('[getMyAvailability] Error:', error);
    return res.status(500).json({ message: 'Error al obtener disponibilidad' });
  }
};

// POST /api/teacher-availability — saves the full availability map (replaces all)
// Body: { availability: { "Lunes|m1": "available", ... } }
export const saveMyAvailability = async (req: Request, res: Response) => {
  try {
    const personId = (req.session as any)?.user?.personId;
    if (!personId) return res.status(400).json({ message: 'No hay persona asociada' });

    const { availability } = req.body as { availability: Record<string, string> };
    if (!availability || typeof availability !== 'object') {
      return res.status(400).json({ message: 'availability es requerido' });
    }

    // Delete existing rows and insert new ones
    await TeacherAvailability.destroy({ where: { personId } });

    const rows: Array<{ personId: number; day: string; periodId: string; status: string }> = [];
    for (const [key, status] of Object.entries(availability)) {
      const [day, periodId] = key.split('|');
      if (day && periodId && status) {
        rows.push({ personId, day, periodId, status });
      }
    }

    if (rows.length > 0) {
      await TeacherAvailability.bulkCreate(rows);
    }

    return res.json({ message: 'Disponibilidad guardada', count: rows.length });
  } catch (error) {
    console.error('[saveMyAvailability] Error:', error);
    return res.status(500).json({ message: 'Error al guardar disponibilidad' });
  }
};

// GET /api/teacher-availability/all — returns availability for all teachers (for Control de Estudios)
// Response: [{ personId, firstName, lastName, availability: {...} }, ...]
export const getAllAvailability = async (_req: Request, res: Response) => {
  try {
    const { Person } = await import('@/models');
    const teachers = await Person.findAll({
      include: [
        { association: 'roles', where: { name: 'Profesor' }, required: true },
        { association: 'availability' },
      ],
    });

    const result = teachers.map((t: any) => {
      const map: Record<string, string> = {};
      (t.availability || []).forEach((r: any) => {
        map[`${r.day}|${r.periodId}`] = r.status;
      });
      return {
        personId: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        availability: map,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error('[getAllAvailability] Error:', error);
    return res.status(500).json({ message: 'Error al obtener disponibilidad de profesores' });
  }
};
