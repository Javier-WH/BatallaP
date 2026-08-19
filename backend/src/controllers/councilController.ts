import { Request, Response } from 'express';
import {
  Inscription,
  Person,
  InscriptionSubject,
  Subject,
  SubjectGroup,
  CouncilPoint,
  PeriodGrade,
  PeriodGradeSubject,
  Term,
  Qualification,
  EvaluationPlan,
  Setting
} from '@/models/index';
import {
  getSubjectOrderMap,
  sortSubjectsByOrder,
} from '@/services/subjectOrderService';
import { filterActiveGroupSubjects } from '@/services/subjectGroupService';
import { TermSectionClosureService } from '@/services/termSectionClosureService';

export const getCouncilData = async (req: Request, res: Response) => {
  try {
    const { sectionId, termId, gradeId } = req.query;

    if (!sectionId || !termId || !gradeId) {
      return res.status(400).json({ message: 'sectionId, termId y gradeId son requeridos' });
    }

    const term = await Term.findByPk(Number(termId));
    if (!term) {
      return res.status(404).json({ message: 'Lapso no encontrado' });
    }

    // First find the periodGrade associated with this section and term
    // We can get schoolPeriodId from the term
    const inscriptions = await Inscription.findAll({
      where: {
        sectionId: Number(sectionId),
        gradeId: Number(gradeId),
        schoolPeriodId: term.schoolPeriodId
      },
      include: [
        { model: Person, as: 'student' },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            {
              model: Subject,
              as: 'subject',
              include: [{ model: SubjectGroup, as: 'subjectGroup', attributes: ['id', 'name'] }]
            },
            {
              model: CouncilPoint,
              as: 'councilPoints',
              include: [{ model: Term, as: 'term', attributes: ['name'] }],
              required: false
            },
            {
              model: Qualification,
              as: 'qualifications',
              include: [
                {
                  model: EvaluationPlan,
                  as: 'evaluationPlan'
                }
              ],
              required: false
            }
          ]
        }
      ]
    });

    // To order subjects correctly, we need the order from PeriodGradeSubject
    // Since all students in this query belong to the same Grade/Period, we can just fetch the order once
    const firstInscription = inscriptions[0];
    if (!firstInscription) {
      return res.json([]);
    }

    const pg = await PeriodGrade.findOne({
      where: {
        schoolPeriodId: term.schoolPeriodId,
        gradeId: firstInscription.gradeId
      }
    });

    if (!pg) return res.json(inscriptions);

    const subjectOrderMap = await getSubjectOrderMap(pg.id);

    // Fetch all terms for this school period, sorted by order
    const allTerms = await Term.findAll({
      where: { schoolPeriodId: term.schoolPeriodId },
      order: [['order', 'ASC']],
      raw: true
    });

    // Terms before the selected one (previous terms)
    const previousTerms = allTerms.filter((t: any) => t.order < term.order);

    // Map data for frontend
    const result = inscriptions.map(ins => {
      const insAny = ins as any;
      const activeSubjects = filterActiveGroupSubjects(insAny.inscriptionSubjects || []);
      const sortedSubjects = sortSubjectsByOrder(
        activeSubjects,
        (is: any) => is.subjectId,
        (is: any) => is.subject?.name,
        subjectOrderMap
      ).map((is: any) => {
        const allQualifications = is.qualifications || [];
        const allCouncilPoints = is.councilPoints || [];

        // Calculate base grade for a specific term from its qualifications
        const calculateTermBaseGrade = (termId: number): number => {
          return allQualifications
            .filter((q: any) => q.evaluationPlan?.termId === termId)
            .reduce((acc: number, q: any) => {
              if (q.isAbsent) return acc;
              const score = q.remedialScore != null && Number(q.remedialScore) > 0
                ? Number(q.remedialScore)
                : Number(q.score) || 0;
              const percentage = Number(q.evaluationPlan?.percentage) || 0;
              return acc + (score * (percentage / 100));
            }, 0);
        };

        // Current term grade
        const currentTermGrade = calculateTermBaseGrade(Number(termId));

        // Current term council points
        const currentTermPoints = allCouncilPoints.find((cp: any) => cp.termId === Number(termId));
        const otherTermsPoints = allCouncilPoints.filter((cp: any) => cp.termId !== Number(termId) && cp.points > 0);

        // Build previous terms data: for each previous term, calculate base grade + council points = final grade
        const previousTermsData = previousTerms.map((pt: any) => {
          const ptBaseGrade = calculateTermBaseGrade(pt.id);
          const ptCouncilPoint = allCouncilPoints.find((cp: any) => cp.termId === pt.id);
          const ptPoints = ptCouncilPoint?.points || 0;
          const ptFinalGrade = Math.round((ptBaseGrade + ptPoints) * 100) / 100;
          return {
            termId: pt.id,
            termName: pt.name,
            baseGrade: Math.round(ptBaseGrade * 100) / 100,
            councilPoints: ptPoints,
            finalGrade: ptFinalGrade
          };
        });

        return {
          id: is.subjectId,
          name: is.subject?.name,
          groupId: is.subject?.subjectGroupId,
          groupName: is.subject?.subjectGroup?.name,
          inscriptionSubjectId: is.id,
          points: currentTermPoints?.points || 0,
          councilPointId: currentTermPoints?.id,
          grade: Math.round(currentTermGrade * 100) / 100,
          hasOtherTermsPoints: otherTermsPoints.length > 0,
          otherTermsInfo: otherTermsPoints.map((cp: any) => ({
            termName: cp.term?.name,
            points: cp.points
          })),
          previousTermsData
        };
      });

      return {
        id: ins.id,
        studentName: `${insAny.student?.lastName} ${insAny.student?.firstName}`,
        studentDni: insAny.student?.document,
        documentType: insAny.student?.documentType,
        subjects: sortedSubjects
      };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener datos del consejo' });
  }
};

