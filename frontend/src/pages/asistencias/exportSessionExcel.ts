import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';
import api from '@/services/api';
import { STATUS_LABELS, type RosterEntry } from './types';
import { CELL_STYLE, LEGEND, type DatasheetColumn, type DatasheetLeadColumn, type DatasheetRow } from './AttendanceDatasheet';

const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;

/** Filesystem-safe file name fragment. */
const safeName = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * Export an attendance datasheet (Por Sección / Por Estudiante, week or day
 * view) exactly as shown: identification header, N° + lead columns, one column
 * per day / class block, status colors and a legend.
 */
export async function exportDatasheetExcel(opts: {
  title: string;
  subtitle?: string;
  leadColumns: DatasheetLeadColumn[];
  columns: DatasheetColumn[];
  rows: DatasheetRow[];
  fileName: string;
}): Promise<void> {
  const { title, subtitle, leadColumns, columns, rows, fileName } = opts;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Asistencia', { views: [{ state: 'frozen', ySplit: 4, xSplit: 1 + leadColumns.length }] });

  ws.columns = [
    { width: 5 },
    ...leadColumns.map(c => ({ width: Math.max(10, Math.round(c.width / 7)) })),
    ...columns.map(() => ({ width: 13 })),
  ];

  ws.addRow([title.toUpperCase()]).font = { bold: true, size: 13 };
  ws.addRow([subtitle ?? '']).font = { size: 10, color: { argb: 'FF475467' } };
  ws.addRow([]);

  const header = ws.addRow([
    'N°',
    ...leadColumns.map(c => c.label.toUpperCase()),
    ...columns.map(c => (c.sub ? `${c.label}\n${c.sub}` : c.label)),
  ]);
  styleHeaderRow(header);
  header.height = columns.some(c => c.sub) ? 30 : 18;
  header.eachCell((cell, col) => {
    if (col > 1 + leadColumns.length) cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  rows.forEach((r, i) => {
    const row = ws.addRow([
      i + 1,
      ...r.lead,
      ...columns.map(c => (r.disabled?.has(c.key) ? '' : r.cells[c.key]?.label ?? '—')),
    ]);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = BORDER;
      const ci = colNumber - 2 - leadColumns.length;
      if (ci < 0) return;
      cell.alignment = { horizontal: 'center' };
      const c = columns[ci];
      if (!c) return;
      if (r.disabled?.has(c.key)) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        return;
      }
      const rc = r.cells[c.key];
      if (!rc) { cell.font = { color: { argb: 'FF94A3B8' } }; return; }
      const style = CELL_STYLE[rc.code];
      cell.font = { color: { argb: argb(style.color) }, bold: (style.fontWeight ?? 400) >= 600 };
      if (style.background !== 'transparent') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(style.background) } };
      }
      if (rc.reason) cell.note = rc.reason;
    });
  });

  ws.addRow([]);
  const legend = ws.addRow(['Leyenda:', ...LEGEND.map(l => l.label), 'Sin registro (—)']);
  legend.font = { size: 9, color: { argb: 'FF475467' } };
  LEGEND.forEach((l, i) => {
    const bg = CELL_STYLE[l.code].background;
    if (bg !== 'transparent') {
      legend.getCell(i + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(bg) } };
    }
  });

  saveAs(new Blob([await wb.xlsx.writeBuffer()]), `${safeName(fileName)}.xlsx`);
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F5F1' } };
const THIN: ExcelJS.Border = { style: 'thin', color: { argb: 'FFD0D5DD' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

/** "APELLIDOS, NOMBRES" → [apellidos, nombres] */
const splitName = (full: string): [string, string] => {
  const i = full.indexOf(',');
  return i >= 0 ? [full.slice(0, i).trim(), full.slice(i + 1).trim()] : [full.trim(), ''];
};

const timeLabel = (s: { periodStart?: string | null; periodEnd?: string | null }) =>
  s.periodStart ? `${s.periodStart}${s.periodEnd ? ` – ${s.periodEnd}` : ''}` : '';

const styleHeaderRow = (row: ExcelJS.Row) => {
  row.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, size: 10, color: { argb: 'FF475467' } };
    cell.border = BORDER;
    cell.alignment = { vertical: 'middle' };
  });
};

/**
 * Export one session's roster as a payroll-style sheet:
 * header block (subject / section / date / time) + N° Cédula Apellidos
 * Nombres Grado/Sección Estado Motivo.
 */
export async function exportSessionRosterExcel(sessionId: number): Promise<void> {
  const res = await api.get(`/attendance/sessions/${sessionId}`);
  const session = res.data?.session ?? {};
  const roster: RosterEntry[] = res.data?.roster ?? [];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Asistencia');

  ws.columns = [
    { width: 6 },   // N°
    { width: 14 },  // Cédula
    { width: 26 },  // Apellidos
    { width: 26 },  // Nombres
    { width: 18 },  // Grado/Sección
    { width: 14 },  // Estado
    { width: 30 },  // Motivo
  ];

  const subject = (session.subjectName ?? 'Sin materia').toString().toUpperCase();
  const meta = [
    session.sectionLabel ?? '',
    dayjs(session.sessionDate).format('dddd DD/MM/YYYY'),
    timeLabel(session),
  ].filter(Boolean).join('  ·  ');

  ws.addRow([`Asistencia · ${subject}`]).font = { bold: true, size: 14 };
  ws.addRow([meta]).font = { size: 10, color: { argb: 'FF475467' } };
  ws.addRow([]);

  const header = ws.addRow(['N°', 'CÉDULA', 'APELLIDOS', 'NOMBRES', 'GRADO/SECCIÓN', 'ESTADO', 'MOTIVO']);
  styleHeaderRow(header);

  roster.forEach((r, i) => {
    const [last, first] = splitName(r.fullName ?? '');
    const row = ws.addRow([
      i + 1,
      r.document ?? '',
      last,
      first,
      r.sectionLabel ?? '',
      r.status ? STATUS_LABELS[r.status] : '',
      r.reason ?? '',
    ]);
    row.eachCell(cell => { cell.border = BORDER; });
    if ((r.status === 'absent' || r.status === 'kicked') && !r.reason) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
      });
    }
  });

  const date = dayjs(session.sessionDate).format('YYYY-MM-DD');
  saveAs(new Blob([await wb.xlsx.writeBuffer()]), `asistencia_${subject}_${date}.xlsx`);
}
