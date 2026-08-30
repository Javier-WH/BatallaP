import { Request, Response } from 'express';
import { Op } from 'sequelize';
import {
  Grade,
  Inscription,
  InscriptionSubject,
  InscriptionSubjectRevision,
  PeriodGrade,
  PeriodGradeSubject,
  RevisionOpportunityDate,
  RevisionPeriod,
  RevisionThematicSelection,
  SchoolPeriod,
  Section,
  Subject,
  TeacherAssignment,
  Term,
  ThematicComponent,
} from '@/models/index';

export const getMyRevisionAssignments = async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.user?.id;
    const personId = (req.session as any)?.user?.personId;
    if (!personId) {
      return res.status(400).json({ message: 'Perfil de profesor no encontrado' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
      return res.status(404).json({ message: 'No hay un período activo' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId: activePeriod.id },
    });
    if (!revisionPeriod) {
      return res.json({ assignments: [] });
    }

    // Find teacher's assignments
    const assignments = await TeacherAssignment.findAll({
      where: { teacherId: personId },
      include: [
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject',
          include: [
            { model: Subject, as: 'subject' },
            {
              model: PeriodGrade,
              as: 'periodGrade',
              include: [{ model: Grade, as: 'grade' }],
            },
          ],
        },
        { model: Section, as: 'section' },
      ],
    });

    const result = [];
    const processedAssignments = new Set<string>();
    for (const assign of assignments) {
      const pgs = (assign as any).periodGradeSubject;
      if (!pgs || !pgs.subject) continue;

      // A teacher may hold repeated assignment rows for the same subject and
      // section. Emit a single option per subject + section pair.
      const assignmentKey = `${pgs.id}-${assign.sectionId}`;
      if (processedAssignments.has(assignmentKey)) continue;
      processedAssignments.add(assignmentKey);

      // Find revision entries for this subject via InscriptionSubjectRevision
      const revisionEntries = await InscriptionSubjectRevision.findAll({
        where: {
          revisionPeriodId: revisionPeriod.id,
          opportunity: { [Op.lte]: revisionPeriod.maxOpportunities },
        },
        include: [
          {
            model: InscriptionSubject,
            as: 'inscriptionSubject',
            required: true,
            include: [
              {
                model: Subject,
                as: 'subject',
                where: { id: pgs.subject.id },
              },
              {
                model: Inscription,
                as: 'inscription',
                where: {
                  schoolPeriodId: activePeriod.id,
                  sectionId: assign.sectionId,
                },
                include: [{ association: 'student' }],
              },
            ],
          },
        ],
      });

      if (revisionEntries.length === 0) continue;

      // Group revisions by inscriptionSubjectId
      const groupedMap = new Map<number, typeof revisionEntries>();
      for (const rev of revisionEntries) {
        if (!groupedMap.has(rev.inscriptionSubjectId)) {
          groupedMap.set(rev.inscriptionSubjectId, []);
        }
        groupedMap.get(rev.inscriptionSubjectId)!.push(rev);
      }

      const students = [];
      for (const [insSubId, revs] of groupedMap) {
        const firstRev = revs[0];
        const insSub = (firstRev as any).inscriptionSubject;
        const ins = insSub?.inscription;

        students.push({
          inscriptionSubjectId: insSubId,
          studentId: ins?.personId,
          studentName: ins?.student
            ? `${ins.student.lastName || ''} ${ins.student.firstName || ''}`.trim()
            : '',
          document: ins?.student?.document || '',
          originalScore: null,
          maxOpportunities: revisionPeriod.maxOpportunities,
          revisions: revs.map(r => ({
            id: r.id,
            opportunity: r.opportunity,
            score: r.score,
            status: r.status,
          })),
        });
      }

      result.push({
        periodGradeSubjectId: pgs.id,
        subjectName: pgs.subject.name,
        gradeName: (pgs as any).periodGrade?.grade?.name || '',
        sectionName: (assign as any).section?.name || '',
        sectionId: assign.sectionId,
        students,
      });
    }

    return res.json({ assignments: result });
  } catch (error: any) {
    console.error('[getMyRevisionAssignments] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener asignaciones' });
  }
};