export const saveCouncilPoint = async (req: Request, res: Response) => {
  try {
    const { inscriptionSubjectId, termId, points } = req.body;

    const term = await Term.findByPk(termId);
    if (!term) return res.status(404).json({ message: 'Lapso no encontrado' });

    // Derive sectionId + gradeId from InscriptionSubject → Inscription for section-aware check
    const insSub = await InscriptionSubject.findByPk(inscriptionSubjectId, {
      include: [{ model: Inscription, as: 'inscription', attributes: ['id', 'sectionId', 'gradeId'] }],
    });
    const sectionId = (insSub as any)?.inscription?.sectionId;
    const gradeId = (insSub as any)?.inscription?.gradeId;

    const sectionClosed = sectionId && gradeId
      ? await TermSectionClosureService.isSectionClosed(termId, sectionId, gradeId)
      : term.isBlocked;
    if (sectionClosed) return res.status(403).json({ message: 'El lapso está cerrado para esta sección' });

    const [point, created] = await CouncilPoint.findOrCreate({
      where: { inscriptionSubjectId, termId },
      defaults: { inscriptionSubjectId, termId, points }
    });

    if (!created) {
      await point.update({ points });
    }

    res.json(point);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al guardar puntos de consejo' });
  }
};

export const bulkSaveCouncilPoints = async (req: Request, res: Response) => {
  try {
    const { updates } = req.body; // Array of { inscriptionSubjectId, termId, points }

    // Fetch limits from settings
    const [totalLimitSetting, perSubjectLimitSetting] = await Promise.all([
      Setting.findOne({ where: { key: 'council_points_limit' } }),
      Setting.findOne({ where: { key: 'council_points_per_subject_limit' } })
    ]);
    const totalLimit = totalLimitSetting ? Number(totalLimitSetting.value) : 2;
    const perSubjectLimit = perSubjectLimitSetting ? Number(perSubjectLimitSetting.value) : 2;

    // Validate per-subject limit
    for (const update of updates) {
      if (Number(update.points) > perSubjectLimit) {
        return res.status(400).json({
          message: `El límite de puntos por materia es de ${perSubjectLimit}. Se intentó asignar ${update.points}.`
        });
      }
    }

    // Validate total limit per student (group by inscriptionSubjectId's parent inscription)
    // Group updates by inscription via InscriptionSubject
    const inscriptionSubjectIds = updates.map((u: any) => u.inscriptionSubjectId);
    const insSubs = await InscriptionSubject.findAll({
      where: { id: inscriptionSubjectIds },
      attributes: ['id', 'inscriptionId']
    });

    const inscriptionMap = new Map<number, number[]>();
    insSubs.forEach((is: any) => {
      const arr = inscriptionMap.get(is.inscriptionId) || [];
      arr.push(is.id);
      inscriptionMap.set(is.inscriptionId, arr);
    });

    for (const [inscriptionId, subIds] of inscriptionMap) {
      // Sum points from updates for this inscription
      const totalFromUpdates = updates
        .filter((u: any) => subIds.includes(u.inscriptionSubjectId))
        .reduce((sum: number, u: any) => sum + Number(u.points || 0), 0);

      if (totalFromUpdates > totalLimit) {
        return res.status(400).json({
          message: `El límite total de puntos por alumno es de ${totalLimit}. Se intentó asignar ${totalFromUpdates}.`
        });
      }
    }

    for (const update of updates) {
      const [point, created] = await CouncilPoint.findOrCreate({
        where: {
          inscriptionSubjectId: update.inscriptionSubjectId,
          termId: update.termId
        },
        defaults: {
          inscriptionSubjectId: update.inscriptionSubjectId,
          termId: update.termId,
          points: update.points
        }
      });

      if (!created) {
        await point.update({ points: update.points });
      }
    }

    res.json({ message: 'Puntos actualizados correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al guardar puntos en lote' });
  }
};
