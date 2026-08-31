import { Request, Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '@/config/database';
import { RevisionPeriodService } from '@/services/revisionPeriodService';
import { sortInscriptions } from '@/services/studentSortService';
import {
  CouncilPoint,
  EvaluationPlan,
  Inscription,
  InscriptionSubject,
  InscriptionSubjectRevision,
  Person,
  Qualification,
  RevisionGradeEditAudit,
  RevisionPeriod,
  Setting,
  SubjectFinalGrade,
  Term,
} from '@/models/index';

export const getRevisionPeriod = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    const summary = await RevisionPeriodService.getSummary(schoolPeriodId);
    return res.json(summary);
  } catch (error: any) {
    console.error('[getRevisionPeriod] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener período de revisión' });
  }
};

export const openRevisionPeriod = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    const result = await RevisionPeriodService.openRevisionPeriod(schoolPeriodId, t);
    await t.commit();
    return res.json({
      message: 'Período de revisión abierto correctamente',
      revisionPeriod: result.revisionPeriod,
      revisionsCreated: result.revisionsCreated,
    });
  } catch (error: any) {
    await t.rollback();
    console.error('[openRevisionPeriod] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al abrir período de revisión' });
  }
};

export const completeRevisionPeriod = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    const userId = (req.session as any)?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const revisionPeriod = await RevisionPeriodService.completeRevisionPeriod(schoolPeriodId, userId, t);
    await t.commit();
    return res.json({
      message: 'Período de revisión completado correctamente',
      revisionPeriod,
    });
  } catch (error: any) {
    await t.rollback();
    console.error('[completeRevisionPeriod] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al completar período de revisión' });
  }
};

export const lockRevisionPeriod = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    const revisionPeriod = await RevisionPeriodService.lockRevisionPeriod(schoolPeriodId, t);
    await t.commit();
    return res.json({
      message: 'Período de revisión bloqueado correctamente',
      revisionPeriod,
    });
  } catch (error: any) {
    await t.rollback();
    console.error('[lockRevisionPeriod] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al bloquear período de revisión' });
  }
};

