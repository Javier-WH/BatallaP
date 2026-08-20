import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';
import api from '@/services/api';

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

interface InscriptionStudent {
  student?: {
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
  const { gradeId, sectionId, schoolPeriodId, gradeName: rawGradeName, sectionName: rawSectionName, periodName } = input;
  const gradeName = toTitleCase(rawGradeName);
  const sectionName = toTitleCase(rawSectionName);

  // Fetch students for this grade+section
  const res = await api.get('/inscriptions', {
    params: { schoolPeriodId, gradeId, sectionId },
  });
  const students: InscriptionStudent[] = (res.data || []).filter(
    (s: InscriptionStudent) => !s.matriculation?.hiddenFromControlEstudios
  );

  // Sort by cédula number ascending, with "Cedula Escolar" (CE) at the end
  const parseDoc = (doc: string, docType: string) => {
    const isEscolar = docType === 'Cedula Escolar';
    const num = parseInt((doc || '').replace(/\D/g, ''), 10) || 0;
    return { isEscolar, num };
  };
  students.sort((a, b) => {
    const da = parseDoc(a.student?.document || '', a.student?.documentType || '');
    const db = parseDoc(b.student?.document || '', b.student?.documentType || '');
    if (da.isEscolar !== db.isEscolar) return da.isEscolar ? 1 : -1;
    return da.num - db.num;
  });

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

  // Logo
  const logoBuffer = await loadLogo();
  if (logoBuffer) {
    const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
    worksheet.addImage(logoId, {
      tl: { col: 0.31, row: 0.5 },
      ext: { width: 119, height: 119 },
    });
  }

  // Header rows
  const titleRow = worksheet.addRow(['', '', 'U.E.C. BATALLA DE LA VICTORIA']);
  const periodRow = worksheet.addRow(['', '', periodName]);
  worksheet.addRow([]);
  const teacherRow = worksheet.addRow(['', '', `Prof. Guía: ${teacherName}`.trim()]);
  const sectionRow = worksheet.addRow(['', '', `${gradeName} ${sectionName}`]);

  [titleRow, periodRow, teacherRow].forEach((row, i) => {
    const firstCell = row.getCell(3);
    if (i < 2) {
      firstCell.font = { bold: true, size: 16 };
      firstCell.alignment = { horizontal: 'center' };
    } else {
      firstCell.font = { bold: true, size: 11 };
    }
  });
  sectionRow.getCell(3).font = { bold: true, size: 12 };
  sectionRow.getCell(3).alignment = { horizontal: 'center' };

  // Table starts at row 7
  const startRow = 7;
  const headerRow = worksheet.getRow(startRow);
  headerRow.values = ['#', 'CÉDULA', 'APELLIDOS Y NOMBRES', 'Teléfono'];
  for (let c = 1; c <= 4; c++) {
    const cell = headerRow.getCell(c);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    cell.alignment = { horizontal: 'center' };
  }

  worksheet.getColumn(1).width = 6;
  worksheet.getColumn(2).width = 18;
  worksheet.getColumn(3).width = 45;
  worksheet.getColumn(4).width = 18;

  students.forEach((s, idx) => {
    const row = worksheet.getRow(startRow + 1 + idx);
    row.values = [
      idx + 1,
      s.student?.document || '',
      `${s.student?.lastName || ''} ${s.student?.firstName || ''}`.trim(),
      s.student?.contact?.phone1 || '',
    ];
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center' };
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
