import { Request, Response } from 'express';
import { ScheduleException, Subject } from '@/models';

// GET /api/schedule-exceptions
export const listExceptions = async (_req: Request, res: Response) => {
  try {
    const exceptions = await ScheduleException.findAll({
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'name', 'color'] }],
    });
    return res.json(exceptions);
  } catch (error) {
    console.error('[listExceptions] Error:', error);
    return res.status(500).json({ message: 'Error al listar excepciones' });
  }
};

// POST /api/schedule-exceptions
export const createException = async (req: Request, res: Response) => {
  try {
    const { subjectId, allowConsecutiveBlocks, weeklyBlocks, maxHoursPerDay } = req.body;
    if (!subjectId) return res.status(400).json({ message: 'subjectId es requerido' });

    // Upsert: if exception for this subject already exists, update it
    const [exc, created] = await ScheduleException.findOrCreate({
      where: { subjectId },
      defaults: {
        subjectId,
        allowConsecutiveBlocks: allowConsecutiveBlocks ?? null,
        weeklyBlocks: weeklyBlocks ?? null,
        maxHoursPerDay: maxHoursPerDay ?? null,
      },
    });
    if (!created) {
      exc.allowConsecutiveBlocks = allowConsecutiveBlocks ?? null;
      exc.weeklyBlocks = weeklyBlocks ?? null;
      exc.maxHoursPerDay = maxHoursPerDay ?? null;
      await exc.save();
    }
    return res.status(created ? 201 : 200).json(exc);
  } catch (error) {
    console.error('[createException] Error:', error);
    return res.status(500).json({ message: 'Error al crear excepción' });
  }
};

// PUT /api/schedule-exceptions/:id
export const updateException = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { allowConsecutiveBlocks, weeklyBlocks, maxHoursPerDay } = req.body;
    const exc = await ScheduleException.findByPk(Number(id));
    if (!exc) return res.status(404).json({ message: 'Excepción no encontrada' });
    exc.allowConsecutiveBlocks = allowConsecutiveBlocks ?? null;
    exc.weeklyBlocks = weeklyBlocks ?? null;
    exc.maxHoursPerDay = maxHoursPerDay ?? null;
    await exc.save();
    return res.json(exc);
  } catch (error) {
    console.error('[updateException] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar excepción' });
  }
};

// DELETE /api/schedule-exceptions/:id
export const deleteException = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ScheduleException.destroy({ where: { id: Number(id) } });
    return res.json({ message: 'Excepción eliminada' });
  } catch (error) {
    console.error('[deleteException] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar excepción' });
  }
};
