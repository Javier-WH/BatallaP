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
  InscriptionSubjectRevision,
  RevisionPeriod,
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
  PendingSubject,
  PendingSubjectEncounter,
  StudentPeriodOutcome,
} from '@/models/index';
import {
  getSubjectOrderMap,
  sortSubjectsByOrder,
} from '@/services/subjectOrderService';
import { filterActiveGroupSubjects, filterActiveGroupSubjectsForTerm } from '@/services/subjectGroupService';
import { isPassingGrade, resolveGradeStatus, roundFinalGrade, MIN_FINAL_GRADE } from '@/services/gradeEvaluationService';
import { GradeCalculationService } from '@/services/gradeCalculationService';
import { readTemplateNamedRanges, TemplateNamedRanges } from '@/services/templateNamedRanges';
import { sortInscriptions } from '@/services/studentSortService';

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
  subjectColList: { col: number; abbr: string; subjIdx: number; subjectId: number }[],
  subjectToSubjIndex: Map<number, number>,
  calculateFinalScore: (insSub: any) => number | null,
  subjectOrderMap: Map<number, number>,
  studentOffset: number,
  sourceSheetName?: string,
  gradeName?: string,
  sectionName?: string,
  letterGradesConfig?: { letter: string; max: number }[],
  lastCouncilDate?: string | null,
  isMpSection?: boolean,
  isRevisionSection?: boolean,
  isAbsentFn?: (insSub: any) => boolean,
): void {
  // Only writes when value is non-empty. Empty/undefined values leave the
  // cell untouched, preserving the template's decorative content (e.g. "***"
  // placeholders) for unused student rows.
  // For cloned pages (e.g. "1er Año (Regulares 2)"), the named ranges are
  // registered for the original sheet (e.g. "1er Año"), so we look up
  // coordinates by the original sheet's name and write to the same absolute
  // coordinates in the destination sheet.
  const lookupSheetName = sourceSheetName || sheetName;
  // Map of Venezuelan states with correct accents (uppercase)
  const STATE_ACCENTS: Record<string, string> = {
    'GUARICO': 'GUÁRICO',
    'AMAZONAS': 'AMAZONAS',
    'ANZOATEGUI': 'ANZOÁTEGUI',
    'APURE': 'APURE',
    'ARAGUA': 'ARAGUA',
    'BARINAS': 'BARINAS',
    'BOLIVAR': 'BOLÍVAR',
    'CARABOBO': 'CARABOBO',
    'COJEDES': 'COJEDES',
    'DELTA AMACURO': 'DELTA AMACURO',
    'FALCON': 'FALCÓN',
    'GUAYANA': 'GUAYANA',
    'LARA': 'LARA',
    'MERIDA': 'MÉRIDA',
    'MIRANDA': 'MIRANDA',
    'MONAGAS': 'MONAGAS',
    'NUEVA ESPARTA': 'NUEVA ESPARTA',
    'PORTUGUESA': 'PORTUGUESA',
    'SUCRE': 'SUCRE',
    'TACHIRA': 'TÁCHIRA',
    'TRUJILLO': 'TRUJILLO',
    'VARGAS': 'VARGAS',
    'YARACUY': 'YARACUY',
    'ZULIA': 'ZULIA',
    'DISTRITO CAPITAL': 'DISTRITO CAPITAL',
    'DEPENDENCIAS FEDERALES': 'DEPENDENCIAS FEDERALES',
  };
  const fixAccents = (name: string, value: string): string => {
    if (name === 'inst_state') {
      const upper = value.toUpperCase();
      return STATE_ACCENTS[upper] || upper;
    }
    return value;
  };
  const setByRange = (name: string, value: any) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'string') {
      value = value.toUpperCase();
      value = fixAccents(name, value);
    }
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
  setByRange('inst_state', settings.institution_state || plantel?.state);
  setByRange('inst_cdcee', settings.institution_cdcee);
  setByRange('inst_director', settings.director_name);
  setByRange('inst_director_doc', settings.director_document);
  // inst_director_2 uses "Apellidos, Nombres" format if available, else falls back to director_name
  const directorFirstNames = (settings.director_first_names || '').trim();
  const directorLastNames = (settings.director_last_names || '').trim();
  const directorLong = (directorLastNames && directorFirstNames)
    ? `${directorLastNames}, ${directorFirstNames}`
    : settings.director_name;
  setByRange('inst_director_2', directorLong);
  setByRange('inst_director_doc_2', settings.director_document);
  setByRange('inst_grade', gradeName);
  setByRange('inst_section', sectionName);

  // Write the council date to cell Z4 (no named range defined in template).
  // Format: "MES DE AÑO" (e.g. "JULIO DE 2026") in uppercase.
  if (lastCouncilDate) {
    const d = new Date(lastCouncilDate);
    if (!isNaN(d.getTime())) {
      const months = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
      const dateStr = `${months[d.getUTCMonth()]} DE ${d.getUTCFullYear()}`;
      // Try named range first, fall back to direct Z4 cell
      let dateRef = namedRanges.getCell(lookupSheetName, 'inst_date');
      if (!dateRef) {
        for (const sn of namedRanges.bySheet.keys()) {
          dateRef = namedRanges.getCell(sn, 'inst_date');
          if (dateRef) break;
        }
      }
      if (dateRef) {
        sheet.getCell(dateRef.cell).value = dateStr;
      } else {
        // Direct write to Z4 (hardcoded in template)
        sheet.getCell('Z4').value = dateStr;
      }
    }
  }

  for (let n = 1; n <= MAX_STUDENTS_PER_SHEET; n++) {
    const studentIdx = studentOffset + (n - 1);
    const ins = students[studentIdx];

    // If no student for this row, do nothing — keep the template's placeholder
    // (e.g. "***") intact.
    if (!ins) continue;

    const student = ins.student;
    const residence = student?.residence;

    setByRange('std_num_' + n, String(studentIdx + 1).padStart(2, '0'));

    const documentType = student?.documentType;
    // Stored documents may already contain a type prefix (e.g. V777777).
    // Remove it before applying the canonical export format.
    const document = String(student?.document || '').replace(/^(V|E|P|CE)\s*[-.]?\s*/i, '');
    const docType = documentType === 'Venezolano' ? 'V' :
                    documentType === 'Extranjero' ? 'E' :
                    documentType === 'Pasaporte' ? 'P' : '';
    setByRange('std_doc_' + n, docType ? `${docType} ${document}` : document);
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

    // For MP sections, use pendingSubjects; for regular, use inscriptionSubjects
    const insSubjects = isMpSection
      ? (ins.pendingSubjects || [])
      : sortSubjectsByOrder(
          ins.inscriptionSubjects || [],
          (is: any) => is.subjectId,
          (is: any) => is.subject?.name,
          subjectOrderMap
        );

    for (let i = 0; i < subjectColList.length; i++) {
      const subjId = subjectColList[i].subjectId;
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
      // For MP sections, check if the student was absent (I) instead of showing 00
      const mpIsAbsent = isMpSection && insSub ? (() => {
        const encs = (insSub.encounters || []).sort((a: any, b: any) => a.encounterNumber - b.encounterNumber);
        const approvedEnc = encs.find((e: any) => e.score !== null && e.score >= 10 && !e.isAbsent);
        if (approvedEnc) return false;
        const lastScored = [...encs].reverse().find((e: any) => e.score !== null || e.isAbsent);
        return lastScored ? !!lastScored.isAbsent : false;
      })() : false;
      // For revision sections, check if the last scored revision was an absence
      const revIsAbsent = isRevisionSection && insSub && isAbsentFn ? isAbsentFn(insSub) : false;
      if ((isMpSection && mpIsAbsent) || (isRevisionSection && revIsAbsent)) {
        sheet.getRow(row).getCell(col).value = 'I';
      } else if (isLiteral) {
        if (score != null) {
          sheet.getRow(row).getCell(col).value = numericToLetter(score, letterGradesConfig || []).toUpperCase();
        }
      } else if (score != null) {
        sheet.getRow(row).getCell(col).value = padNumber(score);
      }
    }

    if (!isMpSection) {
      const groupedInsSub = insSubjects.find((is: any) =>
        groupedSubjectIds.has(is.subjectId)
      );
      if (groupedInsSub?.subject?.name) {
        setByRange('std_part_' + n, groupedInsSub.subject.name);
      }
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

    const isMpSection = section.name.toUpperCase() === 'MATERIA PENDIENTE';

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
      attributes: ['termId', 'sectionId', 'status', 'completedAt'],
    });
    // Find the most recent council completion date for this section
    const councilDates = councilChecklists
      .filter((c: any) => c.completedAt)
      .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    let lastCouncilDate = councilDates.length > 0 ? String(councilDates[0].completedAt) : null;

    // For MP sections, use the date of the last encounter with a score
    // (instead of the council completion date) for inst_date.
    if (isMpSection) {
      const lastEncounter: any = await PendingSubjectEncounter.findOne({
        where: { score: { [Op.ne]: null } },
        order: [['date', 'DESC']],
        raw: true,
      });
      if (lastEncounter?.date) {
        lastCouncilDate = String(lastEncounter.date);
      }
    }
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
        ...(isMpSection ? [] : [{
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            { model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] },
            { model: SubjectFinalGrade, as: 'finalGrade', where: { gradeType: 'regular' }, required: false },
            { model: SubjectTermGrade, as: 'termGrades', required: false },
            { model: Qualification, as: 'qualifications', include: [{ model: EvaluationPlan, as: 'evaluationPlan' }], required: false },
            { model: CouncilPoint, as: 'councilPoints', required: false },
          ],
        }]),
        ...(isMpSection ? [{
          model: PendingSubject,
          as: 'pendingSubjects',
          required: true,
          include: [
            { model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] },
            { model: PendingSubjectEncounter, as: 'encounters', required: false },
          ],
        }] : []),
      ],
      order: [
        [{ model: Person, as: 'student' }, 'lastName', 'ASC'],
        [{ model: Person, as: 'student' }, 'firstName', 'ASC'],
      ],
    });

    if (inscriptions.length === 0) {
      return res.status(404).json({ message: 'No hay estudiantes inscritos en esta seccion' });
    }

    // Sort students canonically: document type priority → document number → lastName → firstName
    sortInscriptions(inscriptions as any[]);

    const subjectOrderMap = await getSubjectOrderMap(pg.id);

    const subjectMap = new Map<number, { id: number; name: string; abbreviation: string | null; subjectGroupId: number | null; subjectGroupName: string | null; subjectGroupShortAbbr: string | null; subjectGroupLongAbbr: string | null; usesLiteralGrades: boolean }>();

    if (isMpSection) {
      // For MP section, build subjectMap from pendingSubjects (each student's
      // pending subjects with their subject info).
      inscriptions.forEach((ins: any) => {
        (ins.pendingSubjects || []).forEach((ps: any) => {
          if (ps.subject && !subjectMap.has(ps.subjectId)) {
            subjectMap.set(ps.subjectId, {
              id: ps.subject.id,
              name: ps.subject.name,
              abbreviation: ps.subject.abbreviation || null,
              subjectGroupId: ps.subject.subjectGroupId || null,
              subjectGroupName: ps.subject.subjectGroup?.name || null,
              subjectGroupShortAbbr: ps.subject.subjectGroup?.shortAbbreviation || null,
              subjectGroupLongAbbr: ps.subject.subjectGroup?.longAbbreviation || null,
              usesLiteralGrades: ps.subject.usesLiteralGrades || false,
            });
          }
        });
      });
    } else {
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
    }

    // Also seed subjectMap from the grade's curriculum (PeriodGradeSubject) so
    // that subjects added to the grade appear in the Excel even if no student
    // has an InscriptionSubject for them yet.
    // For MP sections, we still query PeriodGradeSubject to know the canonical
    // order and positions, but we do NOT add them to subjectMap — only subjects
    // with actual PendingSubject records get written.
    const pgSubjects = await PeriodGradeSubject.findAll({
      where: { periodGradeId: pg.id },
      include: [
        { model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] },
      ],
    });
    if (!isMpSection) {
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

    // For MP sections, build academicSubjects from the full grade curriculum
    // (PeriodGradeSubject) in canonical order, so each subject maps to its
    // correct subj_i position. Only subjects that have PendingSubject students
    // (i.e., are in subjectMap) will actually be written to cells; the rest
    // keep their template placeholders (asterisks).
    // For regular sections, collapse group subjects into one column.
    let academicSubjects: any[];
    if (isMpSection) {
      const mpSubjectIds = new Set(allSubjects.map(s => s.id));
      academicSubjects = pgSubjects
        .map((pgs: any) => {
          const subj = pgs.subject;
          if (!subj) return null;
          return {
            id: subj.id,
            name: subj.name,
            abbreviation: subj.abbreviation || null,
            subjectGroupId: subj.subjectGroupId || null,
            subjectGroupName: subj.subjectGroup?.name || null,
            subjectGroupShortAbbr: subj.subjectGroup?.shortAbbreviation || null,
            subjectGroupLongAbbr: subj.subjectGroup?.longAbbreviation || null,
            usesLiteralGrades: subj.usesLiteralGrades || false,
            hasMpStudents: mpSubjectIds.has(subj.id),
          };
        })
        .filter(Boolean);
    } else {
      // The Excel has one column per academic subject, but group subjects are
      // alternatives: a student has one subject from a group, not all of them.
      // Collapse all official subjects with the same subjectGroupId into one
      // representative column while preserving every student's actual subject
      // for the grade lookup below.
      const officialSubjects = allSubjects.filter(s => pgSubjectIds.has(s.id));
      const seenGroupIds = new Set<number>();
      academicSubjects = officialSubjects.filter((subject) => {
        if (subject.subjectGroupId === null) return true;
        if (seenGroupIds.has(subject.subjectGroupId)) return false;
        seenGroupIds.add(subject.subjectGroupId);
        return true;
      });
    }

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

    // Apply manual group signers from Setting. For each subject group that has
    // a saved signer, override the teacherMap so that every subject in the group
    // maps to the chosen signer's data. This ensures the collapsed group column
    // shows the manually-selected teacher instead of the first-by-iteration one.
    const groupSubjectMap = new Map<number, number[]>(); // subjectGroupId → [subjectId...]
    for (const pgs of pgSubjects) {
      const subj = (pgs as any).subject;
      if (subj && subj.subjectGroupId) {
        const arr = groupSubjectMap.get(subj.subjectGroupId) || [];
        arr.push(subj.id);
        groupSubjectMap.set(subj.subjectGroupId, arr);
      }
    }
    if (groupSubjectMap.size > 0) {
      const signerKeys = Array.from(groupSubjectMap.keys()).map(
        (gid) => `group_signer_${Number(schoolPeriodId)}_${Number(gradeId)}_${gid}`
      );
      const signerSettings = await Setting.findAll({ where: { key: signerKeys } });
      for (const s of signerSettings) {
        const signerPersonId = Number(s.value);
        if (!signerPersonId) continue;
        // Extract subjectGroupId from key: group_signer_{periodId}_{gradeId}_{subjectGroupId}
        const parts = s.key.split('_');
        const subjectGroupId = Number(parts[parts.length - 1]);
        const subjectIds = groupSubjectMap.get(subjectGroupId);
        if (!subjectIds) continue;
        // Find the signer's data from the teacherAssignments we already have.
        // The signer might be assigned to any subject in the group (any section).
        // We look for a TeacherAssignment whose teacherId matches signerPersonId.
        let signerData: { fullName: string; docWithType: string } | null = null;
        for (const ta of teacherAssignments) {
          const teacher = (ta as any).teacher;
          if (teacher && teacher.id === signerPersonId) {
            const docType = teacher.documentType === 'Venezolano' ? 'V' :
                            teacher.documentType === 'Extranjero' ? 'E' : 'V';
            signerData = {
              fullName: `${teacher.lastName || ''} ${teacher.firstName || ''}`.trim(),
              docWithType: docType + ' ' + (teacher.document || ''),
            };
            break;
          }
        }
        if (!signerData) {
          // The signer is not in this section's TeacherAssignments. Fetch from Person.
          const signerPerson = await Person.findByPk(signerPersonId, {
            attributes: ['firstName', 'lastName', 'documentType', 'document'],
          });
          if (signerPerson) {
            const docType = signerPerson.documentType === 'Venezolano' ? 'V' :
                            signerPerson.documentType === 'Extranjero' ? 'E' : 'V';
            signerData = {
              fullName: `${signerPerson.lastName || ''} ${signerPerson.firstName || ''}`.trim(),
              docWithType: docType + ' ' + (signerPerson.document || ''),
            };
          }
        }
        if (signerData) {
          // Override all subjects in the group to use the signer
          for (const subjId of subjectIds) {
            teacherMap.set(subjId, signerData);
          }
        }
      }
    }

    // For MP sections, calculate score from PendingSubject encounters.
    // For regular sections, use the standard term-grade calculation.
    const calculateMpScore = (pendingSubj: any): number | null => {
      const encs = (pendingSubj.encounters || []).sort((a: any, b: any) => a.encounterNumber - b.encounterNumber);
      // Find the encounter where the student approved (score >= 10, not absent)
      const approvedEnc = encs.find((e: any) => e.score !== null && e.score >= 10 && !e.isAbsent);
      if (approvedEnc) return Number(approvedEnc.score);
      // Otherwise, find the last encounter with a non-null score
      const lastScored = [...encs].reverse().find((e: any) => e.score !== null || e.isAbsent);
      if (lastScored) return lastScored.isAbsent ? 0 : Number(lastScored.score);
      return null;
    };

    const calculateFinalScore = isMpSection
      ? (insSub: any): number | null => calculateMpScore(insSub)
      : (insSub: any): number | null => {
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
      // Look up the template assigned to this grade (per-grade only;
      // all sections share the same template).
      const { Setting } = await import('@/models/index');
      const tryKey = (k: string) => Setting.findOne({ where: { key: k } });
      const gradeId = String(grade.id);
      const gradeKey = `template_assignment:grade:${gradeId}`;
      const assignment = await tryKey(gradeKey);
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
    const sortedAcademicSubjects = [...academicSubjects].sort((a: any, b: any) => {
      const orderA = subjectOrderMap.get(a.id) ?? 999;
      const orderB = subjectOrderMap.get(b.id) ?? 999;
      return orderA - orderB;
    });

    const passingGrade = Number(settings.passing_grade) || 10;

    // Build statistics for exactly the students supplied. Grouped subjects
    // share one column and each student is counted once using the group subject
    // actually enrolled for that student.
    const buildSubjectStats = (students: any[]) => {
      const studentCountBySubject = new Map<number, number>();
      const failedCountBySubject = new Map<number, number>();
      const passedCountBySubject = new Map<number, number>();
      const zeroCountBySubject = new Map<number, number>();

      for (const columnSubject of sortedAcademicSubjects) {
        if (isMpSection && !(columnSubject as any).hasMpStudents) continue;
        let enrolled = 0;
        let failed = 0;
        let passed = 0;
        let zero = 0;

        for (const ins of students) {
          const subjectsList = isMpSection ? (ins as any).pendingSubjects : (ins as any).inscriptionSubjects;
          const insSub = subjectsList?.find((is: any) =>
            is.subjectId === columnSubject.id || (
              columnSubject.subjectGroupId !== null &&
              columnSubject.subjectGroupId !== undefined &&
              is.subject?.subjectGroupId === columnSubject.subjectGroupId
            )
          );
          if (!insSub) continue;

          enrolled++;
          const score = calculateFinalScore(insSub);
          if (score == null) continue;
          if (score === 0) zero++;
          if (isPassingGrade(score, passingGrade)) passed++;
          else failed++;
        }

        studentCountBySubject.set(columnSubject.id, enrolled);
        failedCountBySubject.set(columnSubject.id, failed);
        passedCountBySubject.set(columnSubject.id, passed);
        zeroCountBySubject.set(columnSubject.id, zero);
      }

      return { studentCountBySubject, failedCountBySubject, passedCountBySubject, zeroCountBySubject };
    };

    const { studentCountBySubject, failedCountBySubject, passedCountBySubject, zeroCountBySubject } =
      buildSubjectStats(inscriptions);
    const totalStudents = inscriptions.length;

    // Discover subj_i named ranges and WRITE the abbreviation of the i-th
    // subject (in canonical order) into that cell. The map is subjIndex → subjectId
    // so that fillSheetByNamedRanges can look up which subject a column belongs to.
    const subjectColList: { col: number; abbr: string; subjIdx: number; subjectId: number }[] = [];
    const subjectToSubjIndex = new Map<number, number>();
    let subjIdx = 1;
    while (true) {
      const ref = findRef('subj_' + subjIdx);
      if (!ref) break;
      const subj = sortedAcademicSubjects[subjIdx - 1];
      if (subj && (!isMpSection || (subj as any).hasMpStudents)) {
        const abbrText = subj.subjectGroupId
          ? (subj.subjectGroupShortAbbr || subj.subjectGroupLongAbbr || subj.name)
          : (subj.abbreviation || subj.name);
        const headerText = abbrText.toUpperCase();
        sheet!.getCell(ref.cell).value = headerText;
        subjectColList.push({ col: ref.col, abbr: abbrText.toUpperCase(), subjIdx, subjectId: subj.id });
        subjectToSubjIndex.set(subjIdx, subj.id);
        // Also write the full subject name into subjname_i if defined
        const nameRef = findRef('subjname_' + subjIdx);
        const nameText = (subj.subjectGroupId
          ? 'Participación en Grupos de \r\nCreación, Recreación y Producción'
          : subj.name).toUpperCase();
        if (nameRef) {
          sheet!.getCell(nameRef.cell).value = nameText;
        }
        // The area table needs its own named ranges because Excel does not
        // allow the global subj_N name to point to two different cells.
        const areaRef = findRef('area_subj_' + subjIdx);
        const areaNameRef = findRef('area_subjname_' + subjIdx);
        const areaHeaderText = (subj.subjectGroupId
          ? (subj.subjectGroupLongAbbr || '-')
          : (subj.abbreviation || '-')).toUpperCase();
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
        if (isMpSection && !(subj as any).hasMpStudents) continue;
        const teacher = teacherMap.get(subj.id);
        if (!teacher) continue;

        const teacherNameRef = findRef(`teacher_name_${i}`);
        const teacherDocRef = findRef(`teacher_doc_${i}`);
        const teacherSignRef = findRef(`teacher_sign_${i}`);
        if (teacherNameRef) ws.getCell(teacherNameRef.cell).value = teacher.fullName.toUpperCase();
        if (teacherDocRef) ws.getCell(teacherDocRef.cell).value = teacher.docWithType.toUpperCase();
        // Remove the template placeholder only when a teacher exists. If no
        // teacher is assigned, leave the template cell untouched.
        if (teacherSignRef) ws.getCell(teacherSignRef.cell).value = '';
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

      const pageStats = buildSubjectStats(
        studentList.slice(studentOffset, studentOffset + pageCount)
      );
      const {
        studentCountBySubject,
        failedCountBySubject,
        passedCountBySubject,
        zeroCountBySubject,
      } = pageStats;

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
        if (subj && (!isMpSection || (subj as any).hasMpStudents)) {
          const abbrText = subj.subjectGroupId
            ? (subj.subjectGroupShortAbbr || subj.subjectGroupLongAbbr || subj.name)
            : (subj.abbreviation || subj.name);
          const headerText = abbrText.toUpperCase();
          if (ref) ws.getCell(ref.cell).value = headerText;
          const nameText = (subj.subjectGroupId
            ? 'Participación en Grupos de \r\nCreación, Recreación y Producción'
            : subj.name).toUpperCase();
          if (nameRef) {
            ws.getCell(nameRef.cell).value = nameText;
          }
          const areaRef = findRef('area_subj_' + i);
          const areaNameRef = findRef('area_subjname_' + i);
          const areaHeaderText = (subj.subjectGroupId
            ? (subj.subjectGroupLongAbbr || '-')
            : (subj.abbreviation || '-')).toUpperCase();
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
            ws.getCell(unenrolledRef.cell).value = pageCount - (studentCountBySubject.get(subj.id) || 0);
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
        lastCouncilDate,
        isMpSection,
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
      const names = renderGroup(dtg.students, isMpSection ? 'Materia Pendiente' : 'Final', dtg.label, isFirst);
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

// ── Resumen de Revisión ─────────────────────────────────────────────
// Same template and layout as exportPerformanceSummary, but:
//  - Only students with InscriptionSubjectRevision entries are included
//  - Only subjects that have revision entries appear as columns
//  - Each cell shows the revision result (approval score or last score)
export const exportRevisionSummary = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, gradeId, sectionId, template } = req.query;

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

    // Find the revision period for this school period
    const revisionPeriod = await RevisionPeriod.findOne({
      where: { schoolPeriodId: Number(schoolPeriodId) },
    });
    if (!revisionPeriod) {
      return res.status(404).json({ message: 'No hay período de revisión para este año escolar' });
    }

    const gradeOrder = grade.order || 1;
    const gradeSuffix = gradeOrder === 1 || gradeOrder === 3 ? 'ER' : gradeOrder === 2 ? 'DO' : 'TO';
    const templateGradeName = `${gradeOrder}${gradeSuffix} AÑO`;
    const sheetName = gradeOrderToSheetName[gradeOrder] || '1er Año';

    const pg = await PeriodGrade.findOne({
      where: { schoolPeriodId: Number(schoolPeriodId), gradeId: Number(gradeId) },
    });
    if (!pg) return res.status(404).json({ message: 'Estructura academica no encontrada' });

    // Find all InscriptionSubjectRevision entries for this revision period + section
    const revisionEntries = await InscriptionSubjectRevision.findAll({
      where: {
        revisionPeriodId: revisionPeriod.id,
      },
      include: [
        {
          model: InscriptionSubject,
          as: 'inscriptionSubject',
          required: true,
          include: [
            { model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] },
            {
              model: Inscription,
              as: 'inscription',
              where: {
                schoolPeriodId: Number(schoolPeriodId),
                sectionId: Number(sectionId),
                gradeId: Number(gradeId),
              },
              include: [{ association: 'student', include: [{ model: PersonResidence, as: 'residence' }] }],
            },
          ],
        },
      ],
    });

    if (revisionEntries.length === 0) {
      return res.status(404).json({ message: 'No hay estudiantes con revisión en esta sección' });
    }

    // A revision row is created for every enrolled subject when the repair
    // period opens, with status 'pending' and a null score. Those rows do not
    // represent an actual repair grade, so only rows that were really graded
    // count towards the report.
    const isGradedRevision = (rev: any) =>
      rev.score !== null && rev.score !== undefined;

    // Build a set of subjectIds that have at least one graded revision
    const revisionSubjectIds = new Set<number>();
    for (const rev of revisionEntries) {
      if (!isGradedRevision(rev)) continue;
      const insSub = (rev as any).inscriptionSubject;
      if (insSub?.subject) {
        revisionSubjectIds.add(insSub.subject.id);
      }
    }

    if (revisionSubjectIds.size === 0) {
      return res.status(404).json({ message: 'No hay notas de revisión registradas en esta sección' });
    }

    // Build a set of personIds (students) that have at least one graded revision
    const revisionStudentIds = new Set<number>();
    for (const rev of revisionEntries) {
      if (!isGradedRevision(rev)) continue;
      const ins = (rev as any).inscriptionSubject?.inscription;
      if (ins?.personId) {
        revisionStudentIds.add(ins.personId);
      }
    }

    // Build a map: inscriptionSubjectId → revisions array
    const revisionsByInsSub = new Map<number, any[]>();
    for (const rev of revisionEntries) {
      if (!revisionsByInsSub.has(rev.inscriptionSubjectId)) {
        revisionsByInsSub.set(rev.inscriptionSubjectId, []);
      }
      revisionsByInsSub.get(rev.inscriptionSubjectId)!.push(rev);
    }

    // Load inscriptions for ONLY the students that have revision entries
    const inscriptions = await Inscription.findAll({
      where: {
        schoolPeriodId: Number(schoolPeriodId),
        sectionId: Number(sectionId),
        gradeId: Number(gradeId),
        personId: { [Op.in]: Array.from(revisionStudentIds) },
      },
      include: [
        {
          model: Person,
          as: 'student',
          include: [{ model: PersonResidence, as: 'residence' }],
        },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            { model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] },
          ],
        },
      ],
      order: [
        [{ model: Person, as: 'student' }, 'lastName', 'ASC'],
        [{ model: Person, as: 'student' }, 'firstName', 'ASC'],
      ],
    });

    if (inscriptions.length === 0) {
      return res.status(404).json({ message: 'No hay estudiantes con revisión en esta sección' });
    }

    sortInscriptions(inscriptions as any[]);

    const subjectOrderMap = await getSubjectOrderMap(pg.id);

    // Query PeriodGradeSubject to get canonical order and subject info
    const pgSubjects = await PeriodGradeSubject.findAll({
      where: { periodGradeId: pg.id },
      include: [{ model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] }],
    });

    // Build academicSubjects from the FULL grade curriculum so that each
    // subject keeps its canonical position (subj_1, subj_2, …). Subjects
    // without repair grades are flagged and simply left untouched, preserving
    // the template's own placeholders ("**").
    const academicSubjects: any[] = pgSubjects
      .map((pgs: any) => {
        const subj = pgs.subject;
        if (!subj) return null;
        return {
          id: subj.id,
          name: subj.name,
          abbreviation: subj.abbreviation || null,
          subjectGroupId: subj.subjectGroupId || null,
          subjectGroupName: subj.subjectGroup?.name || null,
          subjectGroupShortAbbr: subj.subjectGroup?.shortAbbreviation || null,
          subjectGroupLongAbbr: subj.subjectGroup?.longAbbreviation || null,
          usesLiteralGrades: subj.usesLiteralGrades || false,
          hasRevisionStudents: revisionSubjectIds.has(subj.id),
        };
      })
      .filter(Boolean) as any[];

    // Query teacher assignments for this section
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

    // Apply manual group signers from Setting (same logic as exportPerformanceSummary)
    const groupSubjectMap = new Map<number, number[]>();
    for (const pgs of pgSubjects) {
      const subj = (pgs as any).subject;
      if (subj && subj.subjectGroupId) {
        const arr = groupSubjectMap.get(subj.subjectGroupId) || [];
        arr.push(subj.id);
        groupSubjectMap.set(subj.subjectGroupId, arr);
      }
    }
    if (groupSubjectMap.size > 0) {
      const signerKeys = Array.from(groupSubjectMap.keys()).map(
        (gid) => `group_signer_${Number(schoolPeriodId)}_${Number(gradeId)}_${gid}`
      );
      const signerSettings = await Setting.findAll({ where: { key: signerKeys } });
      for (const s of signerSettings) {
        const signerPersonId = Number(s.value);
        if (!signerPersonId) continue;
        const parts = s.key.split('_');
        const subjectGroupId = Number(parts[parts.length - 1]);
        const subjectIds = groupSubjectMap.get(subjectGroupId);
        if (!subjectIds) continue;
        let signerData: { fullName: string; docWithType: string } | null = null;
        for (const ta of teacherAssignments) {
          const teacher = (ta as any).teacher;
          if (teacher && teacher.id === signerPersonId) {
            const docType = teacher.documentType === 'Venezolano' ? 'V' :
                            teacher.documentType === 'Extranjero' ? 'E' : 'V';
            signerData = {
              fullName: `${teacher.lastName || ''} ${teacher.firstName || ''}`.trim(),
              docWithType: docType + ' ' + (teacher.document || ''),
            };
            break;
          }
        }
        if (!signerData) {
          const signerPerson = await Person.findByPk(signerPersonId, {
            attributes: ['firstName', 'lastName', 'documentType', 'document'],
          });
          if (signerPerson) {
            const docType = signerPerson.documentType === 'Venezolano' ? 'V' :
                            signerPerson.documentType === 'Extranjero' ? 'E' : 'V';
            signerData = {
              fullName: `${signerPerson.lastName || ''} ${signerPerson.firstName || ''}`.trim(),
              docWithType: docType + ' ' + (signerPerson.document || ''),
            };
          }
        }
        if (signerData) {
          for (const subjId of subjectIds) {
            teacherMap.set(subjId, signerData);
          }
        }
      }
    }

    // Calculate revision score: if approved in any opportunity → approval score,
    // otherwise the last recorded score, otherwise null.
    // Returns { score, isAbsent } so the Excel can show "I" for absent students.
    const calculateRevisionScore = (insSub: any): number | null => {
      const revs = revisionsByInsSub.get(insSub.id) || [];
      if (revs.length === 0) return null;
      const sorted = revs.sort((a: any, b: any) => a.opportunity - b.opportunity);
      const approved = sorted.find((r: any) => r.status === 'approved' && r.score != null);
      if (approved) return Number(approved.score);
      const lastScored = [...sorted].reverse().find((r: any) => r.score != null);
      return lastScored ? Number(lastScored.score) : null;
    };
    // Check if the last scored revision for this insSub was an absence.
    const isRevisionAbsent = (insSub: any): boolean => {
      const revs = revisionsByInsSub.get(insSub.id) || [];
      if (revs.length === 0) return false;
      const sorted = revs.sort((a: any, b: any) => a.opportunity - b.opportunity);
      const approved = sorted.find((r: any) => r.status === 'approved' && r.score != null);
      if (approved) return false;
      const lastScored = [...sorted].reverse().find((r: any) => r.score != null);
      return lastScored ? !!lastScored.isAbsent : false;
    };

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

    // Only grouped subjects that actually have repair grades may write the
    // "Participación en Grupos" column; otherwise leave the template as is.
    const groupedSubjectIds = new Set(
      academicSubjects
        .filter((s: any) => s.subjectGroupId !== null && s.hasRevisionStudents)
        .map((s: any) => s.id)
    );

    // Resolve template path (same logic as exportPerformanceSummary)
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
      const tryKey = (k: string) => Setting.findOne({ where: { key: k } });
      const gradeIdStr = String(grade.id);
      const gradeKey = `template_assignment:grade:${gradeIdStr}`;
      const assignment = await tryKey(gradeKey);
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

    const sortedAcademicSubjects = [...academicSubjects].sort((a: any, b: any) => {
      const orderA = subjectOrderMap.get(a.id) ?? 999;
      const orderB = subjectOrderMap.get(b.id) ?? 999;
      return orderA - orderB;
    });

    const passingGrade = Number(settings.passing_grade) || 10;

    // Build statistics
    const buildSubjectStats = (students: any[]) => {
      const studentCountBySubject = new Map<number, number>();
      const failedCountBySubject = new Map<number, number>();
      const passedCountBySubject = new Map<number, number>();
      const zeroCountBySubject = new Map<number, number>();

      for (const columnSubject of sortedAcademicSubjects as any[]) {
        if (!columnSubject?.hasRevisionStudents) continue;
        let enrolled = 0;
        let failed = 0;
        let passed = 0;
        let zero = 0;

        for (const ins of students) {
          const insSub = (ins.inscriptionSubjects || []).find((is: any) =>
            is.subjectId === columnSubject.id || (
              columnSubject.subjectGroupId !== null &&
              columnSubject.subjectGroupId !== undefined &&
              is.subject?.subjectGroupId === columnSubject.subjectGroupId
            )
          );
          if (!insSub) continue;

          // Count only students that actually have a repair grade for this
          // subject, not everyone enrolled in it.
          const score = calculateRevisionScore(insSub);
          if (score == null) continue;
          enrolled++;
          if (score === 0) zero++;
          if (isPassingGrade(score, passingGrade)) passed++;
          else failed++;
        }

        studentCountBySubject.set(columnSubject.id, enrolled);
        failedCountBySubject.set(columnSubject.id, failed);
        passedCountBySubject.set(columnSubject.id, passed);
        zeroCountBySubject.set(columnSubject.id, zero);
      }

      return { studentCountBySubject, failedCountBySubject, passedCountBySubject, zeroCountBySubject };
    };

    // Total students in the section (ALL enrolled students, not only those
    // with repair grades). Used for the "no inscritos" per-subject count so
    // it reflects the real section size.
    const totalStudents = await Inscription.count({
      where: {
        schoolPeriodId: Number(schoolPeriodId),
        sectionId: Number(sectionId),
        gradeId: Number(gradeId),
      },
    });

    // Build the subject-column map without writing anything to the template.
    // Headers and statistics are written later per page, based on the scores
    // present in that page only.
    const subjectColList: { col: number; abbr: string; subjIdx: number; subjectId: number }[] = [];
    const subjectToSubjIndex = new Map<number, number>();
    let subjIdx = 1;
    while (true) {
      const ref = findRef('subj_' + subjIdx);
      if (!ref) break;
      const subj = sortedAcademicSubjects[subjIdx - 1];
      if (subj && (subj as any).hasRevisionStudents) {
        const abbrText = subj.subjectGroupId
          ? (subj.subjectGroupShortAbbr || subj.subjectGroupLongAbbr || subj.name)
          : (subj.abbreviation || subj.name);
        subjectColList.push({ col: ref.col, abbr: abbrText.toUpperCase(), subjIdx, subjectId: subj.id });
        subjectToSubjIndex.set(subjIdx, subj.id);
      }
      subjIdx++;
    }

    // Write teacher data only for subjects that have a score on the page.
    const setTeacherData = (ws: ExcelJS.Worksheet, activeSubjectIds: Set<number>) => {
      for (let i = 1; i <= sortedAcademicSubjects.length; i++) {
        const subj = sortedAcademicSubjects[i - 1];
        if (!subj || !activeSubjectIds.has(subj.id)) continue;
        const teacher = teacherMap.get(subj.id);
        if (!teacher) continue;

        const teacherNameRef = findRef(`teacher_name_${i}`);
        const teacherDocRef = findRef(`teacher_doc_${i}`);
        const teacherSignRef = findRef(`teacher_sign_${i}`);
        if (teacherNameRef) ws.getCell(teacherNameRef.cell).value = teacher.fullName.toUpperCase();
        if (teacherDocRef) ws.getCell(teacherDocRef.cell).value = teacher.docWithType.toUpperCase();
        if (teacherSignRef) ws.getCell(teacherSignRef.cell).value = '';
      }
    };

    // Group students by document type
    const docTypeGroups: { label: string; students: any[] }[] = [
      { label: 'Venezolano', students: inscriptions.filter(ins => ins.student?.documentType === 'Venezolano') },
      { label: 'Extranjero', students: inscriptions.filter(ins => ins.student?.documentType === 'Extranjero') },
      { label: 'Pasaporte', students: inscriptions.filter(ins => ins.student?.documentType === 'Pasaporte') },
      { label: 'Cedula Escolar', students: inscriptions.filter(ins => ins.student?.documentType === 'Cedula Escolar') },
    ];

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
      if (sourceWs.model.merges) {
        sourceWs.model.merges.forEach((merge: string) => (cloned as any).mergeCellsWithoutStyle(merge));
      }
      return cloned;
    };

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

    const fillGroupPage = (
      ws: ExcelJS.Worksheet,
      studentList: any[],
      studentOffset: number,
      evalType: string,
      sectionTotal: number,
      pageCount: number,
    ) => {
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

      const pageStats = buildSubjectStats(
        studentList.slice(studentOffset, studentOffset + pageCount)
      );
      const {
        studentCountBySubject: pgStCount,
        failedCountBySubject: pgFailCount,
        passedCountBySubject: pgPassCount,
        zeroCountBySubject: pgZeroCount,
      } = pageStats;

      for (let i = 1; i <= sortedAcademicSubjects.length; i++) {
        const ref = findRef('subj_' + i);
        const nameRef = findRef('subjname_' + i);
        const countRef = findRef('subj_count_' + i);
        const failedRef = findRef('subj_failed_' + i);
        const passedRef = findRef('subj_passed_' + i);
        const zeroRef = findRef('subj_zero_' + i);
        const unenrolledRef = findRef('subj_unenrolled_' + i);
        const subj = sortedAcademicSubjects[i - 1];
        const hasPageRevision = Boolean(subj && (subj as any).hasRevisionStudents && (pgStCount.get(subj.id) || 0) > 0);
        if (hasPageRevision) {
          const abbrText = subj.subjectGroupId
            ? (subj.subjectGroupShortAbbr || subj.subjectGroupLongAbbr || subj.name)
            : (subj.abbreviation || subj.name);
          const headerText = abbrText.toUpperCase();
          if (ref) ws.getCell(ref.cell).value = headerText;
          const nameText = (subj.subjectGroupId
            ? 'Participación en Grupos de \r\nCreación, Recreación y Producción'
            : subj.name).toUpperCase();
          if (nameRef) ws.getCell(nameRef.cell).value = nameText;
          const areaRef = findRef('area_subj_' + i);
          const areaNameRef = findRef('area_subjname_' + i);
          const areaHeaderText = (subj.subjectGroupId
            ? (subj.subjectGroupLongAbbr || '-')
            : (subj.abbreviation || '-')).toUpperCase();
          if (areaRef) ws.getCell(areaRef.cell).value = areaHeaderText;
          if (areaNameRef) ws.getCell(areaNameRef.cell).value = nameText;
          if (countRef) ws.getCell(countRef.cell).value = pgStCount.get(subj.id) || 0;
          if (failedRef) ws.getCell(failedRef.cell).value = pgFailCount.get(subj.id) || 0;
          if (passedRef) ws.getCell(passedRef.cell).value = pgPassCount.get(subj.id) || 0;
          if (zeroRef) ws.getCell(zeroRef.cell).value = pgZeroCount.get(subj.id) || 0;
          if (unenrolledRef) ws.getCell(unenrolledRef.cell).value = pageCount - (pgStCount.get(subj.id) || 0);
        }
      }

      const activeSubjectIds = new Set<number>();
      for (const [subjectId, count] of pgStCount) {
        if (count > 0) activeSubjectIds.add(subjectId);
      }
      setTeacherData(ws, activeSubjectIds);

      fillSheetByNamedRanges(
        ws, ws.name, namedRanges, settings, plantel, period,
        studentList, academicSubjects, groupedSubjectIds,
        subjectColList, subjectToSubjIndex,
        calculateRevisionScore, subjectOrderMap, studentOffset,
        actualSheetName,
        templateGradeName,
        section?.name,
        letterGradesConfig,
        null, // lastCouncilDate — not applicable for revision
        false, // isMpSection
        true,  // isRevisionSection
        isRevisionAbsent,
      );

      const evalRef = findRef('inst_eval_type');
      if (evalRef) ws.getCell(evalRef.cell).value = 'REVISIÓN';

      const setLocal = (name: string, value: any) => {
        if (value === undefined || value === null || value === '') return;
        const r = findRef(name);
        if (r) ws.getCell(r.cell).value = value;
      };
      setLocal('std_total', sectionTotal);
      setLocal('std_page_count', pageCount);

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

    const cleanTemplateSheet = cloneSheetInPlace(sheet!, `${actualSheetName} (Template Source)`);

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
      if (isFirst && pages > 0 && pageSheets[0] === sheet!) {
        sheet!.name = pageNames[0];
      }

      for (let pageIdx = 0; pageIdx < pages; pageIdx++) {
        const studentOffset = pageIdx * MAX_STUDENTS_PER_SHEET;
        const pageCount = Math.min(group.length - studentOffset, MAX_STUDENTS_PER_SHEET);
        fillGroupPage(pageSheets[pageIdx], group, studentOffset, 'Revisión', totalStudents, pageCount);
      }

      return pageNames;
    };

    let isFirst = true;
    const allSheetNames: string[] = [];
    for (const dtg of docTypeGroups) {
      if (dtg.students.length === 0) continue;
      const names = renderGroup(dtg.students, 'Revisión', dtg.label, isFirst);
      allSheetNames.push(...names);
      isFirst = false;
    }

    if (allSheetNames.length === 0) {
      return res.status(404).json({ message: 'No hay estudiantes con revisión en esta sección' });
    }

    const keepNames = new Set<string>(allSheetNames);
    workbook.worksheets
      .filter(ws => !keepNames.has(ws.name))
      .forEach(ws => workbook.removeWorksheet(ws.id!));

    (workbook as any)._definedNames.matrixMap = {};

    const addWithSheet = (name: string, wsName: string, cell: string) => {
      const sheetLabel = wsName.includes(' ') ? `'${wsName}'` : wsName;
      try {
        workbook.definedNames.add(`${sheetLabel}!$${cell}`, name);
      } catch {}
    };

    for (const ws of workbook.worksheets) {
      const wsName = ws.name;
      for (const [origName, namesMap] of namedRanges.bySheet) {
        if (wsName.startsWith(origName)) {
          for (const [name, ref] of namesMap) {
            addWithSheet(name, wsName, ref.cell);
          }
        }
      }
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
    const fileName = 'resumen-revision-' + grade.name.replace(/\s+/g, '_') + '-' + section.name.replace(/\s+/g, '_') + '.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="' + fileName + '"');
    res.send(buffer);
  } catch (error: any) {
    console.error('[exportRevisionSummary] Error:', error);
    res.status(500).json({ message: error.message || 'Error al exportar resumen de revisión' });
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
      attributes: ['termId', 'sectionId', 'status', 'completedAt'],
    });
    const isCouncilDone = GradeCalculationService.buildCouncilDoneChecker(
      councilChecklists.map((c: any) => ({ termId: c.termId, sectionId: c.sectionId, status: c.status })),
    );

    // Find the completion date of the last term's council for this section.
    // Terms are sorted by order ASC, so the last done council for the section
    // gives us the date to show on the annual report.
    let lastCouncilCompletedAt: Date | null | undefined = null;
    if (sectionId) {
      const doneForSection = councilChecklists
        .filter((c: any) => c.sectionId === sectionId && c.completedAt)
        .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      if (doneForSection.length > 0) {
        lastCouncilCompletedAt = doneForSection[0].completedAt;
      }
    }

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
            { model: SubjectFinalGrade, as: 'finalGrade', where: { gradeType: 'regular' }, required: false },
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

    // Sort students canonically: document type → document number → lastName → firstName → grade → section
    sortInscriptions(inscriptions as any[]);

    // Resolve the active term so group subjects are filtered per-term.
    const activeTerm = await Term.findOne({ where: { schoolPeriodId, isActive: true } });

    const students = await Promise.all(inscriptions.map(async (ins: any) => {
      const activeInscriptionSubjects = activeTerm
        ? await filterActiveGroupSubjectsForTerm(ins.inscriptionSubjects || [], activeTerm.id)
        : filterActiveGroupSubjects(ins.inscriptionSubjects || []);
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
          subjectName: is.subject?.name || '',
          subjectAbbreviation: is.subject?.abbreviation || null,
          subjectGroupId: is.subject?.subjectGroupId || null,
          subjectGroupName: is.subject?.subjectGroup?.name || null,
          teacherName: teacherMap.get(is.subjectId) || '',
          usesLiteralGrades: is.subject?.usesLiteralGrades || false,
          includeInAverage: includeInAverageMap.get(is.subjectId) !== false,
          lapsos,
          finalScore,
          status: GradeCalculationService.resolveStatus(finalScore, Number(settings.passing_grade || 10)),
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
    }));

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
      lastCouncilCompletedAt,
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
            { model: SubjectFinalGrade, as: 'finalGrade', where: { gradeType: 'regular' }, required: false, attributes: ['finalScore', 'gradeType'] },
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

    // Sort students canonically: document type → document number → lastName → firstName → grade → section
    sortInscriptions(inscriptions as any[]);

    // Exclude "MATERIA PENDIENTE" sections — those are not regular grades
    const regularInscriptions = inscriptions.filter((ins: any) =>
      (ins.section?.name || '').toUpperCase() !== 'MATERIA PENDIENTE'
    );

    const students = regularInscriptions.map((ins: any) => {
      const gradeId = ins.grade?.id || 0;
      const studentSectionId = ins.section?.id || 0;
      const averageEligibleSubjects = includeInAverageMap.get(gradeId);
      const termIds = terms.map((t: any) => t.id);
      // Build term score map: average of subjects that include in average
      // Only include scores from terms where council is done (final scores)
      const termScoreMap = new Map<number, number[]>();
      // Also build per-subject finalScore for generalAverage (same method as boletin)
      const subjectFinalScores: { finalScore: number | null; includeInAverage: boolean; gradeType?: string | null }[] = [];
      // Per-subject data for the frontend to recompute averages with selected terms
      const subjectsData: { includeInAverage: boolean; termScores: { termId: number; score: number | null }[]; finalScore: number | null }[] = [];

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

        // Build per-subject term scores (null if council not done for that term)
        const subjectTermScores = terms.map((t: any) => {
          const councilDone = isCouncilDone(t.id, studentSectionId);
          if (!councilDone) return { termId: t.id, score: null as number | null };
          const tg = termGradesArr.find((tr) => tr.termId === t.id);
          const raw = tg ? Number(tg.score) : 0;
          if (raw <= 0) return { termId: t.id, score: null as number | null };
          return { termId: t.id, score: Math.max(MIN_FINAL_GRADE, roundFinalGrade(raw)) };
        });

        subjectsData.push({
          includeInAverage,
          termScores: subjectTermScores,
          finalScore: subjectFinalScore,
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
        subjects: subjectsData,
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

/**
 * GET /api/performance-summary/titulo-data
 * Returns students who graduated (approved 5th year) for a given school period,
 * with all data needed to print titles (diplomas).
 *
 * Query params:
 * - schoolPeriodId: number (required)
 */
export const getTituloData = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = parseInt(req.query.schoolPeriodId as string, 10);
    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
    }

    const [period, settingsRows] = await Promise.all([
      SchoolPeriod.findByPk(schoolPeriodId),
      Setting.findAll(),
    ]);
    if (!period) return res.status(404).json({ message: 'Período no encontrado' });

    const settings: Record<string, string> = {};
    settingsRows.forEach((s: any) => { settings[s.key] = s.value; });

    // Find 5th grade (order = 5) — the graduating grade
    const fifthGrade = await Grade.findOne({ where: { order: 5 } });
    if (!fifthGrade) {
      return res.status(404).json({ message: 'No se encontró el 5to año (grado con order=5)' });
    }

    // Find inscriptions for 5th grade in this period
    // Include periodOutcome optionally (may not exist if closure hasn't run)
    const inscriptions = await Inscription.findAll({
      where: { schoolPeriodId, gradeId: fifthGrade.id },
      include: [
        {
          model: Person,
          as: 'student',
          include: [{ model: PersonResidence, as: 'residence' }],
        },
        { model: Section, as: 'section' },
        {
          model: StudentPeriodOutcome,
          as: 'periodOutcome',
          required: false,
        },
      ],
      order: [
        [{ model: Person, as: 'student' }, 'lastName', 'ASC'],
        [{ model: Person, as: 'student' }, 'firstName', 'ASC'],
      ],
    });

    const students = inscriptions.map((ins: any) => {
      const person = ins.student;
      const residence = person?.residence;
      const outcome = ins.periodOutcome;

      // Format birthplace: "PAÍS, ESTADO, MUNICIPIO XXX" (Venezuela is assumed)
      const birthState = residence?.birthState || '';
      const birthMunicipality = residence?.birthMunicipality || '';
      const birthplace = ['VENEZUELA', birthState, birthMunicipality ? `MUNICIPIO ${birthMunicipality}` : '']
        .filter(Boolean)
        .join(', ');

      // Format birthdate: "04 DE ABRIL DE 2005"
      const birthdate = person?.birthdate ? formatDateLong(person.birthdate) : '';

      // Format document: "V 30.781.275"
      const docPrefix = person?.documentType === 'Venezolano' ? 'V'
        : person?.documentType === 'Extranjero' ? 'E'
        : person?.documentType === 'Pasaporte' ? 'P' : 'CE';
      const docFormatted = person?.document ? `${docPrefix} ${person.document}` : '';

      // Full name in uppercase
      const fullName = `${person?.lastName || ''} ${person?.firstName || ''}`.trim().toUpperCase();

      return {
        inscriptionId: ins.id,
        personId: person?.id,
        fullName,
        document: docFormatted,
        birthplace,
        birthdate,
        finalAverage: outcome?.finalAverage != null ? Number(outcome.finalAverage).toFixed(2) : '',
        graduatedAt: outcome?.graduatedAt,
        outcomeStatus: outcome?.status || null,
        sectionName: ins.section?.name || '',
      };
    });

    // Institution data
    const institution = {
      name: settings.institution_name || '',
      // Plantel code = Código DEA (institution_code is the modalidad code,
      // already included in the program field).
      code: settings.institution_dea_code || '',
      level: 'BACHILLER',
      program: settings.institution_program || 'EDUCACIÓN MEDIA GENERAL, 31059',
      directorName: settings.director_first_names && settings.director_last_names
        ? `${settings.director_first_names} ${settings.director_last_names}`
        : (settings.director_name || ''),
      directorDocument: settings.director_document || '',
      // sig2 (Control de Estudios) — from coordinator settings if available,
      // fall back to legacy titulo_sig2_* settings
      sig2Name: settings.control_estudios_first_names && settings.control_estudios_last_names
        ? `${settings.control_estudios_first_names} ${settings.control_estudios_last_names}`
        : (settings.control_estudios_name || settings.titulo_sig2_name || ''),
      sig2Id: settings.control_estudios_document || settings.titulo_sig2_id || '',
      // Issue place: "ESTADO, PARROQUIA, FECHA"
      issueState: settings.institution_state || '',
      issueParish: settings.institution_parish || '',
    };

    return res.json({ students, institution, schoolPeriodName: period.name });
  } catch (error: any) {
    console.error('[getTituloData] Error:', error);
    res.status(500).json({ message: error.message || 'Error al obtener datos de títulos' });
  }
};

// Format a date as "DD DE MES DE YYYY" in Spanish
function formatDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);
  const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = months[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${dd} DE ${mm} DE ${yyyy}`;
}

/* ------------------------------------------------------------------ */
/* Group signer — manual selection of which teacher signs for a       */
/* subject group in the performance summary Excel.                    */
/* ------------------------------------------------------------------ */

/**
 * GET /api/performance-summary/group-teachers?schoolPeriodId=X&gradeId=Y
 *
 * Returns the subject groups that have more than one subject (i.e. groups
 * where a manual signer choice is needed) along with the teachers assigned
 * to each subject across all sections of the grade.
 *
 * Response:
 * [
 *   {
 *     subjectGroupId: 5,
 *     subjectGroupName: "Grupos de Creación",
 *     subjects: [
 *       { subjectId: 12, subjectName: "Música", teacherPersonId: 3, teacherName: "Pérez Juan" },
 *       { subjectId: 13, subjectName: "Teatro", teacherPersonId: 7, teacherName: "Gómez Ana" }
 *     ],
 *     currentSignerPersonId: 3   // from Setting, null if not set
 *   }
 * ]
 */
export const getGroupTeachers = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = Number(req.query.schoolPeriodId);
    const gradeId = Number(req.query.gradeId);
    if (!schoolPeriodId || !gradeId) {
      return res.status(400).json({ message: 'schoolPeriodId y gradeId son requeridos' });
    }

    const pg = await PeriodGrade.findOne({ where: { schoolPeriodId, gradeId } });
    if (!pg) return res.status(404).json({ message: 'Estructura académica no encontrada' });

    // Get all PeriodGradeSubject for this grade, with subject + subjectGroup
    const pgSubjects = await PeriodGradeSubject.findAll({
      where: { periodGradeId: pg.id },
      include: [{ model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] }],
    });

    // Get all TeacherAssignments for any section of this grade's PeriodGradeSubjects.
    // We want every teacher that teaches any subject of the group, regardless of section.
    const pgsIds = pgSubjects.map((p: any) => p.id);
    const teacherAssignments = pgsIds.length > 0
      ? await TeacherAssignment.findAll({
          where: { periodGradeSubjectId: pgsIds },
          include: [
            { model: PeriodGradeSubject, as: 'periodGradeSubject' },
            { model: Person, as: 'teacher', attributes: ['id', 'firstName', 'lastName'] },
          ],
        })
      : [];

    // Build subjectId → list of { personId, fullName } (dedup by personId)
    const subjectTeachersMap = new Map<number, { personId: number; fullName: string }[]>();
    for (const ta of teacherAssignments) {
      const pgs = (ta as any).periodGradeSubject;
      const teacher = (ta as any).teacher;
      if (!pgs || !teacher) continue;
      const list = subjectTeachersMap.get(pgs.subjectId) || [];
      const fullName = `${teacher.lastName || ''} ${teacher.firstName || ''}`.trim();
      if (!list.some((t: any) => t.personId === teacher.id)) {
        list.push({ personId: teacher.id, fullName });
      }
      subjectTeachersMap.set(pgs.subjectId, list);
    }

    // Group subjects by subjectGroupId (only groups with >1 subject need a manual choice)
    interface GroupEntry { subjectGroupId: number; subjectGroupName: string; subjects: any[] }
    const groupMap = new Map<number, GroupEntry>();
    for (const pgs of pgSubjects) {
      const subj = (pgs as any).subject;
      if (!subj || subj.subjectGroupId === null) continue;
      const groupId = subj.subjectGroupId;
      const groupName = subj.subjectGroup?.name || `Grupo ${groupId}`;
      const teachers = subjectTeachersMap.get(subj.id) || [];
      const entry: GroupEntry = groupMap.get(groupId) || { subjectGroupId: groupId, subjectGroupName: groupName, subjects: [] };
      entry.subjects.push({
        subjectId: subj.id,
        subjectName: subj.name,
        teachers,
      });
      groupMap.set(groupId, entry);
    }

    // Only return groups that have at least 2 subjects (otherwise no choice to make)
    const groups = Array.from(groupMap.values()).filter((g: any) => g.subjects.length >= 2);

    // Load current signers from Setting
    const settingKeys = groups.map((g: any) => `group_signer_${schoolPeriodId}_${gradeId}_${g.subjectGroupId}`);
    const settings = settingKeys.length > 0
      ? await Setting.findAll({ where: { key: settingKeys } })
      : [];
    const signerMap = new Map<string, number>();
    for (const s of settings) {
      signerMap.set(s.key, Number(s.value));
    }

    const result = groups.map((g: any) => ({
      ...g,
      currentSignerPersonId: signerMap.get(`group_signer_${schoolPeriodId}_${gradeId}_${g.subjectGroupId}`) || null,
    }));

    return res.json(result);
  } catch (error: any) {
    console.error('[getGroupTeachers] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener profesores de grupos' });
  }
};

/**
 * POST /api/performance-summary/group-signer
 * Body: { schoolPeriodId, gradeId, subjectGroupId, personId }
 *
 * Persists the chosen signer for a subject group in the Setting table.
 * If personId is null, removes the setting (revert to default behavior).
 */
export const setGroupSigner = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, gradeId, subjectGroupId, personId } = req.body;
    if (!schoolPeriodId || !gradeId || !subjectGroupId) {
      return res.status(400).json({ message: 'schoolPeriodId, gradeId y subjectGroupId son requeridos' });
    }
    const key = `group_signer_${schoolPeriodId}_${gradeId}_${subjectGroupId}`;

    if (personId === null || personId === undefined) {
      await Setting.destroy({ where: { key } });
      return res.json({ message: 'Signer eliminado' });
    }

    // upsert
    const [setting, created] = await Setting.findOrCreate({
      where: { key },
      defaults: { key, value: String(personId) },
    });
    if (!created) {
      await setting.update({ value: String(personId) });
    }
    return res.json({ message: 'Signer guardado', key, value: String(personId) });
  } catch (error: any) {
    console.error('[setGroupSigner] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al guardar signer' });
  }
};
