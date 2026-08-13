import { Op, Transaction } from 'sequelize';
import sequelize from '@/config/database';
import {
  SchoolPeriod,
  PeriodGrade,
  PeriodGradeSection,
  PeriodGradeSubject,
  TeacherAssignment,
  Term,
} from '@/models/index';

export interface NextPeriodDescriptor {
  period: string;
  name: string;
  startYear: number;
  endYear: number;
}

export const getActivePeriod = async (transaction?: Transaction) =>
  SchoolPeriod.findOne({ where: { status: 'activo' }, transaction });

export const getPreinscriptionPeriod = async (transaction?: Transaction) =>
  SchoolPeriod.findOne({ where: { status: 'preinscripcion' }, transaction });

/**
 * Build the descriptor of the school year right after the given one.
 * "2025-2026" -> "2026-2027".
 */
export const buildNextPeriodDescriptor = (period: SchoolPeriod): NextPeriodDescriptor => {
  const startYear = period.startYear + 1;
  const endYear = period.endYear + 1;
  const label = `${startYear}-${endYear}`;

  return {
    period: label,
    name: `Año Escolar ${label}`,
    startYear,
    endYear,
  };
};

/**
 * Copy the academic structure (terms, grades, sections, subjects and teacher
 * assignments) from one period into another. The target period is expected to
 * be empty; nothing is deleted here.
 */
export const clonePeriodStructure = async (
  sourcePeriodId: number,
  targetPeriodId: number,
  transaction: Transaction
): Promise<void> => {
  const existingTerms = await Term.count({
    where: { schoolPeriodId: targetPeriodId },
    transaction,
  });

  const sourceTerms = existingTerms > 0
    ? []
    : await Term.findAll({
      where: { schoolPeriodId: sourcePeriodId },
      order: [['order', 'ASC']],
      transaction,
    });

  for (const term of sourceTerms) {
    await Term.create(
      {
        schoolPeriodId: targetPeriodId,
        name: term.name,
        order: term.order,
        isBlocked: false,
      },
      { transaction }
    );
  }

  const sourcePeriodGrades = await PeriodGrade.findAll({
    where: { schoolPeriodId: sourcePeriodId },
    transaction,
  });

  const periodGradeSubjectIdMap = new Map<number, number>();

  for (const pg of sourcePeriodGrades) {
    const newPeriodGrade = await PeriodGrade.create(
      {
        schoolPeriodId: targetPeriodId,
        gradeId: pg.gradeId,
        specializationId: pg.specializationId,
      },
      { transaction }
    );

    const sourceSections = await PeriodGradeSection.findAll({
      where: { periodGradeId: pg.id },
      transaction,
    });

    for (const pgs of sourceSections) {
      await PeriodGradeSection.create(
        {
          periodGradeId: newPeriodGrade.id,
          sectionId: pgs.sectionId,
        },
        { transaction }
      );
    }

    const sourceSubjects = await PeriodGradeSubject.findAll({
      where: { periodGradeId: pg.id },
      transaction,
    });

    for (const pgSubject of sourceSubjects) {
      const newPeriodGradeSubject = await PeriodGradeSubject.create(
        {
          periodGradeId: newPeriodGrade.id,
          subjectId: pgSubject.subjectId,
          order: pgSubject.order,
        },
        { transaction }
      );

      periodGradeSubjectIdMap.set(pgSubject.id, newPeriodGradeSubject.id);
    }
  }

  if (periodGradeSubjectIdMap.size === 0) return;

  const sourceAssignments = await TeacherAssignment.findAll({
    where: {
      periodGradeSubjectId: { [Op.in]: Array.from(periodGradeSubjectIdMap.keys()) },
    },
    transaction,
  });

  for (const assignment of sourceAssignments) {
    const newPeriodGradeSubjectId = periodGradeSubjectIdMap.get(assignment.periodGradeSubjectId);
    if (!newPeriodGradeSubjectId) continue;

    await TeacherAssignment.create(
      {
        teacherId: assignment.teacherId,
        periodGradeSubjectId: newPeriodGradeSubjectId,
        sectionId: assignment.sectionId,
      },
      { transaction }
    );
  }
};

/**
 * Guarantee that the school year following the active one exists and is flagged
 * as 'preinscripcion', so students can enroll for the next year before the
 * current one ends. Idempotent: does nothing when the next period already exists.
 */
export const ensureNextPreinscriptionPeriod = async (
  activePeriod: SchoolPeriod,
  transaction: Transaction
): Promise<SchoolPeriod | null> => {
  const descriptor = buildNextPeriodDescriptor(activePeriod);

  const existing = await SchoolPeriod.findOne({
    where: {
      status: { [Op.ne]: 'externo' },
      startYear: descriptor.startYear,
    },
    transaction,
  });

  if (existing) {
    // Normalize an already created future period that was left as 'historico'
    if (existing.status === 'historico') {
      await existing.update({ status: 'preinscripcion' }, { transaction });
    }

    // Backfill the structure when the period was created before the active one had any
    const structureCount = await PeriodGrade.count({
      where: { schoolPeriodId: existing.id },
      transaction,
    });
    if (structureCount === 0) {
      await clonePeriodStructure(activePeriod.id, existing.id, transaction);
    }

    return existing;
  }

  const created = await SchoolPeriod.create(
    {
      period: descriptor.period,
      name: descriptor.name,
      startYear: descriptor.startYear,
      endYear: descriptor.endYear,
      status: 'preinscripcion',
    },
    { transaction }
  );

  await clonePeriodStructure(activePeriod.id, created.id, transaction);

  return created;
};

/**
 * Make the given period the active one. Demotes the previous active period to
 * 'historico', keeps at most one 'preinscripcion' and creates the following
 * school year when it does not exist yet.
 */
export const activatePeriod = async (
  periodId: number,
  externalTransaction?: Transaction
): Promise<SchoolPeriod> => {
  const transaction = externalTransaction ?? (await sequelize.transaction());
  const ownsTransaction = !externalTransaction;

  try {
    const target = await SchoolPeriod.findByPk(periodId, { transaction });
    if (!target) throw new Error('Período escolar no encontrado');
    if (target.status === 'externo') {
      throw new Error('No se puede activar un período externo');
    }

    await SchoolPeriod.update(
      { status: 'historico' },
      {
        where: {
          status: { [Op.in]: ['activo', 'preinscripcion'] },
          id: { [Op.ne]: target.id },
        },
        transaction,
      }
    );

    await target.update({ status: 'activo' }, { transaction });

    await ensureNextPreinscriptionPeriod(target, transaction);

    if (ownsTransaction) await transaction.commit();

    return target;
  } catch (error) {
    if (ownsTransaction) await transaction.rollback();
    throw error;
  }
};
