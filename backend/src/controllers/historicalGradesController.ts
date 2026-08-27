import { Request, Response } from 'express';
import sequelize from '@/config/database';
import {
  Inscription,
  InscriptionSubject,
  Subject,
  SubjectFinalGrade,
  SubjectTermGrade,
  SchoolPeriod,
  Grade,
  Section,
  PeriodGrade,
  PeriodGradeSubject,
  Plantel,
  Person,
  SubjectGroup,
  Term,
  HistoricalGrade,
} from '@/models/index';
import { sortInscriptions } from '@/services/studentSortService';
import { roundFinalGrade, roundGrade, isPassingGrade } from '@/services/gradeEvaluationService';

/**
 * GET /api/historical-grades/by-section?schoolPeriodId=X&sectionId=Y&gradeId=Z
 * GET /api/historical-grades/by-section?schoolPeriodId=X&personId=P
 *
 * Returns students + ALL years (1ro–5to) with their subjects, plus all known
 * grades from multiple sources (SubjectFinalGrade, SubjectTermGrade fallback,
 * PendingSubject, HistoricalGrade).
 *
 * Years are built from ALL Grade records in the system, not just the ones
 * where the student has inscriptions. This allows the user to manually fill
 * in legacy data for years where the student has no records in the system.
 *
 * Response shape:
 * {
 *   students: [{ id, firstName, lastName, document, documentType }],
 *   years: [{
 *     gradeId, gradeName, gradeOrder,
 *     schoolPeriodId,  // the period used for subject lookup (may be null)
 *     subjects: [{ id, name, abbreviation, subjectGroupId, memberIds }],
 *   }],
 *   grades: [{ personId, schoolPeriodId, gradeId, subjectId, finalScore, status, gradeType, plantelId, ... }],
 *   planteles: [{ id, code, name }],
 * }
 */
