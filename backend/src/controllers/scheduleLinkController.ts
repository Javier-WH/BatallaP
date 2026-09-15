import { Request, Response } from 'express';
import sequelize from '@/config/database';
import { ScheduleLink, ScheduleLinkItem, Subject, PeriodGrade, Grade } from '@/models';

// GET /api/schedule-links?schoolPeriodId=
export const listLinks = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId } = req.query;
    const where: any = {};
    if (schoolPeriodId) where.schoolPeriodId = Number(schoolPeriodId);

    const links = await ScheduleLink.findAll({
      where,
      include: [
        {
          model: ScheduleLinkItem,
          as: 'items',
          include: [
            { model: Subject, as: 'subject', attributes: ['id', 'name', 'color'] },
            { model: PeriodGrade, as: 'periodGrade', include: [{ model: Grade, as: 'grade', attributes: ['id', 'name'] }] },
          ],
        },
      ],
      order: [['id', 'ASC']],
    });
    return res.json(links);
  } catch (error) {
    console.error('[listLinks] Error:', error);
    return res.status(500).json({ message: 'Error al listar vínculos de horarios' });
  }
};

// POST /api/schedule-links
export const createLink = async (req: Request, res: Response) => {
  try {
    const { name, schoolPeriodId, items } = req.body as {
      name?: string | null;
      schoolPeriodId: number;
      items: Array<{ subjectId: number; periodGradeId: number }>;
    };

    if (!schoolPeriodId) return res.status(400).json({ message: 'schoolPeriodId es requerido' });
    if (!items || items.length < 2) {
      return res.status(400).json({ message: 'Se requieren al menos 2 materias para crear un vínculo' });
    }

    // Validate no duplicate (subjectId, periodGradeId) pairs within the request
    const seen = new Set<string>();
    for (const item of items) {
      const key = `${item.subjectId}|${item.periodGradeId}`;
      if (seen.has(key)) {
        return res.status(400).json({ message: `Par duplicado en la solicitud: subjectId=${item.subjectId}, periodGradeId=${item.periodGradeId}` });
      }
      seen.add(key);
    }

    // Validate that all periodGrades belong to the given school period
    const periodGrades = await PeriodGrade.findAll({
      where: { id: items.map(i => i.periodGradeId) },
      attributes: ['id', 'schoolPeriodId'],
    });
    const pgPeriod = new Map(periodGrades.map(pg => [pg.id, pg.schoolPeriodId]));
    for (const item of items) {
      if (pgPeriod.get(item.periodGradeId) !== Number(schoolPeriodId)) {
        return res.status(400).json({ message: `El grado (periodGradeId=${item.periodGradeId}) no pertenece al período indicado` });
      }
    }

    // Validate that all subjects are group subjects (the feature only applies to group subjects)
    const subjects = await Subject.findAll({
      where: { id: items.map(i => i.subjectId) },
      attributes: ['id', 'subjectGroupId'],
    });
    const subjectGroup = new Map(subjects.map(s => [s.id, s.subjectGroupId]));
    for (const item of items) {
      if (!subjectGroup.has(item.subjectId)) {
        return res.status(400).json({ message: `La materia (subjectId=${item.subjectId}) no existe` });
      }
      if (subjectGroup.get(item.subjectId) == null) {
        return res.status(400).json({ message: `La materia (subjectId=${item.subjectId}) no es una materia de grupo` });
      }
    }

    // Validate that none of the (subjectId, periodGradeId) pairs already belong to another link
    const existingItems = await ScheduleLinkItem.findAll({
      where: {
        subjectId: items.map(i => i.subjectId),
        periodGradeId: items.map(i => i.periodGradeId),
      },
    });
    const existingSet = new Set(existingItems.map(i => `${i.subjectId}|${i.periodGradeId}`));
    for (const item of items) {
      const key = `${item.subjectId}|${item.periodGradeId}`;
      if (existingSet.has(key)) {
        return res.status(400).json({
          message: `La materia (subjectId=${item.subjectId}, periodGradeId=${item.periodGradeId}) ya pertenece a otro vínculo`,
        });
      }
    }

    const t = await sequelize.transaction();
    try {
      const link = await ScheduleLink.create({ name: name ?? null, schoolPeriodId }, { transaction: t });
      await ScheduleLinkItem.bulkCreate(
        items.map(item => ({ linkId: link.id, subjectId: item.subjectId, periodGradeId: item.periodGradeId })),
        { transaction: t }
      );
      await t.commit();

      // Reload with associations for the response
      const fullLink = await ScheduleLink.findByPk(link.id, {
        include: [
          {
            model: ScheduleLinkItem,
            as: 'items',
            include: [
              { model: Subject, as: 'subject', attributes: ['id', 'name', 'color'] },
              { model: PeriodGrade, as: 'periodGrade', include: [{ model: Grade, as: 'grade', attributes: ['id', 'name'] }] },
            ],
          },
        ],
      });
      return res.status(201).json(fullLink);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    console.error('[createLink] Error:', error);
    return res.status(500).json({ message: 'Error al crear vínculo de horario' });
  }
};

// DELETE /api/schedule-links/:id
export const deleteLink = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const link = await ScheduleLink.findByPk(Number(id));
    if (!link) return res.status(404).json({ message: 'Vínculo no encontrado' });

    await link.destroy(); // CASCADE deletes items
    return res.json({ message: 'Vínculo eliminado' });
  } catch (error) {
    console.error('[deleteLink] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar vínculo de horario' });
  }
};
