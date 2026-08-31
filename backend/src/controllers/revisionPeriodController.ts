import { Request, Response } from 'express';
import { Op } from 'sequelize';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import sequelize from '@/config/database';
import { RevisionPeriodService } from '@/services/revisionPeriodService';
import { sortInscriptions } from '@/services/studentSortService';
import {
  getSubjectOrderMapByGradeAndPeriod,
  sortSubjectsByOrder,
} from '@/services/subjectOrderService';
import {
  CouncilPoint,
  EvaluationPlan,
  Grade,
  Inscription,
  InscriptionSubject,
  InscriptionSubjectRevision,
  PendingSubject,
  PeriodGrade,
  PeriodGradeSubject,
  Person,
  Qualification,
  RevisionGradeEditAudit,
  RevisionPeriod,
  SchoolPeriod,
  Setting,
  Subject,
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
      // Cache subject order maps by gradeId for canonical subject ordering
      const orderMapCache = new Map<number, Map<number, number>>();
      const resolveOrderMap = async (gradeId: number | null | undefined) => {
        if (!gradeId) return new Map<number, number>();
        if (orderMapCache.has(gradeId)) return orderMapCache.get(gradeId)!;
        const m = await getSubjectOrderMapByGradeAndPeriod(gradeId, schoolPeriodId);
        orderMapCache.set(gradeId, m);
        return m;
      };
      // Cache full subject lists by gradeId (all active subjects of the grade)
      const gradeSubjectsCache = new Map<number, any[]>();
      const resolveGradeSubjects = async (gradeId: number | null | undefined) => {
        if (!gradeId) return [];
        if (gradeSubjectsCache.has(gradeId)) return gradeSubjectsCache.get(gradeId)!;
        const pg = await PeriodGrade.findOne({
          where: { gradeId, schoolPeriodId },
          include: [{
            model: Subject,
            as: 'subjects',
            through: { where: { active: true } } as any,
          }],
        });
        const orderMap = await resolveOrderMap(gradeId);
        const rawSubjects = (pg as any)?.subjects || [];
        const sorted = sortSubjectsByOrder(
          rawSubjects,
          (s: any) => s.id,
          (s: any) => s.name,
          orderMap
        ).map((s: any) => ({
          subjectId: s.id,
          subjectName: s.name || '',
          abbreviation: s.abbreviation || s.name || '',
          subjectOrder: orderMap.get(s.id) ?? 999,
        }));
        gradeSubjectsCache.set(gradeId, sorted);
        return sorted;
      };

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
            documentType: ins.student?.documentType || '',
            grade: ins.grade?.name || '',
            gradeId: ins.gradeId,
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
          subjectId: insSub.subjectId,
          subjectName: insSub.subject?.name || '',
          abbreviation: insSub.subject?.abbreviation || insSub.subject?.name || '',
          originalScore: null,
          originalStatus: null,
          maxOpportunities: revisionPeriod.maxOpportunities,
          revisions: subjectRevisionsMap.get(insSub.id) || [],
          passed: false,
        });
      }

      // Apply canonical subject order per student
      const studentsList = Array.from(studentMap.values());
      const gradeSubjectsMap: Record<number, any[]> = {};
      for (const student of studentsList) {
        const orderMap = await resolveOrderMap(student.gradeId);
        student.subjects = sortSubjectsByOrder(
          student.subjects,
          (s: any) => s.subjectId,
          (s: any) => s.subjectName,
          orderMap
        );
        // Attach subjectOrder for frontend, remove internal subjectId
        for (const subj of student.subjects) {
          const sid = subj.subjectId;
          subj.subjectOrder = (sid != null && orderMap.has(sid)) ? orderMap.get(sid)! : 999;
          delete subj.subjectId;
        }
        // Build gradeSubjects map
        if (student.gradeId && !gradeSubjectsMap[student.gradeId]) {
          gradeSubjectsMap[student.gradeId] = await resolveGradeSubjects(student.gradeId);
        }
      }

      return res.json({ students: studentsList, isPreview: false, gradeSubjects: gradeSubjectsMap });
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
    // Cache subject order maps by gradeId for canonical subject ordering
    const orderMapCache = new Map<number, Map<number, number>>();
    const resolveOrderMap = async (gradeId: number | null | undefined) => {
      if (!gradeId) return new Map<number, number>();
      if (orderMapCache.has(gradeId)) return orderMapCache.get(gradeId)!;
      const m = await getSubjectOrderMapByGradeAndPeriod(gradeId, schoolPeriodId);
      orderMapCache.set(gradeId, m);
      return m;
    };
    // Cache full subject lists by gradeId (all active subjects of the grade)
    const gradeSubjectsCache = new Map<number, any[]>();
    const resolveGradeSubjects = async (gradeId: number | null | undefined) => {
      if (!gradeId) return [];
      if (gradeSubjectsCache.has(gradeId)) return gradeSubjectsCache.get(gradeId)!;
      const pg = await PeriodGrade.findOne({
        where: { gradeId, schoolPeriodId },
        include: [{
          model: Subject,
          as: 'subjects',
          through: { where: { active: true } } as any,
        }],
      });
      const orderMap = await resolveOrderMap(gradeId);
      const rawSubjects = (pg as any)?.subjects || [];
      const sorted = sortSubjectsByOrder(
        rawSubjects,
        (s: any) => s.id,
        (s: any) => s.name,
        orderMap
      ).map((s: any) => ({
        subjectId: s.id,
        subjectName: s.name || '',
        abbreviation: s.abbreviation || s.name || '',
        subjectOrder: orderMap.get(s.id) ?? 999,
      }));
      gradeSubjectsCache.set(gradeId, sorted);
      return sorted;
    };

    for (const ins of allInscriptions) {
      const insAny = ins as any;
      const insSubjects = insAny.inscriptionSubjects || [];
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
            subjectId: insSub.subjectId,
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
        studentMap.set(insAny.personId, {
          studentId: insAny.personId,
          inscriptionId: insAny.id,
          studentName: `${insAny.student?.lastName || ''} ${insAny.student?.firstName || ''}`.trim(),
          document: insAny.student?.document || '',
          documentType: insAny.student?.documentType || '',
          grade: insAny.grade?.name || '',
          gradeId: insAny.gradeId,
          gradeOrder: insAny.grade?.order ?? 999,
          section: insAny.section?.name || '',
          subjects,
        });
      }
    }

    // Apply canonical subject order per student
    const studentsList = Array.from(studentMap.values());
    const gradeSubjectsMap: Record<number, any[]> = {};
    for (const student of studentsList) {
      const orderMap = await resolveOrderMap(student.gradeId);
      student.subjects = sortSubjectsByOrder(
        student.subjects,
        (s: any) => s.subjectId,
        (s: any) => s.subjectName,
        orderMap
      );
      // Attach subjectOrder for frontend, remove internal subjectId
      for (const subj of student.subjects) {
        const sid = subj.subjectId;
        subj.subjectOrder = (sid != null && orderMap.has(sid)) ? orderMap.get(sid)! : 999;
        delete subj.subjectId;
      }
      // Build gradeSubjects map
      if (student.gradeId && !gradeSubjectsMap[student.gradeId]) {
        gradeSubjectsMap[student.gradeId] = await resolveGradeSubjects(student.gradeId);
      }
    }

    return res.json({ students: studentsList, isPreview: true, gradeSubjects: gradeSubjectsMap });
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

