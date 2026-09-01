import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

interface Period {
  id: string;
  start: string;
  end: string;
  break?: boolean;
  label?: string;
  section: string;
}

interface ScheduleSection {
  id: string;
  label: string;
  periods: Period[];
}

interface ScheduleEntryData {
  id?: number;
  day: string;
  periodId: string;
  subjectId: number;
  teacherId: number;
  isGroupSubject: boolean;
  subjectName: string;
  subject?: { name: string };
  teacher?: { firstName: string; lastName: string };
}

export interface HorarioInput {
  sectionLabel: string;       // e.g. "1° A" (already formatted)
  teacherName?: string;       // optional, for teacher schedule export
  room?: string;              // e.g. "AULA 1"
  schoolPeriodName: string;   // e.g. "2025 - 2026"
  sections: ScheduleSection[];
  entries: Record<string, ScheduleEntryData[]>;
  gradeOrder?: number;        // e.g. 1 for "Primer año"
  sectionName?: string;       // e.g. "SECCIÓN A" or "A"
  institutionName?: string;   // e.g. "Unidad Educativa Colegio \"Batalla de La Altagracia\""
  institutionParish?: string; // e.g. "Altagracia de Orituco"
  institutionState?: string;  // e.g. "Guárico"
}

// Build a signature to detect mergeable consecutive cells
// Use the display label (subject name) as the signature — if two consecutive cells
// show the same subject name, they should be merged
function cellSignature(cellEntries: ScheduleEntryData[] | undefined): string {
  if (!cellEntries || cellEntries.length === 0) return '';
  return cellLabel(cellEntries);
}

// Get the display label for a cell
function cellLabel(cellEntries: ScheduleEntryData[] | undefined): string {
  if (!cellEntries || cellEntries.length === 0) return '';
  if (cellEntries.length === 1) {
    const e = cellEntries[0];
    return (e.subjectName || e.subject?.name || '').toUpperCase();
  }
  // Multiple group subjects — join names
  return cellEntries.map(e => (e.subjectName || e.subject?.name || '').toUpperCase()).join(' / ');
}

const thinBorder: Partial<ExcelJS.Borders> = {
  left: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
  top: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
};

const mediumBorder: Partial<ExcelJS.Borders> = {
  left: { style: 'medium', color: { argb: 'FF000000' } },
  right: { style: 'medium', color: { argb: 'FF000000' } },
  top: { style: 'medium', color: { argb: 'FF000000' } },
  bottom: { style: 'medium', color: { argb: 'FF000000' } },
};

const headerFont: Partial<ExcelJS.Font> = {
  name: 'Cambria',
  size: 9,
  color: { argb: 'FF000000' },
};

const titleFont: Partial<ExcelJS.Font> = {
  name: 'Cambria',
  size: 10,
  bold: true,
  color: { argb: 'FF000000' },
};

