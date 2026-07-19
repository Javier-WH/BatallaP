import { Request, Response } from 'express';
import { Op } from 'sequelize';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import {
  Inscription,
  Person,
  PersonResidence,
  InscriptionSubject,
  Subject,
  SubjectFinalGrade,
  SubjectGroup,
  PeriodGrade,
  PeriodGradeSubject,
  Term,
  Qualification,
  EvaluationPlan,
  CouncilPoint,
  SchoolPeriod,
  Grade,
  Section,
  Setting,
  Plantel,
} from '@/models/index';
import {
  getSubjectOrderMap,
  sortSubjectsByOrder,
} from '@/services/subjectOrderService';
import { readTemplateNamedRanges, TemplateNamedRanges } from '@/services/templateNamedRanges';

const gradeOrderToSheetName: Record<number, string> = {
  1: '1er Año',
  2: '1er Año',
  3: '3er Año',
  4: '4to Año',
  5: '5to Año',
};

const stateAbbreviations: Record<string, string> = {
  'GUARICO': 'GU',
  'MIRANDA': 'MI',
  'CARABOBO': 'CA',
  'ZULIA': 'ZU',
  'ARAGUA': 'AR',
  'BARINAS': 'BA',
  'BOLIVAR': 'BO',
  'COJEDES': 'CO',
  'PORTUGUESA': 'PO',
  'LARA': 'LA',
  'YARACUY': 'YA',
  'FALCON': 'FA',
  'VARGAS': 'VA',
  'MERIDA': 'ME',
  'TRUJILLO': 'TR',
  'TACHIRA': 'TA',
  'APURE': 'AP',
  'GUAIRA': 'GU',
  'NUEVA ESPARTA': 'NE',
  'SUCRE': 'SU',
  'ANZOATEGUI': 'AN',
  'MONAGAS': 'MO',
  'DELTA AMACURO': 'DA',
  'AMAZONAS': 'AM',
  'DISTRITO CAPITAL': 'DC',
  'DEPENDENCIAS FEDERALES': 'DF',
};

function getStateAbbrev(stateName: string): string {
  if (!stateName) return '';
  const upper = stateName.toUpperCase().trim();
  return stateAbbreviations[upper] || upper.substring(0, 2);
}

function padNumber(n: number | null | undefined): number | string | null {
  if (n == null) return null;
  if (n < 0) return n;
  if (n < 10) return '0' + n;
  return n;
}

function numericToLetter(numericGrade: number, letterGrades: { letter: string; max: number }[]): string {
  if (!letterGrades || letterGrades.length === 0) return String(numericGrade);
  const sorted = [...letterGrades].sort((a, b) => b.max - a.max);
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (!next) return numericGrade <= current.max ? current.letter : String(numericGrade);
    if (numericGrade > next.max && numericGrade <= current.max) return current.letter;
  }
  return String(numericGrade);
}

async function getInstitutionSettings(): Promise<Record<string, string>> {
  const settings = await Setting.findAll();
  const map: Record<string, string> = {};
  settings.forEach((s: any) => { map[s.key] = s.value; });
  return map;
}

const MAX_STUDENTS_PER_SHEET = 35;

function cloneWorksheet(workbook: ExcelJS.Workbook, sourceSheet: ExcelJS.Worksheet, newName: string): ExcelJS.Worksheet {
  const newSheet = workbook.addWorksheet(newName, {
    properties: sourceSheet.model.properties,
    views: sourceSheet.model.views,
  });

  // Copy column widths
  if (sourceSheet.columns) {
    sourceSheet.columns.forEach((col, idx) => {
      if (col && col.width != null) {
        newSheet.getColumn(idx + 1).width = col.width;
      }
    });
  }

  // Copy cell values, styles and row heights
  sourceSheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const newCell = newSheet.getRow(rowNum).getCell(colNumber);
      newCell.value = cell.value;
      if (cell.style) {
        newCell.style = JSON.parse(JSON.stringify(cell.style));
      }
      if (cell.numFmt) {
        newCell.numFmt = cell.numFmt;
      }
      if (cell.font) {
        newCell.font = JSON.parse(JSON.stringify(cell.font));
      }
      if (cell.alignment) {
        newCell.alignment = JSON.parse(JSON.stringify(cell.alignment));
      }
      if (cell.border) {
        newCell.border = JSON.parse(JSON.stringify(cell.border));
      }
      if (cell.fill) {
        newCell.fill = JSON.parse(JSON.stringify(cell.fill));
      }
    });
    if (row.height != null) {
      newSheet.getRow(rowNum).height = row.height;
    }
  });

  // Copy merged cell ranges
  if (sourceSheet.model.merges) {
    sourceSheet.model.merges.forEach((merge: string) => {
      newSheet.mergeCells(merge);
    });
  }

  // Copy page setup and print options if present
  if (sourceSheet.pageSetup) {
    newSheet.pageSetup = JSON.parse(JSON.stringify(sourceSheet.pageSetup));
  }

  return newSheet;
}

