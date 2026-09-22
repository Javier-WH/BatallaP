import { Request, Response } from 'express';
import { ScheduleException, ScheduleDayTurnException, Subject, PeriodGrade, PeriodGradeSubject, PeriodGradeSection, Grade, Section } from '@/models';

const VALID_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const VALID_TURNS = ['manana', 'tarde'];
const VALID_MODES = ['soft', 'hard'];

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
    const { subjectId, allowConsecutiveBlocks, maxHoursPerDay, difficulty, forcedSlot, endOfRun } = req.body;
    if (!subjectId) return res.status(400).json({ message: 'subjectId es requerido' });

    // Upsert: if exception for this subject already exists, update it
    const [exc, created] = await ScheduleException.findOrCreate({
      where: { subjectId },
      defaults: {
        subjectId,
        allowConsecutiveBlocks: allowConsecutiveBlocks ?? null,
        maxHoursPerDay: maxHoursPerDay ?? null,
        difficulty: difficulty ?? null,
        forcedSlot: forcedSlot ?? null,
        endOfRun: endOfRun ?? null,
      },
    });
    if (!created) {
      exc.allowConsecutiveBlocks = allowConsecutiveBlocks ?? null;
      exc.maxHoursPerDay = maxHoursPerDay ?? null;
      exc.difficulty = difficulty ?? null;
      exc.forcedSlot = forcedSlot ?? null;
      exc.endOfRun = endOfRun ?? null;
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
    const { allowConsecutiveBlocks, maxHoursPerDay, difficulty, forcedSlot, endOfRun } = req.body;
    const exc = await ScheduleException.findByPk(Number(id));
    if (!exc) return res.status(404).json({ message: 'Excepción no encontrada' });
    exc.allowConsecutiveBlocks = allowConsecutiveBlocks ?? null;
    exc.maxHoursPerDay = maxHoursPerDay ?? null;
    exc.difficulty = difficulty ?? null;
    exc.forcedSlot = forcedSlot ?? null;
    exc.endOfRun = endOfRun ?? null;
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

// ── Day+turn forced exceptions ──
// Force a grade's subject into one specific day and turn (manana/tarde).
// The solver still picks which block(s) inside that turn.

// GET /api/schedule-exceptions/day-turn?schoolPeriodId=
export const listDayTurnExceptions = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = req.query.schoolPeriodId ? Number(req.query.schoolPeriodId) : null;
    const exceptions = await ScheduleDayTurnException.findAll({
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'color'] },
        {
          model: PeriodGrade,
          as: 'periodGrade',
          attributes: ['id', 'schoolPeriodId'],
          include: [{ model: Grade, as: 'grade', attributes: ['id', 'name'] }],
          ...(schoolPeriodId ? { where: { schoolPeriodId }, required: true } : {}),
        },
        {
          model: PeriodGradeSection,
          as: 'periodGradeSection',
          attributes: ['id'],
          include: [{ model: Section, as: 'section', attributes: ['id', 'name'] }],
        },
      ],
      order: [['id', 'ASC']],
    });
    return res.json(exceptions);
  } catch (error) {
    console.error('[listDayTurnExceptions] Error:', error);
    return res.status(500).json({ message: 'Error al listar excepciones de día y turno' });
  }
};

// POST /api/schedule-exceptions/day-turn
export const createDayTurnException = async (req: Request, res: Response) => {
  try {
    const { periodGradeId, periodGradeSectionId, subjectId, day, turn, mode, weight } = req.body;
    if (!periodGradeId || !subjectId || !day || !turn) {
      return res.status(400).json({ message: 'Grado, materia, día y turno son requeridos' });
    }
    if (!VALID_DAYS.includes(day)) {
      return res.status(400).json({ message: 'Día inválido' });
    }
    if (!VALID_TURNS.includes(turn)) {
      return res.status(400).json({ message: 'Turno inválido (manana | tarde)' });
    }
    const finalMode = mode ?? 'hard';
    if (!VALID_MODES.includes(finalMode)) {
      return res.status(400).json({ message: 'Modo inválido (soft | hard)' });
    }

    // If a specific class is targeted, it must belong to the grade
    if (periodGradeSectionId != null) {
      const pgsSection = await PeriodGradeSection.findOne({
        where: { id: Number(periodGradeSectionId), periodGradeId: Number(periodGradeId) },
      });
      if (!pgsSection) {
        return res.status(400).json({ message: 'La sección no pertenece al grado seleccionado' });
      }
    }

    // The subject must be active in the target grade's plan
    const pgs = await PeriodGradeSubject.findOne({
      where: { periodGradeId: Number(periodGradeId), subjectId: Number(subjectId), active: true },
    });
    if (!pgs) {
      return res.status(400).json({ message: 'La materia no pertenece al grado seleccionado' });
    }

    // Upsert: one forced day+turn per (grade, section-or-null, subject)
    const scopeSectionId = periodGradeSectionId != null ? Number(periodGradeSectionId) : null;
    const [exc, created] = await ScheduleDayTurnException.findOrCreate({
      where: { periodGradeId: Number(periodGradeId), periodGradeSectionId: scopeSectionId, subjectId: Number(subjectId) },
      defaults: {
        periodGradeId: Number(periodGradeId),
        periodGradeSectionId: scopeSectionId,
        subjectId: Number(subjectId),
        day,
        turn,
        mode: finalMode,
        weight: weight ?? null,
      },
    });
    if (!created) {
      exc.day = day;
      exc.turn = turn;
      exc.mode = finalMode;
      exc.weight = weight ?? null;
      await exc.save();
    }
    return res.status(created ? 201 : 200).json(exc);
  } catch (error) {
    console.error('[createDayTurnException] Error:', error);
    return res.status(500).json({ message: 'Error al crear excepción de día y turno' });
  }
};

// DELETE /api/schedule-exceptions/day-turn/:id
export const deleteDayTurnException = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ScheduleDayTurnException.destroy({ where: { id: Number(id) } });
    return res.json({ message: 'Excepción eliminada' });
  } catch (error) {
    console.error('[deleteDayTurnException] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar excepción' });
  }
};
