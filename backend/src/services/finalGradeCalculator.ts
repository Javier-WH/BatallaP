import { Op, Transaction } from 'sequelize';
import {
  CouncilPoint,
  EvaluationPlan,
  Inscription,
  InscriptionSubject,
  Qualification,
  Term,
  Subject,
  SubjectFinalGrade,
  SubjectTermGrade,
  Plantel,
  Setting,
  InscriptionSubjectRevision,
  RevisionPeriod
} from '@/models/index';
import {
  getSubjectOrderMapByGradeAndPeriod,
  getSubjectIncludeInAverageMapByGradeAndPeriod,
  sortSubjectsByOrder,
} from './subjectOrderService';
import { filterActiveGroupSubjects } from './subjectGroupService';
import { resolveGradeStatus, roundGrade, roundFinalGrade } from './gradeEvaluationService';
import { TermGradeSyncService } from './termGradeSyncService';
import { GradeCalculationService } from './gradeCalculationService';

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
            { model: Subject, as: 'subject' },
            { model: SubjectTermGrade, as: 'termGrades' }
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
    // Load includeInAverage map so the final average only counts eligible subjects
    const includeInAverageMap = await getSubjectIncludeInAverageMapByGradeAndPeriod(
      inscriptionSimple.gradeId,
      inscriptionSimple.schoolPeriodId,
      options.transaction
    );
    // Apply canonical subject order before iterating.
    // NOTE: finalGradeCalculator operates across all terms (it computes the
    // period final grade), so we use the legacy filter that picks the subject
    // with qualifications. The per-term choice is respected by the per-term
    // callers (council, evaluation) which use filterActiveGroupSubjectsForTerm.
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
    if (revisionPeriod && (revisionPeriod.status === 'completed' || revisionPeriod.status === 'closed')) {
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
      // Sync term grades to SubjectTermGrade table (single source of truth for per-lapso grades)
      await TermGradeSyncService.syncForInscriptionSubject(insSub.id, { transaction: options.transaction });

      // Re-fetch term grades after sync to get the updated values
      const syncedTermGrades = await SubjectTermGrade.findAll({
        where: { inscriptionSubjectId: insSub.id },
        transaction: options.transaction,
      });

      // Build term grades array from SubjectTermGrade (single source of truth)
      const termGradesArr = syncedTermGrades.map((tg: any) => ({
        termId: tg.termId,
        score: Number(tg.score),
      }));

      // Build lapsos — during period closure, all councils are done,
      // so all lapsos have finalScore (not null)
      const lapsos = terms.map((t: Term) => {
        const accumulatedScore = GradeCalculationService.calculateAccumulatedTermScore(t.id, termGradesArr);
        return { termId: t.id, finalScore: accumulatedScore };
      });

      // Calculate finalScore using the service
      // During closure, isClosedPeriod=true so it uses SubjectFinalGrade if available
      // or averages all lapsos (which are all done)
      const existingFinalGrade = await SubjectFinalGrade.findOne({
        where: { inscriptionSubjectId: insSub.id, gradeType: 'regular' },
        transaction: options.transaction,
      });

      const finalScore = GradeCalculationService.calculateFinalScore(
        lapsos,
        existingFinalGrade ? { finalScore: existingFinalGrade.finalScore, gradeType: existingFinalGrade.gradeType } : null,
        { isClosedPeriod: true },
      ) || roundFinalGrade(lapsos.reduce((sum, l) => sum + l.finalScore, 0) / (lapsos.length || 1));

      // Raw Score (sum of non-council points) calculation for display/statistics
      // Still calculated from qualifications for detailed breakdown
      const termScores: Record<number, number> = {};
      terms.forEach((t: Term) => { termScores[t.id] = 0; });

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
        effectiveFinalScore = roundFinalGrade(repairScore!);
        effectiveStatus = resolveGradeStatus(repairScore!, repairPassingGrade ?? minApproval);
        gradeType = 'revision';
        originalScore = finalScore;
        originalStatus = resolveGradeStatus(finalScore, minApproval);
      } else {
        effectiveFinalScore = finalScore;
        effectiveStatus = resolveGradeStatus(finalScore, minApproval);
      }

      if (effectiveStatus === 'reprobada') {
        failedSubjects += 1;
      }

      // Only count subjects flagged includeInAverage (default true) toward the average
      const countsForAverage = includeInAverageMap.get(insSub.subjectId) !== false;
      if (countsForAverage) {
        subjectCount += 1;
        sumFinalScores += effectiveFinalScore;
      }

      const summary: SubjectResultSummary = {
        inscriptionSubjectId: insSub.id,
        subjectId: insSub.subjectId,
        subjectName: insSub.subject?.name,
        rawScore: roundGrade(totalRaw / termCount),
        councilPoints: roundGrade(totalCouncil / termCount),
        finalScore: effectiveFinalScore,
        status: effectiveStatus
      };
      subjectResults.push(summary);

      const existingGrade = await SubjectFinalGrade.findOne({
        where: { inscriptionSubjectId: insSub.id, gradeType },
        transaction: options.transaction
      });

      // External grades (transferencia/equivalencia) are not recalculated by this engine.
      if (existingGrade?.gradeType === 'transferencia' || existingGrade?.gradeType === 'equivalencia') {
        continue;
      }

      // Use findOne + update/create instead of upsert, since the unique index is now
      // (inscriptionSubjectId, gradeType) and we want to preserve other gradeType records.
      if (existingGrade) {
        await existingGrade.update(
          {
            rawScore: summary.rawScore,
            councilPoints: summary.councilPoints,
            finalScore: summary.finalScore,
            status: summary.status,
            calculatedAt: new Date(),
            plantelId: existingGrade.plantelId ?? institutionPlantelId,
            gradeType,
            originalScore: hasRepair ? originalScore : (existingGrade.originalScore ?? null),
            originalStatus: hasRepair ? originalStatus : (existingGrade.originalStatus ?? null),
            schoolPeriodId: inscriptionSimple.schoolPeriodId,
            subjectId: insSub.subjectId,
            gradeId: inscriptionSimple.gradeId,
          },
          { transaction: options.transaction }
        );
      } else {
        await SubjectFinalGrade.create(
          {
            inscriptionSubjectId: insSub.id,
            rawScore: summary.rawScore,
            councilPoints: summary.councilPoints,
            finalScore: summary.finalScore,
            status: summary.status,
            calculatedAt: new Date(),
            plantelId: institutionPlantelId,
            gradeType,
            originalScore: hasRepair ? originalScore : null,
            originalStatus: hasRepair ? originalStatus : null,
            schoolPeriodId: inscriptionSimple.schoolPeriodId,
            subjectId: insSub.subjectId,
            gradeId: inscriptionSimple.gradeId,
          },
          { transaction: options.transaction }
        );
      }
    }

    const finalAverage =
      subjectCount > 0 ? Number((sumFinalScores / subjectCount).toFixed(2)) : null; // averages keep 2 decimals

    return {
      finalAverage,
      failedSubjects,
      subjectResults
    };
  }

  /**
   * Fast read-only calculation that uses pre-existing SubjectFinalGrade records
   * directly, without syncing term grades or recalculating/updating anything.
   *
   * Use this for previews where SubjectFinalGrade records already exist (closed
   * period or pre-seeded). The full `calculateForInscription` is still used by
   * the executor to recalculate and persist final grades.
   */
  static async calculateForInscriptionFast(
    inscriptionId: number,
    options: CalculateOptions = {}
  ): Promise<FinalGradeSummary> {
    const inscription = await Inscription.findByPk(inscriptionId, {
      attributes: ['id', 'schoolPeriodId', 'gradeId'],
      transaction: options.transaction,
    });
    if (!inscription) throw new Error('Inscripción no encontrada');

    // Fetch all InscriptionSubjects for this inscription in one query
    const inscriptionSubjects = await InscriptionSubject.findAll({
      where: { inscriptionId },
      include: [{ model: Subject, as: 'subject' }],
      transaction: options.transaction,
    });

    if (inscriptionSubjects.length === 0) {
      return { finalAverage: null, failedSubjects: 0, subjectResults: [] };
    }

    // Fetch all SubjectFinalGrade records for these InscriptionSubjects in one query
    const insSubIds = inscriptionSubjects.map(is => is.id);
    const finalGrades = await SubjectFinalGrade.findAll({
      where: {
        inscriptionSubjectId: { [Op.in]: insSubIds },
        gradeType: 'regular',
      },
      transaction: options.transaction,
    });

    // Build a map: inscriptionSubjectId -> SubjectFinalGrade
    const fgMap = new Map<number, SubjectFinalGrade>();
    for (const fg of finalGrades) {
      fgMap.set(fg.inscriptionSubjectId, fg);
    }

    // Fetch includeInAverage map once
    const includeInAverageMap = await getSubjectIncludeInAverageMapByGradeAndPeriod(
      inscription.gradeId,
      inscription.schoolPeriodId,
      options.transaction,
    );

    // Fetch revision period + repair grades in bulk (if revision is completed/closed)
    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId: inscription.schoolPeriodId },
      transaction: options.transaction,
    });
    let repairScoresBySubject = new Map<number, number>();
    let repairPassingGrade: number | null = null;
    if (revisionPeriod && (revisionPeriod.status === 'completed' || revisionPeriod.status === 'closed')) {
      repairPassingGrade = revisionPeriod.passingGrade;
      const revisions = await InscriptionSubjectRevision.findAll({
        where: {
          revisionPeriodId: revisionPeriod.id,
          inscriptionSubjectId: { [Op.in]: insSubIds },
        },
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

    // Apply canonical subject order
    const orderMap = await getSubjectOrderMapByGradeAndPeriod(
      inscription.gradeId,
      inscription.schoolPeriodId,
      options.transaction,
    );
    const orderedSubjects = filterActiveGroupSubjects(
      sortSubjectsByOrder(
        inscriptionSubjects,
        (is) => is.subjectId,
        (is) => is.subject?.name,
        orderMap,
      ),
    );

    const minApproval = options.minApproval ?? 10;
    const subjectResults: SubjectResultSummary[] = [];
    let failedSubjects = 0;
    let sumFinalScores = 0;
    let subjectCount = 0;

    for (const insSub of orderedSubjects) {
      const fg = fgMap.get(insSub.id);
      if (!fg) {
        // No pre-existing final grade — skip (shouldn't happen in closed period)
        continue;
      }

      const repairScore = repairScoresBySubject.get(insSub.id);
      const hasRepair = repairScore != null;

      let effectiveFinalScore: number;
      let effectiveStatus: 'aprobada' | 'reprobada';

      if (hasRepair) {
        effectiveFinalScore = roundFinalGrade(repairScore!);
        effectiveStatus = resolveGradeStatus(repairScore!, repairPassingGrade ?? minApproval);
      } else {
        effectiveFinalScore = Number(fg.finalScore) || 0;
        effectiveStatus = fg.status as 'aprobada' | 'reprobada';
      }

      if (effectiveStatus === 'reprobada') {
        failedSubjects += 1;
      }

      const countsForAverage = includeInAverageMap.get(insSub.subjectId) !== false;
      if (countsForAverage) {
        subjectCount += 1;
        sumFinalScores += effectiveFinalScore;
      }

      subjectResults.push({
        inscriptionSubjectId: insSub.id,
        subjectId: insSub.subjectId,
        subjectName: insSub.subject?.name,
        rawScore: Number(fg.rawScore) || 0,
        councilPoints: Number(fg.councilPoints) || 0,
        finalScore: effectiveFinalScore,
        status: effectiveStatus,
      });
    }

    const finalAverage =
      subjectCount > 0 ? Number((sumFinalScores / subjectCount).toFixed(2)) : null;

    return {
      finalAverage,
      failedSubjects,
      subjectResults,
    };
  }
}

export default FinalGradeCalculator;