export const getRevisionStudents = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
    });

    // If period is open, completed, or closed, return actual revision records
    if (revisionPeriod && revisionPeriod.status !== 'pending') {
      const revisions = await InscriptionSubjectRevision.findAll({
        where: { revisionPeriodId: revisionPeriod.id },
        include: [
          {
            model: InscriptionSubject,
            as: 'inscriptionSubject',
            include: [
              {
                model: Inscription,
                as: 'inscription',
                include: [
                  { association: 'student' },
                  { association: 'grade' },
                  { association: 'section' },
                ],
              },
              { association: 'subject' },
            ],
          },
          { model: Person, as: 'grader' },
        ],
        order: [['inscriptionSubjectId', 'ASC'], ['opportunity', 'ASC']],
      });

      const studentMap = new Map<number, any>();
      const subjectRevisionsMap = new Map<number, any[]>();

      for (const rev of revisions) {
        if (!subjectRevisionsMap.has(rev.inscriptionSubjectId)) {
          subjectRevisionsMap.set(rev.inscriptionSubjectId, []);
        }
        subjectRevisionsMap.get(rev.inscriptionSubjectId)!.push({
          id: rev.id,
          opportunity: rev.opportunity,
          score: rev.score,
          status: rev.status,
          isAbsent: (rev as any).isAbsent || false,
          gradedBy: rev.gradedBy,
          graderName: (rev as any).grader
            ? `${(rev as any).grader.firstName || ''} ${(rev as any).grader.lastName || ''}`.trim()
            : null,
          gradedAt: rev.gradedAt,
        });
      }

      for (const rev of revisions) {
        const insSub = (rev as any).inscriptionSubject;
        if (!insSub) continue;
        const ins = insSub.inscription;
        if (!ins) continue;

        const studentId = ins.personId;
        if (!studentMap.has(studentId)) {
          studentMap.set(studentId, {
            studentId,
            inscriptionId: ins.id,
            studentName: `${ins.student?.lastName || ''} ${ins.student?.firstName || ''}`.trim(),
            document: ins.student?.document || '',
            grade: ins.grade?.name || '',
            gradeOrder: (ins.grade as any)?.order ?? 999,
            section: ins.section?.name || '',
            subjects: [],
          });
        }

        const entry = studentMap.get(studentId);
        const alreadyAdded = entry.subjects.some((s: any) => s.inscriptionSubjectId === insSub.id);
        if (alreadyAdded) continue;

        entry.subjects.push({
          inscriptionSubjectId: insSub.id,
          subjectName: insSub.subject?.name || '',
          abbreviation: insSub.subject?.abbreviation || insSub.subject?.name || '',
          originalScore: null,
          originalStatus: null,
          maxOpportunities: revisionPeriod.maxOpportunities,
          revisions: subjectRevisionsMap.get(insSub.id) || [],
          passed: false,
        });
      }

      return res.json({ students: Array.from(studentMap.values()), isPreview: false });
    }

    // Preview mode: calculate failed subjects from qualifications & council points
    const passingGradeSetting = await Setting.findByPk('passing_grade');
    const passingGrade = Number(passingGradeSetting?.value) || 10;

    const terms = await Term.findAll({ where: { schoolPeriodId } });
    const termIds = terms.map(t => t.id);
    const termCount = terms.length || 1;

    const allInscriptions = await Inscription.findAll({
      where: { schoolPeriodId },
      include: [
        { association: 'student' },
        { association: 'grade' },
        { association: 'section' },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            { association: 'subject' },
            {
              model: Qualification,
              as: 'qualifications',
              include: [{ model: EvaluationPlan, as: 'evaluationPlan' }],
            },
            { model: CouncilPoint, as: 'councilPoints' },
          ],
        },
      ],
    });

    // Sort students canonically: document type → document number → lastName → firstName → grade → section
    sortInscriptions(allInscriptions as any[]);

    const studentMap = new Map<number, any>();
    const processedSubjects = new Set<number>();

    for (const ins of allInscriptions) {
      const insSubjects = (ins as any).inscriptionSubjects || [];
      const subjects: any[] = [];

      for (const insSub of insSubjects) {
        if (processedSubjects.has(insSub.id)) continue;
        processedSubjects.add(insSub.id);

        const termScores: Record<number, number> = {};
        termIds.forEach(tid => { termScores[tid] = 0; });

        (insSub.qualifications || []).forEach((q: any) => {
          if (q.isAbsent) return;
          const score = q.remedialScore != null && Number(q.remedialScore) > 0
            ? Number(q.remedialScore) : Number(q.score) || 0;
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
          subjects.push({
            inscriptionSubjectId: insSub.id,
            subjectName: insSub.subject?.name || '',
            abbreviation: insSub.subject?.abbreviation || insSub.subject?.name || '',
            originalScore: finalScore,
            originalStatus: 'reprobada',
            maxOpportunities: 3,
            revisions: [],
            passed: false,
          });
        }
      }

      if (subjects.length > 0) {
        const insAny = ins as any;
        studentMap.set(insAny.personId, {
          studentId: insAny.personId,
          inscriptionId: insAny.id,
          studentName: `${insAny.student?.lastName || ''} ${insAny.student?.firstName || ''}`.trim(),
          document: insAny.student?.document || '',
          documentType: insAny.student?.documentType || '',
          grade: insAny.grade?.name || '',
          gradeOrder: insAny.grade?.order ?? 999,
          section: insAny.section?.name || '',
          subjects,
        });
      }
    }

    return res.json({ students: Array.from(studentMap.values()), isPreview: true });
  } catch (error: any) {
    console.error('[getRevisionStudents] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al listar estudiantes' });
  }
};

export const getRevisionGrades = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
    });
    if (!revisionPeriod) {
      return res.json({ grades: [] });
    }

    const revisions = await InscriptionSubjectRevision.findAll({
      where: { revisionPeriodId: revisionPeriod.id },
      include: [
        {
          model: InscriptionSubject,
          as: 'inscriptionSubject',
          include: [
            {
              model: Inscription,
              as: 'inscription',
              include: [{ association: 'student' }],
            },
            { association: 'subject' },
          ],
        },
        { model: Person, as: 'grader' },
      ],
    });

    const grades = revisions.map(rev => {
      const insSub = (rev as any).inscriptionSubject;
      return {
        id: rev.id,
        inscriptionSubjectId: rev.inscriptionSubjectId,
        subjectName: insSub?.subject?.name || '',
        studentName: insSub?.inscription?.student
          ? `${insSub.inscription.student.lastName || ''} ${insSub.inscription.student.firstName || ''}`.trim()
          : '',
        opportunity: rev.opportunity,
        score: rev.score,
        status: rev.status,
        isAbsent: (rev as any).isAbsent || false,
        gradedBy: rev.gradedBy,
        graderName: (rev as any).grader
          ? `${(rev as any).grader.firstName || ''} ${(rev as any).grader.lastName || ''}`.trim()
          : null,
        gradedAt: rev.gradedAt,
      };
    });

    return res.json({ grades });
  } catch (error: any) {
    console.error('[getRevisionGrades] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener notas' });
  }
};