function fillSheetByNamedRanges(
  sheet: ExcelJS.Worksheet,
  sheetName: string,
  namedRanges: TemplateNamedRanges,
  settings: Record<string, string>,
  plantel: any,
  period: any,
  students: any[],
  academicSubjects: any[],
  groupedSubjectIds: Set<number>,
  subjectColList: { col: number; abbr: string }[],
  subjectToSubjIndex: Map<number, number>,
  calculateFinalScore: (insSub: any) => number | null,
  subjectOrderMap: Map<number, number>,
  studentOffset: number,
  sourceSheetName?: string,
  gradeName?: string,
  sectionName?: string,
  letterGradesConfig?: { letter: string; max: number }[],
): void {
  // Only writes when value is non-empty. Empty/undefined values leave the
  // cell untouched, preserving the template's decorative content (e.g. "***"
  // placeholders) for unused student rows.
  // For cloned pages (e.g. "1er Año (Regulares 2)"), the named ranges are
  // registered for the original sheet (e.g. "1er Año"), so we look up
  // coordinates by the original sheet's name and write to the same absolute
  // coordinates in the destination sheet.
  const lookupSheetName = sourceSheetName || sheetName;
  const setByRange = (name: string, value: any) => {
    if (value === undefined || value === null || value === '') return;
    let ref = namedRanges.getCell(lookupSheetName, name);
    if (!ref) {
      for (const sn of namedRanges.bySheet.keys()) {
        ref = namedRanges.getCell(sn, name);
        if (ref) break;
      }
    }
    if (ref) {
      sheet.getCell(ref.cell).value = value;
    }
  };

  const lowestLetter = (() => {
    if (!letterGradesConfig || letterGradesConfig.length === 0) return '';
    const sorted = [...letterGradesConfig].sort((a, b) => a.max - b.max);
    return sorted[0].letter;
  })();

  setByRange('inst_period', period?.name);
  setByRange('inst_code', settings.institution_dea_code || plantel?.code);
  setByRange('inst_education_code', settings.institution_code);
  setByRange('inst_level', settings.institution_level);
  setByRange('inst_name', settings.institution_name || plantel?.name);
  setByRange('inst_address', settings.institution_address);
  setByRange('inst_phone', settings.institution_phone);
  setByRange('inst_municipality', settings.institution_municipality || plantel?.municipality);
  setByRange('inst_state', plantel?.state);
  setByRange('inst_cdcee', settings.institution_cdcee);
  setByRange('inst_director', settings.director_name);
  setByRange('inst_director_doc', settings.director_document);
  setByRange('inst_grade', gradeName);
  setByRange('inst_section', sectionName);

  for (let n = 1; n <= MAX_STUDENTS_PER_SHEET; n++) {
    const studentIdx = studentOffset + (n - 1);
    const ins = students[studentIdx];

    // If no student for this row, do nothing — keep the template's placeholder
    // (e.g. "***") intact.
    if (!ins) continue;

    const student = ins.student;
    const residence = student?.residence;

    setByRange('std_num_' + n, String(studentIdx + 1).padStart(2, '0'));

    const docType = student?.documentType === 'Venezolano' ? 'V' :
                    student?.documentType === 'Extranjero' ? 'E' :
                    student?.documentType === 'Pasaporte' ? 'P' : 'V';
    setByRange('std_doc_' + n, docType + ' ' + (student?.document || ''));
    setByRange('std_ln_' + n, student?.lastName);
    setByRange('std_fn_' + n, student?.firstName);
    setByRange('std_bp_' + n, residence?.birthMunicipality);
    setByRange('std_ef_' + n, getStateAbbrev(residence?.birthState || ''));
    setByRange('std_sx_' + n, student?.gender);

    if (student?.birthdate) {
      const birthDate = new Date(student.birthdate);
      setByRange('std_bd_' + n, padNumber(birthDate.getDate()));
      setByRange('std_bm_' + n, padNumber(birthDate.getMonth() + 1));
      setByRange('std_by_' + n, padNumber(birthDate.getFullYear() % 100));
    }

    const insSubjects = sortSubjectsByOrder(
      ins.inscriptionSubjects || [],
      (is: any) => is.subjectId,
      (is: any) => is.subject?.name,
      subjectOrderMap
    );

    for (let i = 0; i < subjectColList.length; i++) {
      const subjId = subjectToSubjIndex.get(i + 1);
      if (!subjId) continue;
      const insSub = insSubjects.find((is: any) => is.subjectId === subjId);
      const score = insSub ? calculateFinalScore(insSub) : null;
      const col = subjectColList[i].col;
      const row = 15 + n;
      const isLiteral = insSub?.subject?.usesLiteralGrades ?? academicSubjects.find((s: any) => s.id === subjId)?.usesLiteralGrades;
      if (isLiteral) {
        if (score != null) {
          sheet.getRow(row).getCell(col).value = numericToLetter(score, letterGradesConfig || []);
        } else if (lowestLetter) {
          sheet.getRow(row).getCell(col).value = lowestLetter;
        }
      } else if (score != null) {
        sheet.getRow(row).getCell(col).value = padNumber(score);
      }
    }

    const groupedInsSub = insSubjects.find((is: any) =>
      groupedSubjectIds.has(is.subjectId)
    );
    if (groupedInsSub?.subject?.name) {
      setByRange('std_part_' + n, groupedInsSub.subject.name);
    }
  }
}