/**
 * Export a printable Excel nomina for the revision period.
 * Format matches RevisiónMockup.xlsx:
 *  - Single sheet with all grades stacked vertically
 *  - Header: school name | "REVISIÓN" | school year
 *  - Per grade: GRADO (merged) | # | CÉDULA | APELLIDOS Y NOMBRES | Sec | subject abbreviations
 *  - Subject cells filled with revision grades (score or 'I' for absent)
 *  - Non-revision subjects shown as solid gray cells
 */
export const exportRevisionNominaExcel = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    const schoolPeriod = await SchoolPeriod.findByPk(schoolPeriodId);
    if (!schoolPeriod) {
      return res.status(404).json({ message: 'Período escolar no encontrado' });
    }

    const institutionNameSetting = await Setting.findOne({ where: { key: 'institution_name' } });
    const institutionName = institutionNameSetting?.getDataValue('value') || 'Institución Educativa';

    const revisionPeriod = await RevisionPeriod.findOne({ where: { schoolPeriodId } });

    // Load all revisions for this period (if it exists)
    const revisionMap = new Map<number, Map<number, any>>(); // inscriptionSubjectId -> opportunity -> revision
    if (revisionPeriod) {
      const revisions = await InscriptionSubjectRevision.findAll({
        where: { revisionPeriodId: revisionPeriod.id },
        include: [
          {
            model: InscriptionSubject,
            as: 'inscriptionSubject',
            required: true,
            include: [
              {
                model: Inscription,
                as: 'inscription',
                where: { schoolPeriodId },
                include: [{ association: 'student' }, { association: 'grade' }, { association: 'section' }],
              },
              { association: 'subject' },
            ],
          },
        ],
        order: [['inscriptionSubjectId', 'ASC'], ['opportunity', 'ASC']],
      });

      for (const rev of revisions) {
        const insSubId = rev.inscriptionSubjectId;
        if (!revisionMap.has(insSubId)) revisionMap.set(insSubId, new Map());
        revisionMap.get(insSubId)!.set(rev.opportunity, {
          score: rev.score,
          status: rev.status,
          isAbsent: (rev as any).isAbsent || false,
          gradedBy: rev.gradedBy,
          opportunity: rev.opportunity,
        });
      }
    }

    // Load all inscriptions with their subjects for this period
    const allInscriptions = await Inscription.findAll({
      where: { schoolPeriodId },
      include: [
        { association: 'student' },
        { association: 'grade' },
        { association: 'section' },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [{ association: 'subject' }],
        },
      ],
    });

    // Sort students canonically
    sortInscriptions(allInscriptions as any[]);

    // Load pending subjects for this period's inscriptions so we can exclude
    // them from the revision nomina. PendingSubject links a subject from a
    // previous period to the current inscription (newInscriptionId).
    const inscriptionIds = allInscriptions.map((ins: any) => ins.id);
    const pendingSubjects = inscriptionIds.length > 0
      ? await PendingSubject.findAll({
          where: { newInscriptionId: { [Op.in]: inscriptionIds } },
          transaction: undefined as any,
        })
      : [];
    // Build a set of "inscriptionId-subjectId" pairs that are pending subjects
    const pendingSet = new Set<string>();
    for (const ps of pendingSubjects) {
      pendingSet.add(`${ps.newInscriptionId}-${ps.subjectId}`);
    }
    // Also collect InscriptionSubject IDs that correspond to pending subjects
    // so we can exclude their revisions from the revisionMap.
    const pendingInsSubIds = new Set<number>();
    for (const ins of allInscriptions as any[]) {
      for (const insSub of (ins.inscriptionSubjects || [])) {
        if (pendingSet.has(`${ins.id}-${insSub.subjectId}`)) {
          pendingInsSubIds.add(insSub.id);
        }
      }
    }
    // Remove pending subject revisions from the revisionMap
    for (const insSubId of pendingInsSubIds) {
      revisionMap.delete(insSubId);
    }

    // Build grade groups: gradeId -> { gradeName, gradeOrder, subjects (canonical), students }
    const gradeGroupsMap = new Map<number, {
      gradeName: string;
      gradeOrder: number;
      subjects: Array<{ subjectId: number; name: string; abbreviation: string; order: number }>;
      students: Array<{
        studentId: number;
        studentName: string;
        document: string;
        section: string;
        subjectsBySubjectId: Map<number, { inscriptionSubjectId: number }>;
      }>;
    }>();

    // Cache for grade subject lists
    const gradeSubjectsCache = new Map<number, Array<{ subjectId: number; name: string; abbreviation: string; order: number }>>();
    const resolveGradeSubjects = async (gradeId: number) => {
      if (gradeSubjectsCache.has(gradeId)) return gradeSubjectsCache.get(gradeId)!;
      const pg = await PeriodGrade.findOne({
        where: { gradeId, schoolPeriodId },
        include: [{
          model: Subject,
          as: 'subjects',
          through: { where: { active: true } } as any,
        }],
      });
      const orderMap = await getSubjectOrderMapByGradeAndPeriod(gradeId, schoolPeriodId);
      const rawSubjects = (pg as any)?.subjects || [];
      const sorted = sortSubjectsByOrder(
        rawSubjects,
        (s: any) => s.id,
        (s: any) => s.name,
        orderMap
      ).map((s: any) => ({
        subjectId: s.id,
        name: s.name || '',
        abbreviation: s.abbreviation || s.name || '',
        order: orderMap.get(s.id) ?? 999,
      }));
      gradeSubjectsCache.set(gradeId, sorted);
      return sorted;
    };

    for (const ins of allInscriptions) {
      const insAny = ins as any;
      const gradeId = insAny.gradeId;
      if (!gradeId) continue;
      const gradeName = insAny.grade?.name || '';
      const gradeOrder = insAny.grade?.order ?? 999;

      if (!gradeGroupsMap.has(gradeId)) {
        const subjects = await resolveGradeSubjects(gradeId);
        gradeGroupsMap.set(gradeId, {
          gradeName,
          gradeOrder,
          subjects,
          students: [],
        });
      }

      const group = gradeGroupsMap.get(gradeId)!;
      const subjectsBySubjectId = new Map<number, { inscriptionSubjectId: number }>();
      for (const insSub of (insAny.inscriptionSubjects || [])) {
        // Skip pending subjects (from previous periods)
        if (pendingSet.has(`${ins.id}-${insSub.subjectId}`)) continue;
        if (insSub.subjectId) {
          subjectsBySubjectId.set(insSub.subjectId, { inscriptionSubjectId: insSub.id });
        }
      }

      group.students.push({
        studentId: insAny.personId,
        studentName: `${insAny.student?.lastName || ''} ${insAny.student?.firstName || ''}`.trim(),
        document: insAny.student?.document || '',
        section: insAny.section?.name || '',
        subjectsBySubjectId,
      });
    }

    // Only include students that have at least one subject in revision,
    // and only grades that have at least one such student.
    const gradeGroups = Array.from(gradeGroupsMap.values())
      .map(g => ({
        ...g,
        students: g.students.filter(s =>
          Array.from(s.subjectsBySubjectId.values()).some(subj =>
            revisionMap.has(subj.inscriptionSubjectId)
          )
        ),
      }))
      .filter(g => g.students.length > 0)
      .sort((a, b) => {
        if (a.gradeOrder !== b.gradeOrder) return b.gradeOrder - a.gradeOrder;
        return b.gradeName.localeCompare(a.gradeName, 'es', { numeric: true });
      });

    if (gradeGroups.length === 0) {
      return res.status(404).json({ message: 'No hay estudiantes en revisión' });
    }

    // Determine the max number of subjects across all grades (for column count)
    const maxSubjects = Math.max(...gradeGroups.map(g => g.subjects.length));

    // Build workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Revisión');

    // Logo
    const logoPath = path.resolve(process.cwd(), 'public', 'uploads', 'images', 'Logo_ME_Batalla_H.png');
    const logoId = fs.existsSync(logoPath)
      ? workbook.addImage({ filename: logoPath, extension: 'png' })
      : null;

    const thinBorder = { style: 'thin' as const, color: { argb: 'FF000000' } };
    const mediumBorder = { style: 'medium' as const, color: { argb: 'FF000000' } };
    const cellFillGray: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
    const cellFillDisabled: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };

    // Column widths (matching mockup)
    sheet.getColumn(1).width = 6.86;   // GRADO
    sheet.getColumn(2).width = 3.43;   // #
    sheet.getColumn(3).width = 18;     // CÉDULA
    sheet.getColumn(4).width = 45;     // APELLIDOS Y NOMBRES
    sheet.getColumn(5).width = 5.71;   // Sec
    for (let i = 6; i < 6 + maxSubjects; i++) {
      sheet.getColumn(i).width = 5.71; // Subject columns
    }

    const totalCols = 5 + maxSubjects;
    // Compute column letter
    const colLetter = (col: number) => {
      let result = '';
      while (col > 0) {
        const rem = (col - 1) % 26;
        result = String.fromCharCode(65 + rem) + result;
        col = Math.floor((col - 1) / 26);
      }
      return result;
    };
    const lastCol = colLetter(totalCols);

    // Row 1: Header — school name | REVISIÓN | school year
    sheet.getRow(1).height = 21;
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = institutionName;
    sheet.getCell('A1').font = { bold: true, size: 14, name: 'Calibri' };
    sheet.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };

    const revisionTitleEnd = Math.min(5 + Math.floor(maxSubjects / 2), totalCols);
    sheet.mergeCells(`E1:${colLetter(revisionTitleEnd)}1`);
    sheet.getCell('E1').value = 'REVISIÓN';
    sheet.getCell('E1').font = { bold: true, size: 14, name: 'Calibri' };
    sheet.getCell('E1').alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells(`${colLetter(revisionTitleEnd + 1)}1:${lastCol}1`);
    const periodName = String(schoolPeriod.name || '');
    const schoolYear = periodName.match(/\d{4}\s*-\s*\d{4}/)?.[0] || periodName;
    sheet.getCell(`${colLetter(revisionTitleEnd + 1)}1`).value = `Año Escolar ${schoolYear}`;
    sheet.getCell(`${colLetter(revisionTitleEnd + 1)}1`).font = { bold: true, size: 12, name: 'Calibri' };
    sheet.getCell(`${colLetter(revisionTitleEnd + 1)}1`).alignment = { horizontal: 'right', vertical: 'middle' };

    // Row 2: spacer
    sheet.getRow(2).height = 15.75;

    // Data starts at row 3
    let currentRow = 3;

    for (const group of gradeGroups) {
      const gradeName = group.gradeName.toUpperCase();
      const numStudents = group.students.length;
      const numSubjects = group.subjects.length;

      // Header row
      const headerRow = sheet.getRow(currentRow);
      headerRow.height = 18;

      // Col 1: GRADO (will be merged vertically including header row, text vertical)
      headerRow.getCell(1).value = gradeName;
      headerRow.getCell(1).font = { bold: true, size: 18, name: 'Calibri' };
      headerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };

      // Col 2-5: #, CÉDULA, APELLIDOS Y NOMBRES, Sec
      const fixedHeaders = ['#', 'CÉDULA', 'APELLIDOS Y NOMBRES', 'Sec'];
      for (let i = 0; i < fixedHeaders.length; i++) {
        const cell = headerRow.getCell(2 + i);
        cell.value = fixedHeaders[i];
        cell.font = { bold: true, size: 11, name: 'Calibri' };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // Subject columns
      for (let i = 0; i < numSubjects; i++) {
        const cell = headerRow.getCell(6 + i);
        cell.value = group.subjects[i].abbreviation;
        cell.font = { bold: true, size: 8, name: 'Arial' };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      }

      // Apply borders to header row
      for (let c = 1; c <= 5 + numSubjects; c++) {
        const cell = headerRow.getCell(c);
        cell.border = {
          top: mediumBorder,
          bottom: thinBorder,
          left: c === 1 ? mediumBorder : thinBorder,
          right: (c === 5 || c === 5 + numSubjects) ? mediumBorder : thinBorder,
        };
      }

      currentRow++;

      // Data rows
      for (let si = 0; si < numStudents; si++) {
        const student = group.students[si];
        const row = sheet.getRow(currentRow);
        row.height = 18;

        // Col 1: Grade name (merged with header, no need to repeat value)
        row.getCell(1).font = { bold: true, size: 18, name: 'Calibri' };
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };

        // Col 2: #
        row.getCell(2).value = si + 1;
        row.getCell(2).font = { bold: true, size: 10, name: 'Calibri' };
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

        // Col 3: CÉDULA
        row.getCell(3).value = student.document;
        row.getCell(3).font = { size: 10, name: 'Calibri' };
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

        // Col 4: APELLIDOS Y NOMBRES
        row.getCell(4).value = student.studentName;
        row.getCell(4).font = { size: 10, name: 'Calibri' };
        row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };

        // Col 5: Sec
        const sectionName = student.section.replace(/^Secci[oó]n\s*/i, '');
        row.getCell(5).value = sectionName;
        row.getCell(5).font = { size: 10, name: 'Calibri' };
        row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

        // Subject columns
        for (let i = 0; i < numSubjects; i++) {
          const subj = group.subjects[i];
          const cell = row.getCell(6 + i);
          const studentSubj = student.subjectsBySubjectId.get(subj.subjectId);

          if (!studentSubj) {
            // Student doesn't have this subject — disabled cell
            cell.fill = cellFillDisabled;
          } else {
            const revMap = revisionMap.get(studentSubj.inscriptionSubjectId);
            if (revMap && revMap.size > 0) {
              const currentOpp = revisionPeriod?.currentOpportunity ?? 1;
              const gradesFinalized = revisionPeriod?.gradesFinalized === true;
              const allRevs = Array.from(revMap.entries())
                .filter(([opp]) => opp <= currentOpp)
                .sort((a, b) => a[0] - b[0]);
              let finalRev: any = null;
              for (let r = allRevs.length - 1; r >= 0; r--) {
                const rev = allRevs[r][1];
                if (rev.score !== null && rev.score !== undefined) {
                  finalRev = rev;
                  break;
                }
                if (rev.isAbsent === true && rev.gradedBy == null && allRevs[r][0] < currentOpp) {
                  finalRev = rev;
                  break;
                }
              }

              if (finalRev && finalRev.score != null && Number(finalRev.score) > 0) {
                // Has a real score (>0) — show it
                cell.value = Number(finalRev.score);
                const isApproved = finalRev.status === 'approved';
                cell.font = isApproved
                  ? { bold: true, size: 8, color: { argb: 'FF22A547' }, name: 'Arial' }
                  : { bold: true, size: 8, color: { argb: 'FFDC2626' }, name: 'Arial' };
              } else if (gradesFinalized) {
                // No real score and grades are finalized → NP
                cell.value = 'NP';
                cell.font = { bold: true, size: 8, color: { argb: 'FFDC2626' }, name: 'Arial' };
              } else {
                // Not finalized → empty cell
                cell.value = '';
                cell.font = { bold: true, size: 8, name: 'Arial' };
              }
              cell.fill = cellFillGray;
            } else {
              // Student has this subject but no revisions (not in revision for this subject)
              cell.fill = cellFillDisabled;
            }
          }
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        }

        // Borders: outer perimeter = medium, inner = thin
        const isLastRow = si === numStudents - 1;
        for (let c = 1; c <= 5 + numSubjects; c++) {
          const cell = row.getCell(c);
          cell.border = {
            top: thinBorder,
            bottom: isLastRow ? mediumBorder : thinBorder,
            left: c === 1 ? mediumBorder : thinBorder,
            right: (c === 5 || c === 5 + numSubjects) ? mediumBorder : thinBorder,
          };
        }

        currentRow++;
      }

      // Merge grade name column vertically (from header row to last student row)
      if (numStudents > 0) {
        const startMerge = currentRow - numStudents - 1; // include header row
        const endMerge = currentRow - 1;
        sheet.mergeCells(startMerge, 1, endMerge, 1);
        // Re-apply border + vertical text after merge.
        // For merged cells, ExcelJS needs the border set on every individual
        // cell within the merge — the outer perimeter must be mediumBorder.
        for (let r = startMerge; r <= endMerge; r++) {
          const cell = sheet.getCell(r, 1);
          cell.border = {
            top: r === startMerge ? mediumBorder : thinBorder,
            bottom: r === endMerge ? mediumBorder : thinBorder,
            left: mediumBorder,
            right: mediumBorder,
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
        }
        // Ensure the top border of the first row of the merge is medium
        // (sometimes overwritten by the header border loop above)
        sheet.getCell(startMerge, 1).border = {
          ...sheet.getCell(startMerge, 1).border,
          top: mediumBorder,
        };
      }

    }

    // Page setup
    sheet.pageSetup = {
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
    sheet.pageSetup.margins = {
      left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3,
    };

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="revision-nomina-${schoolYear}.xlsx"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('[exportRevisionNominaExcel] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al generar Excel de revisión' });
  }
};

