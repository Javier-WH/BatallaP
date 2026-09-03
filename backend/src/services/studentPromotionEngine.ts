import { Transaction } from 'sequelize';
import {
  Grade,
  Inscription,
  SchoolPeriodTransitionRule,
  StudentPeriodOutcome,
  Setting
} from '@/models/index';
import { FinalGradeSummary, SubjectResultSummary } from './finalGradeCalculator';

type InscriptionWithOutcome = Inscription & {
  periodOutcome?: StudentPeriodOutcome | null;
};

interface EvaluateOptions {
  transaction?: Transaction;
  now?: Date;
}

interface EvaluateResult {
  outcome: StudentPeriodOutcome;
  pendingSubjects: SubjectResultSummary[];
  promotionGrade?: Grade | null;
  /** Subject IDs of previously-pending subjects that were approved this period. */
  approvedPendingSubjectIds: number[];
  /** Subject IDs of previously-pending subjects that were re-approved (still failed). */
  failedPendingSubjectIds: number[];
  /** True when the student is repeating because they failed a pending subject (rezagado). */
  isRezagado: boolean;
}

export class StudentPromotionEngine {
  static async evaluateInscription(
    inscriptionId: number,
    summary: FinalGradeSummary,
    options: EvaluateOptions = {}
  ): Promise<EvaluateResult> {
    const inscription = (await Inscription.findByPk(inscriptionId, {
      include: [{ model: StudentPeriodOutcome, as: 'periodOutcome' }],
      transaction: options.transaction
    })) as InscriptionWithOutcome | null;

    if (!inscription) {
      throw new Error('Inscripción no encontrada');
    }

    const rule = await SchoolPeriodTransitionRule.findOne({
      where: { gradeFromId: inscription.gradeId },
      transaction: options.transaction
    });

    const maxFailedSetting = await Setting.findByPk('max_failed_subjects', { transaction: options.transaction });
    const maxFailedSubjects = maxFailedSetting ? parseInt(maxFailedSetting.value, 10) : 3;

    let status = StudentPromotionEngine.determineStatus(summary, maxFailedSubjects, rule);
    let promotionGradeId = await StudentPromotionEngine.getPromotionGradeId(
      inscription.gradeId,
      status,
      rule,
      options
    );

    // --- Pending subjects evaluation (R5, R6, R7) ---
    const { PendingSubject } = await import('@/models/index');

    // Find active pending subjects for this inscription
    const pendingSubjectsRecords = await PendingSubject.findAll({
      where: {
        newInscriptionId: inscription.id,
        status: 'pendiente'
      },
      transaction: options.transaction
    });

    const pendingSubjectIds = new Set(pendingSubjectsRecords.map(ps => ps.subjectId));

    // Collect approved and failed pending subject IDs
    const approvedPendingSubjectIds: number[] = [];
    const failedPendingSubjectIds: number[] = [];

    for (const result of summary.subjectResults) {
      if (!pendingSubjectIds.has(result.subjectId)) continue;
      if (result.status === 'aprobada') {
        approvedPendingSubjectIds.push(result.subjectId);
      } else if (result.status === 'reprobada') {
        failedPendingSubjectIds.push(result.subjectId);
      }
    }

    // R5: If the student fails any pending subject → rezagado (repeats current grade)
    let isRezagado = false;
    if (failedPendingSubjectIds.length > 0) {
      status = 'reprobado';
      promotionGradeId = inscription.gradeId; // repeat CURRENT grade, not the origin grade
      isRezagado = true;
    }

    // R9: Last grade — if no promotion grade exists and student failed anything → repeat
    if (promotionGradeId === null && summary.failedSubjects > 0) {
      status = 'reprobado';
      promotionGradeId = inscription.gradeId;
    }

    const graduatedAt =
      status === 'aprobado' && (rule?.autoGraduate || !promotionGradeId)
        ? options.now ?? new Date()
        : null;

    const payload = {
      inscriptionId: inscription.id,
      finalAverage: summary.finalAverage,
      failedSubjects: summary.failedSubjects,
      status,
      promotionGradeId,
      graduatedAt,
      metadata: {
        ruleId: rule?.id ?? null,
        maxPendingSubjects: rule?.maxPendingSubjects ?? null,
        evaluatedAt: (options.now ?? new Date()).toISOString(),
        isRezagado
      }
    };

    let outcome = inscription.periodOutcome ?? null;
    if (outcome) {
      await outcome.update(payload, { transaction: options.transaction });
    } else {
      outcome = await StudentPeriodOutcome.create(payload, {
        transaction: options.transaction
      });
    }

    const pendingSubjects = summary.subjectResults.filter(
      (subject) => subject.status === 'reprobada'
    );

    const promotionGrade = promotionGradeId
      ? await Grade.findByPk(promotionGradeId, { transaction: options.transaction })
      : null;

    return {
      outcome,
      pendingSubjects,
      promotionGrade,
      approvedPendingSubjectIds,
      failedPendingSubjectIds,
      isRezagado
    };
  }

  private static determineStatus(
    summary: FinalGradeSummary,
    maxFailedSubjects: number,
    rule?: SchoolPeriodTransitionRule | null
  ): 'aprobado' | 'materias_pendientes' | 'reprobado' {
    const finalAverage = summary.finalAverage ?? 0;
    const minAverage = Number(rule?.minAverage ?? 10);

    if (summary.failedSubjects === 0 && finalAverage >= minAverage) {
      return 'aprobado';
    }

    if (summary.failedSubjects > maxFailedSubjects) {
      return 'reprobado';
    }

    return 'materias_pendientes';
  }

  private static async getPromotionGradeId(
    currentGradeId: number,
    status: 'aprobado' | 'materias_pendientes' | 'reprobado',
    rule: SchoolPeriodTransitionRule | null,
    options: EvaluateOptions = {}
  ): Promise<number | null> {
    if (status === 'reprobado') {
      return currentGradeId;
    }

    if (rule?.gradeToId) {
      return rule.gradeToId;
    }

    // Fallback: try to find next grade by order
    const currentGrade = await Grade.findByPk(currentGradeId, {
      transaction: options.transaction
    });

    if (currentGrade && typeof currentGrade.order === 'number') {
      const nextGrade = await Grade.findOne({
        where: { order: currentGrade.order + 1 },
        transaction: options.transaction
      });
      if (nextGrade) {
        return nextGrade.id;
      }
    }

    return null;
  }
}

export default StudentPromotionEngine;