export const exportPerformanceSummary = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, gradeId, sectionId, template } = req.query;

    // Validate the three required identifiers. They must be numeric strings
    // (positive integers) so the rest of the pipeline can safely Number()
    // them without producing NaN.
    const numericFields: Array<[string, unknown]> = [
      ['schoolPeriodId', schoolPeriodId],
      ['gradeId', gradeId],
      ['sectionId', sectionId],
    ];
    for (const [name, raw] of numericFields) {
      if (raw === undefined || raw === null || raw === '') {
        return res.status(400).json({ message: `${name} es requerido` });
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
        return res.status(400).json({ message: `${name} debe ser un número entero positivo` });
      }
    }

    const period = await SchoolPeriod.findByPk(Number(schoolPeriodId));
    if (!period) return res.status(404).json({ message: 'Periodo no encontrado' });

    const grade = await Grade.findByPk(Number(gradeId));
    if (!grade) return res.status(404).json({ message: 'Grado no encontrado' });

    const section = await Section.findByPk(Number(sectionId));
    if (!section) return res.status(404).json({ message: 'Seccion no encontrada' });

    const gradeOrder = grade.order || 1;
    const sheetName = gradeOrderToSheetName[gradeOrder] || '1er Año';

    const pg = await PeriodGrade.findOne({
      where: { schoolPeriodId: Number(schoolPeriodId), gradeId: Number(gradeId) },
    });

    if (!pg) return res.status(404).json({ message: 'Estructura academica no encontrada' });

    const terms = await Term.findAll({
      where: { schoolPeriodId: Number(schoolPeriodId) },
      raw: true,
    });
    const termCount = terms.length || 1;

    const settings = await getInstitutionSettings();

    const letterGradesConfig: { letter: string; max: number }[] = (() => {
      try {
        const raw = settings.letter_grades;
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return parsed.scale || parsed || [];
      } catch { return []; }
    })();

    let plantel: any = null;
    if (settings.institution_dea_code) {
      plantel = await Plantel.findOne({ where: { code: settings.institution_dea_code } });
    }

    const inscriptions = await Inscription.findAll({
      where: {
        schoolPeriodId: Number(schoolPeriodId),
        sectionId: Number(sectionId),
        gradeId: Number(gradeId),
      },
      include: [
        {
          model: Person,
          as: 'student',
          include: [
            { model: PersonResidence, as: 'residence' },
          ],
        },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            { model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] },
            { model: SubjectFinalGrade, as: 'finalGrade', required: false },
            { model: Qualification, as: 'qualifications', include: [{ model: EvaluationPlan, as: 'evaluationPlan' }], required: false },
            { model: CouncilPoint, as: 'councilPoints', required: false },
          ],
        },
      ],
      order: [
        [{ model: Person, as: 'student' }, 'lastName', 'ASC'],
        [{ model: Person, as: 'student' }, 'firstName', 'ASC'],
      ],
    });

    if (inscriptions.length === 0) {
      return res.status(404).json({ message: 'No hay estudiantes inscritos en esta seccion' });
    }

    const subjectOrderMap = await getSubjectOrderMap(pg.id);

    const subjectMap = new Map<number, { id: number; name: string; abbreviation: string | null; subjectGroupId: number | null; subjectGroupName: string | null; usesLiteralGrades: boolean }>();

    inscriptions.forEach((ins: any) => {
      const sorted = sortSubjectsByOrder(
        ins.inscriptionSubjects || [],
        (is: any) => is.subjectId,
        (is: any) => is.subject?.name,
        subjectOrderMap
      );
      sorted.forEach((is: any) => {
        if (is.subject && !subjectMap.has(is.subjectId)) {
          subjectMap.set(is.subjectId, {
            id: is.subject.id,
            name: is.subject.name,
            abbreviation: is.subject.abbreviation || null,
            subjectGroupId: is.subject.subjectGroupId || null,
            subjectGroupName: is.subject.subjectGroup?.name || null,
            usesLiteralGrades: is.subject.usesLiteralGrades || false,
          });
        }
      });
    });

    // Also seed subjectMap from the grade's curriculum (PeriodGradeSubject) so
    // that subjects added to the grade appear in the Excel even if no student
    // has an InscriptionSubject for them yet.
    const pgSubjects = await PeriodGradeSubject.findAll({
      where: { periodGradeId: pg.id },
      include: [
        { model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] },
      ],
    });
    for (const pgs of pgSubjects) {
      const subj = (pgs as any).subject;
      if (subj && !subjectMap.has(subj.id)) {
        subjectMap.set(subj.id, {
          id: subj.id,
          name: subj.name,
          abbreviation: subj.abbreviation || null,
          subjectGroupId: subj.subjectGroupId || null,
          subjectGroupName: subj.subjectGroup?.name || null,
          usesLiteralGrades: subj.usesLiteralGrades || false,
        });
      }
    }

    const allSubjects = Array.from(subjectMap.values());

    const groupedSubjectIds = new Set(
      allSubjects.filter(s => s.subjectGroupId !== null).map(s => s.id)
    );

    const academicSubjects = allSubjects.filter(s => !groupedSubjectIds.has(s.id));

    const calculateFinalScore = (insSub: any): number | null => {
      if (insSub.finalGrade && insSub.finalGrade.finalScore != null) {
        return Number(insSub.finalGrade.finalScore);
      }

      const termScores: Record<number, number> = {};
      terms.forEach((t: any) => { termScores[t.id] = 0; });

      (insSub.qualifications || []).forEach((q: any) => {
        if (q.isAbsent) return;
        const score = q.remedialScore != null && Number(q.remedialScore) > 0
          ? Number(q.remedialScore)
          : Number(q.score) || 0;
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
      Object.values(termScores).forEach(val => totalAccumulated += val);

      const finalScore = totalAccumulated / termCount;
      return Math.round(finalScore * 100) / 100;
    };

    // Resolve template path. Precedence:
//   1. ?template= override in the query string
//   2. Template assigned to the (grade, section) combination
//   3. Template assigned to the grade (any section)
// A template MUST be selected by the caller. There is no default fallback
// so that a missing assignment surfaces as a clear error.
    const templatesRoot = path.resolve(process.cwd(), 'templates');
    let templatePath: string | null = null;
    if (template && typeof template === 'string') {
      const requested = path.basename(template);
      const candidate = path.join(templatesRoot, requested);
      if (!candidate.startsWith(templatesRoot) || !fs.existsSync(candidate)) {
        return res.status(400).json({ message: 'La plantilla seleccionada no existe' });
      }
      templatePath = candidate;
    } else {
      // Look up the template assigned to this grade / section
      const { Setting } = await import('@/models/index');
      const tryKey = (k: string) => Setting.findOne({ where: { key: k } });
      const gradeId = String(grade.id);
      const sectionId = section.id;
      const sectionKey = `template_assignment:grade:${gradeId}:section:${sectionId}`;
      const gradeKey = `template_assignment:grade:${gradeId}`;
      const sectionAssignment = await tryKey(sectionKey);
      const gradeAssignment = sectionAssignment ? null : await tryKey(gradeKey);
      const assignment = sectionAssignment || gradeAssignment;
      if (assignment && fs.existsSync(path.join(templatesRoot, path.basename(assignment.value)))) {
        templatePath = path.join(templatesRoot, path.basename(assignment.value));
      }
    }
    if (!templatePath) {
      return res.status(400).json({
        message: 'Debe seleccionar una plantilla (mediante ?template= en la URL o asignada al grado/sección).',
      });
    }

    const namedRanges = readTemplateNamedRanges(templatePath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    let sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      sheet = workbook.worksheets[0];
    }
    const actualSheetName = sheet!.name;

    // Helper: find a named range across any sheet. All named ranges in the
    // template are stored under '1er Año', but actualSheetName may differ
    // for higher grades (3er Año, 4to Año, etc.). This fallback ensures
    // lookups succeed regardless of the current sheet context.
    const findRef = (name: string) => {
      let r = namedRanges.getCell(actualSheetName, name);
      if (!r) {
        for (const sn of namedRanges.bySheet.keys()) {
          r = namedRanges.getCell(sn, name);
          if (r) break;
        }
      }
      return r;
    };

    // Sort academic subjects by canonical order (subjectOrderMap) so subj_i
    // always maps to the same subject regardless of insertion order.
    const sortedAcademicSubjects = [...academicSubjects].sort((a, b) => {
      const orderA = subjectOrderMap.get(a.id) ?? 999;
      const orderB = subjectOrderMap.get(b.id) ?? 999;
      return orderA - orderB;
    });

    // Discover subj_i named ranges and WRITE the abbreviation of the i-th
    // subject (in canonical order) into that cell. The map is subjIndex → subjectId
    // so that fillSheetByNamedRanges can look up which subject a column belongs to.
    const subjectColList: { col: number; abbr: string }[] = [];
    const subjectToSubjIndex = new Map<number, number>();
    let subjIdx = 1;
    while (true) {
      const ref = findRef('subj_' + subjIdx);
      if (!ref) break;
      const subj = sortedAcademicSubjects[subjIdx - 1];
      if (subj) {
        const abbrText = subj.abbreviation || subj.name;
        sheet!.getCell(ref.cell).value = abbrText;
        subjectColList.push({ col: ref.col, abbr: abbrText.toUpperCase() });
        subjectToSubjIndex.set(subjIdx, subj.id);
        // Also write the full subject name into subjname_i if defined
        const nameRef = findRef('subjname_' + subjIdx);
        if (nameRef) {
          sheet!.getCell(nameRef.cell).value = subj.name;
        }
      }
      subjIdx++;
    }

    // Note: the template defines subj_I named ranges for up to 9 subjects.
    // Only subjects with a corresponding subj_i named range are written.
    // Subjects beyond the template's named ranges are silently skipped to
    // preserve the Excel layout (no auto-appending columns).

// Classify students into approved and failed based on the calculated
    // final score per academic subject. A student fails the period if any
    // academic subject ends up below passingGrade.
    const passingGrade = Number(settings.passing_grade) || 10;
    const isFailed = (ins: any): boolean => {
      const sortedSubs = sortSubjectsByOrder(
        ins.inscriptionSubjects || [],
        (is: any) => is.subjectId,
        (is: any) => is.subject?.name,
        subjectOrderMap
      );
      for (const is of sortedSubs) {
        // Only consider academic subjects; skip grouped/elective subjects.
        if (groupedSubjectIds.has(is.subjectId)) continue;
        const score = calculateFinalScore(is);
        if (score == null) continue;
        if (score < passingGrade) return true;
      }
      return false;
    };

    const group = (req.query.group as string) || 'regulares';

    const failedInscriptions = inscriptions.filter(isFailed);
    const approvedInscriptions = inscriptions.filter(ins => !isFailed(ins));

    // Helper that clones a worksheet inside the same workbook (preserves
    // styles, borders, images, merges, decorative text like ***). Cloning
    // within the same workbook is what keeps the right border on column Z
    // intact on the copied sheet.
    const cloneSheetInPlace = (
      sourceWs: ExcelJS.Worksheet,
      newName: string
    ): ExcelJS.Worksheet => {
      const cloned = workbook.addWorksheet(newName);
      sourceWs.eachRow({ includeEmpty: true }, (row, rowNum) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const c = cloned.getRow(rowNum).getCell(colNumber);
          c.value = cell.value;
          if (cell.style) c.style = JSON.parse(JSON.stringify(cell.style));
          if (cell.numFmt) c.numFmt = cell.numFmt;
        });
        if (row.height != null) cloned.getRow(rowNum).height = row.height;
      });
      if (sourceWs.columns) {
        sourceWs.columns.forEach((col, idx) => {
          if (col && col.width != null) cloned.getColumn(idx + 1).width = col.width;
        });
      }
      // Use mergeCellsWithoutStyle (not mergeCells) to avoid re-ordering
      // cellXfs in the workbook, which would convert the right border on
      // column Z (the table edge) into a left border on the cloned sheet.
      if (sourceWs.model.merges) {
        sourceWs.model.merges.forEach((merge: string) => (cloned as any).mergeCellsWithoutStyle(merge));
      }
      return cloned;
    };

    // Helper that registers the template images in the workbook before any
    // cloning happens, so cellXfs stays stable during the clone.
    const originalImages = sheet!.getImages();
    const originalMedia: any[] = (workbook as any).model?.media || [];
    const preImageIds: number[] = [];
    for (const img of originalImages) {
      const media = originalMedia[(img as any).imageId];
      if (media && media.buffer) {
        preImageIds.push(workbook.addImage({
          buffer: media.buffer,
          extension: media.extension || 'png',
        }) as number);
      } else {
        preImageIds.push(-1);
      }
    }

    // Helper that fills a single worksheet (already inside `workbook`) with
    // a given group of students at the given student offset. The worksheet is
    // expected to already be cloned from the template and named accordingly.
    const fillGroupPage = (
      ws: ExcelJS.Worksheet,
      studentList: any[],
      studentOffset: number,
      evalType: string,
      sectionTotal: number,
      pageCount: number,
    ) => {
      // Attach pre-registered images with the template's anchors
      const makeAnchor = (a: any) => ({
        nativeCol: a.nativeCol,
        nativeColOff: a.nativeColOff,
        nativeRow: a.nativeRow,
        nativeRowOff: a.nativeRowOff,
      });
      for (let i = 0; i < originalImages.length; i++) {
        const img = originalImages[i];
        if (preImageIds[i] < 0) continue;
        (ws as any).addImage(preImageIds[i], {
          tl: makeAnchor(img.range.tl),
          br: makeAnchor(img.range.br),
          editAs: (img as any).range.editAs,
        });
      }

      // Write subject abbreviations / full names
      for (let i = 1; i <= sortedAcademicSubjects.length; i++) {
        const ref = findRef('subj_' + i);
        const nameRef = findRef('subjname_' + i);
        const subj = sortedAcademicSubjects[i - 1];
        if (subj) {
          const abbrText = subj.abbreviation || subj.name;
          if (ref) ws.getCell(ref.cell).value = abbrText;
          if (nameRef) ws.getCell(nameRef.cell).value = subj.name;
        }
      }

      // Fill the student rows
      fillSheetByNamedRanges(
        ws, ws.name, namedRanges, settings, plantel, period,
        studentList, academicSubjects, groupedSubjectIds,
        subjectColList, subjectToSubjIndex,
        calculateFinalScore, subjectOrderMap, studentOffset,
        actualSheetName,  // named ranges registered under the original sheet
        grade?.name,
        section?.name,
        letterGradesConfig,
      );

      // Override the evaluation type for this group. We do it after the
      // generic fill so it is not overwritten by the hard-coded default.
      const evalRef = findRef('inst_eval_type');
      if (evalRef) ws.getCell(evalRef.cell).value = evalType;

      // Total students in the section and students on this page
      const setLocal = (name: string, value: any) => {
        if (value === undefined || value === null || value === '') return;
        const r = findRef(name);
        if (r) ws.getCell(r.cell).value = value;
      };
      setLocal('std_total', sectionTotal);
      setLocal('std_page_count', pageCount);
    };

    // Render one or more pages for a given student group with the given
    // evaluation type. Returns the array of generated worksheet names.
    // The FIRST group rendered uses the original `sheet!` in-place (keeping
    // its original name `actualSheetName`) so that workbook-level defined
    // names (named ranges like subj_1, inst_code, etc.) which point to
    // `'1er Año'!$X$Y` remain valid. Formulas like `=subj_1` in the
    // template will resolve correctly. Subsequent groups and extra pages
    // are clones with different names.
    let originalSheetUsed = false;
    const renderGroup = (
      group: any[],
      evalType: string,
      groupLabel: string,
      isFirst: boolean
    ): string[] => {
      if (group.length === 0) return [];
      const pages = Math.ceil(group.length / MAX_STUDENTS_PER_SHEET);
      const generated: string[] = [];
      for (let pageIdx = 0; pageIdx < pages; pageIdx++) {
        let targetSheet: ExcelJS.Worksheet;
        let targetName: string;
        if (isFirst && pageIdx === 0 && !originalSheetUsed) {
          // Use the original template sheet in-place, keep its original
          // name so named ranges stay valid.
          targetSheet = sheet!;
          targetName = actualSheetName;
          originalSheetUsed = true;
        } else {
          targetName = `${actualSheetName} (${groupLabel} ${pageIdx + 1})`;
          targetSheet = cloneSheetInPlace(sheet!, targetName);
        }
        const studentOffset = pageIdx * MAX_STUDENTS_PER_SHEET;
        const pageCount = Math.min(group.length - studentOffset, MAX_STUDENTS_PER_SHEET);
        fillGroupPage(targetSheet, group, studentOffset, evalType, inscriptions.length, pageCount);
        generated.push(targetName);
      }
      return generated;
    };

    let approvedSheetNames: string[] = [];
    let failedSheetNames: string[] = [];

    if (group === 'revision') {
      if (failedInscriptions.length === 0) {
        return res.status(404).json({ message: 'No hay estudiantes reprobados en esta sección' });
      }
      failedSheetNames = renderGroup(
        failedInscriptions, 'REVISION DE MATERIA PENDIENTE', 'REVISION', true,
      );
    } else {
      if (approvedInscriptions.length === 0) {
        return res.status(404).json({ message: 'No hay estudiantes aprobados en esta sección' });
      }
      // Default 'regulares': only approved students
      approvedSheetNames = renderGroup(
        approvedInscriptions, 'Regulares', 'Regulares', true,
      );
    }

    // Drop the un-filled template sheets (3er Año, 4to Año, 5to Año) and
    // the original `sheet!` if it was NOT used (no students at all). Keep
    // only the rendered group pages.
    const keepNames = new Set<string>([...approvedSheetNames, ...failedSheetNames]);
    workbook.worksheets
      .filter(ws => !keepNames.has(ws.name))
      .forEach(ws => workbook.removeWorksheet(ws.id!));

    // Re-register ALL named ranges from the template so that formulas like
    // =subj_1 survive the removeWorksheet + clone operations. ExcelJS drops
    // definedNames when sheets are removed, so we rebuild them here.
    for (const [sheetName, namesMap] of namedRanges.bySheet) {
      for (const [name, ref] of namesMap) {
        const sheetLabel = sheetName.includes(' ')
          ? `'${sheetName}'`
          : sheetName;
        const locStr = `${sheetLabel}!$${ref.cell}`;
        try {
          workbook.definedNames.add(locStr, name);
        } catch {
          // name may already exist (original sheet kept); ignore
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = 'resumen-rendimiento-' + grade.name.replace(/s+/g, '_') + '-' + section.name.replace(/s+/g, '_') + '.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="' + fileName + '"');
    res.send(buffer);
} catch (error: any) {
    console.error('[exportPerformanceSummary] Error:', error);
    res.status(500).json({ message: error.message || 'Error al exportar resumen de rendimiento' });
  }
};

