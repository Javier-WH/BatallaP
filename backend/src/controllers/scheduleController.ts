import { Request, Response } from 'express';
import sequelize from '@/config/database';
import { Schedule, ScheduleEntry, PeriodGradeSection, Subject, Person, SchoolPeriod, PeriodGrade, Grade, Section, TeacherAssignment, PeriodGradeSubject } from '@/models';

// GET /api/schedules?schoolPeriodId=&sectionId=
export const listSchedules = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, sectionId } = req.query;
    const where: any = {};
    if (schoolPeriodId) where.schoolPeriodId = Number(schoolPeriodId);
    if (sectionId) where.periodGradeSectionId = Number(sectionId);

    const schedules = await Schedule.findAll({
      where,
      include: [
        { model: PeriodGradeSection, as: 'section', include: [
          { model: PeriodGrade, as: 'periodGrade', include: [{ model: Grade, as: 'grade' }] },
          { model: Section, as: 'section' },
        ]},
        { model: ScheduleEntry, as: 'entries', include: [
          { model: Subject, as: 'subject' },
          { model: Person, as: 'teacher' },
        ]},
      ],
    });
    return res.json(schedules);
  } catch (error) {
    console.error('[listSchedules] Error:', error);
    return res.status(500).json({ message: 'Error al listar horarios' });
  }
};

// GET /api/schedules/:id
export const getSchedule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const schedule = await Schedule.findByPk(Number(id), {
      include: [
        { model: PeriodGradeSection, as: 'section', include: [
          { model: PeriodGrade, as: 'periodGrade', include: [{ model: Grade, as: 'grade' }] },
          { model: Section, as: 'section' },
        ]},
        { model: ScheduleEntry, as: 'entries', include: [
          { model: Subject, as: 'subject' },
          { model: Person, as: 'teacher' },
        ]},
      ],
    });
    if (!schedule) return res.status(404).json({ message: 'Horario no encontrado' });
    return res.json(schedule);
  } catch (error) {
    console.error('[getSchedule] Error:', error);
    return res.status(500).json({ message: 'Error al obtener horario' });
  }
};

// POST /api/schedules — create or get-or-create for a section
export const createSchedule = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, periodGradeSectionId } = req.body;
    if (!schoolPeriodId || !periodGradeSectionId) {
      return res.status(400).json({ message: 'schoolPeriodId y periodGradeSectionId son requeridos' });
    }
    const [schedule, created] = await Schedule.findOrCreate({
      where: { schoolPeriodId, periodGradeSectionId },
      defaults: { schoolPeriodId, periodGradeSectionId, status: 'draft' },
    });
    return res.status(created ? 201 : 200).json(schedule);
  } catch (error) {
    console.error('[createSchedule] Error:', error);
    return res.status(500).json({ message: 'Error al crear horario' });
  }
};

// PUT /api/schedules/:id — update status
export const updateSchedule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const schedule = await Schedule.findByPk(Number(id));
    if (!schedule) return res.status(404).json({ message: 'Horario no encontrado' });
    if (status) await schedule.update({ status });
    return res.json(schedule);
  } catch (error) {
    console.error('[updateSchedule] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar horario' });
  }
};

// PUT /api/schedules/:id/entries — replace all entries (full schedule save)
export const saveScheduleEntries = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { entries } = req.body as { entries: Array<{ day: string; periodId: string; subjectId: number | null; teacherId: number | null; isGroupSubject: boolean }> };

    const schedule = await Schedule.findByPk(Number(id));
    if (!schedule) return res.status(404).json({ message: 'Horario no encontrado' });

    // ── Validate group subject rule ──
    // For each (day, periodId), at most ONE non-group entry is allowed.
    // Multiple group entries are allowed only if they all share the same subjectGroupId.
    if (entries && entries.length > 0) {
      // Build a map subjectId -> subjectGroupId
      const subjectIds = Array.from(new Set(entries.map(e => e.subjectId).filter((s): s is number => s !== null)));
      const subjects = await Subject.findAll({ where: { id: subjectIds }, attributes: ['id', 'subjectGroupId'] });
      const subjGroupMap = new Map<number, number | null>();
      subjects.forEach(s => subjGroupMap.set(s.id, (s as any).subjectGroupId ?? null));

      // Group entries by `${day}|${periodId}`
      const cellMap = new Map<string, typeof entries>();
      entries.forEach(e => {
        const k = `${e.day}|${e.periodId}`;
        if (!cellMap.has(k)) cellMap.set(k, []);
        cellMap.get(k)!.push(e);
      });

      for (const [cellKey, cellEntries] of cellMap) {
        const nonGroup = cellEntries.filter(e => !e.isGroupSubject);
        const groupEntries = cellEntries.filter(e => e.isGroupSubject);

        // At most one non-group subject per cell
        if (nonGroup.length > 1) {
          const subjNames = await Subject.findAll({ where: { id: nonGroup.map(e => e.subjectId).filter((s): s is number => s !== null) } });
          return res.status(400).json({
            message: `No se pueden colocar múltiples materias regulares en el mismo bloque (${cellKey}). Materias en conflicto: ${subjNames.map(s => s.name).join(', ')}`,
          });
        }
        // A non-group subject cannot coexist with group subjects in the same cell
        if (nonGroup.length > 0 && groupEntries.length > 0) {
          return res.status(400).json({
            message: `No se puede mezclar una materia regular con materias de grupo en el mismo bloque (${cellKey})`,
          });
        }
        // All group subjects in the same cell must share the same subjectGroupId
        if (groupEntries.length > 1) {
          const groupIds = new Set(groupEntries.map(e => subjGroupMap.get(e.subjectId!) ?? null));
          if (groupIds.size > 1) {
            return res.status(400).json({
              message: `Las materias de grupo en el mismo bloque (${cellKey}) deben pertenecer al mismo grupo. Grupos detectados: ${Array.from(groupIds).join(', ')}`,
            });
          }
        }
      }
    }

    const t = await sequelize.transaction();
    try {
      await ScheduleEntry.destroy({ where: { scheduleId: schedule.id }, transaction: t });
      if (entries && entries.length > 0) {
        await ScheduleEntry.bulkCreate(
          entries.map(e => ({
            scheduleId: schedule.id,
            day: e.day,
            periodId: e.periodId,
            subjectId: e.subjectId,
            teacherId: e.teacherId,
            isGroupSubject: e.isGroupSubject ?? false,
          })),
          { transaction: t }
        );
      }
      await t.commit();
      return res.json({ message: 'Horario guardado', count: entries?.length ?? 0 });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    console.error('[saveScheduleEntries] Error:', error);
    return res.status(500).json({ message: 'Error al guardar entradas del horario' });
  }
};