export const getHistoricalGradesBySection = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req.session as any)?.user;
    if (!sessionUser) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const { schoolPeriodId, sectionId, gradeId, personId } = req.query;
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es requerido' });
    }

    const periodId = Number(schoolPeriodId);
    const secId = sectionId ? Number(sectionId) : null;
    const grdId = gradeId ? Number(gradeId) : null;
    const individualPersonId = personId ? Number(personId) : null;

    // 1. Get the active period
    const activePeriod = await SchoolPeriod.findByPk(periodId);
    if (!activePeriod) {
      return res.status(404).json({ message: 'Período escolar no encontrado' });
    }

    // 2. Get students — either by section or individual
    let personIds: number[] = [];
    let students: any[] = [];

    if (individualPersonId) {
      // Individual student mode
      const person = await Person.findByPk(individualPersonId, {
        attributes: ['id', 'firstName', 'lastName', 'document', 'documentType'],
      });
      if (!person) {
        return res.json({ students: [], years: [], grades: [], planteles: [] });
      }
      personIds = [person.id];
      students = [{
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        document: person.document,
        documentType: person.documentType,
      }];
    } else {
      if (!secId) {
        return res.status(400).json({ message: 'sectionId o personId es requerido' });
      }
      // Section mode
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
          { model: Section, as: 'section', attributes: ['id', 'name'] },
        ],
      });

      if (inscriptions.length === 0) {
        return res.json({ students: [], years: [], grades: [], planteles: [] });
      }

      // Filter out MATERIA PENDIENTE section inscriptions — those are not regular students
      const regularInscriptions = inscriptions.filter((ins: any) =>
        (ins.section?.name || '').toUpperCase() !== 'MATERIA PENDIENTE'
      );
      // If all were MP, use original list
      const inscriptionsToUse = regularInscriptions.length > 0 ? regularInscriptions : inscriptions;

      sortInscriptions(inscriptionsToUse as any);
      personIds = inscriptionsToUse.map(i => i.personId);
      students = inscriptionsToUse.map(ins => ({
        id: ins.personId,
        firstName: (ins as any).student?.firstName,
        lastName: (ins as any).student?.lastName,
        document: (ins as any).student?.document,
        documentType: (ins as any).student?.documentType,
      }));
    }

    if (personIds.length === 0) {
      return res.json({ students: [], years: [], grades: [], planteles: [] });
    }

    // 3. Get ALL Grade records from the system — these define the year columns.
    //    Every grade is shown regardless of whether the student has inscriptions.
    const allGrades = await Grade.findAll({
      attributes: ['id', 'name', 'order'],
      order: [['order', 'ASC']],
    });

    // 3b. Batch-fetch all SchoolPeriods to build a short period label (e.g. "25/26")
    const allPeriods = await SchoolPeriod.findAll({
      attributes: ['id', 'startYear', 'endYear', 'period', 'name', 'status'],
      order: [['startYear', 'ASC']],
    });
    const periodShortMap = new Map<number, string>();
    for (const p of allPeriods) {
      const s = String(p.startYear).slice(-2);
      const e = String(p.endYear).slice(-2);
      periodShortMap.set(p.id, `${s}/${e}`);
    }

    // 4. For each grade, find the PeriodGrade to get subjects.
    //    Try the active period first; if not found, try any period that has
    //    a PeriodGrade for this grade.
    const years: any[] = [];
    for (const gr of allGrades) {
      // Try active period first
      let pg = await PeriodGrade.findOne({
        where: { schoolPeriodId: periodId, gradeId: gr.id },
        attributes: ['id', 'schoolPeriodId', 'gradeId', 'color'],
      });
      let pgPeriodId = periodId;

      // If not found, try any period with a PeriodGrade for this grade
      if (!pg) {
        pg = await PeriodGrade.findOne({
          where: { gradeId: gr.id },
          attributes: ['id', 'schoolPeriodId', 'gradeId', 'color'],
          order: [['id', 'DESC']], // most recent
        });
        if (pg) {
          pgPeriodId = pg.schoolPeriodId;
        }
      }

      // Get subjects for this period grade
      let subjects: any[] = [];
      if (pg) {
        const pgs = await PeriodGradeSubject.findAll({
          where: { periodGradeId: pg.id },
          include: [{
            model: Subject,
            as: 'subject',
            attributes: ['id', 'name', 'abbreviation', 'subjectGroupId'],
            include: [{ model: SubjectGroup, as: 'subjectGroup', attributes: ['id', 'name'] }],
          }],
          order: [['order', 'ASC']],
        });
        // Collapse subjects sharing a subjectGroupId
        const seenGroupIds = new Set<number>();
        for (const p of pgs) {
          const subj = (p as any).subject;
          if (!subj) continue;
          const groupId = subj.subjectGroupId ?? null;
          if (groupId !== null) {
            if (seenGroupIds.has(groupId)) {
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
      }

      years.push({
        gradeId: gr.id,
        gradeName: gr.name,
        gradeOrder: gr.order,
        schoolPeriodId: pgPeriodId,
        periodShort: pgPeriodId ? (periodShortMap.get(pgPeriodId) ?? null) : null,
        gradeColor: (pg as any)?.color ?? null,
        subjects,
      });
    }

    // 5. Get all inscriptions for these students (across all periods).
    //    Auxiliary MP inscriptions are identified by their SECTION name, not by
    //    escolaridad — registering a student in Materia Pendiente also flips the
    //    escolaridad of their REGULAR inscription to 'materia_pendiente', so
    //    filtering by escolaridad would wrongly drop all their regular grades.
    const allInscriptionsRaw = await Inscription.findAll({
      where: { personId: personIds as any },
      include: [
        { model: SchoolPeriod, as: 'period', attributes: ['id', 'period', 'name', 'startYear', 'endYear', 'status'] },
        { model: Grade, as: 'grade', attributes: ['id', 'name', 'order'] },
        { model: Section, as: 'section', attributes: ['id', 'name'] },
      ],
    });

    const allInscriptionsForStudents = allInscriptionsRaw.filter((ins: any) =>
      (ins.section?.name || '').toUpperCase() !== 'MATERIA PENDIENTE'
    );

    const allInsIds = allInscriptionsForStudents.map(i => i.id);

    // 6. Get InscriptionSubjects + SubjectFinalGrades + SubjectTermGrades
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
        { model: SubjectTermGrade, as: 'termGrades', include: [{ model: Term, as: 'term' }] },
      ],
    });

    // Build grades map from InscriptionSubjects
    const gradesMap: any[] = [];
    for (const is of insSubjects) {
      const ins = (is as any).inscription;
      const subj = (is as any).subject;
      const fg = (is as any).finalGrade;
      const termGrades: any[] = (is as any).termGrades || [];
      if (!ins || !subj) continue;

      let finalScore: number | null = fg?.finalScore != null ? roundGrade(Number(fg.finalScore)) : null;
      let status: string | null = fg?.status ?? null;
      let gradeType: string | null = fg?.gradeType ?? null;
      let date: string | null = fg?.calculatedAt ? new Date(fg.calculatedAt).toISOString().split('T')[0] : null;

      // Fallback: compute from term grades if no SubjectFinalGrade exists
      if (!fg && termGrades.length > 0) {
        const sum = termGrades.reduce((acc, tg) => acc + Number(tg.score || 0), 0);
        const avg = sum / termGrades.length;
        finalScore = roundFinalGrade(avg);
        status = isPassingGrade(avg, 10) ? 'aprobada' : 'reprobada';
        gradeType = 'regular';
        const latestCalculated = termGrades
          .map(tg => tg.calculatedAt)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
        date = latestCalculated ? new Date(latestCalculated).toISOString().split('T')[0] : null;
      }

      // Only show regular/transferencia/equivalencia final grades.
      // Exclude materia_pendiente and revision_materia_pendiente (shown in another view).
      // For revision grades, show the original aplazada score (not the repair score).
      if (gradeType === 'materia_pendiente' || gradeType === 'revision_materia_pendiente') continue;
      if (gradeType === 'revision') {
        // Show the original aplazada score, not the repair score
        finalScore = fg?.originalScore != null ? roundGrade(Number(fg.originalScore)) : finalScore;
        status = fg?.originalStatus ?? status;
        gradeType = 'regular';
      }

      gradesMap.push({
        personId: ins.personId,
        schoolPeriodId: ins.schoolPeriodId,
        periodShort: ins.schoolPeriodId != null ? (periodShortMap.get(ins.schoolPeriodId) ?? null) : null,
        gradeId: ins.gradeId ?? null,
        subjectId: subj.id,
        subjectGroupId: subj.subjectGroupId ?? null,
        subjectName: subj.name ?? null,
        finalScore,
        status,
        gradeType,
        plantelId: fg?.plantelId ?? null,
        plantelName: fg?.plantel?.name ?? null,
        finalGradeId: fg?.id ?? null,
        inscriptionSubjectId: is.id,
        date,
        source: 'system',
      });
    }

    // 7. PendingSubject grades are NOT shown in this view — only final grades
    //    from the conventional evaluation process (lapsos, evaluaciones, consejos)
    //    and manually-entered historical grades are displayed.

    // 8. Get HistoricalGrade records (legacy data entered manually)
    const historicalGrades = await HistoricalGrade.findAll({
      where: { personId: personIds as any },
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'abbreviation', 'subjectGroupId'] },
        { model: Plantel, as: 'plantel', attributes: ['id', 'code', 'name'] },
      ],
    });

    for (const hg of historicalGrades) {
      const subj = (hg as any).subject;
      gradesMap.push({
        personId: hg.personId,
        schoolPeriodId: hg.schoolPeriodId ?? null,
        periodShort: hg.schoolPeriodId != null ? (periodShortMap.get(hg.schoolPeriodId) ?? null) : null,
        gradeId: hg.gradeId,
        subjectId: hg.subjectId,
        subjectGroupId: subj?.subjectGroupId ?? null,
        subjectName: subj?.name ?? null,
        finalScore: hg.finalScore != null ? roundGrade(Number(hg.finalScore)) : null,
        status: hg.status,
        gradeType: hg.gradeType,
        plantelId: hg.plantelId ?? null,
        plantelName: (hg as any).plantel?.name ?? null,
        finalGradeId: null,
        inscriptionSubjectId: null,
        historicalGradeId: hg.id,
        date: hg.date ? new Date(hg.date).toISOString().split('T')[0] : null,
        source: 'historical',
      });
    }

    // 9. Get all planteles
    const planteles = await Plantel.findAll({
      attributes: ['id', 'code', 'name', 'state'],
      order: [['name', 'ASC']],
    });

    return res.json({
      students,
      years,
      grades: gradesMap,
      planteles: planteles.map((p: any) => ({ id: p.id, code: p.code, name: p.name })),
      allPeriods: allPeriods.map((p: any) => ({
        id: p.id,
        periodShort: periodShortMap.get(p.id) ?? null,
        period: p.period,
        name: p.name,
        status: p.status,
      })),
    });
  } catch (error: any) {
    console.error('[getHistoricalGradesBySection] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al cargar notas históricas' });
  }
};

