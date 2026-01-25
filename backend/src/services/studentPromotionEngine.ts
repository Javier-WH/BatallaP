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

    // Logic: If a student fails a pending subject, they must repeat the year of that pending subject.
    const { PendingSubject, PeriodGrade, Subject } = await import('@/models/index');

    // Find active pending subjects for this inscription
    const pendingSubjectsRecords = await PendingSubject.findAll({
      where: {
        newInscriptionId: inscription.id,
        status: 'pendiente'
      },
      transaction: options.transaction
    });

    if (pendingSubjectsRecords.length > 0) {
      // Check if any of the failed subjects is a pending subject
      let failedPendingSubjectRecord = null;

      for (const result of summary.subjectResults) {
        if (result.status === 'reprobada') {
          const match = pendingSubjectsRecords.find(ps => ps.subjectId === result.subjectId);
          if (match) {
            failedPendingSubjectRecord = match;
            break;
          }
        }
      }

      if (failedPendingSubjectRecord) {
        // Change status to reprobado immediately
        status = 'reprobado';

        // Find the grade of the pending subject to set as promotionGradeId (Repeat that grade)
        const periodGrade = await PeriodGrade.findOne({
          where: { schoolPeriodId: failedPendingSubjectRecord.originPeriodId },
          include: [{
            model: Subject,
            as: 'subjects',
            where: { id: failedPendingSubjectRecord.subjectId },
            required: true
          }],
          transaction: options.transaction
        });

        if (periodGrade) {
          promotionGradeId = periodGrade.gradeId;
        }
      }
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
