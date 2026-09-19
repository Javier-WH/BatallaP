import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';
import api from '@/services/api';
import { sortNominaStudents } from '@/utils/studentSort';

// Capitalize first letter of each word, rest lowercase (supports ñ and accents)
const toTitleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[^a-záéíóúñ])([a-záéíóúñ])/gi, (_m, p1, p2) => p1 + p2.toUpperCase());

export interface NominaInput {
  gradeId: number;
  sectionId: number;
  schoolPeriodId: number;
  gradeName: string;
  sectionName: string;
  periodName: string;
  institutionName?: string;
}

// Cache logo across calls within a single generation pass
let cachedLogoBuffer: ArrayBuffer | null | undefined;

async function loadLogo(force = false): Promise<ArrayBuffer | null> {
  if (cachedLogoBuffer !== undefined && !force) return cachedLogoBuffer ?? null;
  try {
    const logoRes = await api.get('/upload/logo', { responseType: 'arraybuffer' });
    cachedLogoBuffer = logoRes.data;
  } catch (e) {
    console.error('No se pudo cargar el logo para la nómina', e);
    cachedLogoBuffer = null;
  }
  return cachedLogoBuffer ?? null;
}

// Cache pending subjects per period across sheets within a single generation pass
const cachedPendingByPeriod = new Map<number, Map<number, string[]>>();

async function loadPendingSubjects(schoolPeriodId: number): Promise<Map<number, string[]>> {
  const cached = cachedPendingByPeriod.get(schoolPeriodId);
  if (cached) return cached;
  // Keyed by personId: a PendingSubject may point to the student's regular
  // inscription OR to their auxiliary MP inscription — personId covers both.
  const map = new Map<number, string[]>();
  try {
    const res = await api.get(`/periods/${schoolPeriodId}/pending-subjects`);
    for (const p of res.data || []) {
      if (p.status !== 'pendiente') continue;
      const personId: number | undefined = p.inscription?.personId;
      const label: string | undefined = p.subject?.abbreviation?.trim() || p.subject?.name;
      if (!personId || !label) continue;
      const list = map.get(personId) ?? [];
      if (!list.includes(label)) list.push(label);
      map.set(personId, list);
    }
  } catch (e) {
    console.error('No se pudieron cargar las materias pendientes para la nómina', e);
  }
  cachedPendingByPeriod.set(schoolPeriodId, map);
  return map;
}

interface InscriptionStudent {
  id: number;
  student?: {
    id?: number;
    document?: string;
    documentType?: string;
    firstName?: string;
    lastName?: string;
    contact?: { phone1?: string };
  };
  matriculation?: { hiddenFromControlEstudios?: boolean };
}

/**
 * Add a single nomina sheet to an existing workbook.
 * Returns the number of students added to the sheet.
 */