/**
 * Resolve a period label (e.g. "03/04" or "2003-2004") to a SchoolPeriod id.
 * If the period doesn't exist AND is in the past, create it with status 'historico'.
 * Rejects the active period or future periods.
 * Returns null if the label is empty or invalid.
 */
async function resolveOrCreatePeriod(periodLabel: string | null | undefined, transaction: any): Promise<number | null> {
  if (!periodLabel || typeof periodLabel !== 'string') return null;
  const label = periodLabel.trim();
  if (!label) return null;

  // Load all periods to match and to find the active one
  const allPeriods = await SchoolPeriod.findAll({
    attributes: ['id', 'startYear', 'endYear', 'period', 'status'],
    transaction,
  });

  // Helper: reject active or future periods
  const rejectIfNotHistorical = (p: any) => {
    if (p.status === 'activo' || p.status === 'preinscripcion') {
      throw new Error(
        `No se puede usar el periodo "${p.period}" en notas históricas. ` +
        `Solo se permiten periodos anteriores al actual.`
      );
    }
  };

  // Try to match by periodShort (YY/YY format, e.g. "03/04")
  for (const p of allPeriods) {
    const s = String(p.startYear).slice(-2);
    const e = String(p.endYear).slice(-2);
    if (`${s}/${e}` === label) {
      rejectIfNotHistorical(p);
      return p.id;
    }
  }

  // Try to match by period string (YYYY-YYYY format, e.g. "2003-2004")
  const byPeriod = allPeriods.find(p => p.period === label);
  if (byPeriod) {
    rejectIfNotHistorical(byPeriod);
    return byPeriod.id;
  }

  // Validate YYYY-YYYY format
  const match = /^(\d{4})-(\d{4})$/.exec(label);
  if (!match) {
    throw new Error(`Formato de periodo inválido: "${label}". Use AAAA-AAAA (ej. 2003-2004)`);
  }
  const startYear = parseInt(match[1], 10);
  const endYear = parseInt(match[2], 10);
  if (!(endYear > startYear)) {
    throw new Error(`Periodo inválido: "${label}". El año final debe ser mayor al inicial`);
  }

  // Reject the active period or any period that starts in the same year or after
  const activePeriod = allPeriods.find(p => p.status === 'activo');
  if (activePeriod && startYear >= activePeriod.startYear) {
    throw new Error(
      `No se puede usar el periodo "${label}" en notas históricas. ` +
      `Solo se permiten periodos anteriores al actual (${activePeriod.period}).`
    );
  }

  const created = await SchoolPeriod.create({
    period: label,
    name: `Año Escolar ${label}`,
    startYear,
    endYear,
    status: 'historico',
  }, { transaction });

  return created.id;
}

