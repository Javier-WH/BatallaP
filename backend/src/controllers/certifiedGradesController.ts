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
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'abbreviation', 'subjectGroupId'] },
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

    // Build a lookup: gradeId + subjectName (normalized) -> grade data
    const gradeLookup = new Map<string, any>();
    for (const g of consolidatedGrades) {
      const key = `${g.gradeId}__${(g.subjectName || '').trim().toLowerCase()}`;
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
    const plantelesList: Array<{ name: string; parish: string; stateCode: string }> = [];
    for (const pp of personPlanteles) {
      const p = (pp as any).plantel;
      if (!p) continue;
      plantelesList.push({
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