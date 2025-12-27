import { Transaction } from 'sequelize';
import {
  CouncilPoint,
  EvaluationPlan,
  Inscription,
  InscriptionSubject,
  Qualification,
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
        }
      ],
      transaction: options.transaction
    });

    const inscriptionRecord = inscription as InscriptionWithSubjects | null;

    if (!inscriptionRecord || !inscriptionRecord.inscriptionSubjects) {
      throw new Error('Inscripción no encontrada o sin materias asociadas');
    }

    const minApproval = options.minApproval ?? 10;
    const subjectResults: SubjectResultSummary[] = [];
    let failedSubjects = 0;
    let sumFinalScores = 0;
    let subjectCount = 0;

    for (const insSub of inscriptionRecord.inscriptionSubjects) {
      const rawScore = (insSub.qualifications || []).reduce((acc: number, qualification: Qualification & { evaluationPlan?: EvaluationPlan | null }) => {
        const score = Number(qualification.score) || 0;
        const percentage = Number(qualification.evaluationPlan?.percentage) || 0;
        return acc + score * (percentage / 100);
      }, 0);

      const councilPoints = (insSub.councilPoints || []).reduce((acc: number, point: CouncilPoint) => {
        return acc + (Number(point.points) || 0);
      }, 0);

      const finalScore = rawScore + councilPoints;
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
        rawScore: Number(rawScore.toFixed(2)),
        councilPoints: Number(councilPoints.toFixed(2)),
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
