import { Transaction } from 'sequelize';
import {
  CouncilChecklist,
  CouncilPoint,
  EvaluationPlan,
  Inscription,
  InscriptionSubject,
  InscriptionSubjectRevision,
  Qualification,
  RevisionPeriod,
  SchoolPeriod,
  Setting,
  SubjectFinalGrade,
  Term,
} from '@/models/index';

export interface RevisionPeriodSummary {
  revisionPeriod: RevisionPeriod | null;
  councilStatus: {
    totalChecklists: number;
    doneChecklists: number;
    allDone: boolean;
  };
  termsStatus: {
    totalTerms: number;
    blockedTerms: number;
    allBlocked: boolean;
  };
  stats?: {
    totalStudents: number;
    totalSubjects: number;
    approvedCount: number;
    failedCount: number;
    pendingCount: number;
  };
}

export class RevisionPeriodService {
  static async getOrCreate(schoolPeriodId: number, transaction?: Transaction): Promise<RevisionPeriod> {
    const [revisionPeriod] = await RevisionPeriod.findOrCreate({
      where: { schoolPeriodId },
      defaults: { schoolPeriodId },
      transaction,
    });
    return revisionPeriod;
  }

  static async getSummary(schoolPeriodId: number, transaction?: Transaction): Promise<RevisionPeriodSummary> {
    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
      transaction,
    });

    const councilChecklists = await CouncilChecklist.findAll({
      where: { schoolPeriodId },
      transaction,
    });
    const totalChecklists = councilChecklists.length;
    const doneChecklists = councilChecklists.filter(c => c.status === 'done').length;

    const allTerms = await Term.findAll({
      where: { schoolPeriodId },
      transaction,
    });
    const totalTerms = allTerms.length;
    const blockedTerms = allTerms.filter(t => t.isBlocked).length;

    let stats;
    if (revisionPeriod) {
      const revisions = await InscriptionSubjectRevision.findAll({
        where: { revisionPeriodId: revisionPeriod.id },
        transaction,
      });
      const inscriptionSubjectIds = new Set(revisions.map(r => r.inscriptionSubjectId));
      stats = {
        totalSubjects: inscriptionSubjectIds.size,
        approvedCount: revisions.filter(r => r.status === 'approved').length,
        failedCount: revisions.filter(r => r.status === 'failed').length,
        pendingCount: revisions.filter(r => r.status === 'pending').length,
        totalStudents: 0,
      };

      if (inscriptionSubjectIds.size > 0) {
        const insSubjects = await InscriptionSubject.findAll({
          where: { id: Array.from(inscriptionSubjectIds) },
          attributes: ['id', 'inscriptionId'],
          transaction,
        });
        const studentIds = new Set(insSubjects.map(s => s.inscriptionId));
        stats.totalStudents = studentIds.size;
      }
    }

    return {
      revisionPeriod,
      councilStatus: { totalChecklists, doneChecklists, allDone: totalChecklists > 0 && totalChecklists === doneChecklists },
      termsStatus: { totalTerms, blockedTerms, allBlocked: totalTerms > 0 && blockedTerms === totalTerms },
      stats,
    };
  }

  static async openRevisionPeriod(
    schoolPeriodId: number,
    transaction?: Transaction
  ): Promise<{ revisionPeriod: RevisionPeriod; revisionsCreated: number }> {
    const period = await SchoolPeriod.findByPk(schoolPeriodId, { transaction });
    if (!period) throw new Error('Período escolar no encontrado');

    if (!period.isActive) throw new Error('El período escolar no está activo');

    const terms = await Term.findAll({
      where: { schoolPeriodId },
      transaction,
    });
    const blockedTerms = terms.filter(t => t.isBlocked);
    if (blockedTerms.length < terms.length) {
      throw new Error('Todos los lapsos deben estar bloqueados antes de abrir el período de reparación');
    }

    const councilChecklists = await CouncilChecklist.findAll({
      where: { schoolPeriodId },
      transaction,
    });
    if (councilChecklists.length === 0) {
      throw new Error('No hay consejos de curso registrados para este período');
    }
    const allDone = councilChecklists.every(c => c.status === 'done');
    if (!allDone) {
      throw new Error('Todos los consejos de curso deben estar completos (status=done)');
    }

    const passingGradeSetting = await Setting.findOne({
      where: { key: 'passing_grade' },
      transaction,
    });
    const passingGrade = Number(passingGradeSetting?.value) || 10;

    const maxOppSetting = await Setting.findOne({
      where: { key: 'revision_max_opportunities' },
      transaction,
    });
    const maxOpportunities = Number(maxOppSetting?.value) || 3;

    const [revisionPeriod] = await RevisionPeriod.findOrCreate({
      where: { schoolPeriodId },
      defaults: { schoolPeriodId },
      transaction,
    });

    if (revisionPeriod.status === 'open') {
      throw new Error('El período de reparación ya está abierto');
    }
    if (revisionPeriod.status === 'closed') {
      throw new Error('El período de reparación ya fue cerrado');
    }

    await revisionPeriod.update({
      status: 'open',
      maxOpportunities,
      passingGrade,
      openedAt: new Date(),
    }, { transaction });

    // Calculate failed subjects directly from qualifications & council points.
    // SubjectFinalGrade records don't exist until period closure, so we
    // compute the final score per subject manually here.
    const allInscriptions = await Inscription.findAll({
      where: { schoolPeriodId },
      include: [
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            {
              model: Qualification,
              as: 'qualifications',
              include: [{ model: EvaluationPlan, as: 'evaluationPlan' }],
            },
            { model: CouncilPoint, as: 'councilPoints' },
          ],
        },
      ],
      transaction,
    });

    const termIds = terms.map(t => t.id);
    const termCount = terms.length || 1;

    const failedSubjects: Array<{ inscriptionSubjectId: number }> = [];
    const uniqueSet = new Set<number>();

    for (const ins of allInscriptions) {
      const insSubjects = (ins as any).inscriptionSubjects || [];
      for (const insSub of insSubjects) {
        if (uniqueSet.has(insSub.id)) continue;
        uniqueSet.add(insSub.id);

        // Same calculation as FinalGradeCalculator
        const termScores: Record<number, number> = {};
        termIds.forEach(tid => { termScores[tid] = 0; });

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

        let totalAccumulated = 0;
        Object.values(termScores).forEach(v => { totalAccumulated += v; });
        const finalScore = totalAccumulated / termCount;

        if (finalScore < passingGrade) {
          failedSubjects.push({ inscriptionSubjectId: insSub.id });
        }
      }
    }

    let revisionsCreated = 0;
    for (const fs of failedSubjects) {
      await InscriptionSubjectRevision.create({
        revisionPeriodId: revisionPeriod.id,
        inscriptionSubjectId: fs.inscriptionSubjectId,
        opportunity: 1,
        status: 'pending',
      }, { transaction });
      revisionsCreated++;
    }

    return { revisionPeriod, revisionsCreated };
  }

  static async closeRevisionPeriod(
    schoolPeriodId: number,
    transaction?: Transaction
  ): Promise<RevisionPeriod> {
    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
      transaction,
    });

    if (!revisionPeriod) throw new Error('No existe un período de reparación para este período escolar');
    if (revisionPeriod.status !== 'open') {
      throw new Error('El período de reparación no está abierto');
    }

    // Auto-fail all pending revisions (no grade entered = failed)
    const pendingRevisions = await InscriptionSubjectRevision.findAll({
      where: {
        revisionPeriodId: revisionPeriod.id,
        status: 'pending',
      },
      transaction,
    });

    for (const rev of pendingRevisions) {
      await rev.update({ status: 'failed' }, { transaction });
      const failedCount = await InscriptionSubjectRevision.count({
        where: {
          revisionPeriodId: revisionPeriod.id,
          inscriptionSubjectId: rev.inscriptionSubjectId,
          status: 'failed',
        },
        transaction,
      });

      // If this was the last opportunity, no more are created
      if (failedCount < revisionPeriod.maxOpportunities) {
        const exists = await InscriptionSubjectRevision.findOne({
          where: {
            revisionPeriodId: revisionPeriod.id,
            inscriptionSubjectId: rev.inscriptionSubjectId,
            opportunity: failedCount + 1,
          },
          transaction,
        });
        if (!exists) {
          await InscriptionSubjectRevision.create({
            revisionPeriodId: revisionPeriod.id,
            inscriptionSubjectId: rev.inscriptionSubjectId,
            opportunity: failedCount + 1,
            status: 'pending',
          }, { transaction });
        }
      }
    }

    await revisionPeriod.update({
      status: 'closed',
      closedAt: new Date(),
    }, { transaction });

    return revisionPeriod;
  }
}
