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
 * Generate a horario Excel file matching the UECBV mockup format.
 */
export async function generateHorario(input: HorarioInput) {
  const { sectionLabel, teacherName, room, schoolPeriodName, sections, entries, gradeOrder, sectionName, institutionName, institutionParish, institutionState } = input;

  // Build formatted section label: "1° "A"" from gradeOrder + sectionName
  let formattedSectionLabel = sectionLabel;
  if (gradeOrder != null && sectionName) {
    // Remove the word "SECCIÓN" or "SECCION" (case-insensitive) and trim
    const letter = sectionName.replace(/secci[oó]n/i, '').trim().toUpperCase();
    formattedSectionLabel = letter ? `${gradeOrder}° "${letter}"` : sectionLabel;
  }

  // Extract just the year range from the period name (e.g. "Año Escolar 2025 - 2026" -> "2025 - 2026")
  const yearRange = schoolPeriodName.replace(/.*?(\d{4}\s*-\s*\d{4}).*/, '$1') || schoolPeriodName;

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Horario', {
    properties: { defaultRowHeight: 15 },
  });

  // 6 columns: A=HORA, B-F = LUNES..VIERNES
  ws.columns = Array(6).fill(0).map(() => ({ width: 15.71 }));

  // ── Header rows (R1-R4): School info ──
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
    const row = ws.getRow(i + 1);
    row.height = 11.1;
    ws.mergeCells(`B${i + 1}:E${i + 1}`);
    const cell = row.getCell(2);
    cell.value = text;
    cell.font = headerFont;
    cell.alignment = centerAlign;
  });

  // ── R5: "HORARIO DE CLASES" ──
  ws.mergeCells('A5:F5');
  const r5 = ws.getRow(5);
  const r5c1 = r5.getCell(1);
  r5c1.value = 'HORARIO DE CLASES';
  r5c1.font = titleFont;
  r5c1.alignment = centerAlign;

  // ── R6: Profesor + Año Escolar ──
  const r6 = ws.getRow(6);
  r6.height = 12.95;
  r6.getCell(1).value = 'Profesor:  ';
  r6.getCell(1).font = { name: 'Cambria', size: 11, bold: true };
  r6.getCell(1).alignment = rightAlign;
  ws.mergeCells('B6:C6');
  r6.getCell(2).value = (teacherName || '').toUpperCase();
  r6.getCell(2).font = { name: 'Cambria', size: 11 };
  r6.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
  r6.getCell(5).value = 'Año Escolar:';
  r6.getCell(5).font = { name: 'Cambria', size: 11, bold: true };
  r6.getCell(5).alignment = rightAlign;
  r6.getCell(6).value = yearRange;
  r6.getCell(6).font = { name: 'Cambria', size: 11 };
  r6.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' };
  // ── R7: Año/Secc + Aula ──
  const r7 = ws.getRow(7);
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

  // ── Build merge info per section (merge across breaks when subject is same) ──
  // For each section, get non-break periods in order. Within each day, find runs of
  // consecutive non-break periods with the same signature and merge them.
  // Empty cells (no subject) are never merged.
  // Also track which non-break periods are followed by a break (for double border in time column).
  const mergeInfoBySection: { sectionId: string; nonBreakPeriods: Period[]; mergeInfo: Record<string, { span: number; start: boolean }>; breakAfter: Set<string> }[] = sections.map(sec => {
    const nonBreakPeriods = sec.periods.filter(p => !p.break);
    // Build set of non-break period IDs that are immediately followed by a break in the original periods list
    const breakAfter = new Set<string>();
    for (let i = 0; i < sec.periods.length; i++) {
      const p = sec.periods[i];
      if (p.break) continue;
      // Check if the next period in the original list is a break
      if (i + 1 < sec.periods.length && sec.periods[i + 1].break) {
        breakAfter.add(p.id);
      }
    }
    const mergeInfo: Record<string, { span: number; start: boolean }> = {};
    DAYS.forEach(day => {
      let i = 0;
      while (i < nonBreakPeriods.length) {
        const p = nonBreakPeriods[i];
        const sig = cellSignature(entries[`${day}|${p.id}`]);
        if (!sig) {
          // Empty cell — no merge
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

  // ── Write grid rows ──
  let currentRow = 8;
  let sectionStartRow = 0; // track first data row of each section for outer border
  for (const secData of mergeInfoBySection) {
    const sec = sections.find(s => s.id === secData.sectionId)!;
    const { nonBreakPeriods, mergeInfo, breakAfter } = secData;

    // Section banner row (MAÑANA / TARDE) — no fill, black text
    ws.mergeCells(`A${currentRow}:F${currentRow}`);
    const bannerCell = ws.getRow(currentRow).getCell(1);
    bannerCell.value = sec.label.toUpperCase().split('').join('   ');
    bannerCell.font = { name: 'Cambria', size: 10, bold: true, color: { argb: 'FF000000' } };
    bannerCell.alignment = centerAlign;
    ws.getRow(currentRow).height = 15.75;
    currentRow++;
    sectionStartRow = currentRow; // first row after banner

    // Day header row: HORA | LUNES | MARTES | ...
    const headerRow = ws.getRow(currentRow);
    headerRow.getCell(1).value = 'HORA';
    headerRow.getCell(1).font = dayHeaderFont;
    headerRow.getCell(1).alignment = centerAlign;
    headerRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    headerRow.getCell(1).border = mediumBorder;
    DAYS.forEach((d, i) => {
      const cell = headerRow.getCell(i + 2);
      cell.value = d.toUpperCase();
      cell.font = dayHeaderFont;
      cell.alignment = centerAlign;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      };
      cell.border = mediumBorder;
    });
    currentRow++;

    // Period rows
    // Track which Excel rows correspond to periods followed by a break (for double border)
    const breakAfterRows: number[] = [];
    for (const period of nonBreakPeriods) {
      const row = ws.getRow(currentRow);

      // Time column
      const timeCell = row.getCell(1);
      timeCell.value = `${period.start} - ${period.end}`;
      timeCell.font = timeFont;
      timeCell.alignment = centerAlign;

      // Track if this period is followed by a break
      if (breakAfter.has(period.id)) {
        breakAfterRows.push(currentRow);
      }

      // Day columns
      DAYS.forEach((day, dayIdx) => {
        const col = dayIdx + 2;
        const key = `${day}|${period.id}`;
        const info = mergeInfo[key];
        const cellSpan = info?.span ?? 1;

        if (!info?.start) {
          // Covered by a merge from above — skip
          return;
        }

        const cell = row.getCell(col);
        const label = cellLabel(entries[key]);
        if (label) {
          cell.value = label;
        }
        cell.font = cellFont;
        cell.alignment = centerAlign;

        // Merge cells vertically if span > 1
        if (cellSpan > 1) {
          const startCol = col;
          const endCol = col;
          const startRow = currentRow;
          const endRow = currentRow + cellSpan - 1;
          ws.mergeCells(startRow, startCol, endRow, endCol);
        }
      });

      // Advance currentRow only for the start of a merge; non-start rows were already
      // written during the same iteration because we iterate nonBreakPeriods directly
      currentRow++;
    }

    // Apply thick outer border to this section's data block (A sectionStartRow : F currentRow-1)
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

    // Apply double border on the time column (col 1) for rows followed by a break
    for (const r of breakAfterRows) {
      const cell = ws.getRow(r).getCell(1);
      cell.border = {
        ...cell.border,
        bottom: { style: 'double', color: { argb: 'FF000000' } },
      } as any;
      // Also set double top border on the next row's time cell
      if (r + 1 <= sectionEndRow) {
        const nextCell = ws.getRow(r + 1).getCell(1);
        nextCell.border = {
          ...nextCell.border,
          top: { style: 'double', color: { argb: 'FF000000' } },
        } as any;
      }
    }
  }

  // ── Generate and download ──
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `horario_${formattedSectionLabel.replace(/[^\w]/g, '_')}_${dayjs().format('YYYY-MM-DD')}.xlsx`;
  saveAs(new Blob([buffer]), fileName);
}
