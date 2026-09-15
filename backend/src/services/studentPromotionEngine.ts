import { Transaction, Op } from 'sequelize';
import {
  Grade,
  Inscription,
  SchoolPeriodTransitionRule,
  StudentPeriodOutcome,
  Setting,
  PendingSubject,
} from '@/models/index';
import { FinalGradeSummary, SubjectResultSummary } from './finalGradeCalculator';
import { getSubjectNotRepairableMapByGradeAndPeriod } from './subjectOrderService';

type InscriptionWithOutcome = Inscription & {
  periodOutcome?: StudentPeriodOutcome | null;
};

interface EvaluateOptions {
  transaction?: Transaction;
  now?: Date;
  /** When false, do NOT persist StudentPeriodOutcome (preview mode). */
  persist?: boolean;
}

interface EvaluateResult {
  outcome: StudentPeriodOutcome | null;
  pendingSubjects: SubjectResultSummary[];
  promotionGrade?: Grade | null;
  /** Subject IDs of previously-pending subjects that were approved this period. */
  approvedPendingSubjectIds: number[];
  /** Subject IDs of previously-pending subjects that remain unresolved/failed. */
  failedPendingSubjectIds: number[];
  /** True when the student is repeating because they failed a pending subject (rezagado). */
  isRezagado: boolean;
  /** Computed status (always available, even in preview mode). */
  status: 'aprobado' | 'materias_pendientes' | 'reprobado';
  /** Computed promotion grade ID (always available, even in preview mode). */
  promotionGradeId: number | null;
  /** Computed graduatedAt (always available, even in preview mode). */
  graduatedAt: Date | null;
  /** Computed finalAverage (always available, even in preview mode). */
  finalAverage: number | null;
  /** Computed failedSubjects count (always available, even in preview mode). */
  failedSubjects: number;
}

export class StudentPromotionEngine {
  static async evaluateInscription(
    inscriptionId: number,
    summary: FinalGradeSummary,
    options: EvaluateOptions = {}
  ): Promise<EvaluateResult> {
    const persist = options.persist ?? true;
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
    // Discover MP records across the student's inscriptions in this period.
    // In production, pending subjects live in a SEPARATE materia_pendiente
    // inscription, not the regular/repeater one being evaluated here.
    const studentInscriptions = await Inscription.findAll({
      where: {
        schoolPeriodId: inscription.schoolPeriodId,
        personId: inscription.personId,
        withdrawnAt: null,
      },
      transaction: options.transaction,
    });
    // Pending subjects may be attached to any inscription for the student;
    // escolaridad is descriptive and must not restrict this lookup.
    const allInscriptionIds = Array.from(new Set([
      ...studentInscriptions.map(i => i.id),
      inscription.id,
    ]));

    const pendingSubjectsRecords = await PendingSubject.findAll({
      where: {
        newInscriptionId: { [Op.in]: allInscriptionIds },
      },
      transaction: options.transaction,
    });

    // Collect approved and failed pending subject IDs.
    // Per the documented rules:
    //   - status='aprobada' or 'convalidada' → resolved successfully
    //   - status='pendiente' at closure → FAILED (user clarification:
    //     an unresolved MP without a definitive result is considered failed)
    const approvedPendingSubjectIds: number[] = [];
    const failedPendingSubjectIds: number[] = [];

    for (const ps of pendingSubjectsRecords) {
      if (ps.status === 'aprobada' || ps.status === 'convalidada') {
        approvedPendingSubjectIds.push(ps.subjectId);
      } else if (ps.status === 'pendiente') {
        failedPendingSubjectIds.push(ps.subjectId);
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

    let outcome: StudentPeriodOutcome | null = null;
    if (persist) {
      outcome = inscription.periodOutcome ?? null;
      if (outcome) {
        await outcome.update(payload, { transaction: options.transaction });
      } else {
        outcome = await StudentPeriodOutcome.create(payload, {
          transaction: options.transaction
        });
      }
    }

    // Exclude subjects flagged as "No Reparable" from pending subjects — they
    // cannot go to Materia Pendiente (Opción A: filtrar, no borrar).
    const notRepairableMap = await getSubjectNotRepairableMapByGradeAndPeriod(
      inscription.gradeId,
      inscription.schoolPeriodId,
      options.transaction
    );
    const notRepairableSubjectIds = new Set<number>();
    for (const [subjectId, notRepairable] of notRepairableMap.entries()) {
      if (notRepairable) notRepairableSubjectIds.add(subjectId);
    }

    const pendingSubjects = summary.subjectResults.filter(
      (subject) => subject.status === 'reprobada' && !notRepairableSubjectIds.has(subject.subjectId)
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
      isRezagado,
      status,
      promotionGradeId,
      graduatedAt,
      finalAverage: summary.finalAverage,
      failedSubjects: summary.failedSubjects,
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
