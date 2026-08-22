import { Request, Response } from 'express';
import sequelize from '@/config/database';
import {
  StudentObservation, Inscription, Person, SectionGuide, SchoolPeriod,
  Term, CouncilChecklist, SubjectTermGrade, PeriodGrade, PeriodGradeSubject,
  SubjectFinalGrade, Subject, InscriptionSubject, Grade, Section,
} from '@/models/index';
import { GradeCalculationService } from '@/services/gradeCalculationService';
import { roundFinalGrade, MIN_FINAL_GRADE } from '@/services/gradeEvaluationService';

// GET /api/observations?termId=&gradeId=&sectionId=
// Returns the students of the section with their final average, rank position,
// rank trend vs previous completed term, and any existing observation text.
// Only accessible by the guide teacher of that section.
export const getSectionObservations = async (req: Request, res: Response) => {
  try {
    const personId = (req.session as any).user?.personId;
    if (!personId) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const termId = Number(req.query.termId);
    const gradeId = Number(req.query.gradeId);
    const sectionId = Number(req.query.sectionId);
    if (!termId || !gradeId || !sectionId) {
      return res.status(400).json({ message: 'Se requieren termId, gradeId y sectionId' });
    }

    // Verify the logged-in teacher is the guide for this grade+section in the active period
    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
      return res.status(400).json({ message: 'No hay período activo' });
    }

    const guide = await SectionGuide.findOne({
      where: { teacherId: personId, gradeId, sectionId, schoolPeriodId: activePeriod.id },
    });
    if (!guide) {
      return res.status(403).json({ message: 'Solo el profesor guía puede acceder a las observaciones' });
    }

    // Check if the council for this term+section is done (used to lock editing)
    const councilDoneRecord = await CouncilChecklist.findOne({
      where: { termId, sectionId, status: 'done' },
    });
    const isLocked = !!councilDoneRecord;

    // Get all terms for this period (ordered)
    const terms = await Term.findAll({
      where: { schoolPeriodId: activePeriod.id },
      order: [['order', 'ASC']],
    });

    // Determine completed terms (council done for this section)
    const completedTermIds: number[] = [];
    for (const t of terms) {
      const done = await CouncilChecklist.findOne({
        where: { termId: t.id, sectionId, status: 'done' },
      });
      if (done) completedTermIds.push(t.id);
    }

    // Load includeInAverage map for this grade+period
    const pg = await PeriodGrade.findOne({
      where: { gradeId, schoolPeriodId: activePeriod.id },
      attributes: ['id'],
    });
    const pgsRecords = pg
      ? await PeriodGradeSubject.findAll({ where: { periodGradeId: pg.id } })
      : [];
    const includeInAverageSet = new Set<number>();
    for (const pgs of pgsRecords) {
      if ((pgs as any).includeInAverage !== false) {
        includeInAverageSet.add((pgs as any).subjectId);
      }
    }

    // Get all students in this section
    const inscriptions = await Inscription.findAll({
      where: { schoolPeriodId: activePeriod.id, gradeId, sectionId },
      include: [
        {
          model: Person,
          as: 'student',
          attributes: ['id', 'firstName', 'lastName', 'document', 'documentType'],
        },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          required: false,
          include: [
            { model: Subject, as: 'subject' },
            { model: SubjectTermGrade, as: 'termGrades' },
            { model: SubjectFinalGrade, as: 'finalGrade' },
          ],
        },
      ],
      order: [
        [{ model: Person, as: 'student' }, 'lastName', 'ASC'],
        [{ model: Person, as: 'student' }, 'firstName', 'ASC'],
      ],
    });

    // Compute per-term average for each student (only eligible subjects)
    const computeTermAvg = (ins: any, tid: number): number | null => {
      const eligibleSubjects = (ins.inscriptionSubjects || []).filter((is: any) =>
        includeInAverageSet.size === 0 || includeInAverageSet.has(is.subjectId)
      );
      const scored: number[] = eligibleSubjects
        .map((is: any): number | null => {
          const tg = (is.termGrades || []).find((t: any) => t.termId === tid);
          if (!tg) return null;
          const score = Number(tg.score);
          if (isNaN(score) || score <= 0) return null;
          return Math.max(MIN_FINAL_GRADE, score);
        })
        .filter((v: number | null): v is number => v !== null);
      if (scored.length === 0) return null;
      return Number((scored.reduce((a: number, b: number) => a + b, 0) / scored.length).toFixed(2));
    };

    // Build student data with averages
    const studentsData = inscriptions.map((ins: any) => {
      const termAvgs = new Map<number, number | null>();
      for (const t of terms) {
        termAvgs.set(t.id, computeTermAvg(ins, t.id));
      }
      return {
        inscriptionId: ins.id,
        firstName: ins.student?.firstName || '',
        lastName: ins.student?.lastName || '',
        document: ins.student?.document || '',
        termAvgs,
      };
    });

    // Compute ranking for each completed term
    const computeRankForTerm = (tid: number): Map<number, number> => {
      const withAvg = studentsData
        .map((s) => ({ inscriptionId: s.inscriptionId, avg: s.termAvgs.get(tid) }))
        .filter((s): s is { inscriptionId: number; avg: number } => s.avg !== null && s.avg !== undefined)
        .sort((a, b) => b.avg - a.avg);
      const rankMap = new Map<number, number>();
      let currentRank = 0;
      let prevAvg: number | null = null;
      withAvg.forEach((entry, idx) => {
        if (prevAvg === null || entry.avg !== prevAvg) {
          currentRank = idx + 1;
          prevAvg = entry.avg;
        }
        rankMap.set(entry.inscriptionId, currentRank);
      });
      return rankMap;
    };

    const termRankMaps = new Map<number, Map<number, number>>();
    for (const tid of completedTermIds) {
      termRankMaps.set(tid, computeRankForTerm(tid));
    }

    // Determine trend: compare current term rank vs previous completed term rank
    const currentTermIndex = completedTermIds.indexOf(termId);
    const prevTermId = currentTermIndex > 0 ? completedTermIds[currentTermIndex - 1] : null;
    const currentRankMap = termRankMaps.get(termId);
    const prevRankMap = prevTermId ? termRankMaps.get(prevTermId) : null;

    // Load existing observations for this section+term
    const observations = await StudentObservation.findAll({
      where: { termId, schoolPeriodId: activePeriod.id },
    });
    const observationMap = new Map<number, string>();
    for (const obs of observations) {
      observationMap.set(obs.inscriptionId, obs.text);
    }

    const totalStudents = studentsData.filter((s) => currentRankMap?.has(s.inscriptionId)).length;

    const result = studentsData.map((s) => {
      const rankPos = currentRankMap?.get(s.inscriptionId) ?? null;
      const prevPos = prevRankMap?.get(s.inscriptionId) ?? null;
      let trend: 'up' | 'down' | 'same' | null = null;
      if (rankPos != null && prevPos != null) {
        trend = rankPos < prevPos ? 'up' : rankPos > prevPos ? 'down' : 'same';
      }
      return {
        inscriptionId: s.inscriptionId,
        firstName: s.firstName,
        lastName: s.lastName,
        document: s.document,
        finalAverage: s.termAvgs.get(termId) ?? null,
        rankPosition: rankPos,
        rankTotal: rankPos != null ? totalStudents : 0,
        rankTrend: trend,
        observation: observationMap.get(s.inscriptionId) || '',
      };
    });

    // Sort by document number (orden de lista)
    result.sort((a, b) => (a.document || '').localeCompare(b.document || '', undefined, { numeric: true }));

    res.json({ students: result, isLocked });
  } catch (error: any) {
    console.error('[getSectionObservations] Error:', error);
    res.status(500).json({ message: error.message || 'Error al obtener observaciones' });
  }
};