// GET /api/schedules/teacher/:personId?schoolPeriodId=
export const getTeacherSchedule = async (req: Request, res: Response) => {
  try {
    const { personId } = req.params;
    const { schoolPeriodId } = req.query;
    const where: any = { teacherId: Number(personId) };
    if (schoolPeriodId) {
      // Filter by schedule's schoolPeriodId via include
    }
    const entries = await ScheduleEntry.findAll({
      where,
      include: [
        { model: Schedule, as: 'schedule', where: schoolPeriodId ? { schoolPeriodId: Number(schoolPeriodId) } : undefined, include: [
          { model: PeriodGradeSection, as: 'section', include: [
            { model: PeriodGrade, as: 'periodGrade', include: [{ model: Grade, as: 'grade' }] },
            { model: Section, as: 'section' },
          ]},
        ]},
        { model: Subject, as: 'subject' },
      ],
    });
    return res.json(entries);
  } catch (error) {
    console.error('[getTeacherSchedule] Error:', error);
    return res.status(500).json({ message: 'Error al obtener horario del profesor' });
  }
};

// GET /api/schedules/section/:sectionId/options — returns available subject+teacher combos for a section
export const getSectionScheduleOptions = async (req: Request, res: Response) => {
  try {
    const { sectionId } = req.params;
    // Find the PeriodGradeSection to get periodGradeId
    const pgs = await PeriodGradeSection.findByPk(Number(sectionId));
    if (!pgs) return res.status(404).json({ message: 'Sección no encontrada' });

    // Get all subjects for this grade (PeriodGradeSubject)
    const pgsList = await PeriodGradeSubject.findAll({
      where: { periodGradeId: pgs.periodGradeId, active: true },
      include: [{ model: Subject, as: 'subject' }],
      order: [['order', 'ASC']],
    });

    // Get teacher assignments for this section
    const assignments = await TeacherAssignment.findAll({
      where: { sectionId: Number(sectionId) },
      include: [
        { model: Person, as: 'teacher', attributes: ['id', 'firstName', 'lastName'] },
        { model: PeriodGradeSubject, as: 'periodGradeSubject', attributes: ['id', 'subjectId', 'weeklyBlocks'] },
      ],
    });

    // Build options: for each subject, list teachers assigned to it for this section
    const options = pgsList.map(p => {
      const subject = (p as any).subject;
      const teachers = assignments
        .filter(a => a.periodGradeSubjectId === p.id)
        .map(a => ({
          teacherId: (a as any).teacherId,
          teacherName: `${(a as any).teacher?.firstName ?? ''} ${(a as any).teacher?.lastName ?? ''}`.trim(),
        }));
      return {
        periodGradeSubjectId: p.id,
        subjectId: p.subjectId,
        subjectName: subject?.name ?? '',
        weeklyBlocks: p.weeklyBlocks,
        allowConsecutiveBlocks: subject?.allowConsecutiveBlocks ?? false,
        subjectGroupId: subject?.subjectGroupId ?? null,
        teachers,
      };
    });

    return res.json(options);
  } catch (error) {
    console.error('[getSectionScheduleOptions] Error:', error);
    return res.status(500).json({ message: 'Error al obtener opciones de horario' });
  }
};

// GET /api/schedules/conflicts?day=&periodId=&teacherId=&scheduleId= — check if teacher is busy at a slot
export const checkTeacherConflict = async (req: Request, res: Response) => {
  try {
    const { day, periodId, teacherId, scheduleId, schoolPeriodId } = req.query;
    if (!day || !periodId || !teacherId) {
      return res.status(400).json({ message: 'day, periodId, teacherId son requeridos' });
    }
    // Find all entries for this teacher at this day+period, excluding the current schedule
    const entries = await ScheduleEntry.findAll({
      where: {
        day: String(day),
        periodId: String(periodId),
        teacherId: Number(teacherId),
      },
      include: [
        { model: Schedule, as: 'schedule', where: schoolPeriodId ? { schoolPeriodId: Number(schoolPeriodId) } : undefined, include: [
          { model: PeriodGradeSection, as: 'section', include: [
            { model: PeriodGrade, as: 'periodGrade', include: [{ model: Grade, as: 'grade' }] },
            { model: Section, as: 'section' },
          ]},
        ]},
        { model: Subject, as: 'subject' },
      ],
    });
    // Filter out entries belonging to the current schedule (the one being edited)
    const conflicts = entries.filter((e: any) => e.scheduleId !== Number(scheduleId));
    return res.json({ hasConflict: conflicts.length > 0, conflicts });
  } catch (error) {
    console.error('[checkTeacherConflict] Error:', error);
    return res.status(500).json({ message: 'Error al verificar conflicto' });
  }
};
