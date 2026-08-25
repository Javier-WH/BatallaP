import { Request, Response } from 'express';
import sequelize from '@/config/database';
import {
  Inscription,
  InscriptionSubject,
  Subject,
  SubjectFinalGrade,
  SchoolPeriod,
  Grade,
  Section,
  PeriodGrade,
  PeriodGradeSubject,
  Plantel,
  Person,
  SubjectGroup,
} from '@/models/index';
import { sortInscriptions } from '@/services/studentSortService';

/**
 * GET /api/historical-grades/by-section?schoolPeriodId=X&sectionId=Y
 *
 * Returns all students in the given section (for the active school period),
 * along with their final grades across ALL school periods / years (1ro–5to).
 *
 * Response shape:
 * {
 *   students: [{ id, firstName, lastName, document, documentType }],
 *   years: [{
 *     schoolPeriodId, period, name, gradeId, gradeName,
 *     subjects: [{ id, name, abbreviation }],
 *   }],
 *   grades: [{
 *     personId, schoolPeriodId, subjectId,
 *     finalScore, status, gradeType, plantelId, plantelName,
 *     finalGradeId, inscriptionSubjectId,
 *   }],
 *   planteles: [{ id, code, name }],
 * }
 */
export const getHistoricalGradesBySection = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req.session as any)?.user;
    if (!sessionUser) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const { schoolPeriodId, sectionId, gradeId } = req.query;
    if (!schoolPeriodId || !sectionId) {
      return res.status(400).json({ message: 'schoolPeriodId y sectionId son requeridos' });
    }

    const periodId = Number(schoolPeriodId);
    const secId = Number(sectionId);
    const grdId = gradeId ? Number(gradeId) : null;

    // 1. Get the active period to determine the grade of the section
    const activePeriod = await SchoolPeriod.findByPk(periodId);
    if (!activePeriod) {
      return res.status(404).json({ message: 'Período escolar no encontrado' });
    }

    // 2. Get all inscriptions for this section+grade in the active period
    const inscriptionWhere: any = { schoolPeriodId: periodId, sectionId: secId };
    if (grdId) inscriptionWhere.gradeId = grdId;
    const inscriptions = await Inscription.findAll({
      where: inscriptionWhere,
      include: [
        {
          model: Person,
          as: 'student',
          attributes: ['id', 'firstName', 'lastName', 'document', 'documentType'],
        },
        { model: Grade, as: 'grade', attributes: ['id', 'name', 'order'] },
      ],
    });

    if (inscriptions.length === 0) {
      return res.json({ students: [], years: [], grades: [], planteles: [] });
    }

    // Apply canonical student ordering (documentType → cédula → apellidos → nombres)
    sortInscriptions(inscriptions as any);

    const personIds = inscriptions.map(i => i.personId);
    const currentGradeId = inscriptions[0].gradeId;

    // 3. Get all school periods that include this grade (or lower grades for the same student path)
    // We want all periods where these students have inscriptions
    const allInscriptionsForStudents = await Inscription.findAll({
      where: { personId: personIds as any },
      include: [
        { model: SchoolPeriod, as: 'period', attributes: ['id', 'period', 'name', 'startYear', 'endYear', 'status'] },
        { model: Grade, as: 'grade', attributes: ['id', 'name', 'order'] },
      ],
    });

    // Group by schoolPeriodId to build the "years" structure
    const periodMap = new Map<number, any>();
    for (const ins of allInscriptionsForStudents) {
      const sp = (ins as any).period;
      const gr = (ins as any).grade;
      if (!sp || !gr) continue;
      if (!periodMap.has(sp.id)) {
        periodMap.set(sp.id, {
          schoolPeriodId: sp.id,
          period: sp.period,
          name: sp.name,
          startYear: sp.startYear,
          endYear: sp.endYear,
          status: sp.status,
          gradeId: gr.id,
          gradeName: gr.name,
          gradeOrder: gr.order,
        });
      }
    }

    // Sort years by grade order (1ro → 5to)
    const years = Array.from(periodMap.values()).sort((a, b) => (a.gradeOrder ?? 999) - (b.gradeOrder ?? 999));

    // 4. Get all subjects for each period+grade combination
    const periodGradeIds = new Set<number>();
    const pgByPeriod = new Map<number, number>();
    for (const y of years) {
      const pg = await PeriodGrade.findOne({
        where: { schoolPeriodId: y.schoolPeriodId, gradeId: y.gradeId },
      });
      if (pg) {
        periodGradeIds.add(pg.id);
        pgByPeriod.set(y.schoolPeriodId, pg.id);
      }
    }

    // Get subjects per period grade (include SubjectGroup to collapse electives)
    for (const y of years) {
      const pgId = pgByPeriod.get(y.schoolPeriodId);
      if (!pgId) { y.subjects = []; continue; }
      const pgs = await PeriodGradeSubject.findAll({
        where: { periodGradeId: pgId },
        include: [{
          model: Subject,
          as: 'subject',
          attributes: ['id', 'name', 'abbreviation', 'subjectGroupId'],
          include: [{ model: SubjectGroup, as: 'subjectGroup', attributes: ['id', 'name'] }],
        }],
        order: [['order', 'ASC']],
      });
      // Collapse subjects sharing a subjectGroupId into one representative column.
      // The representative uses the group name; all subjectIds in the group are
      // kept so the frontend can match grades against any of them.
      const seenGroupIds = new Set<number>();
      const subjects: any[] = [];
      for (const p of pgs) {
        const subj = (p as any).subject;
        if (!subj) continue;
        const groupId = subj.subjectGroupId ?? null;
        if (groupId !== null) {
          if (seenGroupIds.has(groupId)) {
            // Add this subjectId to the existing group entry's memberIds
            const existing = subjects.find(s => s.subjectGroupId === groupId);
            if (existing) existing.memberIds.push(subj.id);
            continue;
          }
          seenGroupIds.add(groupId);
          subjects.push({
            id: subj.id,
            name: subj.subjectGroup?.name || subj.name,
            abbreviation: subj.abbreviation,
            subjectGroupId: groupId,
            memberIds: [subj.id],
          });
        } else {
          subjects.push({
            id: subj.id,
            name: subj.name,
            abbreviation: subj.abbreviation,
            subjectGroupId: null,
            memberIds: [subj.id],
          });
        }
      }
      y.subjects = subjects;
    }

    // 5. Get all InscriptionSubjects + SubjectFinalGrades for these students across all periods
    const allInsIds = allInscriptionsForStudents.map(i => i.id);
    const insSubjects = await InscriptionSubject.findAll({
      where: { inscriptionId: allInsIds as any },
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'abbreviation', 'subjectGroupId'] },
        {
          model: Inscription,
          as: 'inscription',
          attributes: ['id', 'personId', 'schoolPeriodId', 'gradeId'],
        },
        {
          model: SubjectFinalGrade,
          as: 'finalGrade',
          include: [{ model: Plantel, as: 'plantel', attributes: ['id', 'code', 'name'] }],
        },
      ],
    });

    // Build grades map: personId → schoolPeriodId → subjectId → grade data.
    // Include subjectGroupId so the frontend can match a grade to a collapsed
    // group column (where the column's subjectId is just the representative).
    const gradesMap: any[] = [];
    for (const is of insSubjects) {
      const ins = (is as any).inscription;
      const subj = (is as any).subject;
      const fg = (is as any).finalGrade;
      if (!ins || !subj) continue;
      gradesMap.push({
        personId: ins.personId,
        schoolPeriodId: ins.schoolPeriodId,
        subjectId: subj.id,
        subjectGroupId: subj.subjectGroupId ?? null,
        subjectName: subj.name ?? null,
        finalScore: fg?.finalScore ?? null,
        status: fg?.status ?? null,
        gradeType: fg?.gradeType ?? null,
        plantelId: fg?.plantelId ?? null,
        plantelName: fg?.plantel?.name ?? null,
        finalGradeId: fg?.id ?? null,
        inscriptionSubjectId: is.id,
        date: fg?.calculatedAt ? new Date(fg.calculatedAt).toISOString().split('T')[0] : null,
      });
    }

    // 6. Get all planteles
    const planteles = await Plantel.findAll({
      attributes: ['id', 'code', 'name', 'state'],
      order: [['name', 'ASC']],
    });

    // 7. Build students list (sorted)
    const students = inscriptions.map(ins => ({
      id: ins.personId,
      firstName: (ins as any).student?.firstName,
      lastName: (ins as any).student?.lastName,
      document: (ins as any).student?.document,
      documentType: (ins as any).student?.documentType,
    }));

    return res.json({
      students,
      years,
      grades: gradesMap,
      planteles: planteles.map((p: any) => ({ id: p.id, code: p.code, name: p.name })),
    });
  } catch (error: any) {
    console.error('[getHistoricalGradesBySection] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al cargar notas históricas' });
  }
};

