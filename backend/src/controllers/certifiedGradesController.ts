import { Request, Response } from 'express';
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
  SubjectTermGrade,
  CouncilChecklist,
} from '@/models/index';
import {
  getSubjectOrderMap,
  sortSubjectsByOrder,
} from '@/services/subjectOrderService';
import { filterActiveGroupSubjects } from '@/services/subjectGroupService';
import { resolveGradeStatus } from '@/services/gradeEvaluationService';
import { GradeCalculationService } from '@/services/gradeCalculationService';
import { readTemplateNamedRanges } from '@/services/templateNamedRanges';

function getStateAbbrev(stateName: string): string {
  if (!stateName) return '';
  const abbrev: Record<string, string> = {
    'GUARICO': 'GU', 'MIRANDA': 'MI', 'CARABOBO': 'CA', 'ZULIA': 'ZU',
    'ARAGUA': 'AR', 'BARINAS': 'BA', 'BOLIVAR': 'BO', 'COJEDES': 'CO',
    'PORTUGUESA': 'PO', 'LARA': 'LA', 'YARACUY': 'YA', 'FALCON': 'FA',
    'VARGAS': 'VA', 'MERIDA': 'ME', 'TRUJILLO': 'TR', 'TACHIRA': 'TA',
    'APURE': 'AP', 'GUAIRA': 'GU', 'NUEVA ESPARTA': 'NE', 'SUCRE': 'SU',
    'ANZOATEGUI': 'AN', 'MONAGAS': 'MO', 'DELTA AMACURO': 'DA',
    'AMAZONAS': 'AM', 'DISTRITO CAPITAL': 'DC', 'DEPENDENCIAS FEDERALES': 'DF',
  };
  return abbrev[stateName.toUpperCase()] || stateName.substring(0, 2).toUpperCase();
}