export const saveRevisionGrade = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const revisionId = parseInt(req.params.revisionId, 10);
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    const { score, isAbsent } = req.body as { score?: number | null; isAbsent?: boolean };

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
      transaction: t,
    });

    if (!revisionPeriod) {
      await t.rollback();
      return res.status(404).json({ message: 'Período de revisión no encontrado' });
    }

    if (revisionPeriod.status !== 'open') {
      await t.rollback();
      return res.status(400).json({ message: 'El período de revisión no está abierto' });
    }

    const revision = await InscriptionSubjectRevision.findByPk(revisionId, { transaction: t });

    if (!revision || revision.revisionPeriodId !== revisionPeriod.id) {
      await t.rollback();
      return res.status(404).json({ message: 'Revisión no encontrada' });
    }

    // Only allow saving grades for the currently active opportunity
    if (revision.opportunity !== revisionPeriod.currentOpportunity) {
      await t.rollback();
      return res.status(400).json({
        message: `Solo se puede editar la Oportunidad ${revisionPeriod.currentOpportunity}. La Oportunidad ${revision.opportunity} no está activa.`,
      });
    }

    // If the student already approved in a previous opportunity, do not allow
    // saving grades in this or any subsequent opportunity.
    const earlierApproval = await InscriptionSubjectRevision.findOne({
      where: {
        revisionPeriodId: revisionPeriod.id,
        inscriptionSubjectId: revision.inscriptionSubjectId,
        opportunity: { [Op.lt]: revision.opportunity },
        status: 'approved',
      },
      transaction: t,
    });
    if (earlierApproval) {
      await t.rollback();
      return res.status(400).json({
        message: `El estudiante ya aprobó en la Oportunidad ${earlierApproval.opportunity}. No se pueden registrar notas en oportunidades posteriores.`,
      });
    }

    const userId = (req.session as any)?.user?.personId;
    const submittedScore = score != null ? Number(score) : null;
    if (submittedScore !== null && (!Number.isFinite(submittedScore) || !Number.isInteger(submittedScore))) {
      await t.rollback();
      return res.status(400).json({ message: 'La nota de revisión debe ser un número entero' });
    }
    // A score of zero is always an absence, regardless of the input method.
    const absentFlag = !!isAbsent || submittedScore === 0;
    // When absent: score = 0, status = failed (matches evaluation plan logic)
    const numericScore = absentFlag ? 0 : submittedScore;
    const isApproved = numericScore != null && numericScore >= revisionPeriod.passingGrade;

    await revision.update({
      score: numericScore,
      status: numericScore != null ? (isApproved ? 'approved' : 'failed') : 'pending',
      isAbsent: absentFlag,
      gradedBy: userId,
      gradedAt: new Date(),
    }, { transaction: t });

    // Re-grading an opportunity invalidates every later attempt, so all
    // subsequent opportunities are cleared back to pending.
    if (numericScore != null) {
      await InscriptionSubjectRevision.update(
        { score: null, status: 'pending', isAbsent: false, gradedBy: null, gradedAt: null },
        {
          where: {
            revisionPeriodId: revisionPeriod.id,
            inscriptionSubjectId: revision.inscriptionSubjectId,
            opportunity: { [Op.gt]: revision.opportunity },
          },
          transaction: t,
        }
      );
    }

    // If failed and more opportunities available, create the next one
    if (numericScore != null && !isApproved) {
      const failedCount = await InscriptionSubjectRevision.count({
        where: {
          revisionPeriodId: revisionPeriod.id,
          inscriptionSubjectId: revision.inscriptionSubjectId,
          status: 'failed',
        },
        transaction: t,
      });

      if (failedCount < revisionPeriod.maxOpportunities) {
        const nextOpp = revision.opportunity + 1;
        const exists = await InscriptionSubjectRevision.findOne({
          where: {
            revisionPeriodId: revisionPeriod.id,
            inscriptionSubjectId: revision.inscriptionSubjectId,
            opportunity: nextOpp,
          },
          transaction: t,
        });

        if (!exists) {
          await InscriptionSubjectRevision.create({
            revisionPeriodId: revisionPeriod.id,
            inscriptionSubjectId: revision.inscriptionSubjectId,
            opportunity: nextOpp,
            status: 'pending',
          }, { transaction: t });
        }
      }
    }

    await t.commit();
    return res.json({ message: 'Nota guardada correctamente', revision });
  } catch (error: any) {
    await t.rollback();
    console.error('[saveRevisionGrade] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al guardar nota' });
  }
};

