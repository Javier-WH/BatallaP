import { Transaction } from 'sequelize';
import {
  Inscription,
  InscriptionSubject,
  Qualification,
  CouncilPoint,
  Term,
  SubjectTermGrade,
  SubjectFinalGrade,
  EvaluationPlan,
} from '@/models/index';
import { roundFinalGrade } from './gradeEvaluationService';

/**
 * TermGradeSyncService
 *
 * Single source of truth for per-lapso (term) grades.
 * Calculates the score for each term from qualifications + council points
 * and upserts the result into `subject_term_grades`.
 *
 * All views that need per-lapso grades (boletines, planillas, certified grades)
 * read from `SubjectTermGrade` to ensure consistency.
 */
export class TermGradeSyncService {
  /**
   * Recalculates and persists term grades for a single InscriptionSubject.
   * Call this whenever a qualification or council point changes for that subject.
   */
  static async syncForInscriptionSubject(
    inscriptionSubjectId: number,
    options: { transaction?: Transaction } = {}
  ): Promise<void> {
    const insSub = await InscriptionSubject.findByPk(inscriptionSubjectId, {
      include: [
        {
          model: Qualification,
          as: 'qualifications',
          include: [{ model: EvaluationPlan, as: 'evaluationPlan' }],
        },
        { model: CouncilPoint, as: 'councilPoints' },
        { model: Inscription, as: 'inscription' },
      ],
      transaction: options.transaction,
    }) as any;

    if (!insSub) return;

    // Get the school period's terms
    const inscription = insSub.inscription;
    if (!inscription) return;

    const terms = await Term.findAll({
      where: { schoolPeriodId: inscription.schoolPeriodId },
      transaction: options.transaction,
    });

    // Calculate score per term
    const termScores: Record<number, number> = {};
    terms.forEach((t) => { termScores[t.id] = 0; });

    (insSub.qualifications || []).forEach((q: any) => {
      if (q.isAbsent) return;
      const score = q.remedialScore != null && Number(q.remedialScore) > 0
        ? Number(q.remedialScore)
        : Number(q.score) || 0;
      const percentage = Number(q.evaluationPlan?.percentage) || 0;
      const termId = q.evaluationPlan?.termId;
      if (termId && termScores[termId] !== undefined) {
        termScores[termId] += score * (percentage / 100);
      }
    });

    (insSub.councilPoints || []).forEach((cp: any) => {
      const pVal = Number(cp.points) || 0;
      if (cp.termId && termScores[cp.termId] !== undefined) {
        termScores[cp.termId] += pVal;
      }
    });

    // Upsert each term grade (rounded to integer)
    const now = new Date();
    for (const term of terms) {
      const rawScore = termScores[term.id] || 0;
      const roundedScore = roundFinalGrade(rawScore);
      await SubjectTermGrade.upsert(
        {
          inscriptionSubjectId: insSub.id,
          termId: term.id,
          score: roundedScore,
          calculatedAt: now,
        },
        { transaction: options.transaction }
      );
    }
  }

  /**
   * Re-syncs term grades after evaluation plans were deleted (or moved to
   * another term / had their percentage changed).
   *
   * When an InscriptionSubject is left with no contributions at all (no
   * qualification rows and no council points), its SubjectTermGrade snapshots
   * would otherwise keep the last computed score forever — showing ghost
   * grades in historical/certified views. In that case the snapshots are
   * removed entirely, restoring the "no grades" state. The same applies to
   * computed 'regular' SubjectFinalGrade rows (official revision /
   * materia_pendiente / transferencia rows are never touched).
   *
   * When contributions remain, a normal sync is run so the remaining
   * evaluations are reflected.
   */
  static async resyncAfterEvaluationRemoval(
    inscriptionSubjectIds: number[],
    options: { transaction?: Transaction } = {}
  ): Promise<void> {
    for (const insSubId of [...new Set(inscriptionSubjectIds)]) {
      const qualificationCount = await Qualification.count({
        where: { inscriptionSubjectId: insSubId },
        transaction: options.transaction,
      });
      const councilPointCount = await CouncilPoint.count({
        where: { inscriptionSubjectId: insSubId },
        transaction: options.transaction,
      });

      if (qualificationCount === 0 && councilPointCount === 0) {
        await SubjectTermGrade.destroy({
          where: { inscriptionSubjectId: insSubId },
          transaction: options.transaction,
        });
        await SubjectFinalGrade.destroy({
          where: { inscriptionSubjectId: insSubId, gradeType: 'regular' },
          transaction: options.transaction,
        });
      } else {
        await this.syncForInscriptionSubject(insSubId, options);
      }
    }
  }

  /**
   * Recalculates term grades for all subjects of an inscription.
   * Useful when multiple subjects are affected (e.g. bulk operations).
   */
  static async syncForInscription(
    inscriptionId: number,
    options: { transaction?: Transaction } = {}
  ): Promise<void> {
    const insSubs = await InscriptionSubject.findAll({
      where: { inscriptionId },
      attributes: ['id', 'inscriptionId', 'schoolPeriodId', 'gradeId', 'subjectId', 'sectionId'],
      transaction: options.transaction,
    });

    for (const insSub of insSubs) {
      await this.syncForInscriptionSubject(insSub.id, options);
    }
  }
}

export default TermGradeSyncService;
