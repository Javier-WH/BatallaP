import { Transaction } from 'sequelize';
import {
  CouncilPoint,
  EvaluationPlan,
  Inscription,
  InscriptionSubject,
  Qualification,
  Term,
  Subject,
  SubjectFinalGrade,
  Plantel,
  Setting,
  InscriptionSubjectRevision,
  RevisionPeriod
} from '@/models/index';
import {
  getSubjectOrderMapByGradeAndPeriod,
  sortSubjectsByOrder,
} from './subjectOrderService';
import { filterActiveGroupSubjects } from './subjectGroupService';

const resolveInstitutionPlantelId = async (transaction?: Transaction): Promise<number | null> => {
  const setting = await Setting.findOne({ where: { key: 'institution_dea_code' }, transaction });
  const deaCode = setting?.getDataValue('value');
  if (!deaCode) return null;
  const plantel = await Plantel.findOne({ where: { code: deaCode }, transaction });
  if (!plantel) {
    console.warn(`[FinalGradeCalculator] Plantel con código DEA "${deaCode}" no encontrado en la base de datos`);
    return null;
  }
  return plantel.id;
};

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
      attributes: ['schoolPeriodId', 'gradeId'],
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

    // Apply canonical subject order before iterating
    const orderMap = await getSubjectOrderMapByGradeAndPeriod(
      inscriptionSimple.gradeId,
      inscriptionSimple.schoolPeriodId,
      options.transaction
    );
    inscriptionRecord.inscriptionSubjects = filterActiveGroupSubjects(
      sortSubjectsByOrder(
        inscriptionRecord.inscriptionSubjects,
        (is) => is.subjectId,
        (is) => is.subject?.name,
        orderMap
      )
    );

    const minApproval = options.minApproval ?? 10;
    const institutionPlantelId = await resolveInstitutionPlantelId(options.transaction);

    // Fetch revision period and repair grades if the revision period is closed
    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId: inscriptionSimple.schoolPeriodId },
      transaction: options.transaction,
    });
    let repairPassingGrade: number | null = null;
    let repairScoresBySubject: Map<number, number> = new Map();
    if (revisionPeriod && revisionPeriod.status === 'closed') {
      repairPassingGrade = revisionPeriod.passingGrade;
      const revisions = await InscriptionSubjectRevision.findAll({
        where: { revisionPeriodId: revisionPeriod.id },
        transaction: options.transaction,
      });
      for (const rev of revisions) {
        if (rev.score == null) continue;
        const current = repairScoresBySubject.get(rev.inscriptionSubjectId);
        if (current == null || rev.score > current) {
          repairScoresBySubject.set(rev.inscriptionSubjectId, Number(rev.score));
        }
      }
    }

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
        if ((qualification as any).isAbsent) return;
        const score = (qualification as any).remedialScore != null && Number((qualification as any).remedialScore) > 0
          ? Number((qualification as any).remedialScore)
          : Number(qualification.score) || 0;
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
        if ((q as any).isAbsent) return;
        const s = (q as any).remedialScore != null && Number((q as any).remedialScore) > 0
          ? Number((q as any).remedialScore)
          : Number(q.score) || 0;
        const p = Number(q.evaluationPlan?.percentage) || 0;
        totalRaw += s * (p / 100);
      });
      (insSub.councilPoints || []).forEach(p => totalCouncil += (Number(p.points) || 0));

      // Check if there's a repair grade for this subject
      const repairScore = repairScoresBySubject.get(insSub.id);
      const hasRepair = repairScore != null;

      let effectiveFinalScore: number;
      let effectiveStatus: 'aprobada' | 'reprobada';
      let gradeType: 'regular' | 'revision' = 'regular';
      let originalScore: number | null = null;
      let originalStatus: string | null = null;

      if (hasRepair) {
        // Repair grade replaces the original completely
        effectiveFinalScore = repairScore!;
        effectiveStatus = repairPassingGrade != null
          ? (repairScore! >= repairPassingGrade ? 'aprobada' : 'reprobada')
          : (repairScore! >= minApproval ? 'aprobada' : 'reprobada');
        gradeType = 'revision';
        originalScore = Number(finalScore.toFixed(2));
        originalStatus = finalScore >= minApproval ? 'aprobada' : 'reprobada';
      } else {
        effectiveFinalScore = finalScore;
        effectiveStatus = finalScore >= minApproval ? 'aprobada' : 'reprobada';
      }

      if (effectiveStatus === 'reprobada') {
        failedSubjects += 1;
      }

      subjectCount += 1;
      sumFinalScores += effectiveFinalScore;

      const summary: SubjectResultSummary = {
        inscriptionSubjectId: insSub.id,
        subjectId: insSub.subjectId,
        subjectName: insSub.subject?.name,
        rawScore: Number((totalRaw / termCount).toFixed(2)),
        councilPoints: Number((totalCouncil / termCount).toFixed(2)),
        finalScore: Number(effectiveFinalScore.toFixed(2)),
        status: effectiveStatus
      };
      subjectResults.push(summary);

      const existingGrade = await SubjectFinalGrade.findOne({
        where: { inscriptionSubjectId: insSub.id },
        transaction: options.transaction
      });

      // External grades (transferencia/equivalencia) are not recalculated by this engine.
      if (existingGrade?.gradeType === 'transferencia' || existingGrade?.gradeType === 'equivalencia') {
        continue;
      }

      await SubjectFinalGrade.upsert(
        {
          inscriptionSubjectId: insSub.id,
          rawScore: summary.rawScore,
          councilPoints: summary.councilPoints,
          finalScore: summary.finalScore,
          status: summary.status,
          calculatedAt: new Date(),
          plantelId: existingGrade?.plantelId ?? institutionPlantelId,
          gradeType,
          originalScore: hasRepair ? originalScore : (existingGrade?.originalScore ?? null),
          originalStatus: hasRepair ? originalStatus : (existingGrade?.originalStatus ?? null)
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