export async function addNominaSheet(
  workbook: ExcelJS.Workbook,
  input: NominaInput
): Promise<number> {
  const { gradeId, sectionId, schoolPeriodId, gradeName: rawGradeName, sectionName: rawSectionName, periodName, institutionName } = input;
  const gradeName = toTitleCase(rawGradeName);
  const sectionName = toTitleCase(rawSectionName);

  // Fetch students for this grade+section
  const res = await api.get('/inscriptions', {
    params: { schoolPeriodId, gradeId, sectionId },
  });
  const students: InscriptionStudent[] = (res.data || []).filter(
    (s: InscriptionStudent) => !s.matriculation?.hiddenFromControlEstudios
  );

  // Sort students canonically: document type → document number → lastName → firstName
  sortNominaStudents(students);

  // Fetch pending subjects for this period (personId → subject names)
  const pendingByPerson = await loadPendingSubjects(schoolPeriodId);

  // Fetch guide teacher for this grade+section
  let teacherName = '';
  try {
    const guideRes = await api.get('/section-guides', {
      params: { schoolPeriodId, gradeId, sectionId },
    });
    const guide = guideRes.data;
    if (guide?.guideTeacher) {
      teacherName = toTitleCase(`${guide.guideTeacher.lastName || ''} ${guide.guideTeacher.firstName || ''}`.trim());
    }
  } catch {
    // No guide teacher found, leave empty
  }

  // Sheet name: "Quinto A" (max 31 chars for Excel)
  const sheetName = `${gradeName} ${sectionName}`.slice(0, 31);
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // Logo: 1.03" diameter (~99px), aligned to the top-left corner
  const logoBuffer = await loadLogo();
  if (logoBuffer) {
    const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
    worksheet.addImage(logoId, {
      tl: { col: 0, row: 0 },
      ext: { width: 109, height: 109 },
    });
  }

  // Header rows: institution name merged across the full table width (A:D) so it never gets cut
  const lastTableCol = 'D';
  worksheet.mergeCells(`A1:${lastTableCol}1`);
  worksheet.mergeCells(`A2:${lastTableCol}2`);
  worksheet.mergeCells(`A4:${lastTableCol}4`);
  worksheet.mergeCells(`A5:${lastTableCol}5`);

  const titleCell = worksheet.getCell('A1');
  titleCell.value = institutionName || 'GradeMaster';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' };

  const periodCell = worksheet.getCell('A2');
  periodCell.value = periodName;
  periodCell.font = { bold: true, size: 16 };
  periodCell.alignment = { horizontal: 'center' };

  const teacherCell = worksheet.getCell('A4');
  teacherCell.value = `Prof. Guía: ${teacherName}`.trim();
  teacherCell.font = { bold: true, size: 11 };
  teacherCell.alignment = { horizontal: 'center' };

  const sectionCell = worksheet.getCell('A5');
  sectionCell.value = `${gradeName} ${sectionName}`;
  sectionCell.font = { bold: true, size: 12 };
  sectionCell.alignment = { horizontal: 'center' };

  // Table starts at row 7
  const startRow = 7;
  const headerRow = worksheet.getRow(startRow);
  headerRow.values = ['#', 'CÉDULA', 'APELLIDOS Y NOMBRES', 'MATERIA PENDIENTE'];
  for (let c = 1; c <= 4; c++) {
    const cell = headerRow.getCell(c);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    cell.alignment = { horizontal: 'center' };
  }

  worksheet.getColumn(1).width = 6;
  worksheet.getColumn(2).width = 18;
  worksheet.getColumn(3).width = 45;
  worksheet.getColumn(4).width = 21;

  students.forEach((s, idx) => {
    const row = worksheet.getRow(startRow + 1 + idx);
    const pendingNames = pendingByPerson.get(s.student?.id ?? -1);
    row.values = [
      idx + 1,
      s.student?.document || '',
      `${s.student?.lastName || ''} ${s.student?.firstName || ''}`.trim(),
      pendingNames && pendingNames.length > 0 ? pendingNames.join(', ') : '—',
    ];
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center', wrapText: true };
  });

  // Empty rows (minimum 35 students total)
  const emptyStart = startRow + 1 + students.length;
  const totalRows = startRow + 35;
  for (let i = emptyStart; i <= totalRows; i++) {
    const row = worksheet.getRow(i);
    row.values = [i - startRow, '', '', ''];
    row.getCell(1).alignment = { horizontal: 'center' };
  }

  // Borders for table
  for (let r = startRow; r <= totalRows; r++) {
    for (let c = 1; c <= 4; c++) {
      const cell = worksheet.getRow(r).getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    }
  }

  return students.length;
}

/**
 * Generate and download a single-section nomina (used by TeacherPanel).
 */
export async function generateSingleNomina(input: NominaInput): Promise<number> {
  cachedLogoBuffer = undefined; // reset cache
  cachedPendingByPeriod.clear();
  const workbook = new ExcelJS.Workbook();
  const count = await addNominaSheet(workbook, input);
  if (count === 0 && workbook.worksheets.length === 0) {
    throw new Error('No se pudo generar la nómina');
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `nomina_${dayjs().format('YYYY-MM-DD')}.xlsx`;
  saveAs(new Blob([buffer]), fileName);
  return count;
}

/**
 * Generate and download a multi-section nomina (used by MatriculationEnrollment).
 */
export async function generateMultiNomina(
  combinations: NominaInput[]
): Promise<{ sheetsCreated: number; totalStudents: number }> {
  cachedLogoBuffer = undefined; // reset cache
  cachedPendingByPeriod.clear();
  const workbook = new ExcelJS.Workbook();
  let totalStudents = 0;
  let sheetsCreated = 0;

  for (const combo of combinations) {
    const count = await addNominaSheet(workbook, combo);
    totalStudents += count;
    sheetsCreated++;
  }

  if (sheetsCreated === 0) {
    throw new Error('No se pudieron generar las nóminas');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `nominas_${dayjs().format('YYYY-MM-DD')}.xlsx`;
  saveAs(new Blob([buffer]), fileName);
  return { sheetsCreated, totalStudents };
}