export const bulkSaveRevisionGrades = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    const { grades } = req.body as { grades: Array<{ revisionId: number; score: number | null; isAbsent?: boolean }> };

    if (!schoolPeriodId || !grades || !Array.isArray(grades)) {
      await t.rollback();
      return res.status(400).json({ message: 'Datos inválidos' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
      transaction: t,
    });

    if (!revisionPeriod || revisionPeriod.status !== 'open') {
      await t.rollback();
      return res.status(400).json({ message: 'El período de revisión no está abierto' });
    }

    const userId = (req.session as any)?.user?.personId;
    let saved = 0;
    const skipped: Array<{ revisionId: number; reason: string }> = [];

    for (const { revisionId, score, isAbsent } of grades) {
      const revision = await InscriptionSubjectRevision.findByPk(revisionId, { transaction: t });
      if (!revision || revision.revisionPeriodId !== revisionPeriod.id) continue;

      // Only allow saving grades for the currently active opportunity
      if (revision.opportunity !== revisionPeriod.currentOpportunity) {
        await t.rollback();
        return res.status(400).json({
          message: `Solo se puede editar la Oportunidad ${revisionPeriod.currentOpportunity}. La Oportunidad ${revision.opportunity} no está activa.`,
        });
      }

      // If the student already approved in a previous opportunity, skip this
      // student instead of blocking the entire save.
      const earlierApproval = await InscriptionSubjectRevision.findOne({
        where: {
          revisionPeriodId: revisionPeriod.id,
          inscriptionSubjectId: revision.inscriptionSubjectId,
          opportunity: { [Op.lt]: revision.opportunity },
          status: 'approved',
        },
        transaction: t,
      });
      if (earlierApproval) {
        // Get student name for the warning message
        const insSub = await InscriptionSubject.findByPk(revision.inscriptionSubjectId, {
          include: [{ association: 'inscription', include: [{ association: 'student' }] }],
          transaction: t,
        });
        const studentName = (insSub as any)?.inscription?.student
          ? `${(insSub as any).inscription.student.lastName || ''} ${(insSub as any).inscription.student.firstName || ''}`.trim()
          : `Inscripción ${revision.inscriptionSubjectId}`;
        skipped.push({
          revisionId,
          reason: `${studentName} ya aprobó en la Oportunidad ${earlierApproval.opportunity}`,
        });
        continue;
      }

      const submittedScore = score != null ? Number(score) : null;
      if (submittedScore !== null && (!Number.isFinite(submittedScore) || !Number.isInteger(submittedScore))) {
        await t.rollback();
        return res.status(400).json({ message: 'La nota de revisión debe ser un número entero' });
      }
      // A score of zero is always an absence, regardless of the input method.
      const absentFlag = !!isAbsent || submittedScore === 0;
      // When absent: score = 0, status = failed (matches evaluation plan logic)
      const numericScore = absentFlag ? 0 : submittedScore;
      const isApproved = numericScore != null && numericScore >= revisionPeriod.passingGrade;

      await revision.update({
        score: numericScore,
        status: numericScore != null ? (isApproved ? 'approved' : 'failed') : 'pending',
        isAbsent: absentFlag,
        gradedBy: userId,
        gradedAt: new Date(),
      }, { transaction: t });

      // Re-grading an opportunity invalidates every later attempt, so all
      // subsequent opportunities are cleared back to pending.
      if (numericScore != null) {
        await InscriptionSubjectRevision.update(
          { score: null, status: 'pending', isAbsent: false, gradedBy: null, gradedAt: null },
          {
            where: {
              revisionPeriodId: revisionPeriod.id,
              inscriptionSubjectId: revision.inscriptionSubjectId,
              opportunity: { [Op.gt]: revision.opportunity },
            },
            transaction: t,
          }
        );
      }

      if (numericScore != null && !isApproved) {
        const failedCount = await InscriptionSubjectRevision.count({
          where: {
            revisionPeriodId: revisionPeriod.id,
            inscriptionSubjectId: revision.inscriptionSubjectId,
            status: 'failed',
          },
          transaction: t,
        });

        if (failedCount < revisionPeriod.maxOpportunities) {
          const nextOpp = revision.opportunity + 1;
          const exists = await InscriptionSubjectRevision.findOne({
            where: {
              revisionPeriodId: revisionPeriod.id,
              inscriptionSubjectId: revision.inscriptionSubjectId,
              opportunity: nextOpp,
            },
            transaction: t,
          });

          if (!exists) {
            await InscriptionSubjectRevision.create({
              revisionPeriodId: revisionPeriod.id,
              inscriptionSubjectId: revision.inscriptionSubjectId,
              opportunity: nextOpp,
              status: 'pending',
            }, { transaction: t });
          }
        }
      }

      saved++;
    }

    await t.commit();
    if (skipped.length > 0) {
      return res.json({
        message: `${saved} notas guardadas. ${skipped.length} estudiante(s) omitido(s) por tener aprobación previa.`,
        saved,
        skipped,
      });
    }
    return res.json({ message: `${saved} notas guardadas correctamente`, saved });
  } catch (error: any) {
    await t.rollback();
    console.error('[bulkSaveRevisionGrades] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al guardar notas' });
  }
};