export const getMyRevisionAssignmentDetail = async (req: Request, res: Response) => {
  try {
    const periodGradeSubjectId = parseInt(req.params.periodGradeSubjectId, 10);
    if (!periodGradeSubjectId) {
      return res.status(400).json({ message: 'periodGradeSubjectId es obligatorio' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
      return res.status(404).json({ message: 'No hay un período activo' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId: activePeriod.id },
    });
    if (!revisionPeriod) {
      return res.status(404).json({ message: 'No hay período de reparación' });
    }

    const pgs = await PeriodGradeSubject.findByPk(periodGradeSubjectId, {
      include: [
        { model: Subject, as: 'subject' },
        { model: PeriodGrade, as: 'periodGrade' },
      ],
    });
    if (!pgs) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }

    const pgsGradeId = (pgs as any).periodGrade?.gradeId;
    const sectionId = parseInt(req.query.sectionId as string, 10) || null;

    const revisionEntries = await InscriptionSubjectRevision.findAll({
      where: {
        revisionPeriodId: revisionPeriod.id,
        opportunity: { [Op.lte]: revisionPeriod.maxOpportunities },
      },
      include: [
        {
          model: InscriptionSubject,
          as: 'inscriptionSubject',
          required: true,
          include: [
            {
              model: Subject,
              as: 'subject',
              where: { id: (pgs as any).subject?.id },
            },
            {
              model: Inscription,
              as: 'inscription',
              where: {
                schoolPeriodId: activePeriod.id,
                ...(pgsGradeId ? { gradeId: pgsGradeId } : {}),
                ...(sectionId ? { sectionId } : {}),
              },
              include: [
                { association: 'student' },
                { association: 'grade' },
                { association: 'section' },
              ],
            },
          ],
        },
      ],
      order: [['inscriptionSubjectId', 'ASC'], ['opportunity', 'ASC']],
    });

    // Group revisions by inscriptionSubjectId
    const groupedMap = new Map<number, any[]>();
    for (const rev of revisionEntries) {
      if (!groupedMap.has(rev.inscriptionSubjectId)) {
        groupedMap.set(rev.inscriptionSubjectId, []);
      }
      groupedMap.get(rev.inscriptionSubjectId)!.push(rev);
    }

    const students = [];
    for (const [insSubId, revs] of groupedMap) {
      const firstRev = revs[0];
      const insSub = (firstRev as any).inscriptionSubject;
      const ins = insSub?.inscription;

      students.push({
        inscriptionSubjectId: insSubId,
        studentId: ins?.personId,
        studentName: ins?.student
          ? `${ins.student.lastName || ''} ${ins.student.firstName || ''}`.trim()
          : '',
        document: ins?.student?.document || '',
        documentType: ins?.student?.documentType || '',
        grade: ins?.grade?.name || '',
        section: ins?.section?.name || '',
        originalScore: null,
        maxOpportunities: revisionPeriod.maxOpportunities,
        revisions: revs.map((r: any) => ({
          id: r.id,
          opportunity: r.opportunity,
          score: r.score,
          status: r.status,
        })),
      });
    }

    return res.json({
      periodGradeSubjectId,
      subjectName: (pgs as any).subject?.name || '',
      passingGrade: revisionPeriod.passingGrade,
      maxOpportunities: revisionPeriod.maxOpportunities,
      students,
    });
  } catch (error: any) {
    console.error('[getMyRevisionAssignmentDetail] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener detalle' });
  }
};

// ── Thematic selection for repair (per subject+section) ──────────

/**
 * Get the thematic components available for a PeriodGradeSubject (across all
 * terms of the active school period) plus any saved selection for the given
 * section.
 */
