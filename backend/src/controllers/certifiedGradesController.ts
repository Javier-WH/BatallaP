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
  HistoricalGrade,
  PersonPlantel,
  CouncilChecklist,
} from '@/models/index';
import {
  getSubjectOrderMap,
  sortSubjectsByOrder,
} from '@/services/subjectOrderService';
import { filterActiveGroupSubjects } from '@/services/subjectGroupService';
import { roundGrade, roundFinalGrade, isPassingGrade } from '@/services/gradeEvaluationService';
import { GradeCalculationService } from '@/services/gradeCalculationService';
import { readTemplateNamedRanges } from '@/services/templateNamedRanges';
import { resolveGradeDate } from '@/services/gradeDateResolver';

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
  // Parse "YYYY-MM-DD" strings without timezone shifts
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    const parts = date.split('T')[0].split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${d} de ${months[m - 1]} de ${y}`;
  }
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

function padNumber(n: number): string {
  return String(n).padStart(2, '0');
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

/**
 * Convert a subject name to Spanish title case: capitalize the first letter of
 * each word except articles, prepositions and conjunctions (y, de, del, la, el,
 * las, los, en, a, al, o, u, para, con, por). The first word is always capitalized.
 */
function toTitleCaseES(text: string): string {
  if (!text) return '';
  const lowercaseWords = new Set(['y', 'de', 'del', 'la', 'el', 'las', 'los', 'en', 'a', 'al', 'o', 'u', 'para', 'con', 'por']);
  return text
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      // Keep punctuation prefixes (like commas) intact
      const match = word.match(/^([^a-zA-ZÁÉÍÓÚáéíóú]*)([a-zA-ZÁÉÍÓÚáéíóú]+)(.*)$/);
      if (!match) return word;
      const prefix = match[1];
      const core = match[2];
      const suffix = match[3];
      const lower = core.toLowerCase();
      if (i > 0 && lowercaseWords.has(lower)) {
        return prefix + lower + suffix;
      }
      return prefix + lower.charAt(0).toUpperCase() + lower.slice(1) + suffix;
    })
    .join(' ');
}

function numberToSpanishWords(n: number): string {
  const integerPart = Math.floor(n);
  const decimalPart = Math.round((n - integerPart) * 10);

  const units = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte'];
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

    // ── Load consolidated grades (same logic as historicalGradesController) ──
    // 1. Get all grade records (years 1-5)
    const allGrades = await Grade.findAll({
      attributes: ['id', 'name', 'order'],
      order: [['order', 'ASC']],
    });

    // 2. Get all school periods (for period labels)
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

    // 2b. Find the active period (for subject lookup)
    const activePeriod = allPeriods.find((p: any) => p.status === 'activo');
    const activePeriodId = activePeriod?.id || null;

    // 2c. Load subjects in canonical order for each grade.
    //     Non-literal, non-group subjects go into subjectsByGrade.
    //     Literal, non-group subjects go into literalSubjectsByGrade.
    //     Group subjects (collapsed by subjectGroupId) go into groupSubjectsByGrade.
    //     Try active period first; if no PeriodGrade, try any period.
    const subjectsByGrade: Map<number, Array<{ id: number; name: string }>> = new Map();
    const literalSubjectsByGrade: Map<number, Array<{ id: number; name: string }>> = new Map();
    const groupSubjectsByGrade: Map<number, Array<{ name: string; memberIds: number[] }>> = new Map();
    for (const gr of allGrades) {
      let pg = activePeriodId
        ? await PeriodGrade.findOne({ where: { schoolPeriodId: activePeriodId, gradeId: gr.id }, attributes: ['id'] })
        : null;
      if (!pg) {
        pg = await PeriodGrade.findOne({ where: { gradeId: gr.id }, attributes: ['id'], order: [['id', 'DESC']] });
      }
      if (!pg) {
        subjectsByGrade.set(gr.id, []);
        literalSubjectsByGrade.set(gr.id, []);
        groupSubjectsByGrade.set(gr.id, []);
        continue;
      }

      const pgs = await PeriodGradeSubject.findAll({
        where: { periodGradeId: pg.id },
        include: [{
          model: Subject,
          as: 'subject',
          attributes: ['id', 'name', 'subjectGroupId', 'usesLiteralGrades'],
          include: [{ model: SubjectGroup, as: 'subjectGroup', attributes: ['id', 'name'] }],
        }],
        order: [['order', 'ASC']],
      });

      const subjects: Array<{ id: number; name: string }> = [];
      const literalSubjects: Array<{ id: number; name: string }> = [];
      const groupSubjects: Array<{ name: string; memberIds: number[] }> = [];
      const groupIndexByGroupId = new Map<number, number>();
      for (const p of pgs) {
        const subj = (p as any).subject;
        if (!subj) continue;
        const groupId = subj.subjectGroupId ?? null;
        if (groupId !== null) {
          // Collapse group subjects by subjectGroupId
          if (groupIndexByGroupId.has(groupId)) {
            const idx = groupIndexByGroupId.get(groupId)!;
            groupSubjects[idx].memberIds.push(subj.id);
          } else {
            groupIndexByGroupId.set(groupId, groupSubjects.length);
            groupSubjects.push({
              name: subj.subjectGroup?.name || subj.name,
              memberIds: [subj.id],
            });
          }
        } else if (subj.usesLiteralGrades) {
          literalSubjects.push({ id: subj.id, name: subj.name });
        } else {
          subjects.push({ id: subj.id, name: subj.name });
        }
      }
      subjectsByGrade.set(gr.id, subjects);
      literalSubjectsByGrade.set(gr.id, literalSubjects);
      groupSubjectsByGrade.set(gr.id, groupSubjects);
    }

    // 3. Get all inscriptions for this student (across all periods, including MP)
    const allInscriptions = await Inscription.findAll({
      where: { personId },
      include: [
        { model: SchoolPeriod, as: 'period', attributes: ['id', 'period', 'name', 'startYear', 'endYear', 'status'] },
        { model: Grade, as: 'grade', attributes: ['id', 'name', 'order'] },
        { model: Section, as: 'section', attributes: ['id', 'name'] },
      ],
    });

    const allInsIds = allInscriptions.map(i => i.id);

    // 4. Get InscriptionSubjects + SubjectFinalGrades (all grade types) + SubjectTermGrades
    const insSubjects = await InscriptionSubject.findAll({
      where: { inscriptionId: allInsIds as any },
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'abbreviation', 'subjectGroupId', 'usesLiteralGrades'] },
        {
          model: Inscription,
          as: 'inscription',
          attributes: ['id', 'personId', 'schoolPeriodId', 'gradeId'],
        },
        {
          model: SubjectFinalGrade,
          as: 'finalGrade',
          include: [{ model: Plantel, as: 'plantel', attributes: ['id', 'code', 'name', 'state'] }],
        },
        { model: SubjectTermGrade, as: 'termGrades' },
      ],
    });

    // 5. Build grades list from InscriptionSubjects
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
      let plantelId: number | null = fg?.plantelId ?? null;
      let plantelName: string | null = fg?.plantel?.name ?? null;
      let plantelState: string | null = fg?.plantel?.state ?? null;

      // For revision / materia_pendiente, resolve date from opportunity dates / encounter dates
      if (fg && gradeType && (gradeType === 'revision' || gradeType === 'materia_pendiente' || gradeType === 'revision_materia_pendiente')) {
        const resolvedDate = await resolveGradeDate(
          is.id,
          gradeType,
          is.sectionId ?? null,
          subj.id,
          ins.gradeId ?? null,
          ins.schoolPeriodId ?? null,
        );
        if (resolvedDate) date = resolvedDate;
      }

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

      gradesMap.push({
        personId: ins.personId,
        schoolPeriodId: ins.schoolPeriodId,
        gradeId: ins.gradeId ?? null,
        subjectId: subj.id,
        subjectGroupId: subj.subjectGroupId ?? null,
        subjectName: subj.name ?? null,
        finalScore,
        status,
        gradeType,
        plantelId,
        plantelName,
        plantelState,
        date,
        source: 'system',
      });
    }

    // 6. Get HistoricalGrade records (legacy data entered manually)
    const historicalGrades = await HistoricalGrade.findAll({
      where: { personId },
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'abbreviation', 'subjectGroupId'] },
        { model: Plantel, as: 'plantel', attributes: ['id', 'code', 'name', 'state'] },
      ],
    });

    for (const hg of historicalGrades) {
      const subj = (hg as any).subject;
      gradesMap.push({
        personId: hg.personId,
        schoolPeriodId: hg.schoolPeriodId ?? null,
        gradeId: hg.gradeId,
        subjectId: hg.subjectId,
        subjectGroupId: subj?.subjectGroupId ?? null,
        subjectName: hg.subjectName || (subj?.name ?? null),
        finalScore: hg.finalScore != null ? roundGrade(Number(hg.finalScore)) : null,
        status: hg.status,
        gradeType: hg.gradeType,
        plantelId: hg.plantelId ?? null,
        plantelName: (hg as any).plantel?.name ?? null,
        plantelState: (hg as any).plantel?.state ?? null,
        date: hg.date ? new Date(hg.date).toISOString().split('T')[0] : null,
        source: 'historical',
      });
    }

    // 7. Consolidated dedup: priority MP > revision > regular
    const priority = (gt: string | null): number => {
      if (!gt) return 3;
      if (gt === 'materia_pendiente' || gt === 'revision_materia_pendiente') return 1;
      if (gt === 'revision') return 2;
      return 3;
    };
    const gradeByKey = new Map<string, any>();
    for (const g of gradesMap) {
      const key = `${g.personId}__${g.gradeId}__${g.subjectId}`;
      const existing = gradeByKey.get(key);
      if (!existing) {
        gradeByKey.set(key, g);
      } else {
        const existingPri = priority(existing.gradeType);
        const newPri = priority(g.gradeType);
        if (newPri < existingPri) {
          gradeByKey.set(key, g);
        }
      }
    }
    const consolidatedGrades = Array.from(gradeByKey.values());

    // 8. Get person-planteles (ordered list)
    const personPlanteles = await PersonPlantel.findAll({
      where: { personId },
      order: [['order', 'ASC']],
      include: [{ model: Plantel, as: 'plantel', attributes: ['id', 'code', 'name', 'state', 'stateCode', 'parish'] }],
    });

    // Build a lookup: gradeId + subjectId -> grade data
    const gradeLookup = new Map<string, any>();
    for (const g of consolidatedGrades) {
      const key = `${g.gradeId}__${g.subjectId}`;
      gradeLookup.set(key, g);
    }

    // ── Read template and fill ──
    const namedRanges = readTemplateNamedRanges(templatePath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new Error('La plantilla no tiene hojas');
    }

    const sheetName = sheet.name;

    const setter = (name: string, value: string | number) => {
      if (value === undefined || value === null || value === '') return;
      const ref = namedRanges.getCell(sheetName, name);
      if (ref) {
        sheet.getCell(ref.cell).value = value;
      }
    };

    const residence = (person as any).residence;

    // ── Cells (only fill what is confirmed by the user) ──
    // T2 = Código de modalidad de estudios (mayúsculas)
    setter('inst_modality_code', (settings.institution_code || '').toUpperCase());

    // B6 = Código de la institución (DEA) (mayúsculas)
    setter('inst_code', (settings.institution_dea_code || plantel?.code || '').toUpperCase());

    // N3 = Parroquia de la institución + ", " + fecha actual (ej: "ALTAGRACIA DE ORITUCO, 30 DE DICIEMBRE DE 2023")
    const parish = (settings.institution_parish || '').toUpperCase();
    const dateStr = formatDateES(new Date()).toUpperCase();
    setter('expedition_place_date', parish ? `${parish}, ${dateStr}` : dateStr);

    // ── Institution ──
    // I6 = Nombre de la institución
    setter('inst_name', (settings.institution_name || plantel?.name || '').toUpperCase());
    // C7 = Dirección de la institución
    setter('inst_address', (settings.institution_address || '').toUpperCase());
    // Q7 = Teléfono
    setter('inst_phone', (settings.institution_phone || '').toUpperCase());
    // C8 = Municipio
    setter('inst_municipality', (settings.institution_municipality || plantel?.municipality || '').toUpperCase());
    // M8 = Estado
    setter('inst_state', (settings.institution_state || plantel?.state || '').toUpperCase());
    // Q8 = CDCEE
    setter('inst_cdcee', (settings.institution_cdcee || '').toUpperCase());

    // ── Student ──
    // C10 = Cédula en formato "V 00000000"
    const docType = (person as any).documentType === 'Extranjero' ? 'E' :
                    (person as any).documentType === 'Pasaporte' ? 'P' : 'V';
    const docNum = String(person.document || '').replace(/^(V|E|P|CE)\s*[-.]?\s*/i, '');
    setter('student_doc', docNum ? `${docType} ${docNum}` : '');
    // M10 = Fecha de nacimiento del estudiante
    setter('student_birthdate', person.birthdate ? formatDateES(person.birthdate).toUpperCase() : '');
    // B11 = Apellidos del estudiante
    setter('student_lastname', (person.lastName || '').toUpperCase());
    // M11 = Nombres del estudiante
    setter('student_firstname', (person.firstName || '').toUpperCase());
    // D12 = País de nacimiento del estudiante
    setter('student_birth_country', 'VENEZUELA');
    // J12 = Estado de nacimiento del estudiante
    setter('student_birth_state', (residence?.birthState || '').toUpperCase());
    // O12 = Municipio de nacimiento del estudiante
    setter('student_birth_municipality', (residence?.birthMunicipality || '').toUpperCase());

    // ── Planteles (up to 5) ──
    // Build the list from PersonPlantel (ordered). Each plantel has name, parish, stateCode.
    // For the system's own institution (if not in the plantel list), use
    // settings.institution_parish and first 2 letters of the state.
    // plantelId: null = system institution, otherwise the Plantel.id
    const SYSTEM_PLANTEL_ID = -1;
    const plantelesList: Array<{ plantelId: number; name: string; parish: string; stateCode: string }> = [];
    for (const pp of personPlanteles) {
      const p = (pp as any).plantel;
      if (!p) continue;
      plantelesList.push({
        plantelId: p.id,
        name: p.name || '',
        parish: p.parish || '',
        stateCode: p.stateCode || (p.state ? p.state.substring(0, 2).toUpperCase() : ''),
      });
    }
    // If the system's own institution is not already in the list, add it
    const ownInstName = (settings.institution_name || plantel?.name || '').toUpperCase();
    const ownInstInList = plantelesList.some(p => p.name.toUpperCase() === ownInstName);
    if (!ownInstInList && ownInstName) {
      const ownState = (settings.institution_state || plantel?.state || '').toUpperCase();
      plantelesList.push({
        plantelId: SYSTEM_PLANTEL_ID,
        name: ownInstName,
        parish: (settings.institution_parish || '').toUpperCase(),
        stateCode: ownState ? ownState.substring(0, 2) : '',
      });
    }
    // Write up to 5 planteles
    for (let i = 0; i < Math.min(plantelesList.length, 5); i++) {
      const p = plantelesList[i];
      setter(`plantel_${i + 1}_name`, p.name.toUpperCase());
      setter(`plantel_${i + 1}_parish`, p.parish.toUpperCase());
      setter(`plantel_${i + 1}_state`, p.stateCode.toUpperCase());
    }

    // Helper: resolve plantel index (1-based) for a grade
    const resolvePlantelIndex = (g: any): number => {
      // System grades or null plantelId → system institution
      if (g.source === 'system' || g.plantelId == null) {
        const idx = plantelesList.findIndex(p => p.plantelId === SYSTEM_PLANTEL_ID);
        return idx >= 0 ? idx + 1 : 1;
      }
      // Match by plantelId
      const idx = plantelesList.findIndex(p => p.plantelId === g.plantelId);
      if (idx >= 0) return idx + 1;
      // Fallback: match by name
      if (g.plantelName) {
        const idxByName = plantelesList.findIndex(p => p.name.toUpperCase() === g.plantelName.toUpperCase());
        if (idxByName >= 0) return idxByName + 1;
      }
      return 1;
    };

    // gradeType → letter code (same as Notas Históricas)
    const GRADE_TYPE_TO_CODE: Record<string, string> = {
      regular: 'F',
      revision: 'R',
      materia_pendiente: 'P',
      revision_materia_pendiente: 'M',
      transferencia: 'T',
      equivalencia: 'E',
    };

    // Max grade for padding (default 20)
    const maxGrade = Number(settings.max_grade || 20);
    const padDigits = Math.max(2, String(maxGrade).length);

    // Helper: round grade and enforce minimum of 1 (minimum allowed grade)
    const roundGradeMin1 = (score: number): number => Math.max(1, Math.round(score));

    // Letter grades config (for literal subjects)
    const letterGradesConfig: { letter: string; max: number }[] = (() => {
      try {
        const raw = settings.letter_grades;
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return parsed.scale || parsed || [];
      } catch { return []; }
    })();

    // ── Year 1 grades (rows 21-27, 7 subjects) ──
    const year1Grade = allGrades.find((g: any) => g.order === 1);
    if (year1Grade) {
      const subjects = subjectsByGrade.get(year1Grade.id) || [];
      const maxSubjects = Math.min(subjects.length, 7);
      for (let s = 0; s < maxSubjects; s++) {
        const subj = subjects[s];
        const lookupKey = `${year1Grade.id}__${subj.id}`;
        const g = gradeLookup.get(lookupKey);
        const subjNum = s + 1;

        // A21-A27 = subject name (title case)
        setter(`y1_s${subjNum}_name`, toTitleCaseES(subj.name));

        if (!g) continue;

        // D21-D27 = grade in numbers (rounded, zero-padded)
        if (g.finalScore != null) {
          setter(`y1_s${subjNum}_num`, String(roundGradeMin1(g.finalScore)).padStart(padDigits, '0'));
          // E21-E27 = grade in letters
          setter(`y1_s${subjNum}_letters`, numberToSpanishWords(roundGradeMin1(g.finalScore)).toUpperCase());
        }

        // G21-G27 = evaluation type letter
        const teCode = g.gradeType ? (GRADE_TYPE_TO_CODE[g.gradeType] || 'F') : 'F';
        setter(`y1_s${subjNum}_te`, teCode);

        // H21-H27 = month (00), I21-I27 = year (0000)
        if (g.date) {
          const parts = g.date.split('-');
          if (parts.length === 3) {
            setter(`y1_s${subjNum}_month`, padNumber(parseInt(parts[1], 10)));
            setter(`y1_s${subjNum}_year`, parts[0]);
          }
        }

        // J21-J27 = plantel index (1-based)
        setter(`y1_s${subjNum}_inst`, resolvePlantelIndex(g));
      }
    }

    // ── Literal subjects (8th per year) → P42-P46 (letter grades) ──
    // Year 1 → P42, Year 2 → P43, Year 3 → P44, Year 4 → P45, Year 5 → P46
    const literalCells = ['y1_s8_num', 'y2_s8_num', 'y3_s9_num', 'y4_s10_num', 'y5_s11_num'];
    for (let y = 1; y <= 5; y++) {
      const yearGrade = allGrades.find((g: any) => g.order === y);
      if (!yearGrade) continue;
      const literalSubjects = literalSubjectsByGrade.get(yearGrade.id) || [];
      if (literalSubjects.length > 0) {
        const subj = literalSubjects[0];
        const lookupKey = `${yearGrade.id}__${subj.id}`;
        const g = gradeLookup.get(lookupKey);
        if (g && g.finalScore != null) {
          setter(literalCells[y - 1], numericToLetter(roundGradeMin1(g.finalScore), letterGradesConfig).toUpperCase());
        }
      }
    }

    // ── Group subjects → P48-P52 (name), S48 + B49-B52 (letter grade) ──
    // Year 1 → P48/S48, Year 2 → P49/B49, Year 3 → P50/B50, Year 4 → P51/B51, Year 5 → P52/B52
    const groupNameCells = ['y1_group_name', 'y2_group_name', 'y3_group_name', 'y4_group_name', 'y5_group_name'];
    const groupNumCells  = ['y1_group_num',  'y2_group_num',  'y3_group_num',  'y4_group_num',  'y5_group_num'];
    for (let y = 1; y <= 5; y++) {
      const yearGrade = allGrades.find((g: any) => g.order === y);
      if (!yearGrade) continue;
      const groupSubjects = groupSubjectsByGrade.get(yearGrade.id) || [];
      if (groupSubjects.length > 0) {
        const grp = groupSubjects[0];
        // Find the grade by trying each member subjectId; use the member that has a grade
        for (const memberId of grp.memberIds) {
          const lookupKey = `${yearGrade.id}__${memberId}`;
          const g = gradeLookup.get(lookupKey);
          if (g && g.finalScore != null) {
            // P-cell = name of the specific subject the student took (not the group name)
            setter(groupNameCells[y - 1], toTitleCaseES(g.subjectName || grp.name));
            setter(groupNumCells[y - 1], numericToLetter(roundGradeMin1(g.finalScore), letterGradesConfig).toUpperCase());
            break;
          }
        }
      }
    }

    // ── Year 2 grades (rows 21-27, 7 subjects) ──
    // L=name, O=num, P=letters, Q=te, R=month, S=year, U=inst
    const year2Grade = allGrades.find((g: any) => g.order === 2);
    if (year2Grade) {
      const subjects = subjectsByGrade.get(year2Grade.id) || [];
      const maxSubjects = Math.min(subjects.length, 7);
      for (let s = 0; s < maxSubjects; s++) {
        const subj = subjects[s];
        const lookupKey = `${year2Grade.id}__${subj.id}`;
        const g = gradeLookup.get(lookupKey);
        const subjNum = s + 1;

        // L21-L27 = subject name (title case)
        setter(`y2_s${subjNum}_name`, toTitleCaseES(subj.name));

        if (!g) continue;

        // O21-O27 = grade in numbers (rounded, zero-padded)
        if (g.finalScore != null) {
          setter(`y2_s${subjNum}_num`, String(roundGradeMin1(g.finalScore)).padStart(padDigits, '0'));
          // P21-P27 = grade in letters
          setter(`y2_s${subjNum}_letters`, numberToSpanishWords(roundGradeMin1(g.finalScore)).toUpperCase());
        }

        // Q21-Q27 = evaluation type letter
        const teCode = g.gradeType ? (GRADE_TYPE_TO_CODE[g.gradeType] || 'F') : 'F';
        setter(`y2_s${subjNum}_te`, teCode);

        // R21-R27 = month (00), S21-S27 = year (0000)
        if (g.date) {
          const parts = g.date.split('-');
          if (parts.length === 3) {
            setter(`y2_s${subjNum}_month`, padNumber(parseInt(parts[1], 10)));
            setter(`y2_s${subjNum}_year`, parts[0]);
          }
        }

        // U21-U27 = plantel index (1-based)
        setter(`y2_s${subjNum}_inst`, resolvePlantelIndex(g));
      }
    }

    // ── Year 3 grades (rows 31-38, 8 subjects) ──
    // A=name, D=num, E=letters, G=te, H=month, I=year, J=inst
    const year3Grade = allGrades.find((g: any) => g.order === 3);
    if (year3Grade) {
      const subjects = subjectsByGrade.get(year3Grade.id) || [];
      const maxSubjects = Math.min(subjects.length, 8);
      for (let s = 0; s < maxSubjects; s++) {
        const subj = subjects[s];
        const lookupKey = `${year3Grade.id}__${subj.id}`;
        const g = gradeLookup.get(lookupKey);
        const subjNum = s + 1;

        // A31-A38 = subject name (title case)
        setter(`y3_s${subjNum}_name`, toTitleCaseES(subj.name));

        if (!g) continue;

        // D31-D38 = grade in numbers (rounded, zero-padded)
        if (g.finalScore != null) {
          setter(`y3_s${subjNum}_num`, String(roundGradeMin1(g.finalScore)).padStart(padDigits, '0'));
          // E31-E38 = grade in letters
          setter(`y3_s${subjNum}_letters`, numberToSpanishWords(roundGradeMin1(g.finalScore)).toUpperCase());
        }

        // G31-G38 = evaluation type letter
        const teCode = g.gradeType ? (GRADE_TYPE_TO_CODE[g.gradeType] || 'F') : 'F';
        setter(`y3_s${subjNum}_te`, teCode);

        // H31-H38 = month (00), I31-I38 = year (0000)
        if (g.date) {
          const parts = g.date.split('-');
          if (parts.length === 3) {
            setter(`y3_s${subjNum}_month`, padNumber(parseInt(parts[1], 10)));
            setter(`y3_s${subjNum}_year`, parts[0]);
          }
        }

        // J31-J38 = plantel index (1-based)
        setter(`y3_s${subjNum}_inst`, resolvePlantelIndex(g));
      }
    }

    // ── Year 4 grades (rows 31-39, 9 subjects) ──
    // L=name, O=num, P=letters, Q=te, R=month, S=year, U=inst
    const year4Grade = allGrades.find((g: any) => g.order === 4);
    if (year4Grade) {
      const subjects = subjectsByGrade.get(year4Grade.id) || [];
      const maxSubjects = Math.min(subjects.length, 9);
      for (let s = 0; s < maxSubjects; s++) {
        const subj = subjects[s];
        const lookupKey = `${year4Grade.id}__${subj.id}`;
        const g = gradeLookup.get(lookupKey);
        const subjNum = s + 1;

        // L31-L39 = subject name (title case)
        setter(`y4_s${subjNum}_name`, toTitleCaseES(subj.name));

        if (!g) continue;

        // O31-O39 = grade in numbers (rounded, zero-padded)
        if (g.finalScore != null) {
          setter(`y4_s${subjNum}_num`, String(roundGradeMin1(g.finalScore)).padStart(padDigits, '0'));
          // P31-P39 = grade in letters
          setter(`y4_s${subjNum}_letters`, numberToSpanishWords(roundGradeMin1(g.finalScore)).toUpperCase());
        }

        // Q31-Q39 = evaluation type letter
        const teCode = g.gradeType ? (GRADE_TYPE_TO_CODE[g.gradeType] || 'F') : 'F';
        setter(`y4_s${subjNum}_te`, teCode);

        // R31-R39 = month (00), S31-S39 = year (0000)
        if (g.date) {
          const parts = g.date.split('-');
          if (parts.length === 3) {
            setter(`y4_s${subjNum}_month`, padNumber(parseInt(parts[1], 10)));
            setter(`y4_s${subjNum}_year`, parts[0]);
          }
        }

        // U31-U39 = plantel index (1-based)
        setter(`y4_s${subjNum}_inst`, resolvePlantelIndex(g));
      }
    }

    // ── Year 5 grades (rows 43-52, 10 subjects) ──
    // A=name, D=num, E=letters, G=te, H=month, I=year, J=inst
    const year5Grade = allGrades.find((g: any) => g.order === 5);
    if (year5Grade) {
      const subjects = subjectsByGrade.get(year5Grade.id) || [];
      const maxSubjects = Math.min(subjects.length, 10);
      for (let s = 0; s < maxSubjects; s++) {
        const subj = subjects[s];
        const lookupKey = `${year5Grade.id}__${subj.id}`;
        const g = gradeLookup.get(lookupKey);
        const subjNum = s + 1;

        // A43-A52 = subject name (title case)
        setter(`y5_s${subjNum}_name`, toTitleCaseES(subj.name));

        if (!g) continue;

        // D43-D52 = grade in numbers (rounded, zero-padded)
        if (g.finalScore != null) {
          setter(`y5_s${subjNum}_num`, String(roundGradeMin1(g.finalScore)).padStart(padDigits, '0'));
          // E43-E52 = grade in letters
          setter(`y5_s${subjNum}_letters`, numberToSpanishWords(roundGradeMin1(g.finalScore)).toUpperCase());
        }

        // G43-G52 = evaluation type letter
        const teCode = g.gradeType ? (GRADE_TYPE_TO_CODE[g.gradeType] || 'F') : 'F';
        setter(`y5_s${subjNum}_te`, teCode);

        // H43-H52 = month (00), I43-I52 = year (0000)
        if (g.date) {
          const parts = g.date.split('-');
          if (parts.length === 3) {
            setter(`y5_s${subjNum}_month`, padNumber(parseInt(parts[1], 10)));
            setter(`y5_s${subjNum}_year`, parts[0]);
          }
        }

        // J43-J52 = plantel index (1-based)
        setter(`y5_s${subjNum}_inst`, resolvePlantelIndex(g));
      }
    }

    // ── Overall average (S53) ──
    // Average of all numeric (non-literal) grades across all 5 years.
    const allNumericScores: number[] = [];
    for (let y = 1; y <= 5; y++) {
      const yearGrade = allGrades.find((g: any) => g.order === y);
      if (!yearGrade) continue;
      const subjects = subjectsByGrade.get(yearGrade.id) || [];
      for (const subj of subjects) {
        const lookupKey = `${yearGrade.id}__${subj.id}`;
        const g = gradeLookup.get(lookupKey);
        if (g && g.finalScore != null) {
          allNumericScores.push(roundGradeMin1(g.finalScore));
        }
      }
    }
    if (allNumericScores.length > 0) {
      const avg = allNumericScores.reduce((a, b) => a + b, 0) / allNumericScores.length;
      setter('overall_average', avg.toFixed(2));
    }

    // ── Director (A58 = name, A60 = cédula) ──
    // If director_first_names and director_last_names are set, use "APELLIDOS, Nombres" format.
    // Otherwise fall back to director_name.
    const directorFirstNames = (settings.director_first_names || '').trim();
    const directorLastNames = (settings.director_last_names || '').trim();
    let directorDisplay = '';
    if (directorLastNames && directorFirstNames) {
      directorDisplay = `${directorLastNames}, ${directorFirstNames}`;
    } else {
      directorDisplay = settings.director_name || '';
    }
    setter('director_name', directorDisplay.toUpperCase());
    const directorDocRaw = settings.director_document || '';
    const directorDocNum = directorDocRaw.replace(/^(V|E|P|CE)\s*[-.]?\s*/i, '');
    const directorDocType = /^e/i.test(directorDocRaw) ? 'E' : /^p/i.test(directorDocRaw) ? 'P' : 'V';
    setter('director_doc', directorDocNum ? `${directorDocType} ${directorDocNum}` : '');

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