/**
 * POST /revision-periods/:schoolPeriodId/finalize-revision-grades
 *
 * Reads all InscriptionSubjectRevision for the active revision period,
 * applies the "Nota Final" logic (findFinalRevision), and creates/updates
 * SubjectFinalGrade records with gradeType='revision'.
 *
 * This makes revision grades available in the historical grades view
 * (/notas-historicas) before the school period is closed.
 *
 * Can be re-run safely: if revision grades change after finalizing,
 * pressing the button again will update the SubjectFinalGrade records.
 */
export const finalizeRevisionGrades = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      await t.rollback();
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId },
      transaction: t,
    });
    if (!revisionPeriod) {
      await t.rollback();
      return res.status(404).json({ message: 'No hay período de revisión' });
    }

    // Load all revisions for this period
    const revisions = await InscriptionSubjectRevision.findAll({
      where: { revisionPeriodId: revisionPeriod.id },
      include: [
        {
          model: InscriptionSubject,
          as: 'inscriptionSubject',
          required: true,
          include: [
            {
              model: Inscription,
              as: 'inscription',
              required: true,
              include: [{ association: 'student' }, { association: 'grade' }],
            },
            { association: 'subject' },
            {
              model: SubjectFinalGrade,
              as: 'finalGrade',
              required: false,
              where: { gradeType: 'revision' },
            },
          ],
        },
      ],
      transaction: t,
      order: [['inscriptionSubjectId', 'ASC'], ['opportunity', 'ASC']],
    });

    // Group revisions by inscriptionSubjectId
    const revisionsByInsSubId = new Map<number, any[]>();
    for (const rev of revisions) {
      const insSubId = rev.inscriptionSubjectId;
      if (!revisionsByInsSubId.has(insSubId)) revisionsByInsSubId.set(insSubId, []);
      revisionsByInsSubId.get(insSubId)!.push({
        opportunity: rev.opportunity,
        score: rev.score,
        status: rev.status,
        isAbsent: (rev as any).isAbsent || false,
        gradedBy: rev.gradedBy,
      });
    }

    const currentOpp = revisionPeriod.currentOpportunity ?? 1;
    const passingGrade = revisionPeriod.passingGrade ?? 10;
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const [insSubId, revs] of revisionsByInsSubId) {
      // Apply findFinalRevision logic:
      // last revision (highest opportunity) with score != null OR
      // auto-NP (isAbsent=true, gradedBy=null, opportunity < currentOpp)
      let finalRev: any = null;
      const sortedRevs = [...revs].sort((a, b) => a.opportunity - b.opportunity);
      for (let i = sortedRevs.length - 1; i >= 0; i--) {
        const rev = sortedRevs[i];
        if (rev.score !== null && rev.score !== undefined) {
          finalRev = rev;
          break;
        }
        if (rev.isAbsent === true && rev.gradedBy == null && rev.opportunity < currentOpp) {
          finalRev = rev;
          break;
        }
      }

      if (!finalRev) {
        skipped++;
        continue;
      }

      // Determine final score and status
      const isExplicitZero = finalRev.score !== null && finalRev.score !== undefined && Number(finalRev.score) === 0 && finalRev.gradedBy != null;
      const isAutoAbsent = finalRev.isAbsent === true && finalRev.gradedBy == null && finalRev.opportunity < currentOpp;
      const isAbsent = isExplicitZero || isAutoAbsent;

      const finalScore = isAbsent ? 0 : (finalRev.score != null ? Number(finalRev.score) : null);
      if (finalScore == null) {
        skipped++;
        continue;
      }

      const isApproved = finalScore >= passingGrade;
      const status: 'aprobada' | 'reprobada' = isApproved ? 'aprobada' : 'reprobada';

      // Find the InscriptionSubject to get denormalized fields
      const rev0 = revisions.find(r => r.inscriptionSubjectId === insSubId);
      const insSub = (rev0 as any)?.inscriptionSubject;
      if (!insSub) {
        skipped++;
        continue;
      }

      const ins = insSub.inscription;
      const existingRevisionGrade = insSub.finalGrade;

      // Get the regular grade to preserve original score/status
      const regularGrade = await SubjectFinalGrade.findOne({
        where: { inscriptionSubjectId: insSubId, gradeType: 'regular' },
        transaction: t,
      });
      const originalScore = regularGrade?.finalScore != null
        ? Number(regularGrade.finalScore)
        : null;
      const originalStatus = regularGrade?.status ?? null;
      const plantelId = regularGrade?.plantelId ?? existingRevisionGrade?.plantelId ?? null;

      if (existingRevisionGrade) {
        // Update existing revision record
        await SubjectFinalGrade.update(
          {
            finalScore,
            status,
            gradeType: 'revision',
            originalScore: originalScore != null ? originalScore : (existingRevisionGrade?.originalScore ?? null),
            originalStatus: originalStatus ?? (existingRevisionGrade?.originalStatus ?? null),
            calculatedAt: new Date(),
            schoolPeriodId: ins?.schoolPeriodId ?? null,
            subjectId: insSub.subjectId,
            gradeId: ins?.gradeId ?? null,
          },
          { where: { id: existingRevisionGrade.id }, transaction: t }
        );
        updated++;
      } else {
        // Create new revision record
        await SubjectFinalGrade.create(
          {
            inscriptionSubjectId: insSubId,
            finalScore,
            status,
            gradeType: 'revision',
            originalScore,
            originalStatus,
            calculatedAt: new Date(),
            plantelId,
            schoolPeriodId: ins?.schoolPeriodId ?? null,
            subjectId: insSub.subjectId,
            gradeId: ins?.gradeId ?? null,
          },
          { transaction: t }
        );
        created++;
      }
    }

    // Mark grades as finalized
    const userId = (req.session as any)?.user?.id;
    await revisionPeriod.update({
      gradesFinalized: true,
      gradesFinalizedAt: new Date(),
      gradesFinalizedBy: userId ?? null,
    }, { transaction: t });

    await t.commit();
    return res.json({
      message: `Notas de revisión finalizadas: ${created} creadas, ${updated} actualizadas, ${skipped} omitidas`,
      summary: { created, updated, skipped, total: revisionsByInsSubId.size },
      gradesFinalized: true,
    });
  } catch (error: any) {
    await t.rollback();
    console.error('[finalizeRevisionGrades] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al finalizar notas de revisión' });
  }
};

/**
 * Unmark grades as finalized (toggle off the "Revisión Completada" checkbox).
 * Does NOT delete the SubjectFinalGrade records — only flips the flag so the
 * Excel export shows empty cells instead of NP for ungraded revisions.
 */
export const unfinalizeRevisionGrades = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = parseInt(req.params.schoolPeriodId, 10);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es requerido' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({ where: { schoolPeriodId } });
    if (!revisionPeriod) {
      return res.status(404).json({ message: 'Período de revisión no encontrado' });
    }

    await revisionPeriod.update({
      gradesFinalized: false,
      gradesFinalizedAt: null,
      gradesFinalizedBy: null,
    });

    return res.json({ message: 'Revisión marcada como no completada', gradesFinalized: false });
  } catch (error: any) {
    console.error('[unfinalizeRevisionGrades] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al desmarcar revisión' });
  }
};