export const recalculateRevisionPeriod = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    const result = await RevisionPeriodService.recalculateRevisionPeriod(schoolPeriodId, t);
    await t.commit();
    return res.json({
      message: `Recálculo completado: ${result.created} nuevas reparaciones, ${result.removed} reparaciones eliminadas`,
      revisionPeriod: result.revisionPeriod,
      created: result.created,
      removed: result.removed,
    });
  } catch (error: any) {
    await t.rollback();
    console.error('[recalculateRevisionPeriod] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al recalcular período de revisión' });
  }
};

export const resetRevisionPeriod = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    // Only Master can reset
    const userRoles = (req.session as any)?.user?.roles || [];
    if (!userRoles.includes('Master')) {
      await t.rollback();
      return res.status(403).json({ message: 'Solo el rol Master puede reiniciar el período de revisión' });
    }

    const result = await RevisionPeriodService.resetRevisionPeriod(schoolPeriodId, t);
    await t.commit();
    return res.json({
      message: `Período de revisión reiniciado. ${result.deleted} registros eliminados.`,
      revisionPeriod: result.revisionPeriod,
      deleted: result.deleted,
    });
  } catch (error: any) {
    await t.rollback();
    console.error('[resetRevisionPeriod] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al reiniciar período de revisión' });
  }
};

export const advanceOpportunity = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      await t.rollback();
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    const requestedOpportunity = req.body?.opportunity ? parseInt(req.body.opportunity, 10) : null;
    const revisionPeriod = requestedOpportunity
      ? await RevisionPeriodService.setOpportunity(schoolPeriodId, requestedOpportunity, t)
      : await RevisionPeriodService.advanceOpportunity(schoolPeriodId, t);

    await t.commit();
    return res.json({
      message: `Oportunidad ${revisionPeriod.currentOpportunity} habilitada`,
      currentOpportunity: revisionPeriod.currentOpportunity,
    });
  } catch (error: any) {
    await t.rollback();
    console.error('[advanceOpportunity] Error:', error);
    return res.status(400).json({ message: error.message || 'Error al avanzar oportunidad' });
  }
};