export const getBoletinData = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = parseInt(req.query.schoolPeriodId as string, 10);
    const gradeId = parseInt(req.query.gradeId as string, 10);
    const sectionId = req.query.sectionId ? parseInt(req.query.sectionId as string, 10) : undefined;
    const inscriptionId = req.query.inscriptionId ? parseInt(req.query.inscriptionId as string, 10) : undefined;

    if (!schoolPeriodId || !gradeId) {
      return res.status(400).json({ message: 'schoolPeriodId y gradeId son obligatorios' });
    }

    const [period, grade, settingsRows] = await Promise.all([
      SchoolPeriod.findByPk(schoolPeriodId),
      Grade.findByPk(gradeId),
      Setting.findAll(),
    ]);

    if (!period) return res.status(404).json({ message: 'Período no encontrado' });
    if (!grade) return res.status(404).json({ message: 'Grado no encontrado' });

    const settings: Record<string, string> = {};
    settingsRows.forEach((s: any) => { settings[s.key] = s.value; });

    const periodGrade = await PeriodGrade.findOne({
      where: { schoolPeriodId, gradeId },
    });
    const subjectOrderMap = periodGrade ? await getSubjectOrderMap(periodGrade.id) : new Map<number, number>();

    const terms = await Term.findAll({
      where: { schoolPeriodId },
      order: [['order', 'ASC']],
    });
    const termCount = terms.length || 1;

    const inscWhere: any = { schoolPeriodId, gradeId };
    if (sectionId) inscWhere.sectionId = sectionId;
    if (inscriptionId) inscWhere.id = inscriptionId;

    const inscriptions = await Inscription.findAll({
      where: inscWhere,
      include: [
        {
          model: Person,
          as: 'student',
          include: [{ model: PersonResidence, as: 'residence' }],
        },
        { model: Section, as: 'section' },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            { model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] },
            { model: SubjectFinalGrade, as: 'finalGrade' },
            {
              model: Qualification,
              as: 'qualifications',
              include: [{ model: EvaluationPlan, as: 'evaluationPlan' }],
            },
            { model: CouncilPoint, as: 'councilPoints' },
          ],
        },
      ],
      order: [
        [{ model: Section, as: 'section' }, 'name', 'ASC'],
        [{ model: Person, as: 'student' }, 'lastName', 'ASC'],
        [{ model: Person, as: 'student' }, 'firstName', 'ASC'],
      ],
    });

    const students = inscriptions.map((ins: any) => {
      const insSubs = sortSubjectsByOrder(
        (ins.inscriptionSubjects || []).filter((is: any) => !is.subject?.subjectGroupId),
        (is: any) => is.subjectId,
        (is: any) => is.subject?.name || '',
        subjectOrderMap,
      );

      const subjects = insSubs.map((is: any) => {
        const termScores: Record<number, number> = {};
        terms.forEach((t: any) => { termScores[t.id] = 0; });

        (is.qualifications || []).forEach((q: any) => {
          if (q.isAbsent) return;
          const score = q.remedialScore != null && Number(q.remedialScore) > 0
            ? Number(q.remedialScore) : Number(q.score) || 0;
          const percentage = Number(q.evaluationPlan?.percentage) || 0;
          const termId = q.evaluationPlan?.termId;
          if (termId && termScores[termId] !== undefined) {
            termScores[termId] += score * (percentage / 100);
          }
        });

        (is.councilPoints || []).forEach((cp: any) => {
          const pVal = Number(cp.points) || 0;
          if (cp.termId && termScores[cp.termId] !== undefined) {
            termScores[cp.termId] += pVal;
          }
        });

        let finalScore: number | null = null;
        if (is.finalGrade && is.finalGrade.finalScore != null) {
          finalScore = Number(is.finalGrade.finalScore);
        } else {
          let total = 0;
          Object.values(termScores).forEach((v) => { total += v; });
          finalScore = Math.round((total / termCount) * 100) / 100;
        }

        return {
          id: is.subjectId,
          name: is.subject?.name || '',
          usesLiteralGrades: is.subject?.usesLiteralGrades || false,
          lapsos: terms.map((t: any) => ({
            termId: t.id,
            termName: t.name,
            score: Math.round((termScores[t.id] || 0) * 100) / 100,
          })),
          finalScore,
          status: is.finalGrade?.status || (finalScore !== null && finalScore >= Number(settings.passing_grade || 10) ? 'aprobada' : 'reprobada'),
        };
      });

      return {
        inscriptionId: ins.id,
        firstName: ins.student?.firstName || '',
        lastName: ins.student?.lastName || '',
        document: ins.student?.document || '',
        sectionName: ins.section?.name || '',
        subjects,
      };
    });

    res.json({
      institution: {
        name: settings.institution_name || '',
        period: period.name || period.period || '',
        code: settings.institution_code || '',
        principal: settings.principal_name || '',
      },
      grade: { id: grade.id, name: grade.name },
      terms: terms.map((t: any) => ({ id: t.id, name: t.name, order: t.order })),
      students,
    });
  } catch (error: any) {
    console.error('[getBoletinData] Error:', error);
    res.status(500).json({ message: error.message || 'Error al obtener datos de boletín' });
  }
};
