import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';
import api from '@/services/api';
import { STATUS_LABELS, type RosterEntry } from './types';

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