/**
 * POST /api/historical-grades/save
 *
 * Body: {
 *   changes: [{
 *     personId, periodLabel, gradeId, subjectId,
 *     finalScore, gradeType, plantelId, date,
 *     finalGradeId?, inscriptionSubjectId?, historicalGradeId?,
 *   }]
 * }
 *
 * For each change:
 * - If historicalGradeId exists → update HistoricalGrade
 * - Else if inscriptionSubjectId exists → update/create SubjectFinalGrade
 * - Else if there's an inscription for (personId, schoolPeriodId) → use SubjectFinalGrade
 * - Else → create/update HistoricalGrade (no inscription needed)
 */
export const saveHistoricalGrades = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const sessionUser = (req.session as any)?.user;
    if (!sessionUser) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const userId = sessionUser.id;

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
        const {
          personId, periodLabel, gradeId, subjectId,
          finalScore, gradeType, plantelId,
          finalGradeId, inscriptionSubjectId, historicalGradeId, date,
        } = change;

        if (!personId || !gradeId || !subjectId) {
          errors.push(`Faltan datos: personId, gradeId o subjectId`);
          continue;
        }

        // Resolve periodLabel → schoolPeriodId (creates SchoolPeriod if needed)
        let schoolPeriodId: number | null = null;
        try {
          schoolPeriodId = await resolveOrCreatePeriod(periodLabel, t);
        } catch (periodErr: any) {
          errors.push(periodErr.message);
          continue;
        }

        const rawScore = finalScore !== null && finalScore !== undefined ? Number(finalScore) : null;
        // Use roundGrade (not roundFinalGrade) for historical grades — they can be 0.
        // roundFinalGrade enforces MIN_FINAL_GRADE=1 which is for system-calculated grades only.
        const score = rawScore !== null ? roundGrade(rawScore) : null;
        // Validate score range (0 is treated as "no grade" → null)
        if (score !== null && (score < 0 || score > 20)) {
          errors.push(`Nota inválida: ${score}. Debe estar entre 1 y 20.`);
          continue;
        }
        const normalizedScore = score === 0 ? null : score;
        const status = normalizedScore !== null ? (isPassingGrade(rawScore!, passingGrade) ? 'aprobada' : 'reprobada') : 'reprobada';
        const parsedDate = date ? new Date(`${date}T12:00:00`) : new Date();
        const dateOnly = date ? new Date(date).toISOString().split('T')[0] : null;

        // ── Case 1: Update existing HistoricalGrade ──
        if (historicalGradeId) {
          // If score is null (empty or 0), the user wants to delete the note
          if (normalizedScore === null) {
            await HistoricalGrade.destroy({
              where: { id: historicalGradeId },
              transaction: t,
            });
            saved++;
            continue;
          }
          await HistoricalGrade.update({
            schoolPeriodId: schoolPeriodId || null,
            finalScore: normalizedScore,
            status,
            gradeType: gradeType || 'regular',
            plantelId: plantelId || null,
            date: dateOnly,
          }, {
            where: { id: historicalGradeId },
            transaction: t,
          });
          saved++;
          continue;
        }

        // ── Case 2: Update existing SubjectFinalGrade ──
        if (finalGradeId) {
          await SubjectFinalGrade.update({
            finalScore: normalizedScore,
            status,
            gradeType: gradeType || 'regular',
            plantelId: plantelId || null,
            calculatedAt: parsedDate,
          }, {
            where: { id: finalGradeId },
            transaction: t,
          });
          saved++;
          continue;
        }

        // ── Case 3: Have inscriptionSubjectId → use SubjectFinalGrade ──
        if (inscriptionSubjectId) {
          // Load InscriptionSubject with Inscription to denormalize context
          const ctxInsSub = await InscriptionSubject.findByPk(inscriptionSubjectId, {
            include: [{ model: Inscription, as: 'inscription', attributes: ['id', 'schoolPeriodId', 'gradeId'] }],
            transaction: t,
          });
          const ctxIns = (ctxInsSub as any)?.inscription;
          const existing = await SubjectFinalGrade.findOne({
            where: { inscriptionSubjectId },
            transaction: t,
          });
          if (existing) {
            await SubjectFinalGrade.update({
              finalScore: normalizedScore,
              status,
              gradeType: gradeType || 'regular',
              plantelId: plantelId || null,
              calculatedAt: parsedDate,
              schoolPeriodId: ctxIns?.schoolPeriodId ?? null,
              subjectId: ctxInsSub?.subjectId ?? null,
              gradeId: ctxIns?.gradeId ?? null,
            }, {
              where: { id: existing.id },
              transaction: t,
            });
          } else {
            await SubjectFinalGrade.create({
              inscriptionSubjectId,
              finalScore: normalizedScore,
              status,
              gradeType: gradeType || 'regular',
              plantelId: plantelId || null,
              calculatedAt: parsedDate,
              schoolPeriodId: ctxIns?.schoolPeriodId ?? null,
              subjectId: ctxInsSub?.subjectId ?? null,
              gradeId: ctxIns?.gradeId ?? null,
            }, { transaction: t });
          }
          saved++;
          continue;
        }

        // ── Case 4: Try to find an inscription for (personId, schoolPeriodId, gradeId) ──
        if (schoolPeriodId) {
          const inscWhere: any = { personId, schoolPeriodId };
          if (gradeId) inscWhere.gradeId = gradeId;
          const inscription = await Inscription.findOne({
            where: inscWhere,
            transaction: t,
          });
          if (inscription) {
            // Find or create InscriptionSubject
            let insSub = await InscriptionSubject.findOne({
              where: { inscriptionId: inscription.id, subjectId },
              transaction: t,
            });
            if (!insSub) {
              insSub = await InscriptionSubject.create({
                inscriptionId: inscription.id,
                subjectId,
                schoolPeriodId: inscription.schoolPeriodId,
                gradeId: inscription.gradeId,
                sectionId: inscription.sectionId,
              }, { transaction: t });
            }
            const existing = await SubjectFinalGrade.findOne({
              where: { inscriptionSubjectId: insSub.id },
              transaction: t,
            });
            if (existing) {
              await SubjectFinalGrade.update({
                finalScore: normalizedScore,
                status,
                gradeType: gradeType || 'regular',
                plantelId: plantelId || null,
                calculatedAt: parsedDate,
                schoolPeriodId: inscription.schoolPeriodId,
                subjectId: insSub.subjectId,
                gradeId: inscription.gradeId,
              }, {
                where: { id: existing.id },
                transaction: t,
              });
            } else {
              await SubjectFinalGrade.create({
                inscriptionSubjectId: insSub.id,
                finalScore: normalizedScore,
                status,
                gradeType: gradeType || 'regular',
                plantelId: plantelId || null,
                calculatedAt: parsedDate,
                schoolPeriodId: inscription.schoolPeriodId,
                subjectId: insSub.subjectId,
                gradeId: inscription.gradeId,
              }, { transaction: t });
            }
            saved++;
            continue;
          }
        }

        // ── Case 5: No inscription → use HistoricalGrade ──
        // Don't create empty historical grades — if score is null, skip
        if (normalizedScore === null) {
          // Check if there's an existing one to delete
          const existingHist = await HistoricalGrade.findOne({
            where: { personId, gradeId, subjectId },
            transaction: t,
          });
          if (existingHist) {
            await HistoricalGrade.destroy({
              where: { id: existingHist.id },
              transaction: t,
            });
            saved++;
          }
          continue;
        }
        const existingHist = await HistoricalGrade.findOne({
          where: { personId, gradeId, subjectId },
          transaction: t,
        });
        if (existingHist) {
          await HistoricalGrade.update({
            schoolPeriodId: schoolPeriodId || null,
            finalScore: normalizedScore,
            status,
            gradeType: gradeType || 'regular',
            plantelId: plantelId || null,
            date: dateOnly,
          }, {
            where: { id: existingHist.id },
            transaction: t,
          });
        } else {
          await HistoricalGrade.create({
            personId,
            gradeId,
            subjectId,
            schoolPeriodId: schoolPeriodId || null,
            finalScore: normalizedScore,
            status,
            gradeType: gradeType || 'regular',
            plantelId: plantelId || null,
            date: dateOnly,
            createdBy: userId,
          }, { transaction: t });
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
