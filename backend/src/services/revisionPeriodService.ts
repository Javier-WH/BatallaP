import { Op, Transaction } from 'sequelize';
import {
  CouncilChecklist,
  Inscription,
  InscriptionSubject,
  InscriptionSubjectRevision,
  RevisionPeriod,
  SchoolPeriod,
  Setting,
  SubjectFinalGrade,
  SubjectTermGrade,
  Term,
} from '@/models/index';
import { isPassingGrade } from './gradeEvaluationService';
import { TermSectionClosureService } from './termSectionClosureService';

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

    // Check if all terms are fully closed (globally blocked or all sections closed)
    const allFullyClosed = await TermSectionClosureService.areAllTermsFullyClosed(schoolPeriodId, transaction);

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
      termsStatus: { totalTerms, blockedTerms, allBlocked: totalTerms > 0 && allFullyClosed },
      stats,
    };
  }

  static async openRevisionPeriod(
    schoolPeriodId: number,
    transaction?: Transaction
  ): Promise<{ revisionPeriod: RevisionPeriod; revisionsCreated: number }> {
    const period = await SchoolPeriod.findByPk(schoolPeriodId, { transaction });
    if (!period) throw new Error('Período escolar no encontrado');

    if (period.status !== 'activo') throw new Error('El período escolar no está activo');

    const terms = await Term.findAll({
      where: { schoolPeriodId },
      transaction,
    });
    const allFullyClosed = await TermSectionClosureService.areAllTermsFullyClosed(schoolPeriodId, transaction);
    if (!allFullyClosed) {
      throw new Error('Todos los lapsos deben tener todas sus secciones cerradas antes de abrir el período de revisión');
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
      throw new Error('El período de revisión ya está abierto');
    }
    if (revisionPeriod.status === 'closed') {
      throw new Error('El período de revisión ya fue cerrado');
    }

    await revisionPeriod.update({
      status: 'open',
      maxOpportunities,
      passingGrade,
      currentOpportunity: 1,
      openedAt: new Date(),
    }, { transaction });

    // Calculate failed subjects from SubjectTermGrade (single source of truth,
    // already rounded and synced by TermGradeSyncService).
    const allInscriptions = await Inscription.findAll({
      where: { schoolPeriodId },
      include: [
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            { model: SubjectTermGrade, as: 'termGrades' },
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

        // Use SubjectTermGrade (already rounded per-lapso) and average them
        const termGrades: any[] = insSub.termGrades || [];
        const scoresByTerm: Record<number, number> = {};
        termIds.forEach(tid => { scoresByTerm[tid] = 0; });
        let foundAny = false;
        for (const tg of termGrades) {
          if (termIds.includes(tg.termId)) {
            scoresByTerm[tg.termId] = Number(tg.score) || 0;
            foundAny = true;
          }
        }
        if (!foundAny) continue;

        let totalAccumulated = 0;
        Object.values(scoresByTerm).forEach(v => { totalAccumulated += v; });
        const finalScore = totalAccumulated / termCount;

        if (!isPassingGrade(finalScore, passingGrade)) {
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

  /**
   * Lock the revision period (status='closed').
   *
   * This is set by periodClosureExecutor after the school year closure, or
   * can be called manually to prevent further edits. It does NOT trigger
   * grade calculation — that happens at 'completed'.
   *
   * Can be called from any non-pending status (open or completed) to allow
   * Control de Estudios to block the period at will.
   */
  static async lockRevisionPeriod(
    schoolPeriodId: number,
    transaction?: Transaction
  ): Promise<RevisionPeriod> {
    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
      transaction,
    });

    if (!revisionPeriod) throw new Error('No existe un período de revisión para este período escolar');
    if (revisionPeriod.status === 'closed') {
      return revisionPeriod; // already locked, idempotent
    }
    if (revisionPeriod.status === 'pending') {
      throw new Error('El período de revisión no ha sido abierto');
    }

    await revisionPeriod.update({
      status: 'closed',
      closedAt: new Date(),
    }, { transaction });

    return revisionPeriod;
  }

  /**
   * Reopen a completed or closed revision period back to 'open' so that
   * professors can continue editing grades. Does NOT recreate revisions.
   */
  static async reopenRevisionPeriod(
    schoolPeriodId: number,
    transaction?: Transaction
  ): Promise<RevisionPeriod> {
    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
      transaction,
    });

    if (!revisionPeriod) throw new Error('No existe un período de revisión para este período escolar');
    if (revisionPeriod.status === 'open') {
      return revisionPeriod; // already open, idempotent
    }
    if (revisionPeriod.status === 'pending') {
      throw new Error('El período de revisión no ha sido abierto todavía');
    }

    await revisionPeriod.update({
      status: 'open',
      closedAt: null,
    }, { transaction });

    // When reopening, reset auto-marked NP entries (gradedBy=null, isAbsent=true)
    // at the current opportunity back to pending — they were auto-failed
    // but the opportunity hasn't been formally passed.
    // Only reset entries at the current opportunity; entries from earlier
    // opportunities (opportunity < currentOpportunity) were genuinely passed
    // and should remain as NP.
    await InscriptionSubjectRevision.update(
      { score: null, status: 'pending', isAbsent: false, gradedAt: null },
      {
        where: {
          revisionPeriodId: revisionPeriod.id,
          opportunity: revisionPeriod.currentOpportunity,
          isAbsent: true,
          gradedBy: null,
        },
        transaction,
      }
    );

    return revisionPeriod;
  }

  /**
   * Update the maxOpportunities of a revision period. Allowed from any
   * non-pending status except 'closed' (locked).
   */
  static async updateMaxOpportunities(
    schoolPeriodId: number,
    maxOpportunities: number,
    transaction?: Transaction
  ): Promise<RevisionPeriod> {
    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
      transaction,
    });

    if (!revisionPeriod) throw new Error('No existe un período de revisión para este período escolar');
    if (revisionPeriod.status === 'closed') {
      throw new Error('El período de revisión está bloqueado y no puede modificarse');
    }
    if (revisionPeriod.status === 'pending') {
      throw new Error('El período de revisión no ha sido abierto');
    }
    if (!Number.isInteger(maxOpportunities) || maxOpportunities < 1) {
      throw new Error('El número de intentos debe ser un entero mayor o igual a 1');
    }

    const oldMax = revisionPeriod.maxOpportunities;

    await revisionPeriod.update({ maxOpportunities }, { transaction });

    // If the new max is lower than the old max, delete revisions with
    // opportunity > new maxOpportunities (excess opportunities).
    if (maxOpportunities < oldMax) {
      await InscriptionSubjectRevision.destroy({
        where: {
          revisionPeriodId: revisionPeriod.id,
          opportunity: { [Op.gt]: maxOpportunities },
        },
        transaction,
      });
    }

    return revisionPeriod;
  }

  /**
   * Recalculate failed subjects based on current grades.
   * - Keeps revisions that already have a grade (approved/failed) intact.
   * - Deletes pending revisions for subjects that are now passing.
   * - Creates pending revisions for newly-failed subjects (that don't already have one).
   * Only works when the revision period is 'open'.
   */
  static async recalculateRevisionPeriod(
    schoolPeriodId: number,
    transaction?: Transaction
  ): Promise<{ revisionPeriod: RevisionPeriod; created: number; removed: number }> {
    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
      transaction,
    });
    if (!revisionPeriod) throw new Error('No existe un período de revisión para este período escolar');
    if (revisionPeriod.status !== 'open') {
      throw new Error('El período de revisión debe estar abierto para recalcular');
    }

    const terms = await Term.findAll({ where: { schoolPeriodId }, transaction });
    const termIds = terms.map(t => t.id);
    const termCount = terms.length || 1;

    const passingGrade = revisionPeriod.passingGrade || 10;

    // Recalculate final scores from SubjectTermGrade (single source of truth)
    const allInscriptions = await Inscription.findAll({
      where: { schoolPeriodId },
      include: [
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            { model: SubjectTermGrade, as: 'termGrades' },
          ],
        },
      ],
      transaction,
    });

    // Build set of currently-failed inscriptionSubjectIds
    const failedSubjectIds = new Set<number>();
    for (const ins of allInscriptions) {
      const insSubjects = (ins as any).inscriptionSubjects || [];
      for (const insSub of insSubjects) {
        const termGrades: any[] = insSub.termGrades || [];
        const scoresByTerm: Record<number, number> = {};
        termIds.forEach(tid => { scoresByTerm[tid] = 0; });
        let foundAny = false;
        for (const tg of termGrades) {
          if (termIds.includes(tg.termId)) {
            scoresByTerm[tg.termId] = Number(tg.score) || 0;
            foundAny = true;
          }
        }
        if (!foundAny) continue;

        let totalAccumulated = 0;
        Object.values(scoresByTerm).forEach(v => { totalAccumulated += v; });
        const finalScore = totalAccumulated / termCount;

        if (!isPassingGrade(finalScore, passingGrade)) {
          failedSubjectIds.add(insSub.id);
        }
      }
    }

    // Get all existing revisions for this period
    const existingRevisions = await InscriptionSubjectRevision.findAll({
      where: { revisionPeriodId: revisionPeriod.id },
      transaction,
    });

    // Group by inscriptionSubjectId
    const revisionsBySubject = new Map<number, InscriptionSubjectRevision[]>();
    for (const rev of existingRevisions) {
      if (!revisionsBySubject.has(rev.inscriptionSubjectId)) {
        revisionsBySubject.set(rev.inscriptionSubjectId, []);
      }
      revisionsBySubject.get(rev.inscriptionSubjectId)!.push(rev);
    }

    let created = 0;
    let removed = 0;

    // Remove pending revisions for subjects that are now passing
    for (const rev of existingRevisions) {
      if (rev.status === 'pending' && !failedSubjectIds.has(rev.inscriptionSubjectId)) {
        await rev.destroy({ transaction });
        removed++;
      }
    }

    // Create pending revisions (opportunity 1) for newly-failed subjects
    // that don't already have any revision
    for (const subjId of failedSubjectIds) {
      const existing = revisionsBySubject.get(subjId);
      if (!existing || existing.length === 0) {
        await InscriptionSubjectRevision.create({
          revisionPeriodId: revisionPeriod.id,
          inscriptionSubjectId: subjId,
          opportunity: 1,
          status: 'pending',
        }, { transaction });
        created++;
      }
    }

    return { revisionPeriod, created, removed };
  }

  /**
   * Reset the revision period back to 'pending' state.
   * Deletes ALL revision records and resets the period as if it was never opened.
   * Only Master role can call this (enforced in the controller).
   */
  static async resetRevisionPeriod(
    schoolPeriodId: number,
    transaction?: Transaction
  ): Promise<{ revisionPeriod: RevisionPeriod; deleted: number }> {
    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
      transaction,
    });
    if (!revisionPeriod) throw new Error('No existe un período de revisión para este período escolar');

    // Delete all revision records
    const deleted = await InscriptionSubjectRevision.destroy({
      where: { revisionPeriodId: revisionPeriod.id },
      transaction,
    });

    // Reset the period to pending
    await revisionPeriod.update({
      status: 'pending',
      currentOpportunity: 1,
      openedAt: null,
      completedAt: null,
      completedBy: null,
      closedAt: null,
    }, { transaction });

    return { revisionPeriod, deleted };
  }

  /**
   * Advance the currentOpportunity counter by 1. Only allowed when the
   * revision period is 'open' and currentOpportunity < maxOpportunities.
   */
  static async advanceOpportunity(
    schoolPeriodId: number,
    transaction?: Transaction
  ): Promise<RevisionPeriod> {
    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
      transaction,
    });
    if (!revisionPeriod) throw new Error('No existe un período de revisión para este período escolar');
    if (revisionPeriod.status !== 'open') {
      throw new Error('El período de revisión no está abierto');
    }
    if (revisionPeriod.currentOpportunity >= revisionPeriod.maxOpportunities) {
      throw new Error('Ya está en la última oportunidad, no se puede avanzar más');
    }

    // Closing an opportunity without a grade means the student was absent.
    await InscriptionSubjectRevision.update(
      { score: 0, status: 'failed', isAbsent: true },
      {
        where: {
          revisionPeriodId: revisionPeriod.id,
          opportunity: revisionPeriod.currentOpportunity,
          status: 'pending',
          score: null,
        },
        transaction,
      }
    );

    await revisionPeriod.update({
      currentOpportunity: revisionPeriod.currentOpportunity + 1,
    }, { transaction });

    return revisionPeriod;
  }

  /**
   * Set the currentOpportunity to a specific value. Only allowed when the
   * revision period is 'open'. The target must be between 1 and maxOpportunities.
   */
  static async setOpportunity(
    schoolPeriodId: number,
    opportunity: number,
    transaction?: Transaction
  ): Promise<RevisionPeriod> {
    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
      transaction,
    });
    if (!revisionPeriod) throw new Error('No existe un período de revisión para este período escolar');
    if (revisionPeriod.status !== 'open') {
      throw new Error('El período de revisión no está abierto');
    }
    if (!Number.isInteger(opportunity) || opportunity < 1 || opportunity > revisionPeriod.maxOpportunities) {
      throw new Error(`La oportunidad debe estar entre 1 y ${revisionPeriod.maxOpportunities}`);
    }

    // Any skipped opportunity is closed. Pending entries without a grade are
    // recorded as absences; the selected opportunity remains editable.
    await InscriptionSubjectRevision.update(
      { score: 0, status: 'failed', isAbsent: true },
      {
        where: {
          revisionPeriodId: revisionPeriod.id,
          opportunity: { [Op.lt]: opportunity },
          status: 'pending',
          score: null,
        },
        transaction,
      }
    );

    await revisionPeriod.update({
      currentOpportunity: opportunity,
    }, { transaction });

    return revisionPeriod;
  }
}