const sectionFont: Partial<ExcelJS.Font> = {
  name: 'Cambria',
  size: 10,
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

const dayHeaderFont: Partial<ExcelJS.Font> = {
  name: 'Cambria',
  size: 9,
  bold: true,
  color: { argb: 'FF000000' },
};

const cellFont: Partial<ExcelJS.Font> = {
  name: 'Cambria',
  size: 7,
  color: { argb: 'FF000000' },
};

const timeFont: Partial<ExcelJS.Font> = {
  name: 'Cambria',
  size: 8,
  color: { argb: 'FF000000' },
};

const centerAlign: Partial<ExcelJS.Alignment> = {
  horizontal: 'center',
  vertical: 'middle',
  wrapText: true,
};

const rightAlign: Partial<ExcelJS.Alignment> = {
  horizontal: 'right',
  vertical: 'middle',
};

/**
 * Render a single horario block (header + grid) onto a worksheet starting at a given row.
 * Returns the next available row (after the block + optional gap).
 *
 * This is the reusable core extracted from generateHorario so it can be used both for
 * single-section exports and for batch exports (multiple sections stacked on one sheet).
 */
function renderHorarioBlock(
  ws: ExcelJS.Worksheet,
  startRow: number,
  opts: {
    sections: ScheduleSection[];
    entries: Record<string, ScheduleEntryData[]>;
  },
): number {
  const { sections, entries } = opts;
  let currentRow = startRow;

  // ── Build merge info per section ──
  const mergeInfoBySection = buildMergeInfoBySection(sections, entries);

  // ── Write grid rows ──
  let sectionStartRow = 0;
  for (const secData of mergeInfoBySection) {
    const sec = sections.find(s => s.id === secData.sectionId)!;
    const { nonBreakPeriods, mergeInfo, breakAfter } = secData;

    // Section banner row (MAÑANA / TARDE)
    ws.mergeCells(`A${currentRow}:F${currentRow}`);
    const bannerCell = ws.getRow(currentRow).getCell(1);
    bannerCell.value = sec.label.toUpperCase().split('').join('   ');
    bannerCell.font = { name: 'Cambria', size: 10, bold: true, color: { argb: 'FF000000' } };
    bannerCell.alignment = centerAlign;
    ws.getRow(currentRow).height = 15.75;
    currentRow++;
    sectionStartRow = currentRow;

    // Day header row
    const headerRow = ws.getRow(currentRow);
    headerRow.getCell(1).value = 'HORA';
    headerRow.getCell(1).font = dayHeaderFont;
    headerRow.getCell(1).alignment = centerAlign;
    headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    headerRow.getCell(1).border = mediumBorder;
    DAYS.forEach((d, i) => {
      const cell = headerRow.getCell(i + 2);
      cell.value = d.toUpperCase();
      cell.font = dayHeaderFont;
      cell.alignment = centerAlign;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = mediumBorder;
    });
    currentRow++;

    // Period rows
    const breakAfterRows: number[] = [];
    for (const period of nonBreakPeriods) {
      const row = ws.getRow(currentRow);
      const timeCell = row.getCell(1);
      timeCell.value = `${period.start} - ${period.end}`;
      timeCell.font = timeFont;
      timeCell.alignment = centerAlign;
      if (breakAfter.has(period.id)) breakAfterRows.push(currentRow);

      DAYS.forEach((day, dayIdx) => {
        const col = dayIdx + 2;
        const key = `${day}|${period.id}`;
        const info = mergeInfo[key];
        const cellSpan = info?.span ?? 1;
        if (!info?.start) return;
        const cell = row.getCell(col);
        const label = cellLabel(entries[key]);
        if (label) cell.value = label;
        cell.font = cellFont;
        cell.alignment = centerAlign;
        if (cellSpan > 1) {
          ws.mergeCells(currentRow, col, currentRow + cellSpan - 1, col);
        }
      });
      currentRow++;
    }

    // Outer border
    const sectionEndRow = currentRow - 1;
    for (let r = sectionStartRow; r <= sectionEndRow; r++) {
      for (let c = 1; c <= 6; c++) {
        const cell = ws.getRow(r).getCell(c);
        const isTop = r === sectionStartRow;
        const isBottom = r === sectionEndRow;
        const isLeft = c === 1;
        const isRight = c === 6;
        cell.border = {
          left: { style: isLeft ? 'medium' : 'thin', color: { argb: 'FF000000' } },
          right: { style: isRight ? 'medium' : 'thin', color: { argb: 'FF000000' } },
          top: { style: isTop ? 'medium' : 'thin', color: { argb: 'FF000000' } },
          bottom: { style: isBottom ? 'medium' : 'thin', color: { argb: 'FF000000' } },
        };
      }
    }

    // Double border on break rows
    for (const r of breakAfterRows) {
      const cell = ws.getRow(r).getCell(1);
      cell.border = { ...cell.border, bottom: { style: 'double', color: { argb: 'FF000000' } } } as any;
      if (r + 1 <= sectionEndRow) {
        const nextCell = ws.getRow(r + 1).getCell(1);
        nextCell.border = { ...nextCell.border, top: { style: 'double', color: { argb: 'FF000000' } } } as any;
      }
    }
  }

  return currentRow;
}

// Build merge info for all sections of a schedule
function buildMergeInfoBySection(sections: ScheduleSection[], entries: Record<string, ScheduleEntryData[]>) {
  return sections.map(sec => {
    const nonBreakPeriods = sec.periods.filter(p => !p.break);
    const breakAfter = new Set<string>();
    for (let i = 0; i < sec.periods.length; i++) {
      const p = sec.periods[i];
      if (p.break) continue;
      if (i + 1 < sec.periods.length && sec.periods[i + 1].break) breakAfter.add(p.id);
    }
    const mergeInfo: Record<string, { span: number; start: boolean }> = {};
    DAYS.forEach(day => {
      let i = 0;
      while (i < nonBreakPeriods.length) {
        const p = nonBreakPeriods[i];
        const sig = cellSignature(entries[`${day}|${p.id}`]);
        if (!sig) {
          mergeInfo[`${day}|${p.id}`] = { span: 1, start: true };
          i++;
          continue;
        }
        let j = i + 1;
        while (j < nonBreakPeriods.length) {
          const nextP = nonBreakPeriods[j];
          if (cellSignature(entries[`${day}|${nextP.id}`]) !== sig) break;
          j++;
        }
        const span = j - i;
        mergeInfo[`${day}|${p.id}`] = { span, start: true };
        for (let k = i + 1; k < j; k++) {
          mergeInfo[`${day}|${nonBreakPeriods[k].id}`] = { span, start: false };
        }
        i = j;
      }
    });
    return { sectionId: sec.id, nonBreakPeriods, mergeInfo, breakAfter };
  });
}

// Build the school info header (4 rows) + title + profesor/añosec + año/secc+aula
function renderHeaderBlock(
  ws: ExcelJS.Worksheet,
  startRow: number,
  opts: {
    teacherName?: string;
    room?: string;
    yearRange: string;
    formattedSectionLabel: string;
    institutionName?: string;
    institutionParish?: string;
    institutionState?: string;
  },
): number {
  const { teacherName, room, yearRange, formattedSectionLabel, institutionName, institutionParish, institutionState } = opts;
  let currentRow = startRow;

  // R1-R4: School info
  const locationLine = [institutionParish, institutionState ? `Estado ${institutionState}` : null]
    .filter(Boolean)
    .join('-') || 'Altagracia de Orituco-Estado Guárico.';
  const schoolInfo = [
    'República Bolivariana de Venezuela',
    'Ministerio del Poder Popular Para La Educación',
    institutionName || 'Unidad Educativa Colegio "Batalla de La Altagracia"',
    locationLine,
  ];
  schoolInfo.forEach((text, i) => {
    const row = ws.getRow(currentRow + i);
    row.height = 11.1;
    ws.mergeCells(`B${currentRow + i}:E${currentRow + i}`);
    const cell = row.getCell(2);
    cell.value = text;
    cell.font = headerFont;
    cell.alignment = centerAlign;
  });
  currentRow += 4;

  // R5: "HORARIO DE CLASES"
  ws.mergeCells(`A${currentRow}:F${currentRow}`);
  const r5c1 = ws.getRow(currentRow).getCell(1);
  r5c1.value = 'HORARIO DE CLASES';
  r5c1.font = titleFont;
  r5c1.alignment = centerAlign;
  currentRow++;

  // R6: Profesor + Año Escolar
  const r6 = ws.getRow(currentRow);
  r6.height = 12.95;
  r6.getCell(1).value = 'Profesor:  ';
  r6.getCell(1).font = { name: 'Cambria', size: 11, bold: true };
  r6.getCell(1).alignment = rightAlign;
  ws.mergeCells(`B${currentRow}:C${currentRow}`);
  r6.getCell(2).value = (teacherName || '').toUpperCase();
  r6.getCell(2).font = { name: 'Cambria', size: 11 };
  r6.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
  r6.getCell(5).value = 'Año Escolar:';
  r6.getCell(5).font = { name: 'Cambria', size: 11, bold: true };
  r6.getCell(5).alignment = rightAlign;
  r6.getCell(6).value = yearRange;
  r6.getCell(6).font = { name: 'Cambria', size: 11 };
  r6.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' };
  currentRow++;

  // R7: Año/Secc + Aula
  const r7 = ws.getRow(currentRow);
  r7.height = 12.95;
  r7.getCell(1).value = 'Año/Secc:  ';
  r7.getCell(1).font = { name: 'Cambria', size: 11, bold: true };
  r7.getCell(1).alignment = rightAlign;
  r7.getCell(2).value = formattedSectionLabel;
  r7.getCell(2).font = { name: 'Cambria', size: 11, bold: true };
  r7.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
  if (room) {
    r7.getCell(5).value = room.toUpperCase();
    r7.getCell(5).font = { name: 'Cambria', size: 11, bold: true };
    r7.getCell(5).alignment = centerAlign;
  }
  currentRow++;

  return currentRow;
}

function formatSectionLabel(gradeOrder: number | undefined, sectionName: string | undefined, fallback: string): string {
  if (gradeOrder != null && sectionName) {
    const letter = sectionName.replace(/secci[oó]n/i, '').trim().toUpperCase();
    if (letter) return `${gradeOrder}° "${letter}"`;
  }
  return fallback;
}

function extractYearRange(schoolPeriodName: string): string {
  return schoolPeriodName.replace(/.*?(\d{4}\s*-\s*\d{4}).*/, '$1') || schoolPeriodName;
}

/**
 * Generate a horario Excel file matching the UECBV mockup format (single section/teacher).
 */
export async function generateHorario(input: HorarioInput) {
  const { sectionLabel, teacherName, room, schoolPeriodName, sections, entries, gradeOrder, sectionName, institutionName, institutionParish, institutionState } = input;

  const formattedSectionLabel = formatSectionLabel(gradeOrder, sectionName, sectionLabel);
  const yearRange = extractYearRange(schoolPeriodName);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Horario', {
    properties: { defaultRowHeight: 15 },
  });
  ws.columns = Array(6).fill(0).map(() => ({ width: 15.71 }));

  // Page setup: Letter, fit to 1 page wide
  ws.pageSetup = {
    paperSize: 1, // Letter (8.5 x 11 in)
    fitToWidth: 1,
    fitToHeight: 0,
    orientation: 'portrait',
    fitToPage: true,
    scale: 100,
  } as any;
  ws.autoFilter = undefined;

  const afterHeader = renderHeaderBlock(ws, 1, {
    teacherName, room, yearRange, formattedSectionLabel, institutionName, institutionParish, institutionState,
  });

  renderHorarioBlock(ws, afterHeader, { sections, entries });

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `horario_${formattedSectionLabel.replace(/[^\w]/g, '_')}_${dayjs().format('YYYY-MM-DD')}.xlsx`;
  saveAs(new Blob([buffer]), fileName);
}