export const reopenRevisionPeriod = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    const revisionPeriod = await RevisionPeriodService.reopenRevisionPeriod(schoolPeriodId, t);
    await t.commit();
    return res.json({
      message: 'Período de revisión reabierto correctamente',
      revisionPeriod,
    });
  } catch (error: any) {
    await t.rollback();
    console.error('[reopenRevisionPeriod] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al reabrir período de revisión' });
  }
};

export const updateMaxOpportunities = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    const { maxOpportunities } = req.body;
    if (!schoolPeriodId) {
      await t.rollback();
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }
    if (maxOpportunities == null) {
      await t.rollback();
      return res.status(400).json({ message: 'maxOpportunities es obligatorio' });
    }

    const revisionPeriod = await RevisionPeriodService.updateMaxOpportunities(
      schoolPeriodId,
      Number(maxOpportunities),
      t
    );
    await t.commit();
    return res.json({
      message: 'Número de intentos actualizado',
      revisionPeriod,
    });
  } catch (error: any) {
    await t.rollback();
    console.error('[updateMaxOpportunities] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al actualizar intentos' });
  }
};

// Extraordinary grade override by Control de Estudios (or Master).
// Allows editing any opportunity (not just the active one) and records
// a full audit trail in revision_grade_edit_audits.
export const overrideRevisionGrade = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const revisionId = parseInt(req.params.revisionId, 10);
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    const { score, isAbsent, reason } = req.body as {
      score?: number | null;
      isAbsent?: boolean;
      reason?: string;
    };

    // Only Control de Estudios and Master can override revision grades
    const userRoles: string[] = (req.session as any)?.user?.roles || [];
    if (!userRoles.includes('Control de Estudios') && !userRoles.includes('Master')) {
      await t.rollback();
      return res.status(403).json({ message: 'Solo Control de Estudios o Master pueden modificar notas de revisión extraordinariamente' });
    }

    const userId = (req.session as any)?.user?.personId;
    if (!userId) {
      await t.rollback();
      return res.status(401).json({ message: 'No autorizado' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
      transaction: t,
    });

    if (!revisionPeriod) {
      await t.rollback();
      return res.status(404).json({ message: 'Período de revisión no encontrado' });
    }

    // Allow override when open or completed (not closed/pending)
    if (revisionPeriod.status === 'pending' || revisionPeriod.status === 'closed') {
      await t.rollback();
      return res.status(400).json({ message: 'El período de revisión no permite ediciones en su estado actual' });
    }

    const revision = await InscriptionSubjectRevision.findByPk(revisionId, { transaction: t });
    if (!revision || revision.revisionPeriodId !== revisionPeriod.id) {
      await t.rollback();
      return res.status(404).json({ message: 'Revisión no encontrada' });
    }

    // Prevent editing future opportunities (opportunity > currentOpportunity)
    if (revision.opportunity > revisionPeriod.currentOpportunity) {
      await t.rollback();
      return res.status(400).json({
        message: `No se puede editar la Oportunidad ${revision.opportunity} porque aún no ha sido alcanzada (oportunidad activa: ${revisionPeriod.currentOpportunity}).`,
      });
    }

    // Validate integer score
    const submittedScore = score != null ? Number(score) : null;
    if (submittedScore !== null && (!Number.isFinite(submittedScore) || !Number.isInteger(submittedScore))) {
      await t.rollback();
      return res.status(400).json({ message: 'La nota de revisión debe ser un número entero' });
    }

    const absentFlag = !!isAbsent || submittedScore === 0;
    const numericScore = absentFlag ? 0 : submittedScore;
    const isApproved = numericScore != null && numericScore >= revisionPeriod.passingGrade;
    const newStatus = numericScore != null ? (isApproved ? 'approved' : 'failed') : 'pending';

    // Snapshot previous values for audit
    const previousScore = revision.score;
    const previousStatus = revision.status;
    const previousIsAbsent = revision.isAbsent;

    // Update the revision
    await revision.update({
      score: numericScore,
      status: newStatus,
      isAbsent: absentFlag,
      gradedBy: userId,
      gradedAt: new Date(),
    }, { transaction: t });

    // Re-grading an opportunity invalidates every later attempt, so all
    // subsequent opportunities are cleared back to pending (same as saveRevisionGrade).
    if (numericScore != null) {
      await InscriptionSubjectRevision.update(
        { score: null, status: 'pending', isAbsent: false, gradedBy: null, gradedAt: null },
        {
          where: {
            revisionPeriodId: revisionPeriod.id,
            inscriptionSubjectId: revision.inscriptionSubjectId,
            opportunity: { [Op.gt]: revision.opportunity },
          },
          transaction: t,
        }
      );
    }

    // If failed and more opportunities available, create the next one
    if (numericScore != null && !isApproved) {
      const failedCount = await InscriptionSubjectRevision.count({
        where: {
          revisionPeriodId: revisionPeriod.id,
          inscriptionSubjectId: revision.inscriptionSubjectId,
          status: 'failed',
        },
        transaction: t,
      });

      if (failedCount < revisionPeriod.maxOpportunities) {
        const nextOpp = revision.opportunity + 1;
        const exists = await InscriptionSubjectRevision.findOne({
          where: {
            revisionPeriodId: revisionPeriod.id,
            inscriptionSubjectId: revision.inscriptionSubjectId,
            opportunity: nextOpp,
          },
          transaction: t,
        });

        if (!exists) {
          await InscriptionSubjectRevision.create({
            revisionPeriodId: revisionPeriod.id,
            inscriptionSubjectId: revision.inscriptionSubjectId,
            opportunity: nextOpp,
            status: 'pending',
          }, { transaction: t });
        }
      }
    }

    // Record the audit trail
    await RevisionGradeEditAudit.create({
      revisionId: revision.id,
      editedBy: userId,
      previousScore: previousScore != null ? Number(previousScore) : null,
      newScore: numericScore,
      previousStatus: previousStatus as 'pending' | 'approved' | 'failed',
      newStatus: newStatus as 'pending' | 'approved' | 'failed',
      previousIsAbsent: !!previousIsAbsent,
      newIsAbsent: absentFlag,
      reason: reason?.trim() || null,
    }, { transaction: t });

    await t.commit();
    return res.json({ message: 'Nota modificada correctamente', revision });
  } catch (error: any) {
    await t.rollback();
    console.error('[overrideRevisionGrade] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al modificar nota' });
  }
};

