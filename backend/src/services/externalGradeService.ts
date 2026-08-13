import { Transaction } from 'sequelize';
import {
  Grade,
  Inscription,
  InscriptionSubject,
  Person,
  Plantel,
  SchoolPeriod,
  Subject,
  SubjectFinalGrade,
} from '@/models/index';
import sequelize from '@/config/database';

export type ExternalGradeType = 'transferencia' | 'equivalencia';
export type ExternalGradeStatus = 'aprobada' | 'reprobada';

export interface ResolveOrCreatePlantelInput {
  code?: string | null;
  name: string;
  state?: string | null;
  dependency?: string | null;
  municipality?: string | null;
  parish?: string | null;
}

export interface CreateExternalInscriptionInput {
  personId: number;
  periodLabel: string;       // e.g. "2024-2025"
  periodName: string;        // e.g. "2024-2025 - Colegio X"
  startYear?: number;
  endYear?: number;
  gradeId: number;
  plantelId: number;
}

export interface UpsertExternalGradeInput {
  inscriptionId: number;
  subjectId: number;
  finalScore: number;
  status: ExternalGradeStatus;
  plantelId: number;
  issuedAt: Date;
  gradeType: ExternalGradeType;
  observations?: string | null;
}

export interface ExternalGradeServiceResult {
  ok: true;
}

/**
 * Resolve a Plantel by code, or create it if not found.
 * Used to register external institutions that may not exist in the local catalog.
 */
export const resolveOrCreatePlantel = async (
  input: ResolveOrCreatePlantelInput,
  transaction?: Transaction
): Promise<Plantel> => {
  if (input.code) {
    const existing = await Plantel.findOne({ where: { code: input.code }, transaction });
    if (existing) {
      // Update name/state if provided and different (keep code as identity).
      const patch: Partial<Plantel> = {};
      if (input.name && input.name !== existing.name) patch.name = input.name;
      if (input.state && input.state !== existing.state) patch.state = input.state;
      if (input.dependency && input.dependency !== existing.dependency) patch.dependency = input.dependency;
      if (input.municipality && input.municipality !== existing.municipality) patch.municipality = input.municipality;
      if (input.parish && input.parish !== existing.parish) patch.parish = input.parish;
      if (Object.keys(patch).length > 0) {
        await existing.update(patch, { transaction });
      }
      return existing;
    }
  }
  // Fallback: search by exact name + state to avoid duplicates when no code is provided.
  if (!input.code) {
    const byName = await Plantel.findOne({
      where: { name: input.name, state: input.state ?? '' },
      transaction,
    });
    if (byName) return byName;
  }

  return Plantel.create(
    {
      code: input.code ?? `EXT-${Date.now()}`,
      name: input.name,
      state: input.state ?? '',
      dependency: input.dependency ?? undefined,
      municipality: input.municipality ?? undefined,
      parish: input.parish ?? undefined,
    },
    { transaction }
  );
};

/**
 * Find or create an external SchoolPeriod representing the school year
 * of another institution. Marked with status = 'externo' so it is excluded
 * from normal academic management selectors.
 */
export const resolveOrCreateExternalPeriod = async (
  periodLabel: string,
  periodName: string,
  startYear: number,
  endYear: number,
  transaction?: Transaction
): Promise<SchoolPeriod> => {
  const existing = await SchoolPeriod.findOne({ where: { period: periodLabel }, transaction });
  if (existing) return existing;

  return SchoolPeriod.create(
    {
      period: periodLabel,
      name: periodName,
      startYear,
      endYear,
      status: 'externo',
    },
    { transaction }
  );
};

/**
 * Create (or reuse) an Inscription for a student in an external period.
 * The inscription is marked with escolaridad = 'transferencia' so the
 * period closure engine skips it.
 */
export const createExternalInscription = async (
  input: CreateExternalInscriptionInput,
  transaction?: Transaction
): Promise<Inscription> => {
  const person = await Person.findByPk(input.personId, { transaction });
  if (!person) throw new Error('Estudiante no encontrado');

  const grade = await Grade.findByPk(input.gradeId, { transaction });
  if (!grade) throw new Error('Grado no encontrado');

  const plantel = await Plantel.findByPk(input.plantelId, { transaction });
  if (!plantel) throw new Error('Plantel no encontrado');

  const startYear = input.startYear ?? (Number(input.periodLabel.split('-')[0]) || new Date().getFullYear());
  const endYear = input.endYear ?? (Number(input.periodLabel.split('-')[1]) || startYear + 1);

  const period = await resolveOrCreateExternalPeriod(
    input.periodLabel,
    input.periodName,
    startYear,
    endYear,
    transaction
  );

  // Reuse existing inscription for this person + external period if it exists.
  const existing = await Inscription.findOne({
    where: { personId: input.personId, schoolPeriodId: period.id },
    transaction,
  });
  if (existing) return existing;

  return Inscription.create(
    {
      personId: input.personId,
      schoolPeriodId: period.id,
      gradeId: input.gradeId,
      sectionId: undefined,
      escolaridad: 'transferencia',
      isRepeater: false,
    },
    { transaction }
  );
};

