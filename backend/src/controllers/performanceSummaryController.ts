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
  SubjectTermGrade,
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
  TeacherAssignment,
  SectionGuide,
  CouncilChecklist,
  StudentObservation,
} from '@/models/index';
import {
  getSubjectOrderMap,
  sortSubjectsByOrder,
} from '@/services/subjectOrderService';
import { filterActiveGroupSubjects } from '@/services/subjectGroupService';
import { isPassingGrade, resolveGradeStatus, roundFinalGrade, MIN_FINAL_GRADE } from '@/services/gradeEvaluationService';
import { GradeCalculationService } from '@/services/gradeCalculationService';
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
    if (typeof value === 'string') value = value.toUpperCase();
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
  setByRange('inst_director_2', settings.director_name);
  setByRange('inst_director_doc_2', settings.director_document);
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
      const columnSubject = academicSubjects.find((s: any) => s.id === subjId);
      const insSub = insSubjects.find((is: any) =>
        is.subjectId === subjId || (
          columnSubject?.subjectGroupId !== null &&
          columnSubject?.subjectGroupId !== undefined &&
          is.subject?.subjectGroupId === columnSubject.subjectGroupId
        )
      );
      const score = insSub ? calculateFinalScore(insSub) : null;
      const col = subjectColList[i].col;
      const row = 15 + n;
      const isLiteral = insSub?.subject?.usesLiteralGrades ?? columnSubject?.usesLiteralGrades;
      if (isLiteral) {
        if (score != null) {
          sheet.getRow(row).getCell(col).value = numericToLetter(score, letterGradesConfig || []);
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
    const gradeSuffix = gradeOrder === 1 || gradeOrder === 3 ? 'ER' : gradeOrder === 2 ? 'DO' : 'TO';
    const templateGradeName = `${gradeOrder}${gradeSuffix} AÑO`;
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

    // Query CouncilChecklist to know which (termId, sectionId) pairs have council done
    const councilChecklists = await CouncilChecklist.findAll({
      where: {
        schoolPeriodId: Number(schoolPeriodId),
        gradeId: Number(gradeId),
        status: 'done',
        termId: terms.map((t: any) => t.id),
        sectionId: Number(sectionId),
      },
      attributes: ['termId', 'sectionId', 'status'],
    });
    const isCouncilDone = GradeCalculationService.buildCouncilDoneChecker(
      councilChecklists.map((c: any) => ({ termId: c.termId, sectionId: c.sectionId, status: c.status })),
    );

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
            { model: SubjectTermGrade, as: 'termGrades', required: false },
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

    // Sort students by document number ascending (numeric), with
    // 'Cedula Escolar' documents placed at the end.
    inscriptions.sort((a: any, b: any) => {
      const aIsSchool = a.student?.documentType === 'Cedula Escolar';
      const bIsSchool = b.student?.documentType === 'Cedula Escolar';
      if (aIsSchool !== bIsSchool) return aIsSchool ? 1 : -1;
      const aDoc = Number(a.student?.document) || 0;
      const bDoc = Number(b.student?.document) || 0;
      return aDoc - bDoc;
    });

    const subjectOrderMap = await getSubjectOrderMap(pg.id);

    const subjectMap = new Map<number, { id: number; name: string; abbreviation: string | null; subjectGroupId: number | null; subjectGroupName: string | null; subjectGroupShortAbbr: string | null; subjectGroupLongAbbr: string | null; usesLiteralGrades: boolean }>();

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
            subjectGroupShortAbbr: is.subject.subjectGroup?.shortAbbreviation || null,
            subjectGroupLongAbbr: is.subject.subjectGroup?.longAbbreviation || null,
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
          subjectGroupShortAbbr: subj.subjectGroup?.shortAbbreviation || null,
          subjectGroupLongAbbr: subj.subjectGroup?.longAbbreviation || null,
          usesLiteralGrades: subj.usesLiteralGrades || false,
        });
      }
    }

    const allSubjects = Array.from(subjectMap.values());

    // Only include subjects that are in the grade's official curriculum
    // (PeriodGradeSubject). Subjects from student inscriptions that don't
    // belong to this grade (e.g. Biology from a different grade) are excluded
    // so they don't leak into the Excel columns.
    const pgSubjectIds = new Set(pgSubjects.map(pgs => (pgs as any).subjectId).filter(Boolean));

    const groupedSubjectIds = new Set(
      allSubjects.filter(s => s.subjectGroupId !== null).map(s => s.id)
    );

    // The Excel has one column per academic subject, but group subjects are
    // alternatives: a student has one subject from a group, not all of them.
    // Collapse all official subjects with the same subjectGroupId into one
    // representative column while preserving every student's actual subject
    // for the grade lookup below.
    const officialSubjects = allSubjects.filter(s => pgSubjectIds.has(s.id));
    const seenGroupIds = new Set<number>();
    const academicSubjects = officialSubjects.filter((subject) => {
      if (subject.subjectGroupId === null) return true;
      if (seenGroupIds.has(subject.subjectGroupId)) return false;
      seenGroupIds.add(subject.subjectGroupId);
      return true;
    });

    // Query teacher assignments for this section + periodGrade. Build map:
    // subjectId → { fullName, docWithType }
    const teacherAssignments = await TeacherAssignment.findAll({
      where: { sectionId: section.id },
      include: [
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject',
          required: true,
          where: { periodGradeId: pg.id },
        },
        {
          model: Person,
          as: 'teacher',
          attributes: ['firstName', 'lastName', 'documentType', 'document'],
        },
      ],
    });
    const teacherMap = new Map<number, { fullName: string; docWithType: string }>();
    for (const ta of teacherAssignments) {
      const pgs = (ta as any).periodGradeSubject;
      const teacher = (ta as any).teacher;
      if (pgs && teacher) {
        const docType = teacher.documentType === 'Venezolano' ? 'V' :
                        teacher.documentType === 'Extranjero' ? 'E' : 'V';
        teacherMap.set(pgs.subjectId, {
          fullName: `${teacher.lastName || ''} ${teacher.firstName || ''}`.trim(),
          docWithType: docType + ' ' + (teacher.document || ''),
        });
      }
    }

    const calculateFinalScore = (insSub: any): number | null => {
      // Build term grades with fallback to qualifications + councilPoints
      const termGradesArr = GradeCalculationService.buildTermGradesWithFallback(
        (insSub.termGrades || []).map((tg: any) => ({ termId: tg.termId, score: Number(tg.score) })),
        insSub.qualifications || [],
        insSub.councilPoints || [],
        terms.map((t: any) => t.id),
      );

      // Build lapsos with council-done filter
      const lapsos = terms.map((t: any) => {
        const councilDone = isCouncilDone(t.id, Number(sectionId));
        const finalScore = GradeCalculationService.calculateFinalTermScore(t.id, termGradesArr, councilDone);
        return { termId: t.id, finalScore };
      });

      return GradeCalculationService.calculateFinalScore(
        lapsos,
        insSub.finalGrade ? { finalScore: insSub.finalGrade.finalScore, gradeType: insSub.finalGrade.gradeType } : null,
      );
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

    // Count enrolled students per subject across all inscriptions
    const studentCountBySubject = new Map<number, number>();
    for (const ins of inscriptions) {
      for (const is of (ins as any).inscriptionSubjects || []) {
        if (is.subjectId) {
          studentCountBySubject.set(is.subjectId, (studentCountBySubject.get(is.subjectId) || 0) + 1);
        }
      }
    }

    const passingGrade = Number(settings.passing_grade) || 10;

    // Count failed students per subject (score < passingGrade)
    const failedCountBySubject = new Map<number, number>();
    for (const ins of inscriptions) {
      for (const is of (ins as any).inscriptionSubjects || []) {
        if (!is.subjectId || groupedSubjectIds.has(is.subjectId)) continue;
        const score = calculateFinalScore(is);
        if (score != null && !isPassingGrade(score, passingGrade)) {
          failedCountBySubject.set(is.subjectId, (failedCountBySubject.get(is.subjectId) || 0) + 1);
        }
      }
    }

    // Count approved students per subject (score >= passingGrade)
    const passedCountBySubject = new Map<number, number>();
    for (const ins of inscriptions) {
      for (const is of (ins as any).inscriptionSubjects || []) {
        if (!is.subjectId || groupedSubjectIds.has(is.subjectId)) continue;
        const score = calculateFinalScore(is);
        if (score != null && isPassingGrade(score, passingGrade)) {
          passedCountBySubject.set(is.subjectId, (passedCountBySubject.get(is.subjectId) || 0) + 1);
        }
      }
    }

    // Count zero-score students per subject (exactly 0 = inasistentes)
    const zeroCountBySubject = new Map<number, number>();
    for (const ins of inscriptions) {
      for (const is of (ins as any).inscriptionSubjects || []) {
        if (!is.subjectId || groupedSubjectIds.has(is.subjectId)) continue;
        const score = calculateFinalScore(is);
        if (score != null && score === 0) {
          zeroCountBySubject.set(is.subjectId, (zeroCountBySubject.get(is.subjectId) || 0) + 1);
        }
      }
    }

    const totalStudents = inscriptions.length;

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
        const abbrText = subj.subjectGroupId
          ? (subj.subjectGroupShortAbbr || subj.subjectGroupLongAbbr || subj.name)
          : (subj.abbreviation || subj.name);
        const headerText = abbrText;
        sheet!.getCell(ref.cell).value = headerText;
        subjectColList.push({ col: ref.col, abbr: abbrText.toUpperCase() });
        subjectToSubjIndex.set(subjIdx, subj.id);
        // Also write the full subject name into subjname_i if defined
        const nameRef = findRef('subjname_' + subjIdx);
        const nameText = subj.subjectGroupId
          ? 'Participación en Grupos de \r\nCreación, Recreación y Producción'
          : subj.name;
        if (nameRef) {
          sheet!.getCell(nameRef.cell).value = nameText;
        }
        // The area table needs its own named ranges because Excel does not
        // allow the global subj_N name to point to two different cells.
        const areaRef = findRef('area_subj_' + subjIdx);
        const areaNameRef = findRef('area_subjname_' + subjIdx);
        const areaHeaderText = subj.subjectGroupId
          ? (subj.subjectGroupLongAbbr || '-')
          : (subj.abbreviation || '-');
        if (areaRef) {
          sheet!.getCell(areaRef.cell).value = areaHeaderText;
        }
        if (areaNameRef) {
          sheet!.getCell(areaNameRef.cell).value = nameText;
        }
        // Write enrolled-student count per subject in the same column
        const countVal = studentCountBySubject.get(subj.id) || 0;
        const countRef = findRef('subj_count_' + subjIdx);
        if (countRef) {
          sheet!.getCell(countRef.cell).value = countVal;
        }
        // Write failed-student count per subject
        const failedVal = failedCountBySubject.get(subj.id) || 0;
        const failedRef = findRef('subj_failed_' + subjIdx);
        if (failedRef) {
          sheet!.getCell(failedRef.cell).value = failedVal;
        }
        // Write approved-student count per subject
        const passedVal = passedCountBySubject.get(subj.id) || 0;
        const passedRef = findRef('subj_passed_' + subjIdx);
        if (passedRef) {
          sheet!.getCell(passedRef.cell).value = passedVal;
        }
        // Write zero-score (inasistentes) count per subject
        const zeroVal = zeroCountBySubject.get(subj.id) || 0;
        const zeroRef = findRef('subj_zero_' + subjIdx);
        if (zeroRef) {
          sheet!.getCell(zeroRef.cell).value = zeroVal;
        }
        // Write unenrolled count per subject (total - enrolled)
        const unenrolledVal = totalStudents - (studentCountBySubject.get(subj.id) || 0);
        const unenrolledRef = findRef('subj_unenrolled_' + subjIdx);
        if (unenrolledRef) {
          sheet!.getCell(unenrolledRef.cell).value = unenrolledVal;
        }
      }
      subjIdx++;
    }

    // Note: the template defines subj_I named ranges for up to 9 subjects.
    // Only subjects with a corresponding subj_i named range are written.
    // Subjects beyond the template's named ranges are silently skipped to
    // preserve the Excel layout (no auto-appending columns).

    // Write teacher name and document for each subject in the "V. Profesores
    // por Áreas" section. Use the template's named ranges instead of a hardcoded
    // row limit, since some templates define teacher rows beyond row 65.
    const setTeacherData = (ws: ExcelJS.Worksheet) => {
      for (let i = 1; i <= sortedAcademicSubjects.length; i++) {
        const subj = sortedAcademicSubjects[i - 1];
        if (!subj) continue;
        const teacher = teacherMap.get(subj.id);
        if (!teacher) continue;

        const teacherNameRef = findRef(`teacher_name_${i}`);
        const teacherDocRef = findRef(`teacher_doc_${i}`);
        if (teacherNameRef) ws.getCell(teacherNameRef.cell).value = teacher.fullName;
        if (teacherDocRef) ws.getCell(teacherDocRef.cell).value = teacher.docWithType;
      }
    };

    // Write teacher data on the original template sheet (will be inherited by
    // cloned sheets via cloneSheetInPlace).
    setTeacherData(sheet!);

    // Group students by document type. Each group goes on its own set of
    // sheets, paginated every MAX_STUDENTS_PER_SHEET students.
    const docTypeGroups: { label: string; students: any[] }[] = [
      { label: 'Venezolano', students: inscriptions.filter(ins => ins.student?.documentType === 'Venezolano') },
      { label: 'Extranjero', students: inscriptions.filter(ins => ins.student?.documentType === 'Extranjero') },
      { label: 'Pasaporte', students: inscriptions.filter(ins => ins.student?.documentType === 'Pasaporte') },
      { label: 'Cedula Escolar', students: inscriptions.filter(ins => ins.student?.documentType === 'Cedula Escolar') },
    ];

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
          c.value = cell.value && typeof cell.value === 'object' ? JSON.parse(JSON.stringify(cell.value)) : cell.value;
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

      // Write subject headers
      for (let i = 1; i <= sortedAcademicSubjects.length; i++) {
        const ref = findRef('subj_' + i);
        const nameRef = findRef('subjname_' + i);
        const countRef = findRef('subj_count_' + i);
        const failedRef = findRef('subj_failed_' + i);
        const passedRef = findRef('subj_passed_' + i);
        const zeroRef = findRef('subj_zero_' + i);
        const unenrolledRef = findRef('subj_unenrolled_' + i);
        const subj = sortedAcademicSubjects[i - 1];
        if (subj) {
          const abbrText = subj.subjectGroupId
            ? (subj.subjectGroupShortAbbr || subj.subjectGroupLongAbbr || subj.name)
            : (subj.abbreviation || subj.name);
          const headerText = abbrText;
          if (ref) ws.getCell(ref.cell).value = headerText;
          const nameText = subj.subjectGroupId
            ? 'Participación en Grupos de \r\nCreación, Recreación y Producción'
            : subj.name;
          if (nameRef) {
            ws.getCell(nameRef.cell).value = nameText;
          }
          const areaRef = findRef('area_subj_' + i);
          const areaNameRef = findRef('area_subjname_' + i);
          const areaHeaderText = subj.subjectGroupId
            ? (subj.subjectGroupLongAbbr || '-')
            : (subj.abbreviation || '-');
          if (areaRef) ws.getCell(areaRef.cell).value = areaHeaderText;
          if (areaNameRef) ws.getCell(areaNameRef.cell).value = nameText;
          if (countRef) {
            ws.getCell(countRef.cell).value = studentCountBySubject.get(subj.id) || 0;
          }
          if (failedRef) {
            ws.getCell(failedRef.cell).value = failedCountBySubject.get(subj.id) || 0;
          }
          if (passedRef) {
            ws.getCell(passedRef.cell).value = passedCountBySubject.get(subj.id) || 0;
          }
          if (zeroRef) {
            ws.getCell(zeroRef.cell).value = zeroCountBySubject.get(subj.id) || 0;
          }
          if (unenrolledRef) {
            ws.getCell(unenrolledRef.cell).value = totalStudents - (studentCountBySubject.get(subj.id) || 0);
          }
        }
      }

      // Fill the student rows
      fillSheetByNamedRanges(
        ws, ws.name, namedRanges, settings, plantel, period,
        studentList, academicSubjects, groupedSubjectIds,
        subjectColList, subjectToSubjIndex,
        calculateFinalScore, subjectOrderMap, studentOffset,
        actualSheetName,  // named ranges registered under the original sheet
        templateGradeName,
        section?.name,
        letterGradesConfig,
      );

      // Override the evaluation type for this group. We do it after the
      // generic fill so it is not overwritten by the hard-coded default.
      const evalRef = findRef('inst_eval_type');
      if (evalRef) ws.getCell(evalRef.cell).value = String(evalType).toUpperCase();

      // Total students in the section and students on this page.
      // Named ranges for merged cells point to their top-left cell, so write
      // directly to that cell and preserve the template's merged layout.
      const setLocal = (name: string, value: any) => {
        if (value === undefined || value === null || value === '') return;
        const r = findRef(name);
        if (r) ws.getCell(r.cell).value = value;
      };
      setLocal('std_total', sectionTotal);
      setLocal('std_page_count', pageCount);

      // Replace formula references to named ranges with direct cell
      // references so that formulas resolve correctly in every cloned
      // sheet. Only use named ranges from the matching template sheet
      // (e.g. '1er Año' for '1er Año (1)') to avoid cross-sheet
      // collisions where the same name (e.g. subj_1) exists on every
      // template sheet pointing to different columns.
      const nameToRef = new Map<string, string>();
      for (const [origName, namesMap] of namedRanges.bySheet) {
        if (ws.name.startsWith(origName)) {
          for (const [name, ref] of namesMap) {
            nameToRef.set(name, `'${ws.name}'!$${ref.cell}`);
          }
        }
      }
      ws.eachRow((row) => {
        row.eachCell((cell) => {
          const v = cell.value;
          if (v && typeof v === 'object' && 'formula' in v) {
            let formula = (v as any).formula;
            if (!formula) return;
            let changed = false;
            for (const [name, cellRef] of nameToRef) {
              const re = new RegExp(`\\b${name}\\b`, 'g');
              const newFormula = formula.replace(re, cellRef);
              if (newFormula !== formula) {
                formula = newFormula;
                changed = true;
              }
            }
            if (changed) {
              (v as any).formula = formula;
            }
          }
        });
      });
    };

    // Keep an untouched worksheet as the clone source. The original sheet is
    // filled with the first document-type group, so it cannot be used as the
    // source for later groups without copying those students into them.
    const cleanTemplateSheet = cloneSheetInPlace(sheet!, `${actualSheetName} (Template Source)`);

    // Render one or more pages for a given student group with the given
    // evaluation type. Returns the array of generated worksheet names.
    // The FIRST group rendered uses the original `sheet!` in-place (keeping
    // its original name `actualSheetName`) so that workbook-level defined
    // names (named ranges like subj_1, inst_code, etc.) which point to
    // `'1er Año'!$X$Y` remain valid. Formulas like `=subj_1` in the
    // template will resolve correctly. Subsequent groups and extra pages
    // are clones with different names.
    //
    // IMPORTANT: all clones are created BEFORE any fillGroupPage call so that
    // the template sheet isn't yet filled with student data. Otherwise each
    // clone would inherit the previous page's students in un-overwritten rows.
    const renderGroup = (
      group: any[],
      evalType: string,
      groupLabel: string,
      isFirst: boolean
    ): string[] => {
      if (group.length === 0) return [];
      const pages = Math.ceil(group.length / MAX_STUDENTS_PER_SHEET);
      const pageSheets: ExcelJS.Worksheet[] = [];
      const pageNames: string[] = [];

      // Phase 1: create all worksheets (clone from clean template).
      // Naming: 5to Año (Venezolano) (1), 5to Año (Venezolano) (2), ...
      for (let pageIdx = 0; pageIdx < pages; pageIdx++) {
        const name = `${actualSheetName} (${groupLabel}) (${pageIdx + 1})`;
        if (isFirst && pageIdx === 0) {
          pageSheets[0] = sheet!;
          pageNames[0] = name;
        } else {
          pageSheets.push(cloneSheetInPlace(cleanTemplateSheet, name));
          pageNames.push(name);
        }
      }
      // Rename original sheet in-place so it matches the naming convention.
      if (isFirst && pages > 0 && pageSheets[0] === sheet!) {
        sheet!.name = pageNames[0];
      }

      // Phase 2: fill each sheet with its slice of students
      for (let pageIdx = 0; pageIdx < pages; pageIdx++) {
        const studentOffset = pageIdx * MAX_STUDENTS_PER_SHEET;
        const pageCount = Math.min(group.length - studentOffset, MAX_STUDENTS_PER_SHEET);
        fillGroupPage(pageSheets[pageIdx], group, studentOffset, evalType, inscriptions.length, pageCount);
      }

      return pageNames;
    };

    // Render each document-type group on its own set of sheets.
    let isFirst = true;
    const allSheetNames: string[] = [];
    for (const dtg of docTypeGroups) {
      if (dtg.students.length === 0) continue;
      const names = renderGroup(dtg.students, 'Final', dtg.label, isFirst);
      allSheetNames.push(...names);
      isFirst = false;
    }

    if (allSheetNames.length === 0) {
      return res.status(404).json({ message: 'No hay estudiantes en esta sección' });
    }

    // Drop the un-filled template sheets (3er Año, 4to Año, 5to Año) and
    // the original `sheet!` if it was NOT used (no students at all). Keep
    // only the rendered group pages.
    const keepNames = new Set<string>(allSheetNames);
    workbook.worksheets
      .filter(ws => !keepNames.has(ws.name))
      .forEach(ws => workbook.removeWorksheet(ws.id!));

    // Re-register all named ranges as global entries with fully-qualified
    // sheet references (matching how the template itself stores them).
    // Excel handles duplicate global names gracefully by picking the one
    // matching the current sheet context. This avoids the issues with
    // localSheetId that caused Excel to reject the file.
    // Clear existing named ranges and re-add for remaining worksheets.
    (workbook as any)._definedNames.matrixMap = {};

    const addWithSheet = (name: string, wsName: string, cell: string) => {
      const sheetLabel = wsName.includes(' ') ? `'${wsName}'` : wsName;
      try {
        workbook.definedNames.add(`${sheetLabel}!$${cell}`, name);
      } catch {}
    };

    for (const ws of workbook.worksheets) {
      const wsName = ws.name;
      // Template named ranges
      for (const [origName, namesMap] of namedRanges.bySheet) {
        if (wsName.startsWith(origName)) {
          for (const [name, ref] of namesMap) {
            addWithSheet(name, wsName, ref.cell);
          }
        }
      }
      // Re-register teacher named ranges only when they already exist in the template.
      for (let i = 1; i <= sortedAcademicSubjects.length; i++) {
        const teacherNameRef = findRef(`teacher_name_${i}`);
        const teacherDocRef = findRef(`teacher_doc_${i}`);
        if (teacherNameRef) {
          addWithSheet('teacher_name_' + i, wsName, teacherNameRef.cell);
        }
        if (teacherDocRef) {
          addWithSheet('teacher_doc_' + i, wsName, teacherDocRef.cell);
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

    // Fetch teacher assignments for this period+grade+section
    const periodGradeSubjects = periodGrade
      ? await PeriodGradeSubject.findAll({ where: { periodGradeId: periodGrade.id } })
      : [];
    const pgsIds = periodGradeSubjects.map((pgs: any) => pgs.id);

    // Map: subjectId -> includeInAverage (default true)
    const includeInAverageMap = new Map<number, boolean>();
    for (const pgs of periodGradeSubjects) {
      includeInAverageMap.set((pgs as any).subjectId, (pgs as any).includeInAverage !== false);
    }

    const taWhere: any = { periodGradeSubjectId: pgsIds };
    if (sectionId) taWhere.sectionId = sectionId;
    const teacherAssignments = pgsIds.length > 0
      ? await TeacherAssignment.findAll({
          where: taWhere,
          include: [{ model: Person, as: 'teacher', attributes: ['id', 'firstName', 'lastName'] }],
        })
      : [];

    // Map: subjectId -> teacher name
    const teacherMap = new Map<number, string>();
    for (const ta of teacherAssignments) {
      const pgs = periodGradeSubjects.find((p: any) => p.id === ta.periodGradeSubjectId);
      if (pgs && (ta as any).teacher) {
        const t = (ta as any).teacher;
        teacherMap.set(pgs.subjectId, `${t.firstName || ''} ${t.lastName || ''}`.trim());
      }
    }

    // Fetch guide teachers for this period+grade
    const guideWhere: any = { schoolPeriodId, gradeId };
    if (sectionId) guideWhere.sectionId = sectionId;
    const sectionGuides = await SectionGuide.findAll({
      where: guideWhere,
      include: [{ model: Person, as: 'guideTeacher', attributes: ['id', 'firstName', 'lastName'] }],
    });
    const guideMap = new Map<number, string>();
    for (const sg of sectionGuides) {
      if ((sg as any).guideTeacher) {
        const t = (sg as any).guideTeacher;
        guideMap.set(sg.sectionId, `${t.firstName || ''} ${t.lastName || ''}`.trim());
      }
    }

    const terms = await Term.findAll({
      where: { schoolPeriodId },
      order: [['order', 'ASC']],
    });
    const termCount = terms.length || 1;

    // Determine which (termId, sectionId) pairs have their council completed (status: 'done')
    const councilChecklists = await CouncilChecklist.findAll({
      where: {
        schoolPeriodId,
        gradeId,
        status: 'done',
        termId: terms.map((t: any) => t.id),
        ...(sectionId ? { sectionId } : {}),
      },
      attributes: ['termId', 'sectionId', 'status'],
    });
    const isCouncilDone = GradeCalculationService.buildCouncilDoneChecker(
      councilChecklists.map((c: any) => ({ termId: c.termId, sectionId: c.sectionId, status: c.status })),
    );

    const inscWhere: any = { schoolPeriodId, gradeId };
    if (sectionId) inscWhere.sectionId = sectionId;
    // Note: we don't filter by inscriptionId here so we can compute rank within section

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
            { model: SubjectTermGrade, as: 'termGrades' },
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
      const activeInscriptionSubjects = filterActiveGroupSubjects(ins.inscriptionSubjects || []);
      const insSubs = sortSubjectsByOrder(
        activeInscriptionSubjects,
        (is: any) => is.subjectId,
        (is: any) => is.subject?.name || '',
        subjectOrderMap,
      );

      const subjects = insSubs.map((is: any) => {
        const studentSectionId = ins.sectionId || 0;

        // Build term grades array with fallback to qualifications + councilPoints
        const termGradesArr = GradeCalculationService.buildTermGradesWithFallback(
          (is.termGrades || []).map((tg: any) => ({ termId: tg.termId, score: Number(tg.score) })),
          is.qualifications || [],
          is.councilPoints || [],
          terms.map((t: any) => t.id),
        );

        // Build lapsos using the service
        const lapsos = terms.map((t: any) => {
          const councilDone = isCouncilDone(t.id, studentSectionId);
          const finalScore = GradeCalculationService.calculateFinalTermScore(t.id, termGradesArr, councilDone);
          return { termId: t.id, termName: t.name, score: finalScore };
        });

        // Calculate finalScore using the service
        const finalScore = GradeCalculationService.calculateFinalScore(
          lapsos.map((l: any) => ({ termId: l.termId, finalScore: l.score })),
          is.finalGrade ? { finalScore: is.finalGrade.finalScore, gradeType: is.finalGrade.gradeType } : null,
        );

        const subjectName = is.subject?.subjectGroupId
          ? (is.subject?.subjectGroup?.bulletinAbbreviation || is.subject?.subjectGroup?.name || 'Participación en Grupos de Creación, Recreación y Producción')
          : (is.subject?.name || '');

        return {
          id: is.subjectId,
          name: subjectName,
          teacherName: teacherMap.get(is.subjectId) || '',
          usesLiteralGrades: is.subject?.usesLiteralGrades || false,
          includeInAverage: includeInAverageMap.get(is.subjectId) !== false,
          lapsos,
          finalScore,
          status: is.finalGrade?.status || GradeCalculationService.resolveStatus(finalScore, Number(settings.passing_grade || 10)),
        };
      });

      return {
        inscriptionId: ins.id,
        firstName: ins.student?.firstName || '',
        lastName: ins.student?.lastName || '',
        document: ins.student?.document || '',
        documentType: ins.student?.documentType || '',
        sectionName: ins.section?.name || '',
        sectionId: ins.sectionId,
        guideTeacher: guideMap.get(ins.sectionId) || '',
        subjects,
      };
    });

    // Load observations for all students in this boletin.
    // The boletin shows the observation from the last completed term for
    // each student's section (not from an arbitrary term).
    const inscriptionIds = students.map((s: any) => s.inscriptionId);

    // Determine the last completed term per section
    const sectionToLastDoneTerm = new Map<number, number>();
    for (const s of students) {
      const sid = (s as any).sectionId || 0;
      if (sectionToLastDoneTerm.has(sid)) continue;
      let lastDoneTermId: number | null = null;
      for (const t of terms) {
        if (isCouncilDone(t.id, sid)) {
          lastDoneTermId = t.id;
        }
      }
      if (lastDoneTermId != null) {
        sectionToLastDoneTerm.set(sid, lastDoneTermId);
      }
    }

    // Load observations only for the relevant (inscriptionId, termId) pairs
    const observationQueryPairs: { inscriptionId: number; termId: number }[] = [];
    for (const s of students) {
      const sid = (s as any).sectionId || 0;
      const lastDoneTermId = sectionToLastDoneTerm.get(sid);
      if (lastDoneTermId != null) {
        observationQueryPairs.push({ inscriptionId: s.inscriptionId, termId: lastDoneTermId });
      }
    }

    const observationMap = new Map<number, string>();
    if (observationQueryPairs.length > 0) {
      // Load all observations for these inscriptions and pick the right termId per student
      const allObs = await StudentObservation.findAll({
        where: { inscriptionId: inscriptionIds, schoolPeriodId },
      });
      const obsByInscription = new Map<number, Map<number, string>>();
      for (const obs of allObs) {
        if (!obsByInscription.has(obs.inscriptionId)) {
          obsByInscription.set(obs.inscriptionId, new Map());
        }
        obsByInscription.get(obs.inscriptionId)!.set(obs.termId, obs.text);
      }
      for (const pair of observationQueryPairs) {
        const termMap = obsByInscription.get(pair.inscriptionId);
        if (termMap && termMap.has(pair.termId)) {
          observationMap.set(pair.inscriptionId, termMap.get(pair.termId)!);
        }
      }
    }
    students.forEach((s: any) => {
      s.observation = observationMap.get(s.inscriptionId) || '';
    });

    // Compute rank within each section using the service
    const sectionGroups = new Map<number, typeof students>();
    for (const s of students) {
      const sid = (s as any).sectionId || 0;
      if (!sectionGroups.has(sid)) sectionGroups.set(sid, []);
      sectionGroups.get(sid)!.push(s);
    }

    const rankMap = new Map<number, { position: number; total: number }>();
    for (const [, sectionStudents] of sectionGroups) {
      const withAvg = sectionStudents.map((s: any) => {
        const avg = GradeCalculationService.calculateGeneralAverage(s.subjects, 'final');
        return { inscriptionId: s.inscriptionId, avg: avg ?? 0 };
      });
      const sorted = [...withAvg].sort((a, b) => b.avg - a.avg);
      let currentRank = 0;
      let prevAvg: number | null = null;
      sorted.forEach((entry, idx) => {
        if (prevAvg === null || entry.avg !== prevAvg) {
          currentRank = idx + 1;
          prevAvg = entry.avg;
        }
        rankMap.set(entry.inscriptionId, { position: currentRank, total: sorted.length });
      });
    }

    // Add rank info to each student
    const studentsWithRank = students.map((s: any) => {
      const rank = rankMap.get(s.inscriptionId);
      return { ...s, rankPosition: rank?.position || 0, rankTotal: rank?.total || 0 };
    });

    // Filter to only the requested student(s) if inscriptionId was specified
    const finalStudents = inscriptionId
      ? studentsWithRank.filter((s: any) => s.inscriptionId === inscriptionId)
      : studentsWithRank;

    res.json({
      institution: {
        name: settings.institution_name || '',
        period: period.name || period.period || '',
        code: settings.institution_code || '',
        principal: settings.principal_name || '',
        address: settings.institution_address || '',
        phone: settings.institution_phone || '',
        municipality: settings.institution_municipality || '',
        state: settings.institution_state || '',
      },
      passingGrade: Number(settings.passing_grade) || 10,
      grade: { id: grade.id, name: grade.name },
      terms: terms.map((t: any) => ({ id: t.id, name: t.name, order: t.order })),
      students: finalStudents,
    });
  } catch (error: any) {
    console.error('[getBoletinData] Error:', error);
    res.status(500).json({ message: error.message || 'Error al obtener datos de boletín' });
  }
};