// Get audit history for a specific revision (or all revisions in a period)
export const getRevisionGradeAudits = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
    });
    if (!revisionPeriod) {
      return res.json({ audits: [] });
    }

    const revisionId = req.params.revisionId ? parseInt(req.params.revisionId, 10) : null;

    const where: any = {};
    if (revisionId) {
      where.revisionId = revisionId;
    }

    const audits = await RevisionGradeEditAudit.findAll({
      where,
      include: [
        {
          model: InscriptionSubjectRevision,
          as: 'revision',
          where: { revisionPeriodId: revisionPeriod.id },
          include: [
            {
              model: InscriptionSubject,
              as: 'inscriptionSubject',
              include: [
                { association: 'subject' },
                {
                  model: Inscription,
                  as: 'inscription',
                  include: [{ association: 'student' }],
                },
              ],
            },
          ],
        },
        { model: Person, as: 'editor' },
      ],
      order: [['editedAt', 'DESC']],
    });

    const result = audits.map((audit: any) => {
      const rev = audit.revision;
      const insSub = rev?.inscriptionSubject;
      return {
        id: audit.id,
        revisionId: audit.revisionId,
        opportunity: rev?.opportunity,
        studentName: insSub?.inscription?.student
          ? `${insSub.inscription.student.lastName || ''} ${insSub.inscription.student.firstName || ''}`.trim()
          : '',
        subjectName: insSub?.subject?.name || '',
        subjectAbbreviation: insSub?.subject?.abbreviation || '',
        editedBy: audit.editedBy,
        editorName: audit.editor
          ? `${audit.editor.firstName || ''} ${audit.editor.lastName || ''}`.trim()
          : '',
        previousScore: audit.previousScore != null ? Number(audit.previousScore) : null,
        newScore: audit.newScore != null ? Number(audit.newScore) : null,
        previousStatus: audit.previousStatus,
        newStatus: audit.newStatus,
        previousIsAbsent: audit.previousIsAbsent,
        newIsAbsent: audit.newIsAbsent,
        reason: audit.reason,
        editedAt: audit.editedAt,
      };
    });

    return res.json({ audits: result });
  } catch (error: any) {
    console.error('[getRevisionGradeAudits] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener auditoría' });
  }
};