/**
 * Upsert an external final grade for a subject within an external inscription.
 * The grade is stored directly (no recalculation) with the issuing institution
 * and the date from the original document.
 */
export const upsertExternalGrade = async (
  input: UpsertExternalGradeInput,
  transaction?: Transaction
): Promise<SubjectFinalGrade> => {
  const inscription = await Inscription.findByPk(input.inscriptionId, { transaction });
  if (!inscription) throw new Error('Inscripción no encontrada');
  if (inscription.escolaridad !== 'transferencia') {
    throw new Error('La inscripción no es de tipo transferencia; use el flujo normal de calificación');
  }

  const subject = await Subject.findByPk(input.subjectId, { transaction });
  if (!subject) throw new Error('Materia no encontrada');

  const plantel = await Plantel.findByPk(input.plantelId, { transaction });
  if (!plantel) throw new Error('Plantel no encontrado');

  // Find or create the InscriptionSubject row.
  let insSub = await InscriptionSubject.findOne({
    where: { inscriptionId: input.inscriptionId, subjectId: input.subjectId },
    transaction,
  });
  if (!insSub) {
    insSub = await InscriptionSubject.create(
      { inscriptionId: input.inscriptionId, subjectId: input.subjectId },
      { transaction }
    );
  }

  const existing = await SubjectFinalGrade.findOne({
    where: { inscriptionSubjectId: insSub.id },
    transaction,
  });

  if (existing) {
    // Only allow editing external grades; never downgrade a regular grade to external here.
    await existing.update(
      {
        finalScore: input.finalScore,
        status: input.status,
        plantelId: input.plantelId,
        calculatedAt: input.issuedAt,
        gradeType: input.gradeType,
        rawScore: null,
        councilPoints: 0,
      },
      { transaction }
    );
    return existing;
  }

  return SubjectFinalGrade.create(
    {
      inscriptionSubjectId: insSub.id,
      finalScore: input.finalScore,
      status: input.status,
      plantelId: input.plantelId,
      calculatedAt: input.issuedAt,
      gradeType: input.gradeType,
      rawScore: null,
      councilPoints: 0,
    },
    { transaction }
  );
};

/**
 * List external grades for a person, grouped by external inscription/period.
 */
export const listExternalGradesForPerson = async (personId: number, transaction?: Transaction) => {
  const inscriptions = await Inscription.findAll({
    where: { personId, escolaridad: 'transferencia' },
    include: [
      { model: SchoolPeriod, as: 'period' },
      { model: Grade, as: 'grade' },
      {
        model: InscriptionSubject,
        as: 'inscriptionSubjects',
        include: [
          { model: Subject, as: 'subject' },
          { model: SubjectFinalGrade, as: 'finalGrade', include: [{ model: Plantel, as: 'plantel' }] },
        ],
      },
    ],
    order: [[{ model: SchoolPeriod, as: 'period' }, 'period', 'ASC']],
    transaction,
  });
  return inscriptions;
};

/**
 * Delete an external final grade. Refuses to delete non-external grades.
 */
export const deleteExternalGrade = async (subjectFinalGradeId: number, transaction?: Transaction): Promise<void> => {
  const grade = await SubjectFinalGrade.findByPk(subjectFinalGradeId, { transaction });
  if (!grade) throw new Error('Nota no encontrada');
  if (grade.gradeType !== 'transferencia' && grade.gradeType !== 'equivalencia') {
    throw new Error('Solo se pueden eliminar notas externas (transferencia/equivalencia)');
  }
  await grade.destroy({ transaction });
};

/**
 * Orchestrate the full external enrollment + grade registration in a single transaction.
 * Useful for the bulk Excel flow.
 */
export const registerExternalGradesBatch = async (
  entries: Array<{
    personId: number;
    periodLabel: string;
    periodName: string;
    startYear?: number;
    endYear?: number;
    gradeId: number;
    plantel: ResolveOrCreatePlantelInput;
    grades: Array<{
      subjectId: number;
      finalScore: number;
      status: ExternalGradeStatus;
      issuedAt: Date;
      gradeType: ExternalGradeType;
    }>;
  }>
): Promise<{ created: number; skipped: number }> => {
  let created = 0;
  let skipped = 0;

  await sequelize.transaction(async (t) => {
    for (const entry of entries) {
      const plantel = await resolveOrCreatePlantel(entry.plantel, t);
      const inscription = await createExternalInscription(
        {
          personId: entry.personId,
          periodLabel: entry.periodLabel,
          periodName: entry.periodName,
          startYear: entry.startYear,
          endYear: entry.endYear,
          gradeId: entry.gradeId,
          plantelId: plantel.id,
        },
        t
      );

      for (const g of entry.grades) {
        try {
          await upsertExternalGrade(
            {
              inscriptionId: inscription.id,
              subjectId: g.subjectId,
              finalScore: g.finalScore,
              status: g.status,
              plantelId: plantel.id,
              issuedAt: g.issuedAt,
              gradeType: g.gradeType,
            },
            t
          );
          created += 1;
        } catch (err) {
          console.error('[ExternalGradeService] Error registering external grade:', err);
          skipped += 1;
        }
      }
    }
  });

  return { created, skipped };
};