function formatDateES(date: Date | string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatScore(score: number | null): string {
  if (score === null || score === undefined) return '';
  const n = Number(score);
  if (isNaN(n) || n === 0) return '';
  return n.toFixed(1);
}

const monthsES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function monthNameES(monthNum: number): string {
  if (monthNum < 1 || monthNum > 12) return '';
  return monthsES[monthNum - 1];
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

function numberToSpanishWords(n: number): string {
  const integerPart = Math.floor(n);
  const decimalPart = Math.round((n - integerPart) * 10);

  const units = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte'];
  const tens = ['', '', 'veinti', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

  function convertInt(num: number): string {
    if (num <= 20) return units[num];
    if (num < 30) {
      const remainder = num - 20;
      return remainder === 0 ? 'veinte' : `veinti${units[remainder]}`;
    }
    const ten = Math.floor(num / 10);
    const unit = num % 10;
    if (unit === 0) return tens[ten];
    return `${tens[ten]} y ${units[unit]}`;
  }

  let result = convertInt(integerPart);
  if (decimalPart > 0) {
    result += ` coma ${units[decimalPart] || decimalPart}`;
  }
  return result;
}

export const exportCertifiedGrades = async (req: Request, res: Response) => {
  try {
    const personId = parseInt(req.query.personId as string, 10);
    const templateName = req.query.template as string;

    if (!personId) {
      return res.status(400).json({ message: 'personId es obligatorio' });
    }
    if (!templateName) {
      return res.status(400).json({ message: 'template es obligatorio' });
    }

    const { buffer, fileName } = await generateCertifiedExcel(personId, templateName);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('[exportCertifiedGrades] Error:', error);
    res.status(500).json({ message: error.message || 'Error al exportar notas certificadas' });
  }
};

/**
 * Export certified grades for all students in a grade+section as a single
 * Excel file with one worksheet per student (so they can be printed in a
 * batch). Each worksheet is a copy of the template filled with that
 * student's data.
 */
export const exportCertifiedGradesBySection = async (req: Request, res: Response) => {
  try {
    const schoolPeriodId = parseInt(req.query.schoolPeriodId as string, 10);
    const gradeId = parseInt(req.query.gradeId as string, 10);
    const sectionId = parseInt(req.query.sectionId as string, 10);
    const templateName = req.query.template as string;

    if (!schoolPeriodId || !gradeId || !sectionId) {
      return res.status(400).json({ message: 'schoolPeriodId, gradeId y sectionId son obligatorios' });
    }
    if (!templateName) {
      return res.status(400).json({ message: 'template es obligatorio' });
    }

    // Find all students inscribed in this grade+section+period, sorted by name
    const inscriptions = await Inscription.findAll({
      where: { schoolPeriodId, gradeId, sectionId },
      include: [{ model: Person, as: 'student' }],
      order: [
        [{ model: Person, as: 'student' }, 'lastName', 'ASC'],
        [{ model: Person, as: 'student' }, 'firstName', 'ASC'],
      ],
    });

    if (inscriptions.length === 0) {
      return res.status(404).json({ message: 'No hay estudiantes inscritos en esta sección' });
    }

    const sectionName = (await Section.findByPk(sectionId))?.name || 'seccion';
    const gradeName = (await Grade.findByPk(gradeId))?.name || 'grado';

    // If only one student, send a single-student Excel directly
    if (inscriptions.length === 1) {
      const person = (inscriptions[0] as any).student;
      const { buffer, fileName } = await generateCertifiedExcel(person.id, templateName);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
      return;
    }

    // Multiple students: build a single workbook with one worksheet per student.
    // We build each student's workbook separately, then copy the filled
    // worksheet into a combined workbook.
    const combinedWorkbook = new ExcelJS.Workbook();
    let addedCount = 0;
    const usedNames = new Set<string>();

    for (const ins of inscriptions) {
      const person = (ins as any).student;
      if (!person) continue;
      try {
        const { workbook: studentWb } = await buildCertifiedWorkbook(person.id, templateName);
        const srcSheet = studentWb.worksheets[0];
        if (!srcSheet) continue;

        // Build a unique worksheet name (Excel limits to 31 chars)
        let baseName = `${person.lastName || ''} ${person.firstName || ''}`.trim();
        if (!baseName) baseName = `Estudiante ${person.id}`;
        let sheetName = baseName.substring(0, 31);
        let suffix = 2;
        while (usedNames.has(sheetName)) {
          const s = String(suffix);
          sheetName = `${baseName.substring(0, 31 - s.length)} ${s}`;
          suffix++;
        }
        usedNames.add(sheetName);

        // Copy the worksheet into the combined workbook
        const newSheet = combinedWorkbook.addWorksheet(sheetName);
        // Copy column widths
        srcSheet.columns.forEach((col: any, i: number) => {
          if (col.width) {
            const targetCol = newSheet.getColumn(i + 1);
            targetCol.width = col.width;
          }
        });
        // Copy row-by-row (values + styles)
        srcSheet.eachRow({ includeEmpty: true }, (row: ExcelJS.Row, rowNumber: number) => {
          const newRow = newSheet.getRow(rowNumber);
          row.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell, colNumber: number) => {
            const newCell = newRow.getCell(colNumber);
            newCell.value = cell.value;
            if (cell.style) {
              try {
                newCell.style = JSON.parse(JSON.stringify(cell.style));
              } catch { /* ignore style copy errors */ }
            }
          });
          // Copy row dimensions
          if (row.height) newRow.height = row.height;
        });
        // Copy merged cells
        const merges = (srcSheet as any)._merges;
        if (merges) {
          for (const key of Object.keys(merges)) {
            const merge = merges[key];
            if (merge && merge.model && merge.model.top && merge.model.left && merge.model.bottom && merge.model.right) {
              newSheet.mergeCells(merge.model.top, merge.model.left, merge.model.bottom, merge.model.right);
            }
          }
        }
        addedCount++;
      } catch (err: any) {
        console.error(`[exportCertifiedGradesBySection] Skip student ${person.id}:`, err.message);
      }
    }

    if (addedCount === 0) {
      return res.status(500).json({ message: 'No se pudo generar ningún archivo' });
    }

    const buffer = await combinedWorkbook.xlsx.writeBuffer();
    const fileName = `notas-certificadas-${gradeName}-${sectionName}.xlsx`.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('[exportCertifiedGradesBySection] Error:', error);
    res.status(500).json({ message: error.message || 'Error al exportar notas certificadas por sección' });
  }
};

/**
 * Core logic: build a certified grades workbook for a single student.
 * Returns the configured ExcelJS workbook (not yet serialized) and the
 * student's person record so callers can rename worksheets or combine
 * multiple students into a single workbook.
 */
async function buildCertifiedWorkbook(personId: number, templateName: string): Promise<{ workbook: ExcelJS.Workbook; person: any }> {
    const templatePath = path.join(__dirname, '../../templates', templateName);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Plantilla no encontrada: ${templateName}`);
    }

    const person = await Person.findByPk(personId, {
      include: [{ model: PersonResidence, as: 'residence' }],
    });

    if (!person) {
      throw new Error('Estudiante no encontrado');
    }

    const settingsRows = await Setting.findAll();
    const settings: Record<string, string> = {};
    settingsRows.forEach((s: any) => { settings[s.key] = s.value; });

    let plantel: any = null;
    if (settings.institution_dea_code) {
      plantel = await Plantel.findOne({ where: { code: settings.institution_dea_code } });
    }

    const letterGradesConfig: { letter: string; max: number }[] = (() => {
      try {
        const raw = settings.letter_grades;
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return parsed.scale || parsed || [];
      } catch { return []; }
    })();

    const inscriptions = await Inscription.findAll({
      where: { personId },
      include: [
        { model: SchoolPeriod, as: 'period' },
        { model: Grade, as: 'grade' },
        { model: Section, as: 'section' },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            { model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] },
            { model: SubjectFinalGrade, as: 'finalGrade', where: { gradeType: 'regular' }, required: false, include: [{ model: Plantel, as: 'plantel' }] },
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
        [{ model: SchoolPeriod, as: 'period' }, 'period', 'ASC'],
        [{ model: Grade, as: 'grade' }, 'order', 'ASC'],
      ],
    });

    const allPeriodIds = [...new Set(inscriptions.map((ins: any) => ins.schoolPeriodId))];
    const termsByPeriod: Record<number, any[]> = {};
    const subjectOrderByPeriod: Record<number, Map<number, number>> = {};
    const councilDoneByPeriod: Record<number, (termId: number, sectionId: number) => boolean> = {};

    for (const periodId of allPeriodIds) {
      const terms = await Term.findAll({
        where: { schoolPeriodId: periodId },
        order: [['order', 'ASC']],
      });
      termsByPeriod[periodId] = terms;

      const firstIns = inscriptions.find((ins: any) => ins.schoolPeriodId === periodId);
      if (firstIns) {
        const pg = await PeriodGrade.findOne({
          where: { schoolPeriodId: periodId, gradeId: firstIns.gradeId },
        });
        subjectOrderByPeriod[periodId] = pg ? await getSubjectOrderMap(pg.id) : new Map();
      }

      // Query CouncilChecklist for this period
      const councilChecklists = await CouncilChecklist.findAll({
        where: {
          schoolPeriodId: periodId,
          status: 'done',
          termId: terms.map((t: any) => t.id),
        },
        attributes: ['termId', 'sectionId', 'status'],
      });
      councilDoneByPeriod[periodId] = GradeCalculationService.buildCouncilDoneChecker(
        councilChecklists.map((c: any) => ({ termId: c.termId, sectionId: c.sectionId, status: c.status })),
      );
    }

    const years = inscriptions.map((ins: any) => {
      const terms = termsByPeriod[ins.schoolPeriodId] || [];
      const termCount = terms.length || 1;
      const orderMap = subjectOrderByPeriod[ins.schoolPeriodId] || new Map();

      const activeInscriptionSubjects = filterActiveGroupSubjects(ins.inscriptionSubjects || []);

      const insSubs = sortSubjectsByOrder(
        activeInscriptionSubjects.filter((is: any) => !is.subject?.subjectGroupId),
        (is: any) => is.subjectId,
        (is: any) => is.subject?.name || '',
        orderMap,
      );

      const groupSubjects = activeInscriptionSubjects
        .filter((is: any) => is.subject?.subjectGroupId)
        .map((is: any) => is.subject?.name || '')
        .filter(Boolean);

      const subjects = insSubs.map((is: any) => {
        const studentSectionId = ins.section?.id || 0;
        const isCouncilDone = councilDoneByPeriod[ins.schoolPeriodId] || (() => false);

        // Build term grades with fallback to qualifications + councilPoints
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

        const status = is.finalGrade?.status || GradeCalculationService.resolveStatus(finalScore, Number(settings.passing_grade || 10));
        const approvedDate = is.finalGrade?.calculatedAt ? new Date(is.finalGrade.calculatedAt) : null;

        return {
          id: is.subjectId,
          name: is.subject?.name || '',
          usesLiteralGrades: is.subject?.usesLiteralGrades || false,
          lapsos,
          finalScore,
          status,
          approvedMonth: approvedDate ? approvedDate.getMonth() + 1 : null,
          approvedYear: approvedDate ? approvedDate.getFullYear() : null,
          originInstitution: is.finalGrade?.plantel?.name ?? null,
          originInstitutionCode: is.finalGrade?.plantel?.code ?? null,
          originInstitutionState: is.finalGrade?.plantel?.state ?? null,
          gradeType: is.finalGrade?.gradeType ?? null,
        };
      });

      return {
        periodName: ins.period?.name || ins.period?.period || '',
        gradeName: ins.grade?.name || '',
        sectionName: ins.section?.name || '',
        isExternal: ins.period?.isExternal === true,
        terms: terms.map((t: any) => ({ id: t.id, name: t.name, order: t.order })),
        groupSubjects,
        subjects,
      };
    });

    const templatesDir = path.join(__dirname, '../../templates');
    const namedRanges = await readTemplateNamedRanges(templatePath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new Error('La plantilla no tiene hojas');
    }

    const sheetName = sheet.name;
    const existingNames = new Set<string>();
    const namedRangeModel = (workbook as any).definedNames?.model;
    if (namedRangeModel) {
      for (const d of namedRangeModel) {
        if (d.name) existingNames.add(d.name);
      }
    }
    let overflowRow = 1;

    const setter = (name: string, value: string | number) => {
      if (!value || value === '' || value === 0) return;
      const ref = namedRanges.getCell(sheetName, name);
      if (ref) {
        sheet.getCell(ref.cell).value = value;
        return;
      }
      try {
        const dns = (workbook as any).definedNames?.model;
        if (dns) {
          const dn = dns.find((d: any) => d.name === name);
          if (dn && dn.ranges && dn.ranges.length > 0) {
            const rangeRef = dn.ranges[0];
            const match = rangeRef.match(/\$([A-Z]+)\$(\d+)$/);
            if (match) {
              sheet.getCell(match[1] + match[2]).value = value;
              return;
            }
          }
        }
      } catch { /* ignore if named range not found */ }
      // Named range not found in template — register dynamically
      if (!existingNames.has(name)) {
        existingNames.add(name);
        const cellAddr = `$B$${30 + overflowRow}`;
        overflowRow++;
        try {
          (workbook as any).definedNames.add(name, `'${sheetName}'!${cellAddr}`);
          sheet.getCell(cellAddr.replace(/\$/g, '')).value = value;
        } catch { /* ignore */ }
      }
    };

    const residence = (person as any).residence;

    setter('plantel_code', settings.institution_dea_code || plantel?.code || '');
    setter('plantel_name', settings.institution_name || plantel?.name || '');
    setter('education_code', settings.institution_code || '');
    setter('education_type', settings.institution_level || '');
    setter('plantel_address', settings.institution_address || '');
    setter('plantel_municipality', settings.institution_municipality || plantel?.municipality || '');
    setter('plantel_phone', settings.institution_phone || '');
    setter('plantel_state', plantel?.state || '');
    setter('cdcee', settings.institution_cdcee || '');
    setter('expedition_place_date', formatDateES(new Date()));

    setter('student_doc', person.document || '');
    setter('student_birthdate', person.birthdate ? formatDateES(person.birthdate) : '');
    setter('student_lastname', person.lastName || '');
    setter('student_firstname', person.firstName || '');
    setter('student_birth_country', 'Venezuela');
    setter('student_birth_state', residence?.birthState || '');
    setter('student_birth_municipality', residence?.birthMunicipality || '');

    let yearIdx = 1;
    for (const year of years) {
      const allApproved = year.subjects.length > 0 && year.subjects.every((s: any) => s.status === 'aprobada');
      if (!allApproved) continue;

      setter(`year_${yearIdx}_name`, year.gradeName);
      setter(`year_${yearIdx}_period`, year.periodName);
      setter(`std_part_${yearIdx}`, year.groupSubjects.join(', '));

      let subjIdx = 1;
      for (const subj of year.subjects) {
        setter(`y${yearIdx}_s${subjIdx}_name`, subj.name);
        let lapsoIdx = 1;
        for (const lapse of subj.lapsos) {
          setter(`y${yearIdx}_s${subjIdx}_l${lapsoIdx}`, formatScore(lapse.score));
          lapsoIdx++;
        }
        setter(`y${yearIdx}_s${subjIdx}_num`, subj.usesLiteralGrades && subj.finalScore !== null ? numericToLetter(subj.finalScore, letterGradesConfig) : formatScore(subj.finalScore));
        setter(`y${yearIdx}_s${subjIdx}_letters`, subj.finalScore !== null ? numberToSpanishWords(subj.finalScore) : '');
        setter(`y${yearIdx}_s${subjIdx}_month`, subj.approvedMonth ? monthNameES(subj.approvedMonth) : '');
        setter(`y${yearIdx}_s${subjIdx}_year`, subj.approvedYear ? String(subj.approvedYear) : '');
        subjIdx++;
      }
      let termIdx = 1;
      for (const term of year.terms) {
        setter(`y${yearIdx}_lapso_${termIdx}`, term.name);
        termIdx++;
      }
      yearIdx++;
    }

    return { workbook, person };
}

/**
 * Generate a certified grades Excel buffer for a single student.
 */
async function generateCertifiedExcel(personId: number, templateName: string): Promise<{ buffer: Buffer; fileName: string }> {
    const { workbook, person } = await buildCertifiedWorkbook(personId, templateName);
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `notas-certificadas-${person.lastName}-${person.firstName}.xlsx`.replace(/\s+/g, '_');
    return { buffer: Buffer.from(buffer), fileName };
}

export const getCertifiedGradesData = async (req: Request, res: Response) => {
  try {
    const personId = parseInt(req.query.personId as string, 10);
    if (!personId) {
      return res.status(400).json({ message: 'personId es obligatorio' });
    }

    const person = await Person.findByPk(personId, {
      include: [{ model: PersonResidence, as: 'residence' }],
    });
    if (!person) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }

    const settingsRows = await Setting.findAll();
    const settings: Record<string, string> = {};
    settingsRows.forEach((s: any) => { settings[s.key] = s.value; });

    let plantel: any = null;
    if (settings.institution_dea_code) {
      plantel = await Plantel.findOne({ where: { code: settings.institution_dea_code } });
    }

    const inscriptions = await Inscription.findAll({
      where: { personId },
      include: [
        { model: SchoolPeriod, as: 'period' },
        { model: Grade, as: 'grade' },
        { model: Section, as: 'section' },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            { model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] },
            { model: SubjectFinalGrade, as: 'finalGrade', where: { gradeType: 'regular' }, required: false, include: [{ model: Plantel, as: 'plantel' }] },
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
        [{ model: SchoolPeriod, as: 'period' }, 'period', 'ASC'],
        [{ model: Grade, as: 'grade' }, 'order', 'ASC'],
      ],
    });

    const allPeriodIds = [...new Set(inscriptions.map((ins: any) => ins.schoolPeriodId))];
    const termsByPeriod: Record<number, any[]> = {};
    const subjectOrderByPeriod: Record<number, Map<number, number>> = {};
    const councilDoneByPeriod: Record<number, (termId: number, sectionId: number) => boolean> = {};

    for (const periodId of allPeriodIds) {
      const terms = await Term.findAll({
        where: { schoolPeriodId: periodId },
        order: [['order', 'ASC']],
      });
      termsByPeriod[periodId] = terms;

      const firstIns = inscriptions.find((ins: any) => ins.schoolPeriodId === periodId);
      if (firstIns) {
        const pg = await PeriodGrade.findOne({
          where: { schoolPeriodId: periodId, gradeId: firstIns.gradeId },
        });
        subjectOrderByPeriod[periodId] = pg ? await getSubjectOrderMap(pg.id) : new Map();
      }

      // Query CouncilChecklist for this period
      const councilChecklists = await CouncilChecklist.findAll({
        where: {
          schoolPeriodId: periodId,
          status: 'done',
          termId: terms.map((t: any) => t.id),
        },
        attributes: ['termId', 'sectionId', 'status'],
      });
      councilDoneByPeriod[periodId] = GradeCalculationService.buildCouncilDoneChecker(
        councilChecklists.map((c: any) => ({ termId: c.termId, sectionId: c.sectionId, status: c.status })),
      );
    }

    const years = inscriptions.map((ins: any) => {
      const terms = termsByPeriod[ins.schoolPeriodId] || [];
      const termCount = terms.length || 1;
      const orderMap = subjectOrderByPeriod[ins.schoolPeriodId] || new Map();

      const activeInscriptionSubjects = filterActiveGroupSubjects(ins.inscriptionSubjects || []);

      const insSubs = sortSubjectsByOrder(
        activeInscriptionSubjects.filter((is: any) => !is.subject?.subjectGroupId),
        (is: any) => is.subjectId,
        (is: any) => is.subject?.name || '',
        orderMap,
      );

      const groupSubjects = activeInscriptionSubjects
        .filter((is: any) => is.subject?.subjectGroupId)
        .map((is: any) => is.subject?.name || '')
        .filter(Boolean);

      const subjects = insSubs.map((is: any) => {
        const studentSectionId = ins.section?.id || 0;
        const isCouncilDone = councilDoneByPeriod[ins.schoolPeriodId] || (() => false);

        // Build term grades with fallback to qualifications + councilPoints
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

        return {
          id: is.subjectId,
          name: is.subject?.name || '',
          usesLiteralGrades: is.subject?.usesLiteralGrades || false,
          lapsos,
          finalScore,
          originInstitution: is.finalGrade?.plantel?.name ?? null,
          originInstitutionCode: is.finalGrade?.plantel?.code ?? null,
          originInstitutionState: is.finalGrade?.plantel?.state ?? null,
          gradeType: is.finalGrade?.gradeType ?? null,
          issuedAt: is.finalGrade?.calculatedAt ?? null,
        };
      });

      return {
        periodName: ins.period?.name || ins.period?.period || '',
        gradeName: ins.grade?.name || '',
        sectionName: ins.section?.name || '',
        isExternal: ins.period?.isExternal === true,
        terms: terms.map((t: any) => ({ id: t.id, name: t.name, order: t.order })),
        groupSubjects,
        subjects,
      };
    });

    const residence = (person as any).residence;

    res.json({
      institution: {
        code: settings.institution_dea_code || plantel?.code || '',
        name: settings.institution_name || plantel?.name || '',
        educationCode: settings.institution_code || '',
        educationType: settings.institution_level || '',
        address: settings.institution_address || '',
        municipality: settings.institution_municipality || plantel?.municipality || '',
        phone: settings.institution_phone || '',
        state: plantel?.state || '',
        cdcee: settings.institution_cdcee || '',
      },
      student: {
        id: person.id,
        firstName: person.firstName || '',
        lastName: person.lastName || '',
        document: person.document || '',
        birthdate: person.birthdate ? formatDateES(person.birthdate) : '',
        birthCountry: 'Venezuela',
        birthState: residence?.birthState || '',
        birthMunicipality: residence?.birthMunicipality || '',
      },
      expeditionDate: formatDateES(new Date()),
      years,
    });
  } catch (error: any) {
    console.error('[getCertifiedGradesData] Error:', error);
    res.status(500).json({ message: error.message || 'Error al obtener datos de notas certificadas' });
  }
};