// ── Batch export types ──

export interface HorarioBatchItem {
  gradeId: number;
  gradeName: string;
  gradeOrder: number;
  sectionId: number;        // PeriodGradeSection id
  sectionName: string;      // raw section name (e.g. "A")
  sectionLabel: string;     // formatted label e.g. "1° A"
  teacherName?: string;
  room?: string;
  entries: Record<string, ScheduleEntryData[]>;
}

/**
 * Generate a batch horario Excel file: one sheet per grade, sections stacked vertically
 * (2 per page via page break). Each section gets its own header + grid block.
 */
export async function generateHorarioBatch(
  items: HorarioBatchItem[],
  common: {
    schoolPeriodName: string;
    sections: ScheduleSection[];
    institutionName?: string;
    institutionParish?: string;
    institutionState?: string;
  },
) {
  const { schoolPeriodName, sections, institutionName, institutionParish, institutionState } = common;
  const yearRange = extractYearRange(schoolPeriodName);

  // Group items by gradeId
  const byGrade = new Map<number, HorarioBatchItem[]>();
  for (const item of items) {
    if (!byGrade.has(item.gradeId)) byGrade.set(item.gradeId, []);
    byGrade.get(item.gradeId)!.push(item);
  }

  // Sort grades by gradeOrder
  const sortedGradeIds = Array.from(byGrade.keys()).sort((a, b) => {
    const ga = byGrade.get(a)![0].gradeOrder;
    const gb = byGrade.get(b)![0].gradeOrder;
    return ga - gb;
  });

  const workbook = new ExcelJS.Workbook();

  for (const gradeId of sortedGradeIds) {
    const gradeItems = byGrade.get(gradeId)!;
    // Sort sections within grade by sectionName
    gradeItems.sort((a, b) => (a.sectionName || '').localeCompare(b.sectionName || '', 'es'));

    const gradeName = gradeItems[0].gradeName || `Grado ${gradeId}`;
    const sheetName = gradeName.replace(/[\\/?*\[\]:]/g, '').substring(0, 31) || `Grado_${gradeId}`;
    const ws = workbook.addWorksheet(sheetName, {
      properties: { defaultRowHeight: 15 },
    });
    ws.columns = Array(6).fill(0).map(() => ({ width: 15.71 }));

    let currentRow = 1;
    let sectionCountInSheet = 0;

    for (const item of gradeItems) {
      const formattedLabel = formatSectionLabel(item.gradeOrder, item.sectionName, item.sectionLabel);

      const afterHeader = renderHeaderBlock(ws, currentRow, {
        teacherName: item.teacherName,
        room: item.room,
        yearRange,
        formattedSectionLabel: formattedLabel,
        institutionName,
        institutionParish,
        institutionState,
      });

      const afterBlock = renderHorarioBlock(ws, afterHeader, {
        sections,
        entries: item.entries,
      });

      currentRow = afterBlock;
      sectionCountInSheet++;

      // Page break after every 2 sections (so 2 sections per printed page)
      if (sectionCountInSheet % 2 === 0 && sectionCountInSheet < gradeItems.length) {
        ws.addRow([]); // spacer row
        // Add page break: ExcelJS uses rowBreaks
        (ws as any).rowBreaks = (ws as any).rowBreaks || [];
        (ws as any).rowBreaks.push({ id: currentRow - 1, max: 16383, min: 1 });
        currentRow++;
      } else if (sectionCountInSheet < gradeItems.length) {
        // Small gap between sections on same page
        ws.addRow([]);
        currentRow++;
      }
    }

    // Page setup: Letter, fit to width
    ws.pageSetup = {
      paperSize: 1, // Letter (8.5 x 11 in)
      fitToWidth: 1,
      fitToHeight: 0,
      orientation: 'portrait',
      fitToPage: true,
      scale: 100,
    } as any;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `horarios_batch_${dayjs().format('YYYY-MM-DD')}.xlsx`;
  saveAs(new Blob([buffer]), fileName);
}