export const getRevisionThematicSelection = async (req: Request, res: Response) => {
  try {
    const periodGradeSubjectId = parseInt(req.query.pgsId as string, 10);
    const sectionId = parseInt(req.query.sectionId as string, 10);
    if (!periodGradeSubjectId || !sectionId) {
      return res.status(400).json({ message: 'pgsId y sectionId son requeridos' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
      return res.status(404).json({ message: 'No hay un período activo' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId: activePeriod.id },
    });

    // Load all thematic components for this pgs across all terms of the period
    const terms = await Term.findAll({ where: { schoolPeriodId: activePeriod.id } });
    const termIds = terms.map(t => t.id);

    const components = await ThematicComponent.findAll({
      where: {
        periodGradeSubjectId,
        termId: { [Op.in]: termIds },
      },
      include: [{ association: 'contents' }],
      order: [['termId', 'ASC'], ['order', 'ASC'], ['id', 'ASC']],
    });

    // Load saved selection
    let savedSelection: number[] | null = null;
    if (revisionPeriod) {
      const sel = await RevisionThematicSelection.findOne({
        where: {
          revisionPeriodId: revisionPeriod.id,
          periodGradeSubjectId,
          sectionId,
        },
      });
      savedSelection = sel?.thematicComponentIds ?? null;
    }

    return res.json({
      components: components.map((c: any) => ({
        id: c.id,
        title: c.title,
        termId: c.termId,
        order: c.order,
        contents: (c.contents || []).map((ct: any) => ({ id: ct.id, title: ct.title })),
      })),
      selectedComponentIds: savedSelection,
    });
  } catch (error: any) {
    console.error('[getRevisionThematicSelection] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener selección temática' });
  }
};

/**
 * Save the thematic component selection for a subject+section within the
 * active revision period.
 */
export const saveRevisionThematicSelection = async (req: Request, res: Response) => {
  try {
    const { periodGradeSubjectId, sectionId, thematicComponentIds } = req.body;
    if (!periodGradeSubjectId || !sectionId) {
      return res.status(400).json({ message: 'periodGradeSubjectId y sectionId son requeridos' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
      return res.status(404).json({ message: 'No hay un período activo' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId: activePeriod.id },
    });
    if (!revisionPeriod) {
      return res.status(404).json({ message: 'No hay período de reparación' });
    }

    const [selection, created] = await RevisionThematicSelection.findOrCreate({
      where: {
        revisionPeriodId: revisionPeriod.id,
        periodGradeSubjectId,
        sectionId,
      },
      defaults: {
        revisionPeriodId: revisionPeriod.id,
        periodGradeSubjectId,
        sectionId,
        thematicComponentIds: thematicComponentIds || null,
      },
    });

    if (!created) {
      await selection.update({ thematicComponentIds: thematicComponentIds || null });
    }

    return res.json({ message: 'Selección guardada', selection });
  } catch (error: any) {
    console.error('[saveRevisionThematicSelection] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al guardar selección temática' });
  }
};

// ── Opportunity dates (per subject+section within a revision period) ──────

/**
 * Get the scheduled dates for each opportunity of a subject+section within
 * the active revision period.
 */
export const getRevisionOpportunityDates = async (req: Request, res: Response) => {
  try {
    const periodGradeSubjectId = parseInt(req.query.pgsId as string, 10);
    const sectionId = parseInt(req.query.sectionId as string, 10);
    if (!periodGradeSubjectId || !sectionId) {
      return res.status(400).json({ message: 'pgsId y sectionId son requeridos' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
      return res.status(404).json({ message: 'No hay un período activo' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId: activePeriod.id },
    });
    if (!revisionPeriod) {
      return res.json({ dates: [] });
    }

    const rows = await RevisionOpportunityDate.findAll({
      where: {
        revisionPeriodId: revisionPeriod.id,
        periodGradeSubjectId,
        sectionId,
      },
      order: [['opportunity', 'ASC']],
    });

    return res.json({
      dates: rows.map((r: any) => ({ opportunity: r.opportunity, date: r.date })),
    });
  } catch (error: any) {
    console.error('[getRevisionOpportunityDates] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener fechas' });
  }
};

/**
 * Save (upsert) the scheduled dates for each opportunity of a subject+section
 * within the active revision period.
 */
export const saveRevisionOpportunityDates = async (req: Request, res: Response) => {
  try {
    const { periodGradeSubjectId, sectionId, dates } = req.body as {
      periodGradeSubjectId: number;
      sectionId: number;
      dates: Array<{ opportunity: number; date: string | null }>;
    };
    if (!periodGradeSubjectId || !sectionId) {
      return res.status(400).json({ message: 'periodGradeSubjectId y sectionId son requeridos' });
    }
    if (!Array.isArray(dates)) {
      return res.status(400).json({ message: 'dates debe ser un arreglo' });
    }

    // Validate chronological order: a higher opportunity cannot have a date
    // earlier than a lower opportunity.
    const sorted = [...dates].filter(d => d.date).sort((a, b) => a.opportunity - b.opportunity);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].date! < sorted[i - 1].date!) {
        return res.status(400).json({
          message: `La Oportunidad ${sorted[i].opportunity} (${sorted[i].date}) no puede ser anterior a la Oportunidad ${sorted[i - 1].opportunity} (${sorted[i - 1].date})`,
        });
      }
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
      return res.status(404).json({ message: 'No hay un período activo' });
    }

    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId: activePeriod.id },
    });
    if (!revisionPeriod) {
      return res.status(404).json({ message: 'No hay período de reparación' });
    }

    for (const { opportunity, date } of dates) {
      const [row, created] = await RevisionOpportunityDate.findOrCreate({
        where: {
          revisionPeriodId: revisionPeriod.id,
          periodGradeSubjectId,
          sectionId,
          opportunity,
        },
        defaults: {
          revisionPeriodId: revisionPeriod.id,
          periodGradeSubjectId,
          sectionId,
          opportunity,
          date: date || null,
        },
      });
      if (!created) {
        await row.update({ date: date || null });
      }
    }

    return res.json({ message: 'Fechas guardadas' });
  } catch (error: any) {
    console.error('[saveRevisionOpportunityDates] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al guardar fechas' });
  }
};