// PUT /api/observations
// Body: { inscriptionId, termId, text }
// Upserts the observation for a student+term. Only the guide teacher can write.
export const saveObservation = async (req: Request, res: Response) => {
  try {
    const personId = (req.session as any).user?.personId;
    if (!personId) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const { inscriptionId, termId, text } = req.body;
    if (!inscriptionId || !termId) {
      return res.status(400).json({ message: 'Se requieren inscriptionId y termId' });
    }
    if (text && text.length > 230) {
      return res.status(400).json({ message: 'La observación no puede exceder 230 caracteres' });
    }

    // Find the inscription to get gradeId, sectionId, schoolPeriodId
    const ins = await Inscription.findByPk(inscriptionId, {
      include: [{ model: Grade, as: 'grade' }, { model: Section, as: 'section' }],
    });
    if (!ins) {
      return res.status(404).json({ message: 'Inscripción no encontrada' });
    }

    // Verify the teacher is the guide for this section
    const guide = await SectionGuide.findOne({
      where: {
        teacherId: personId,
        gradeId: ins.gradeId,
        sectionId: ins.sectionId,
        schoolPeriodId: ins.schoolPeriodId,
      },
    });
    if (!guide) {
      return res.status(403).json({ message: 'Solo el profesor guía puede guardar observaciones' });
    }

    // If the council is already done for this term+section, the observation is locked
    const councilDone = await CouncilChecklist.findOne({
      where: { termId, sectionId: ins.sectionId, status: 'done' },
    });
    if (councilDone) {
      return res.status(400).json({ message: 'El consejo de curso de este lapso ya fue completado. Las observaciones están bloqueadas.' });
    }

    const [observation, created] = await StudentObservation.findOrCreate({
      where: { inscriptionId, termId },
      defaults: {
        inscriptionId,
        termId,
        schoolPeriodId: ins.schoolPeriodId,
        teacherId: personId,
        text: text || '',
      },
    });

    if (!created) {
      observation.text = text || '';
      await observation.save();
    }

    res.json(observation);
  } catch (error: any) {
    console.error('[saveObservation] Error:', error);
    res.status(500).json({ message: error.message || 'Error al guardar observación' });
  }
};

// GET /api/observations/boletin?inscriptionId=&termId=
// Returns the observation text for a specific student+term (used by boletin generation).
// No auth restriction — boletin generation runs from Control de Estudios.
export const getObservationForBoletin = async (req: Request, res: Response) => {
  try {
    const inscriptionId = Number(req.query.inscriptionId);
    const termId = Number(req.query.termId);
    if (!inscriptionId || !termId) {
      return res.status(400).json({ message: 'Se requieren inscriptionId y termId' });
    }

    const obs = await StudentObservation.findOne({
      where: { inscriptionId, termId },
    });

    res.json({ text: obs?.text || '' });
  } catch (error: any) {
    console.error('[getObservationForBoletin] Error:', error);
    res.status(500).json({ message: error.message || 'Error al obtener observación' });
  }
};
