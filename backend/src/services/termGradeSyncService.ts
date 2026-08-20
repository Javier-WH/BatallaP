import { Transaction } from 'sequelize';
import {
  Inscription,
  InscriptionSubject,
  Qualification,
  CouncilPoint,
  Term,
  SubjectTermGrade,
  EvaluationPlan,
} from '@/models/index';

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
      const roundedScore = Math.round(rawScore);
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
   * Recalculates term grades for all subjects of an inscription.
   * Useful when multiple subjects are affected (e.g. bulk operations).
   */
  static async syncForInscription(
    inscriptionId: number,
    options: { transaction?: Transaction } = {}
  ): Promise<void> {
    const insSubs = await InscriptionSubject.findAll({
      where: { inscriptionId },
      transaction: options.transaction,
    });

    for (const insSub of insSubs) {
      await this.syncForInscriptionSubject(insSub.id, options);
    }
  }
}

export default TermGradeSyncService;