// ── General Averages ──────────────────────────────────────────────
// Returns all students in a school period with their per-term grades
// so the frontend can compute averages and rankings dynamically.
export const getGeneralAverages = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = Number(req.query.schoolPeriodId);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es requerido' });
    }

    const terms = await Term.findAll({
      where: { schoolPeriodId },
      order: [['order', 'ASC']],
    });

    // Load PeriodGradeSubject to know which subjects count for average
    const periodGrades = await PeriodGrade.findAll({
      where: { schoolPeriodId },
      attributes: ['id', 'gradeId', 'color'],
    });
    const periodGradeIds = periodGrades.map((pg: any) => pg.id);
    const pgsRecords = periodGradeIds.length > 0
      ? await PeriodGradeSubject.findAll({ where: { periodGradeId: periodGradeIds } })
      : [];
    // Map: gradeId -> Set<subjectId> that count for average
    const gradeIdToPgId = new Map<number, number>();
    const gradeColorMap = new Map<number, string>();
    for (const pg of periodGrades) {
      gradeIdToPgId.set((pg as any).gradeId, (pg as any).id);
      if ((pg as any).color) gradeColorMap.set((pg as any).gradeId, (pg as any).color);
    }
    const includeInAverageMap = new Map<number, Set<number>>(); // gradeId -> subjectIds
    for (const pgs of pgsRecords) {
      if ((pgs as any).includeInAverage === false) continue;
      const pgId = (pgs as any).periodGradeId;
      const gradeId = periodGrades.find((pg: any) => pg.id === pgId)?.gradeId;
      if (gradeId === undefined) continue;
      if (!includeInAverageMap.has(gradeId)) includeInAverageMap.set(gradeId, new Set());
      includeInAverageMap.get(gradeId)!.add((pgs as any).subjectId);
    }

    // Query CouncilChecklist to know which (termId, sectionId) pairs have council done
    const councilChecklists = await CouncilChecklist.findAll({
      where: {
        schoolPeriodId,
        status: 'done',
        termId: terms.map((t: any) => t.id),
      },
      attributes: ['termId', 'sectionId', 'status'],
    });
    const isCouncilDone = GradeCalculationService.buildCouncilDoneChecker(
      councilChecklists.map((c: any) => ({ termId: c.termId, sectionId: c.sectionId, status: c.status })),
    );

    const inscriptions = await Inscription.findAll({
      where: { schoolPeriodId },
      include: [
        { model: Person, as: 'student', attributes: ['id', 'firstName', 'lastName', 'document', 'gender'] },
        { model: Grade, as: 'grade', attributes: ['id', 'name'] },
        { model: Section, as: 'section', attributes: ['id', 'name'] },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          attributes: ['id', 'subjectId'],
          include: [
            { model: SubjectTermGrade, as: 'termGrades', attributes: ['termId', 'score'] },
            { model: Subject, as: 'subject', attributes: ['id', 'usesLiteralGrades'] },
            { model: SubjectFinalGrade, as: 'finalGrade', required: false, attributes: ['finalScore', 'gradeType'] },
            {
              model: Qualification,
              as: 'qualifications',
              attributes: ['score', 'remedialScore', 'isAbsent'],
              include: [{ model: EvaluationPlan, as: 'evaluationPlan', attributes: ['percentage', 'termId'] }],
            },
            { model: CouncilPoint, as: 'councilPoints', attributes: ['termId', 'points'] },
          ],
        },
      ],
      order: [
        [{ model: Grade, as: 'grade' }, 'name', 'ASC'],
        [{ model: Section, as: 'section' }, 'name', 'ASC'],
        [{ model: Person, as: 'student' }, 'lastName', 'ASC'],
        [{ model: Person, as: 'student' }, 'firstName', 'ASC'],
      ],
    });

    const students = inscriptions.map((ins: any) => {
      const gradeId = ins.grade?.id || 0;
      const studentSectionId = ins.section?.id || 0;
      const averageEligibleSubjects = includeInAverageMap.get(gradeId);
      const termIds = terms.map((t: any) => t.id);
      // Build term score map: average of subjects that include in average
      // Only include scores from terms where council is done (final scores)
      const termScoreMap = new Map<number, number[]>();
      // Also build per-subject finalScore for generalAverage (same method as boletin)
      const subjectFinalScores: { finalScore: number | null; includeInAverage: boolean; gradeType?: string | null }[] = [];

      (ins.inscriptionSubjects || []).forEach((is: any) => {
        const includeInAverage = averageEligibleSubjects ? averageEligibleSubjects.has(is.subjectId) : true;
        // Build term grades with fallback to qualifications + councilPoints
        const termGradesArr = GradeCalculationService.buildTermGradesWithFallback(
          (is.termGrades || []).map((tg: any) => ({ termId: tg.termId, score: Number(tg.score) })),
          is.qualifications || [],
          is.councilPoints || [],
          termIds,
        );

        // Build lapsos for finalScore calculation (same as boletin)
        const lapsos = terms.map((t: any) => {
          const councilDone = isCouncilDone(t.id, studentSectionId);
          const finalScore = GradeCalculationService.calculateFinalTermScore(t.id, termGradesArr, councilDone);
          return { termId: t.id, finalScore };
        });

        // Calculate subject finalScore using the service (same as boletin)
        const subjectFinalScore = GradeCalculationService.calculateFinalScore(
          lapsos,
          is.finalGrade ? { finalScore: is.finalGrade.finalScore, gradeType: is.finalGrade.gradeType } : null,
        );

        subjectFinalScores.push({
          finalScore: subjectFinalScore,
          includeInAverage,
          gradeType: is.finalGrade?.gradeType || null,
        });

        // Skip subjects not configured for average (if we have the config)
        if (averageEligibleSubjects && !averageEligibleSubjects.has(is.subjectId)) return;
        termGradesArr.forEach((tg) => {
          // Only include if council is done for this term+section
          if (!isCouncilDone(tg.termId, studentSectionId)) return;
          if (tg.score <= 0) return; // skip zero scores (no data)
          const score = Math.max(MIN_FINAL_GRADE, tg.score);
          if (!termScoreMap.has(tg.termId)) termScoreMap.set(tg.termId, []);
          termScoreMap.get(tg.termId)!.push(score);
        });
      });

      const termGrades = terms.map((t: any) => {
        const councilDone = isCouncilDone(t.id, studentSectionId);
        if (!councilDone) {
          return { termId: t.id, termName: t.name, score: null as number | null };
        }
        const scores = termScoreMap.get(t.id) || [];
        const avg = scores.length > 0
          ? Number((scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(2))
          : null;
        return { termId: t.id, termName: t.name, score: avg };
      });

      // Calculate generalAverage using the same method as boletin (via service)
      const generalAverage = GradeCalculationService.calculateGeneralAverage(subjectFinalScores, 'final');

      return {
        inscriptionId: ins.id,
        firstName: ins.student?.firstName || '',
        lastName: ins.student?.lastName || '',
        document: ins.student?.document || '',
        gender: ins.student?.gender || null,
        gradeId: ins.grade?.id || 0,
        gradeName: ins.grade?.name || '',
        gradeColor: gradeColorMap.get(ins.grade?.id || 0) || null,
        sectionId: ins.section?.id || 0,
        sectionName: ins.section?.name || '',
        termGrades,
        generalAverage,
      };
    });

    res.json({
      terms: terms.map((t: any) => ({ id: t.id, name: t.name, order: t.order })),
      grades: [...new Set(students.map((s: any) => s.gradeId))].map((gid: any) => {
        const s = students.find((st: any) => st.gradeId === gid);
        return { id: gid, name: s?.gradeName || '' };
      }).sort((a: any, b: any) => a.name.localeCompare(b.name)),
      sections: [...new Set(students.map((s: any) => s.sectionId))].map((sid: any) => {
        const s = students.find((st: any) => st.sectionId === sid);
        return { id: sid, name: s?.sectionName || '', gradeId: s?.gradeId || 0 };
      }).sort((a: any, b: any) => a.name.localeCompare(b.name)),
      students,
    });
  } catch (error: any) {
    console.error('[getGeneralAverages] Error:', error);
    res.status(500).json({ message: error.message || 'Error al obtener promedios generales' });
  }
};
