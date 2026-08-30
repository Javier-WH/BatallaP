import { Request, Response } from 'express';
import { ClassroomAssignment, Subject, Setting } from '@/models';

// GET /api/classroom-assignments
export const listAssignments = async (_req: Request, res: Response) => {
  try {
    const assignments = await ClassroomAssignment.findAll({
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'name'], required: false }],
    });
    return res.json(assignments);
  } catch (error) {
    console.error('[listAssignments] Error:', error);
    return res.status(500).json({ message: 'Error al listar asignaciones de aulas' });
  }
};

// POST /api/classroom-assignments
export const createAssignment = async (req: Request, res: Response) => {
  try {
    const { room, targetType, sectionKey, subjectId, gradeId } = req.body;
    if (!room || !targetType) return res.status(400).json({ message: 'room y targetType son requeridos' });
    if (targetType === 'section' && !sectionKey) return res.status(400).json({ message: 'sectionKey es requerido para targetType=section' });
    if (targetType === 'subject' && !subjectId) return res.status(400).json({ message: 'subjectId es requerido para targetType=subject' });
    if (targetType === 'group' && (!subjectId || gradeId == null)) return res.status(400).json({ message: 'subjectId y gradeId son requeridos para targetType=group' });

    const [assignment, created] = await ClassroomAssignment.findOrCreate({
      where: { room, targetType, sectionKey: sectionKey ?? null, subjectId: subjectId ?? null, gradeId: gradeId ?? null },
      defaults: { room, targetType, sectionKey: sectionKey ?? null, subjectId: subjectId ?? null, gradeId: gradeId ?? null },
    });
    return res.status(created ? 201 : 200).json(assignment);
  } catch (error) {
    console.error('[createAssignment] Error:', error);
    return res.status(500).json({ message: 'Error al crear asignación' });
  }
};

// DELETE /api/classroom-assignments/:id
export const deleteAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ClassroomAssignment.destroy({ where: { id: Number(id) } });
    return res.json({ message: 'Asignación eliminada' });
  } catch (error) {
    console.error('[deleteAssignment] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar asignación' });
  }
};

// GET /api/classroom-assignments/grid/:schoolPeriodId — load saved grid state
export const getGridState = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId } = req.params;
    const setting = await Setting.findByPk(`classroom_grid_${schoolPeriodId}`);
    if (!setting) return res.json({});
    return res.json(JSON.parse(setting.value));
  } catch (error) {
    console.error('[getGridState] Error:', error);
    return res.status(500).json({ message: 'Error al cargar la distribución' });
  }
};

// PUT /api/classroom-assignments/grid/:schoolPeriodId — save grid state
export const saveGridState = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId } = req.params;
    const data = JSON.stringify(req.body);
    await Setting.upsert({ key: `classroom_grid_${schoolPeriodId}`, value: data });
    return res.json({ message: 'Distribución guardada' });
  } catch (error) {
    console.error('[saveGridState] Error:', error);
    return res.status(500).json({ message: 'Error al guardar la distribución' });
  }
};
