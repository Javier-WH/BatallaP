import { Request, Response } from 'express';
import {
  Inscription,
  Person,
  InscriptionSubject,
  Subject,
  CouncilPoint,
  PeriodGrade,
  PeriodGradeSubject,
  Term,
  Qualification,
  EvaluationPlan
} from '@/models/index';

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
            { model: Subject, as: 'subject' },
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
                  as: 'evaluationPlan',
                  where: { termId: Number(termId) }
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

    const pgSubjects = await PeriodGradeSubject.findAll({
      where: { periodGradeId: pg.id },
      order: [['order', 'ASC']]
    });

    const subjectOrderMap = new Map();
    pgSubjects.forEach(pgs => subjectOrderMap.set(pgs.subjectId, pgs.order));

    // Map data for frontend
    const result = inscriptions.map(ins => {
      const insAny = ins as any;
      const sortedSubjects = (insAny.inscriptionSubjects || []).sort((a: any, b: any) => {
        const orderA = subjectOrderMap.get(a.subjectId) || 999;
        const orderB = subjectOrderMap.get(b.subjectId) || 999;
        return orderA - orderB;
      }).map((is: any) => {
        // Calculate definitive grade for this term
        const qualifications = is.qualifications || [];
        const grade = qualifications.reduce((acc: number, q: any) => {
          const score = Number(q.score) || 0;
          const percentage = Number(q.evaluationPlan?.percentage) || 0;
          return acc + (score * (percentage / 100));
        }, 0);

        const currentTermPoints = (is.councilPoints || []).find((cp: any) => cp.termId === Number(termId));
        const otherTermsPoints = (is.councilPoints || []).filter((cp: any) => cp.termId !== Number(termId) && cp.points > 0);

        return {
          id: is.subjectId,
          name: is.subject?.name,
          inscriptionSubjectId: is.id,
          points: currentTermPoints?.points || 0,
          councilPointId: currentTermPoints?.id,
          grade: Math.round(grade * 100) / 100,
          hasOtherTermsPoints: otherTermsPoints.length > 0,
          otherTermsInfo: otherTermsPoints.map((cp: any) => ({
            termName: cp.term?.name,
            points: cp.points
          }))
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
    if (term.isBlocked) return res.status(403).json({ message: 'El lapso está bloqueado' });

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
