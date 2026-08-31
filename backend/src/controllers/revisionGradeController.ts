import { Request, Response } from 'express';
import { Op } from 'sequelize';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
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
            isAbsent: (r as any).isAbsent || false,
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
      return res.status(404).json({ message: 'No hay período de revisión' });
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
          isAbsent: r.isAbsent || false,
        })),
      });
    }

    return res.json({
      periodGradeSubjectId,
      subjectName: (pgs as any).subject?.name || '',
      passingGrade: revisionPeriod.passingGrade,
      maxOpportunities: revisionPeriod.maxOpportunities,
      currentOpportunity: revisionPeriod.currentOpportunity,
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
      return res.status(404).json({ message: 'No hay período de revisión' });
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
    // earlier than a lower opportunity, and no two opportunities can share
    // the same date.
    const sorted = [...dates].filter(d => d.date).sort((a, b) => a.opportunity - b.opportunity);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].date! < sorted[i - 1].date!) {
        return res.status(400).json({
          message: `La Oportunidad ${sorted[i].opportunity} (${sorted[i].date}) no puede ser anterior a la Oportunidad ${sorted[i - 1].opportunity} (${sorted[i - 1].date})`,
        });
      }
      if (sorted[i].date === sorted[i - 1].date) {
        return res.status(400).json({
          message: `La Oportunidad ${sorted[i].opportunity} y la Oportunidad ${sorted[i - 1].opportunity} no pueden tener la misma fecha (${sorted[i].date})`,
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
      return res.status(404).json({ message: 'No hay período de revisión' });
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

// ── Export repair Excel ────────────────────────────────────────────

export const exportRepairExcel = async (req: Request, res: Response) => {
  try {
    const periodGradeSubjectId = Number(req.params.periodGradeSubjectId);
    const sectionId = Number(req.query.sectionId);
    if (!periodGradeSubjectId || !sectionId) {
      return res.status(400).json({ message: 'periodGradeSubjectId y sectionId son requeridos' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) return res.status(404).json({ message: 'No hay un período activo' });

    const revisionPeriod = await RevisionPeriod.findOne({ where: { schoolPeriodId: activePeriod.id } });
    if (!revisionPeriod) return res.status(404).json({ message: 'No hay período de revisión' });

    const pgs = await PeriodGradeSubject.findByPk(periodGradeSubjectId, {
      include: [
        { model: Subject, as: 'subject' },
        { model: PeriodGrade, as: 'periodGrade', include: [{ model: Grade, as: 'grade' }, { model: SchoolPeriod, as: 'schoolPeriod' }] },
      ],
    });
    if (!pgs) return res.status(404).json({ message: 'Asignación no encontrada' });

    const section = await Section.findByPk(sectionId);
    if (!section) return res.status(404).json({ message: 'Sección no encontrada' });

    // Find teacher assignment for this pgs+section
    const teacherAssignment = await TeacherAssignment.findOne({
      where: { periodGradeSubjectId, sectionId },
      include: [{ association: 'teacher' }],
    });

    // Get revision entries — same filter as getMyRevisionAssignmentDetail
    const pgsGradeId = (pgs as any).periodGrade?.gradeId;
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
            { model: Subject, as: 'subject', where: { id: (pgs as any).subject?.id } },
            {
              model: Inscription,
              as: 'inscription',
              where: {
                schoolPeriodId: activePeriod.id,
                sectionId,
                ...(pgsGradeId ? { gradeId: pgsGradeId } : {}),
              },
              include: [{ association: 'student' }],
            },
          ],
        },
      ],
      order: [['inscriptionSubjectId', 'ASC'], ['opportunity', 'ASC']],
    });

    // Group by student
    const studentMap = new Map<number, {
      studentName: string;
      document: string;
      revisions: Map<number, { id: number; score: number | null; status: string; isAbsent: boolean }>;
    }>();

    for (const rev of revisionEntries) {
      const insSub = (rev as any).inscriptionSubject;
      const ins = insSub?.inscription;
      const studentId = ins?.personId;
      if (!studentId) continue;

      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          studentName: ins?.student ? `${ins.student.lastName || ''} ${ins.student.firstName || ''}`.trim() : '',
          document: ins?.student?.document || '',
          revisions: new Map(),
        });
      }
      studentMap.get(studentId)!.revisions.set(rev.opportunity, {
        id: rev.id,
        score: rev.score,
        status: rev.status,
        isAbsent: (rev as any).isAbsent || false,
      });
    }

    // Get opportunity dates
    const oppDates = await RevisionOpportunityDate.findAll({
      where: { revisionPeriodId: revisionPeriod.id, periodGradeSubjectId, sectionId },
      order: [['opportunity', 'ASC']],
    });
    const dateMap = new Map<number, string | null>();
    oppDates.forEach((d: any) => dateMap.set(d.opportunity, d.date));

    const formatDate = (value: string | null | undefined) => {
      if (!value) return '';
      const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
    };

    const maxOpp = revisionPeriod.maxOpportunities;
    const students = Array.from(studentMap.entries()).sort((a, b) =>
      a[1].studentName.localeCompare(b[1].studentName, 'es')
    );

    // Build workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Revisión');

    const logoPath = path.resolve(process.cwd(), 'public', 'uploads', 'images', 'Logo_ME_Batalla_H.png');
    const logoId = fs.existsSync(logoPath)
      ? workbook.addImage({ filename: logoPath, extension: 'png' })
      : null;

    const border = { style: 'thin' as const, color: { argb: 'FF666666' } };
    const outerBorder = { style: 'medium' as const, color: { argb: 'FF000000' } };
    const headerFill = 'FFD9E2F3';
    const evaluationHeaderFill = 'FFF2F2F2';

    // Columns: #, Cédula, Estudiante, Oport.1..N, Resultado
    const fixedCols: [string, number][] = [['#', 4], ['CÉDULA', 14], ['ESTUDIANTE', 30]];
    const oppCols: [string, number][] = Array.from({ length: maxOpp }, (_, i) => [`OPORT. ${i + 1}`, 12] as [string, number]);
    const resultCol: [string, number] = ['RESULTADO', 14];
    const allCols = [...fixedCols, ...oppCols, resultCol];
    const totalCols = allCols.length;

    allCols.forEach(([name, width], index) => { sheet.getColumn(index + 1).width = width; });

    const lastColLetter = String.fromCharCode(64 + totalCols);

    // Row heights
    sheet.getRow(1).height = 95.25;
    sheet.getRow(2).height = 24.75;
    sheet.getRow(3).height = 16;
    sheet.getRow(4).height = 24.75;
    sheet.getRow(5).height = 24.75;
    sheet.getRow(6).height = 24.75;
    sheet.getRow(7).height = 30;

    // Logo
    sheet.mergeCells('A1:D1');
    if (logoId !== null) {
      sheet.addImage(logoId, {
        tl: { col: 0.238125, row: 0.06 },
        ext: { width: 120 * (1140 / 185), height: 120 },
        editAs: 'absolute',
      });
    }

    // Title
    sheet.mergeCells(`A2:${lastColLetter}2`);
    sheet.getCell('A2').value = 'REPARACIÓN DE MATERIAS';
    sheet.getCell('A2').font = { bold: true, size: 16 };
    sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.getCell('A3').value = 'PEIC: ________________________';
    sheet.getCell('B3').value = 'PA: ________________________';
    sheet.getCell('A3').font = { size: 9 };
    sheet.getCell('B3').font = { size: 9 };

    // Period info
    sheet.mergeCells('A4:C4');
    sheet.mergeCells(`D4:${lastColLetter}4`);
    sheet.getCell('A4').value = 'Período de Revisión';
    sheet.getCell('A4').font = { bold: true, size: 14 };
    sheet.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle' };
    const periodName = String((pgs as any).periodGrade?.schoolPeriod?.name || '');
    const schoolYear = periodName.match(/\d{4}\s*-\s*\d{4}/)?.[0] || periodName;
    sheet.getCell('D4').value = `Año Escolar: ${schoolYear}`;
    sheet.getCell('D4').font = { bold: true, size: 14 };
    sheet.getCell('D4').alignment = { horizontal: 'right', vertical: 'middle' };

    // Teacher
    const sectionName = String(section.name || '').replace(/^Secci[oó]n\s*/i, '');
    sheet.getCell('A5').value = 'Profesor:';
    sheet.getCell('A5').font = { size: 14 };
    sheet.mergeCells(`B5:${lastColLetter}5`);
    const teacher = (teacherAssignment as any)?.teacher;
    sheet.getCell('B5').value = teacher ? `${teacher.firstName} ${teacher.lastName}` : '—';
    sheet.getCell('B5').font = { bold: true, size: 14 };
    sheet.getCell('B5').alignment = { horizontal: 'left', vertical: 'middle' };

    // Subject + grade + section
    sheet.getCell('A6').value = 'Área de Formación:';
    sheet.getCell('A6').font = { size: 14 };
    sheet.mergeCells('B6:C6');
    sheet.getCell('B6').value = (pgs as any).subject?.name || '';
    sheet.getCell('B6').font = { bold: true, size: 14 };
    sheet.getCell('B6').alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.mergeCells(`D6:${lastColLetter}6`);
    const gradeName = (pgs as any).periodGrade?.grade?.name || '';
    sheet.getCell('D6').value = `${gradeName}${sectionName ? `, sección ${sectionName}` : ''}`;
    sheet.getCell('D6').font = { bold: true, size: 14 };
    sheet.getCell('D6').alignment = { horizontal: 'left', vertical: 'middle' };

    // Header row (row 7) — two sub-rows: opportunity name + date
    for (let col = 0; col < totalCols; col++) {
      const cell = sheet.getCell(7, col + 1);
      cell.value = allCols[col][0];
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: col >= fixedCols.length && col < totalCols - 1 ? evaluationHeaderFill : headerFill },
      };
      cell.border = { top: border, bottom: border, left: border, right: border };
    }

    // Row 8: dates under opportunity columns
    for (let col = 0; col < totalCols; col++) {
      const cell = sheet.getCell(8, col + 1);
      const oppNum = col - fixedCols.length + 1;
      if (oppNum >= 1 && oppNum <= maxOpp) {
        cell.value = formatDate(dateMap.get(oppNum) || null);
      }
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: col >= fixedCols.length && col < totalCols - 1 ? evaluationHeaderFill : headerFill },
      };
      cell.border = { top: border, bottom: border, left: border, right: border };
    }
    sheet.getRow(8).height = 16;

    // Data rows
    const startDataRow = 9;
    students.forEach(([studentId, data], index) => {
      const row = sheet.getRow(startDataRow + index);
      row.height = 18;

      // #
      row.getCell(1).value = index + 1;
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(1).font = { size: 10, bold: true };

      // Cédula
      row.getCell(2).value = data.document;
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).font = { size: 10 };

      // Estudiante
      row.getCell(3).value = data.studentName;
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).font = { size: 10 };

      // Opportunities
      const hasApproved = Array.from(data.revisions.values()).some(r => r.status === 'approved');
      const allFailed = data.revisions.size > 0 && Array.from(data.revisions.values()).every(r => r.status === 'failed');
      const resultStatus = hasApproved ? 'Aprobado' : allFailed ? 'Reprobado' : 'Pendiente';

      for (let opp = 1; opp <= maxOpp; opp++) {
        const col = fixedCols.length + opp;
        const rev = data.revisions.get(opp);
        const cell = row.getCell(col);
        if (rev && rev.isAbsent) {
          cell.value = 'I';
          cell.font = { size: 10, color: { argb: 'FFDC2626' }, bold: true };
        } else {
          cell.value = rev && rev.score != null ? Number(rev.score) : '';
          cell.font = { size: 10 };
          if (rev && rev.score != null && Number(rev.score) < revisionPeriod.passingGrade) {
            cell.font = { size: 10, color: { argb: 'FFDC2626' }, bold: true };
          }
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // Result
      const resultCell = row.getCell(totalCols);
      resultCell.value = resultStatus;
      resultCell.alignment = { horizontal: 'center', vertical: 'middle' };
      resultCell.font = { size: 10, bold: true };
      if (resultStatus === 'Aprobado') {
        resultCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } };
      } else if (resultStatus === 'Reprobado') {
        resultCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
      }

      // Borders
      for (let col = 1; col <= totalCols; col++) {
        const cell = row.getCell(col);
        cell.border = {
          top: border,
          bottom: border,
          left: col === 1 ? outerBorder : border,
          right: col === totalCols ? outerBorder : border,
        };
      }
    });

    // Outer borders for header
    for (let rowIndex = 7; rowIndex <= 8; rowIndex++) {
      for (let colIndex = 1; colIndex <= totalCols; colIndex++) {
        const cell = sheet.getCell(rowIndex, colIndex);
        cell.border = {
          ...cell.border,
          left: colIndex === 1 ? outerBorder : cell.border?.left,
          right: colIndex === totalCols ? outerBorder : cell.border?.right,
          top: rowIndex === 7 ? outerBorder : cell.border?.top,
        };
      }
    }

    // Bottom outer border
    const lastRow = startDataRow + Math.max(students.length - 1, 0);
    for (let colIndex = 1; colIndex <= totalCols; colIndex++) {
      const cell = sheet.getCell(lastRow, colIndex);
      cell.border = { ...cell.border, bottom: outerBorder };
    }

    // Page setup
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    sheet.pageSetup.horizontalCentered = true;
    sheet.headerFooter.oddFooter = 'Página &P de &N';

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reparacion-${periodGradeSubjectId}-${sectionId}.xlsx"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('[exportRepairExcel] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al generar Excel de revisión' });
  }
};