/**
 * POST /api/historical-grades/save
 *
 * Body: {
 *   changes: [{
 *     personId, schoolPeriodId, subjectId,
 *     finalScore, gradeType, plantelId,
 *     finalGradeId?, inscriptionSubjectId?,
 *   }]
 * }
 *
 * For each change:
 * - If inscriptionSubjectId exists, use it; otherwise find or create it
 * - If finalGradeId exists, update; otherwise create SubjectFinalGrade
 * - Status is derived from finalScore (>= 10 = aprobada, < 10 = reprobada)
 *
 * Returns: { saved: number, errors: string[] }
 */
export const saveHistoricalGrades = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const sessionUser = (req.session as any)?.user;
    if (!sessionUser) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const { changes } = req.body;
    if (!Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ message: 'changes es requerido y debe ser un array' });
    }

    const passingGradeSetting = await sequelize.query(
      "SELECT value FROM settings WHERE `key` = 'passing_grade' LIMIT 1",
      { type: 'SELECT' as any }
    );
    const passingGrade = Number((passingGradeSetting as any[])[0]?.value) || 10;

    let saved = 0;
    const errors: string[] = [];

    for (const change of changes) {
      try {
        const { personId, schoolPeriodId, subjectId, finalScore, gradeType, plantelId, finalGradeId, inscriptionSubjectId, date } = change;

        if (!personId || !schoolPeriodId || !subjectId) {
          errors.push(`Faltan datos: personId, schoolPeriodId o subjectId`);
          continue;
        }

        // Find or create InscriptionSubject
        let insSubId = inscriptionSubjectId;
        if (!insSubId) {
          // Find the inscription for this person + period
          const inscription = await Inscription.findOne({
            where: { personId, schoolPeriodId },
            transaction: t,
          });
          if (!inscription) {
            errors.push(`No se encontró inscripción para persona ${personId} en período ${schoolPeriodId}`);
            continue;
          }
          const existing = await InscriptionSubject.findOne({
            where: { inscriptionId: inscription.id, subjectId },
            transaction: t,
          });
          if (existing) {
            insSubId = existing.id;
          } else {
            const created = await InscriptionSubject.create({
              inscriptionId: inscription.id,
              subjectId,
            }, { transaction: t });
            insSubId = created.id;
          }
        }

        // Determine status from score
        const score = finalScore !== null && finalScore !== undefined ? Number(finalScore) : null;
        const status = score !== null ? (score >= passingGrade ? 'aprobada' : 'reprobada') : 'reprobada';

        // Parse date or default to now
        const calculatedAt = date ? new Date(`${date}T12:00:00`) : new Date();

        // Update or create SubjectFinalGrade
        if (finalGradeId) {
          await SubjectFinalGrade.update({
            finalScore: score,
            status,
            gradeType: gradeType || 'regular',
            plantelId: plantelId || null,
            calculatedAt,
          }, {
            where: { id: finalGradeId },
            transaction: t,
          });
        } else {
          // Check if one already exists
          const existing = await SubjectFinalGrade.findOne({
            where: { inscriptionSubjectId: insSubId },
            transaction: t,
          });
          if (existing) {
            await SubjectFinalGrade.update({
              finalScore: score,
              status,
              gradeType: gradeType || 'regular',
              plantelId: plantelId || null,
              calculatedAt,
            }, {
              where: { id: existing.id },
              transaction: t,
            });
          } else {
            await SubjectFinalGrade.create({
              inscriptionSubjectId: insSubId,
              finalScore: score,
              status,
              gradeType: gradeType || 'regular',
              plantelId: plantelId || null,
              calculatedAt,
            }, { transaction: t });
          }
        }
        saved++;
      } catch (err: any) {
        errors.push(`Error: ${err.message}`);
      }
    }

    await t.commit();
    return res.json({ saved, errors });
  } catch (error: any) {
    await t.rollback();
    console.error('[saveHistoricalGrades] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al guardar notas históricas' });
  }
};
