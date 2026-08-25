import { Request, Response } from 'express';
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
    return res.status(500).json({ message: error.message || 'Error al obtener período de reparación' });
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
      message: 'Período de reparación abierto correctamente',
      revisionPeriod: result.revisionPeriod,
      revisionsCreated: result.revisionsCreated,
    });
  } catch (error: any) {
    await t.rollback();
    console.error('[openRevisionPeriod] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al abrir período de reparación' });
  }
};

export const closeRevisionPeriod = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    const revisionPeriod = await RevisionPeriodService.closeRevisionPeriod(schoolPeriodId, t);
    await t.commit();
    return res.json({
      message: 'Período de reparación cerrado correctamente',
      revisionPeriod,
    });
  } catch (error: any) {
    await t.rollback();
    console.error('[closeRevisionPeriod] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al cerrar período de reparación' });
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

    // If period is open or closed, return actual revision records
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
    const { score } = req.body;

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
      transaction: t,
    });

    if (!revisionPeriod) {
      await t.rollback();
      return res.status(404).json({ message: 'Período de reparación no encontrado' });
    }

    if (revisionPeriod.status !== 'open') {
      await t.rollback();
      return res.status(400).json({ message: 'El período de reparación no está abierto' });
    }

    const revision = await InscriptionSubjectRevision.findByPk(revisionId, { transaction: t });

    if (!revision || revision.revisionPeriodId !== revisionPeriod.id) {
      await t.rollback();
      return res.status(404).json({ message: 'Revisión no encontrada' });
    }

    const userId = (req.session as any)?.user?.id;
    const numericScore = score != null ? Number(score) : null;
    const isApproved = numericScore != null && numericScore >= revisionPeriod.passingGrade;

    await revision.update({
      score: numericScore,
      status: numericScore != null ? (isApproved ? 'approved' : 'failed') : 'pending',
      gradedBy: userId,
      gradedAt: new Date(),
    }, { transaction: t });

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
    const { grades } = req.body as { grades: Array<{ revisionId: number; score: number | null }> };

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
      return res.status(400).json({ message: 'El período de reparación no está abierto' });
    }

    const userId = (req.session as any)?.user?.id;
    let saved = 0;

    for (const { revisionId, score } of grades) {
      const revision = await InscriptionSubjectRevision.findByPk(revisionId, { transaction: t });
      if (!revision || revision.revisionPeriodId !== revisionPeriod.id) continue;

      const numericScore = score != null ? Number(score) : null;
      const isApproved = numericScore != null && numericScore >= revisionPeriod.passingGrade;

      await revision.update({
        score: numericScore,
        status: numericScore != null ? (isApproved ? 'approved' : 'failed') : 'pending',
        gradedBy: userId,
        gradedAt: new Date(),
      }, { transaction: t });

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
    return res.status(500).json({ message: error.message || 'Error al recalcular período de reparación' });
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
      return res.status(403).json({ message: 'Solo el rol Master puede reiniciar el período de reparación' });
    }

    const result = await RevisionPeriodService.resetRevisionPeriod(schoolPeriodId, t);
    await t.commit();
    return res.json({
      message: `Período de reparación reiniciado. ${result.deleted} registros eliminados.`,
      revisionPeriod: result.revisionPeriod,
      deleted: result.deleted,
    });
  } catch (error: any) {
    await t.rollback();
    console.error('[resetRevisionPeriod] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al reiniciar período de reparación' });
  }
};
