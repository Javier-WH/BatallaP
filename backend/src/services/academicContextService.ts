import { Transaction } from 'sequelize';
import {
  EvaluationPlan,
  Inscription,
  InscriptionSubject,
  PeriodGrade,
  PeriodGradeSubject,
  Term,
} from '@/models/index';

export interface AcademicContext {
  schoolPeriodId: number;
  gradeId: number;
  sectionId: number | null;
  subjectId: number;
  termId: number;
  date: Date | null;
  evaluationPlanId: number;
  inscriptionId: number;
  inscriptionSubjectId: number;
}

export class AcademicContextError extends Error {
  public readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'AcademicContextError';
  }
}

export async function resolveAcademicContext(
  evaluationPlanId: number,
  inscriptionSubjectId: number,
  transaction?: Transaction,
): Promise<AcademicContext> {
  const [plan, inscriptionSubject] = await Promise.all([
    EvaluationPlan.findByPk(evaluationPlanId, {
      include: [
        { model: Term, as: 'term' },
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject',
          include: [{ model: PeriodGrade, as: 'periodGrade' }],
        },
      ],
      transaction,
    }),
    InscriptionSubject.findByPk(inscriptionSubjectId, {
      include: [{ model: Inscription, as: 'inscription' }],
      transaction,
    }),
  ]);

  if (!plan) throw new AcademicContextError('Plan de evaluación no encontrado');
  if (!inscriptionSubject) throw new AcademicContextError('Inscripción de materia no encontrada');

  const periodGradeSubject = (plan as any).periodGradeSubject;
  const periodGrade = periodGradeSubject?.periodGrade;
  const term = (plan as any).term;
  const inscription = (inscriptionSubject as any).inscription;

  if (!periodGradeSubject || !periodGrade || !term || !inscription) {
    throw new AcademicContextError('No se pudo resolver el contexto académico completo');
  }

  const context: AcademicContext = {
    schoolPeriodId: Number(periodGrade.schoolPeriodId),
    gradeId: Number(periodGrade.gradeId),
    sectionId: plan.sectionId == null ? null : Number(plan.sectionId),
    subjectId: Number(periodGradeSubject.subjectId),
    termId: Number(plan.termId),
    date: plan.date ?? null,
    evaluationPlanId: Number(plan.id),
    inscriptionId: Number(inscription.id),
    inscriptionSubjectId: Number(inscriptionSubject.id),
  };

  if (Number(term.schoolPeriodId) !== context.schoolPeriodId) {
    throw new AcademicContextError('El lapso no pertenece al período del plan de evaluación');
  }
  if (Number(inscription.schoolPeriodId) !== context.schoolPeriodId) {
    throw new AcademicContextError('La inscripción no pertenece al período del plan de evaluación');
  }
  if (Number(inscription.gradeId) !== context.gradeId) {
    throw new AcademicContextError('La inscripción no pertenece al grado del plan de evaluación');
  }
  if (Number(inscriptionSubject.subjectId) !== context.subjectId) {
    throw new AcademicContextError('La materia no coincide con el plan de evaluación');
  }
  if (context.sectionId !== null && Number(inscription.sectionId) !== context.sectionId) {
    throw new AcademicContextError('La sección no coincide con el plan de evaluación');
  }

  return context;
}

export function assertRequestedContext(
  context: AcademicContext,
  requested: Partial<Pick<AcademicContext, 'schoolPeriodId' | 'gradeId' | 'sectionId' | 'termId' | 'subjectId'>>,
): void {
  for (const field of ['schoolPeriodId', 'gradeId', 'termId', 'subjectId'] as const) {
    if (requested[field] !== undefined && Number(requested[field]) !== context[field]) {
      throw new AcademicContextError(`El ${field} no coincide con el contexto académico`);
    }
  }
  if (requested.sectionId !== undefined && (requested.sectionId == null ? null : Number(requested.sectionId)) !== context.sectionId) {
    throw new AcademicContextError('La sección no coincide con el contexto académico');
  }
}

export async function getInscriptionAcademicContext(
  inscriptionSubjectId: number,
  transaction?: Transaction,
): Promise<Pick<AcademicContext, 'schoolPeriodId' | 'gradeId' | 'sectionId' | 'subjectId' | 'inscriptionId'>> {
  const inscriptionSubject = await InscriptionSubject.findByPk(inscriptionSubjectId, {
    include: [{ model: Inscription, as: 'inscription' }],
    transaction,
  });
  const inscription = (inscriptionSubject as any)?.inscription;
  if (!inscriptionSubject || !inscription) {
    throw new AcademicContextError('No se pudo resolver el contexto de la inscripción');
  }
  return {
    schoolPeriodId: Number(inscription.schoolPeriodId),
    gradeId: Number(inscription.gradeId),
    sectionId: inscription.sectionId == null ? null : Number(inscription.sectionId),
    subjectId: Number(inscriptionSubject.subjectId),
    inscriptionId: Number(inscription.id),
  };
}
