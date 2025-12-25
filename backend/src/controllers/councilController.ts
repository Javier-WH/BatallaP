import { Request, Response } from 'express';
import {
  Inscription,
  Person,
  InscriptionSubject,
  Subject,
  CouncilPoint,
  PeriodGrade,
  PeriodGradeSubject,
  Term
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
              where: { termId: Number(termId) },
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
      }).map((is: any) => ({
        id: is.subjectId,
        name: is.subject?.name,
        inscriptionSubjectId: is.id,
        points: is.councilPoints?.[0]?.points || 0,
        councilPointId: is.councilPoints?.[0]?.id
      }));

      return {
        id: ins.id,
        studentName: `${insAny.student?.lastName} ${insAny.student?.firstName}`,
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
