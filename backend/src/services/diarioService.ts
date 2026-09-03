import ExcelJS from 'exceljs';
import path from 'path';
import {
  Schedule,
  ScheduleEntry,
  PeriodGradeSection,
  PeriodGrade,
  Grade,
  Section,
  Subject,
  Person,
  Setting,
} from '@/models';

// ── Types ──
interface PeriodInfo {
  id: string;
  start: string;
  end: string;
  section: 'manana' | 'tarde';
}

interface ScheduleSectionsInfo {
  manana: PeriodInfo[];
  tarde: PeriodInfo[];
}

interface SectionScheduleData {
  gradeName: string;       // e.g. "1° AÑO"
  sectionName: string;     // e.g. "A"
  entries: Record<string, { subjectName: string; teacherName: string }[]>;
  // key: `${day}|${periodId}` — day is "Lunes", "Martes", etc.
}

// ── Build period list from settings (same logic as frontend buildSections) ──
function buildPeriodsFromSettings(settings: Record<string, string>): ScheduleSectionsInfo {
  const use12h = settings.time_format === '12';
  const manana: PeriodInfo[] = [];
  const tarde: PeriodInfo[] = [];

  const fmt = (h: number, m: number): string => {
    if (use12h) {
      const h12 = h % 12 || 12;
      const ampm = h < 12 ? 'AM' : 'PM';
      return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
    }
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  // Morning
  const mStart = settings.morning_start_time || '07:00';
  let [mh, mm] = mStart.split(':').map(Number);
  const mBlocksBefore = Number(settings.morning_blocks_before_recess) || 3;
  const mMinBefore = Number(settings.morning_block_minutes_before) || 45;
  const mRecess = Number(settings.morning_recess_minutes) || 0;
  const mBlocksAfter = Number(settings.morning_blocks_after_recess) || 0;
  const mMinAfter = Number(settings.morning_block_minutes_after) || 40;

  let mIdx = 1;
  for (let i = 0; i < mBlocksBefore; i++) {
    const start = fmt(mh, mm);
    mm += mMinBefore;
    while (mm >= 60) { mm -= 60; mh++; }
    const end = fmt(mh, mm);
    manana.push({ id: `m${mIdx}`, start, end, section: 'manana' });
    mIdx++;
  }
  if (mRecess > 0) {
    mm += mRecess;
    while (mm >= 60) { mm -= 60; mh++; }
  }
  for (let i = 0; i < mBlocksAfter; i++) {
    const start = fmt(mh, mm);
    mm += mMinAfter;
    while (mm >= 60) { mm -= 60; mh++; }
    const end = fmt(mh, mm);
    manana.push({ id: `m${mIdx}`, start, end, section: 'manana' });
    mIdx++;
  }

  // Afternoon
  const aStart = settings.afternoon_start_time || '13:00';
  let [ah, am] = aStart.split(':').map(Number);
  const aBlocksBefore = Number(settings.afternoon_blocks_before_recess) || 2;
  const aMinBefore = Number(settings.afternoon_block_minutes_before) || 45;
  const aRecess = Number(settings.afternoon_recess_minutes) || 0;
  const aBlocksAfter = Number(settings.afternoon_blocks_after_recess) || 0;
  const aMinAfter = Number(settings.afternoon_block_minutes_after) || 40;

  let aIdx = 1;
  for (let i = 0; i < aBlocksBefore; i++) {
    const start = fmt(ah, am);
    am += aMinBefore;
    while (am >= 60) { am -= 60; ah++; }
    const end = fmt(ah, am);
    tarde.push({ id: `t${aIdx}`, start, end, section: 'tarde' });
    aIdx++;
  }
  if (aRecess > 0) {
    am += aRecess;
    while (am >= 60) { am -= 60; ah++; }
  }
  for (let i = 0; i < aBlocksAfter; i++) {
    const start = fmt(ah, am);
    am += aMinAfter;
    while (am >= 60) { am -= 60; ah++; }
    const end = fmt(ah, am);
    tarde.push({ id: `t${aIdx}`, start, end, section: 'tarde' });
    aIdx++;
  }

  return { manana, tarde };
}

// ── Fetch schedule data for multiple sections ──
async function fetchSectionSchedules(
  schoolPeriodId: number,
  sectionIds: number[]
): Promise<SectionScheduleData[]> {
  const schedules = await Schedule.findAll({
    where: {
      schoolPeriodId,
      periodGradeSectionId: sectionIds,
    },
    include: [
      {
        model: PeriodGradeSection,
        as: 'section',
        include: [
          {
            model: PeriodGrade,
            as: 'periodGrade',
            include: [{ model: Grade, as: 'grade' }],
          },
          { model: Section, as: 'section' },
        ],
      },
      {
        model: ScheduleEntry,
        as: 'entries',
        include: [
          { model: Subject, as: 'subject' },
          { model: Person, as: 'teacher' },
        ],
      },
    ],
  });

  const result = schedules.map((s: any) => {
    const grade = s.section?.periodGrade?.grade;
    const section = s.section?.section;
    const entries: Record<string, { subjectName: string; teacherName: string }[]> = {};
    for (const e of s.entries || []) {
      const key = `${e.day}|${e.periodId}`;
      if (!entries[key]) entries[key] = [];
      entries[key].push({
        subjectName: e.subject?.name ?? '',
        teacherName: e.teacher ? `${e.teacher.lastName || ''} ${e.teacher.firstName || ''}`.trim() : '',
      });
    }
    return {
      gradeName: grade ? formatGradeName(grade.name) : '',
      sectionName: section?.name ?? '',
      entries,
    };
  });

  result.sort((a, b) => {
    const ga = parseInt(a.gradeName) || 99;
    const gb = parseInt(b.gradeName) || 99;
    if (ga !== gb) return ga - gb;
    return a.sectionName.localeCompare(b.sectionName, 'es');
  });

  return result;
}

function formatGradeName(name: string): string {
  const match = name.match(/^(\d+)/);
  if (match) {
    return `${match[1]}° AÑO`;
  }
  return name.toUpperCase();
}

// ── Deep copy a cell's style (font, fill, border, alignment, numFmt) ──
function copyCellStyle(src: ExcelJS.Cell, dst: ExcelJS.Cell): void {
  // Font
  if (src.font) {
    dst.font = {
      name: src.font.name,
      size: src.font.size,
      family: src.font.family,
      bold: src.font.bold,
      italic: src.font.italic,
      underline: src.font.underline,
      strike: src.font.strike,
      outline: src.font.outline,
      vertAlign: src.font.vertAlign,
      color: src.font.color ? { argb: src.font.color.argb, theme: src.font.color.theme } as any : undefined,
    };
  }
  // Fill
  if (src.fill && src.fill.type === 'pattern') {
    dst.fill = {
      type: 'pattern',
      pattern: src.fill.pattern,
      fgColor: src.fill.fgColor ? { argb: src.fill.fgColor.argb, theme: src.fill.fgColor.theme } as any : undefined,
      bgColor: src.fill.bgColor ? { argb: src.fill.bgColor.argb, theme: src.fill.bgColor.theme } as any : undefined,
    };
  }
  // Border
  const copyBorder = (b: any): any => {
    if (!b) return undefined;
    return {
      style: b.style,
      color: b.color ? { argb: b.color.argb, theme: b.color.theme } as any : undefined,
    };
  };
  if (src.border) {
    dst.border = {
      top: copyBorder(src.border.top),
      bottom: copyBorder(src.border.bottom),
      left: copyBorder(src.border.left),
      right: copyBorder(src.border.right),
      diagonal: copyBorder(src.border.diagonal),
    };
  }
  // Alignment
  if (src.alignment) {
    dst.alignment = {
      horizontal: src.alignment.horizontal,
      vertical: src.alignment.vertical,
      wrapText: src.alignment.wrapText,
      textRotation: src.alignment.textRotation,
      indent: src.alignment.indent,
      readingOrder: src.alignment.readingOrder,
      shrinkToFit: src.alignment.shrinkToFit,
    };
  }
  // Number format
  if (src.numFmt && src.numFmt !== 'General') {
    dst.numFmt = src.numFmt;
  }
  // Protection
  if (src.protection) {
    dst.protection = { locked: src.protection.locked };
  }
}

// Convert column number to letter (1 → A, 2 → B, etc.)
function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ── Copy a block of rows from one worksheet to another, preserving all styles ──
// Returns the next available row after the copied block.
function copyBlock(
  srcWs: ExcelJS.Worksheet,
  srcStartRow: number,
  srcEndRow: number,
  dstWs: ExcelJS.Worksheet,
  dstStartRow: number,
  numCols: number,
): number {
  for (let r = srcStartRow; r <= srcEndRow; r++) {
    const dstRowNum = dstStartRow + (r - srcStartRow);
    const srcRow = srcWs.getRow(r);
    const dstRow = dstWs.getRow(dstRowNum);

    // Copy row height — always set it, even if undefined, to match template exactly.
    // ExcelJS stores height in the row model; we read it from there to get the
    // effective height (including defaults set on the worksheet).
    const srcRowModel = (srcRow as any).model || {};
    const effectiveHeight = srcRow.height ?? srcRowModel.height ?? srcWs.properties?.defaultRowHeight;
    if (effectiveHeight !== undefined && effectiveHeight !== null) {
      dstRow.height = effectiveHeight;
    }

    for (let c = 1; c <= numCols; c++) {
      const srcCell = srcWs.getCell(r, c);
      const dstCell = dstWs.getCell(dstRowNum, c);
      // Copy value
      dstCell.value = srcCell.value;
      // Copy all styles
      copyCellStyle(srcCell, dstCell);
    }
  }

  // Copy merged cells within this block
  const srcMerges = (srcWs as any)._merges || {};
  for (const key of Object.keys(srcMerges)) {
    const merge = srcMerges[key];
    const model = merge.model;
    if (!model) continue;
    // Check if this merge is within the source block
    if (model.top >= srcStartRow && model.bottom <= srcEndRow) {
      // Translate to destination
      const newTop = model.top - srcStartRow + dstStartRow;
      const newBottom = model.bottom - srcStartRow + dstStartRow;
      const left = model.left;
      const right = model.right;
      const startCol = colLetter(left);
      const endCol = colLetter(right);
      dstWs.mergeCells(`${startCol}${newTop}:${endCol}${newBottom}`);
    }
  }

  return dstStartRow + (srcEndRow - srcStartRow) + 1;
}

// ── Fill subject names in a block ──
// The block has 3 day sub-blocks. We need to find the time rows and fill column 2 (ASIGNATURA).
// The structure within a block (for Odd sheet):
//   Day 1 (Lunes):    rows offset 0-20 (title, info, mañana header, col headers, 8 time rows, tarde header, col headers, 6 time rows)
//   blank row
//   Day 2 (Martes):   same structure
//   blank row
//   Day 3 (Miércoles): title, info, mañana header, col headers, 8 time rows (no tarde for Odd)
//
// For Even sheet:
//   Day 1 (Miércoles tarde): title, info, tarde header, col headers, 6 time rows
//   blank row
//   Day 2 (Jueves): full day (mañana + tarde)
//   blank row
//   Day 3 (Viernes): full day (mañana + tarde)
//
// Rather than hardcoding offsets, we scan the block for column header rows
// (where col 1 = "HORA") and then fill the time rows that follow until the
// next section header or end of block.

interface DayInfo {
  dayName: string;  // "Lunes", "Martes", etc. (as stored in schedule entries)
  startRow: number; // absolute row in the worksheet
  // time rows: array of { row, periodId }
  timeRows: { row: number; periodId: string }[];
}

function findDayBlocksInWorksheet(
  ws: ExcelJS.Worksheet,
  blockStart: number,
  blockEnd: number,
  periods: ScheduleSectionsInfo,
  sheetType: 'odd' | 'even',
): DayInfo[] {
  const days: DayInfo[] = [];
  // Scan for "DÍA:" in column E, the day name is in column F
  for (let r = blockStart; r <= blockEnd; r++) {
    const eVal = ws.getCell(r, 5).value;
    if (eVal === 'DÍA:') {
      const fVal = String(ws.getCell(r, 6).value || '');
      // Convert "LUNES" → "Lunes"
      const dayName = fVal.charAt(0) + fVal.slice(1).toLowerCase();
      days.push({ dayName, startRow: r, timeRows: [] });
    }
  }

  // For each day, find the column header rows ("HORA" in col 1) and collect time rows
  for (const day of days) {
    // Find the end of this day's block (next "DÍA:" row or end of block)
    const dayIdx = days.indexOf(day);
    const dayEnd = dayIdx < days.length - 1 ? days[dayIdx + 1].startRow - 1 : blockEnd;

    // Determine which periods to use based on the section headers
    // Scan for "HORA" header rows
    let currentPartIdx = 0;
    const allPeriods = [...periods.manana, ...periods.tarde];
    for (let r = day.startRow; r <= dayEnd; r++) {
      const aVal = ws.getCell(r, 1).value;
      if (aVal === 'HORA') {
        // This is a column header row — time rows follow
        // Determine if this is mañana or tarde by looking at the section header above
        let part: 'manana' | 'tarde' = 'manana';
        for (let r2 = r - 1; r2 >= day.startRow; r2--) {
          const v = String(ws.getCell(r2, 1).value || '');
          if (v.includes('T') && v.includes('A') && v.includes('R') && v.includes('D')) {
            part = 'tarde';
            break;
          }
          if (v.includes('M') && v.includes('A') && v.includes('Ñ')) {
            part = 'manana';
            break;
          }
        }
        const partPeriods = part === 'manana' ? periods.manana : periods.tarde;
        // Collect time rows after this header
        let timeIdx = 0;
        for (let r2 = r + 1; r2 <= dayEnd && timeIdx < partPeriods.length; r2++) {
          const v = ws.getCell(r2, 1).value;
          if (v && typeof v === 'string' && v.match(/\d/)) {
            // This is a time row
            day.timeRows.push({ row: r2, periodId: partPeriods[timeIdx].id });
            timeIdx++;
          } else if (v === 'HORA' || (typeof v === 'string' && (v.includes('T') && v.includes('A') && v.includes('R') && v.includes('D')))) {
            // Hit the next section header or column header — stop
            break;
          }
        }
      }
    }
  }

  return days;
}

// ── Main export function ──
// Reads the template file and produces a filled workbook by duplicating
// the template's block for each selected section.
export async function generateDiarios(
  schoolPeriodId: number,
  sectionIds: number[],
  settings: Record<string, string>,
): Promise<ExcelJS.Buffer> {
  const periods = buildPeriodsFromSettings(settings);
  const sectionsData = await fetchSectionSchedules(schoolPeriodId, sectionIds);

  if (sectionsData.length === 0) {
    throw new Error('No se encontraron horarios para las secciones seleccionadas');
  }

  // Read the template file
  const templatePath = path.join(__dirname, '..', '..', 'templates', 'Diarios_template.xlsx');
  const templateWb = new ExcelJS.Workbook();
  await templateWb.xlsx.readFile(templatePath);

  const templateOdd = templateWb.getWorksheet('Odd')!;
  const templateEven = templateWb.getWorksheet('Even')!;

  // Determine the template block boundaries (first block = rows 1 to first "DIARIO" - 1)
  // For Odd: block 0 = rows 1-56 (includes trailing blank row 56)
  // We use rows 1-55 as the template block (the content rows)
  const ODD_BLOCK_START = 1;
  const ODD_BLOCK_END = 55;  // 55 rows of content
  const EVEN_BLOCK_START = 1;
  const EVEN_BLOCK_END = 55;

  // Create output workbook
  const outWb = new ExcelJS.Workbook();

  // Create Odd and Even sheets by copying page setup from template
  const outOdd = outWb.addWorksheet('Odd', {
    properties: {
      defaultRowHeight: templateOdd.properties?.defaultRowHeight ?? 15,
      dyDescent: templateOdd.properties?.dyDescent,
    },
    pageSetup: templateOdd.pageSetup ? {
      paperSize: templateOdd.pageSetup.paperSize,
      orientation: templateOdd.pageSetup.orientation,
      fitToPage: templateOdd.pageSetup.fitToPage,
      fitToWidth: templateOdd.pageSetup.fitToWidth,
      fitToHeight: templateOdd.pageSetup.fitToHeight,
      margins: templateOdd.pageSetup.margins,
      scale: templateOdd.pageSetup.scale,
    } : undefined,
  });

  const outEven = outWb.addWorksheet('Even', {
    properties: {
      defaultRowHeight: templateEven.properties?.defaultRowHeight ?? 15,
      dyDescent: templateEven.properties?.dyDescent,
    },
    pageSetup: templateEven.pageSetup ? {
      paperSize: templateEven.pageSetup.paperSize,
      orientation: templateEven.pageSetup.orientation,
      fitToPage: templateEven.pageSetup.fitToPage,
      fitToWidth: templateEven.pageSetup.fitToWidth,
      fitToHeight: templateEven.pageSetup.fitToHeight,
      margins: templateEven.pageSetup.margins,
      scale: templateEven.pageSetup.scale,
    } : undefined,
  });

  // Copy column widths from template
  for (const [srcWs, dstWs] of [[templateOdd, outOdd], [templateEven, outEven]] as [ExcelJS.Worksheet, ExcelJS.Worksheet][]) {
    for (let c = 1; c <= 6; c++) {
      const srcCol = srcWs.getColumn(c);
      dstWs.getColumn(c).width = srcCol.width;
    }
  }

  // Copy header/footer from template
  if (templateOdd.headerFooter) {
    outOdd.headerFooter = {
      oddHeader: templateOdd.headerFooter.oddHeader,
      oddFooter: templateOdd.headerFooter.oddFooter,
      evenHeader: templateOdd.headerFooter.evenHeader,
      evenFooter: templateOdd.headerFooter.evenFooter,
      firstHeader: templateOdd.headerFooter.firstHeader,
      firstFooter: templateOdd.headerFooter.firstFooter,
    };
  }
  if (templateEven.headerFooter) {
    outEven.headerFooter = {
      oddHeader: templateEven.headerFooter.oddHeader,
      oddFooter: templateEven.headerFooter.oddFooter,
      evenHeader: templateEven.headerFooter.evenHeader,
      evenFooter: templateEven.headerFooter.evenFooter,
      firstHeader: templateEven.headerFooter.firstHeader,
      firstFooter: templateEven.headerFooter.firstFooter,
    };
  }

  // For each section, copy the template block and fill in data
  for (let i = 0; i < sectionsData.length; i++) {
    const sec = sectionsData[i];

    // Copy Odd block
    const oddStart = i === 0 ? 1 : outOdd.rowCount + 2; // +2 for blank separator + page break
    const oddNext = copyBlock(templateOdd, ODD_BLOCK_START, ODD_BLOCK_END, outOdd, oddStart, 6);

    // Fill in grade name, section name, and subjects for Odd sheet
    fillBlockData(outOdd, oddStart, oddNext - 1, sec, periods, 'odd');

    // Copy Even block
    const evenStart = i === 0 ? 1 : outEven.rowCount + 2;
    const evenNext = copyBlock(templateEven, EVEN_BLOCK_START, EVEN_BLOCK_END, outEven, evenStart, 6);

    // Fill in grade name, section name, and subjects for Even sheet
    fillBlockData(outEven, evenStart, evenNext - 1, sec, periods, 'even');

    // Add page break after this section (except the last)
    if (i < sectionsData.length - 1) {
      outOdd.getRow(oddNext).addPageBreak();
      outEven.getRow(evenNext).addPageBreak();
    }
  }

  // Copy images (logos) from template to output
  // ExcelJS doesn't have great image support, but we can try to copy the media
  // Actually, ExcelJS addImage requires a buffer. Let's extract from template.
  // This is complex — for now, images may not be copied. The template's
  // images are logos that the user can add manually or we handle separately.

  return outWb.xlsx.writeBuffer();
}

// ── Fill a copied block with section data ──
function fillBlockData(
  ws: ExcelJS.Worksheet,
  blockStart: number,
  blockEnd: number,
  sec: SectionScheduleData,
  periods: ScheduleSectionsInfo,
  sheetType: 'odd' | 'even',
): void {
  // Update grade name (column B, row blockStart+1)
  ws.getCell(blockStart + 1, 2).value = sec.gradeName;
  // Update section name (column B, row blockStart+2)
  ws.getCell(blockStart + 2, 2).value = `SECCIÓN "${sec.sectionName}"`;

  // Find day blocks within this copied block
  const days = findDayBlocksInWorksheet(ws, blockStart, blockEnd, periods, sheetType);

  // Fill subject names and merge consecutive cells with the same subject
  for (const day of days) {
    // First, fill all subject cells
    const filledSubjects: { row: number; subject: string }[] = [];
    for (const tr of day.timeRows) {
      const entryKey = `${day.dayName}|${tr.periodId}`;
      const cellEntries = sec.entries[entryKey];
      const subjCell = ws.getCell(tr.row, 2);
      if (cellEntries && cellEntries.length > 0) {
        const subjName = cellEntries.map(e => e.subjectName).join(' / ');
        subjCell.value = subjName;
        filledSubjects.push({ row: tr.row, subject: subjName });
      } else {
        // Clear the subject cell (it was copied from template, may have old data)
        subjCell.value = null;
      }
    }

    // Now merge consecutive cells with the same subject name
    // Group consecutive time rows that have the same subject
    let mergeStart = -1;
    let mergeSubject = '';
    for (let idx = 0; idx < day.timeRows.length; idx++) {
      const tr = day.timeRows[idx];
      const entryKey = `${day.dayName}|${tr.periodId}`;
      const cellEntries = sec.entries[entryKey];
      const currentSubject = cellEntries && cellEntries.length > 0
        ? cellEntries.map(e => e.subjectName).join(' / ')
        : '';

      if (currentSubject && currentSubject === mergeSubject) {
        // Same subject as previous — extend the merge range (do nothing yet)
      } else {
        // Subject changed — merge the previous group if it had 2+ rows
        if (mergeStart >= 0 && idx > 0) {
          const prevRow = day.timeRows[idx - 1].row;
          if (prevRow > mergeStart) {
            ws.mergeCells(`B${mergeStart}:B${prevRow}`);
          }
        }
        // Start a new group
        mergeStart = currentSubject ? tr.row : -1;
        mergeSubject = currentSubject;
      }
    }
    // Merge the last group
    if (mergeStart >= 0 && day.timeRows.length > 0) {
      const lastRow = day.timeRows[day.timeRows.length - 1].row;
      if (lastRow > mergeStart) {
        ws.mergeCells(`B${mergeStart}:B${lastRow}`);
      }
    }
  }
}
