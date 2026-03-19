import { Transaction } from 'sequelize';
import {
  CouncilPoint,
  EvaluationPlan,
  Inscription,
  InscriptionSubject,
  Qualification,
  Term,
  Subject,
  SubjectFinalGrade
} from '@/models/index';

type InscriptionWithSubjects = Inscription & {
  inscriptionSubjects?: (InscriptionSubject & {
    qualifications?: (Qualification & { evaluationPlan?: EvaluationPlan | null })[];
    councilPoints?: CouncilPoint[];
    subject?: Subject | null;
  })[];
};

export interface SubjectResultSummary {
  inscriptionSubjectId: number;
  subjectId: number;
  subjectName?: string;
  rawScore: number;
  councilPoints: number;
  finalScore: number;
  status: 'aprobada' | 'reprobada';
}

export interface FinalGradeSummary {
  finalAverage: number | null;
  failedSubjects: number;
  subjectResults: SubjectResultSummary[];
}

interface CalculateOptions {
  transaction?: Transaction;
  minApproval?: number;
}

export class FinalGradeCalculator {
  static async calculateForInscription(
    inscriptionId: number,
    options: CalculateOptions = {}
  ): Promise<FinalGradeSummary> {
    const inscription = await Inscription.findByPk(inscriptionId, {
      include: [
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            {
              model: Qualification,
              as: 'qualifications',
              include: [{ model: EvaluationPlan, as: 'evaluationPlan' }]
            },
            { model: CouncilPoint, as: 'councilPoints' },
            { model: Subject, as: 'subject' }
          ]
        },

      ],
      transaction: options.transaction
    });

    // Correct way to get period ID
    const inscriptionSimple = await Inscription.findByPk(inscriptionId, {
      attributes: ['schoolPeriodId'],
      transaction: options.transaction
    });

    if (!inscriptionSimple) throw new Error('Inscripción no encontrada');

    // Fetch terms to know the divisor
    const terms = await Term.findAll({
      where: { schoolPeriodId: inscriptionSimple.schoolPeriodId },
      transaction: options.transaction
    });
    const termCount = terms.length || 1;

    // Re-fetch full inscription (using existing logic but simpler query structure if needed, keeping original works)
    const inscriptionRecord = await Inscription.findByPk(inscriptionId, {
      include: [
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            {
              model: Qualification,
              as: 'qualifications',
              include: [{ model: EvaluationPlan, as: 'evaluationPlan' }]
            },
            { model: CouncilPoint, as: 'councilPoints' },
            { model: Subject, as: 'subject' }
          ]
        }
      ],
      transaction: options.transaction
    }) as InscriptionWithSubjects | null;

    if (!inscriptionRecord || !inscriptionRecord.inscriptionSubjects) {
      throw new Error('Inscripción no encontrada o sin materias asociadas');
    }

    const minApproval = options.minApproval ?? 10;
    const subjectResults: SubjectResultSummary[] = [];
    let failedSubjects = 0;
    let sumFinalScores = 0;
    let subjectCount = 0;

    for (const insSub of inscriptionRecord.inscriptionSubjects) {
      // Group scores by Term ID
      const termScores: Record<number, number> = {};

      terms.forEach((t: Term) => { termScores[t.id] = 0; });

      // Calculate Qualifications per Term
      (insSub.qualifications || []).forEach((qualification: Qualification & { evaluationPlan?: EvaluationPlan | null }) => {
        const score = Number(qualification.score) || 0;
        const percentage = Number(qualification.evaluationPlan?.percentage) || 0;
        const termId = qualification.evaluationPlan?.termId;

        if (termId && termScores[termId] !== undefined) {
          termScores[termId] += score * (percentage / 100);
        }
      });

      // Add Council Points per Term
      (insSub.councilPoints || []).forEach((point: CouncilPoint) => {
        const pVal = Number(point.points) || 0;
        if (point.termId && termScores[point.termId] !== undefined) {
          termScores[point.termId] += pVal;
        }
      });

      // Sum all term scores
      let totalAccumulated = 0;
      Object.values(termScores).forEach(val => totalAccumulated += val);

      // Average!
      const finalScore = totalAccumulated / termCount;

      console.log(`[DEBUG] Inscription ${inscriptionId} Subject ${insSub.subject?.name}: Terms found: ${terms.length}. TotalAcc: ${totalAccumulated}. Final: ${finalScore}`);


      // Raw Score (sum of non-council points) calculation for display/statistics?
      // For now, let's keep rawScore as the sum of qualification parts, but averaged? 
      // The summary expects 'rawScore' and 'councilPoints'. 
      // It's ambiguous when averaging. Let's just track the final calculation correctness first.

      // Let's reconstruct 'rawScore' properly for the summary:
      let totalRaw = 0;
      let totalCouncil = 0;
      (insSub.qualifications || []).forEach((q) => {
        const s = Number(q.score) || 0;
        const p = Number(q.evaluationPlan?.percentage) || 0;
        totalRaw += s * (p / 100);
        // Note: This is "Sum of raw scores". If we want "Average Raw Score", divide by termCount.
      });
      (insSub.councilPoints || []).forEach(p => totalCouncil += (Number(p.points) || 0));

      const status = finalScore >= minApproval ? 'aprobada' : 'reprobada';

      if (status === 'reprobada') {
        failedSubjects += 1;
      }

      subjectCount += 1;
      sumFinalScores += finalScore;

      const summary: SubjectResultSummary = {
        inscriptionSubjectId: insSub.id,
        subjectId: insSub.subjectId,
        subjectName: insSub.subject?.name,
        // We present the "Averaged" values in the summary for consistency, or the raw sums?
        // Given finalScore is averaged, these should probably be averaged components to make sense: raw + council = final
        rawScore: Number((totalRaw / termCount).toFixed(2)),
        councilPoints: Number((totalCouncil / termCount).toFixed(2)),
        finalScore: Number(finalScore.toFixed(2)),
        status
      };
      subjectResults.push(summary);

      await SubjectFinalGrade.upsert(
        {
          inscriptionSubjectId: insSub.id,
          rawScore: summary.rawScore,
          councilPoints: summary.councilPoints,
          finalScore: summary.finalScore,
          status: summary.status,
          calculatedAt: new Date()
        },
        { transaction: options.transaction }
      );
    }

    const finalAverage =
      subjectCount > 0 ? Number((sumFinalScores / subjectCount).toFixed(2)) : null;

    return {
      finalAverage,
      failedSubjects,
      subjectResults
    };
  }
}

export default FinalGradeCalculator;
