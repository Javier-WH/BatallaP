import { Transaction } from 'sequelize';
import {
  Grade,
  Inscription,
  SchoolPeriodTransitionRule,
  StudentPeriodOutcome
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

    const status = StudentPromotionEngine.determineStatus(summary, rule);
    const promotionGradeId = StudentPromotionEngine.getPromotionGradeId(
      inscription.gradeId,
      status,
      rule
    );

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
        evaluatedAt: (options.now ?? new Date()).toISOString()
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
      promotionGrade
    };
  }

  private static determineStatus(
    summary: FinalGradeSummary,
    rule?: SchoolPeriodTransitionRule | null
  ): 'aprobado' | 'materias_pendientes' | 'reprobado' {
    const finalAverage = summary.finalAverage ?? 0;
    const minAverage = Number(rule?.minAverage ?? 10);
    const maxPending = rule?.maxPendingSubjects ?? 0;

    if (summary.failedSubjects === 0 && finalAverage >= minAverage) {
      return 'aprobado';
    }

    if (summary.failedSubjects > maxPending) {
      return 'reprobado';
    }

    return 'materias_pendientes';
  }

  private static getPromotionGradeId(
    currentGradeId: number,
    status: 'aprobado' | 'materias_pendientes' | 'reprobado',
    rule?: SchoolPeriodTransitionRule | null
  ): number | null {
    if (status === 'reprobado') {
      return currentGradeId;
    }

    return rule?.gradeToId ?? null;
  }
}

export default StudentPromotionEngine;
