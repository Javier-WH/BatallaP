import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface LedgerExportRow {
  name: string;
  document: string;
  rosterNumber: number | null;
  paid: Record<string, number>;
  pending: Record<string, number>;
  /** 0..1 */
  progress: number;
}

const safeName = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');

/** Summary of the ledger as displayed: students in screen order, paid and pending totals per currency. */
export async function exportLedgerExcel(opts: {
  sectionLabel: string;
  periodLabel: string;
  cutoffLabel: string;
  rows: LedgerExportRow[];
}): Promise<void> {
  const { sectionLabel, periodLabel, cutoffLabel, rows } = opts;
  const currencies = [...new Set(rows.flatMap(r => [...Object.keys(r.paid), ...Object.keys(r.pending)]))].sort();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Pagos', { views: [{ state: 'frozen', ySplit: 4, xSplit: 3 }] });
  ws.columns = [
    { width: 6 }, { width: 38 }, { width: 14 },
    ...currencies.map(() => ({ width: 14 })),
    ...currencies.map(() => ({ width: 14 })),
    { width: 14 },
  ];

  ws.addRow([`PAGOS Y DEUDAS · ${sectionLabel} · ${periodLabel}`.toUpperCase()]).font = { bold: true, size: 13 };
  ws.addRow([`Deuda calculada hasta ${cutoffLabel} (inclusive) · generado el ${new Date().toLocaleDateString('es-VE')}`]).font = { size: 10, color: { argb: 'FF475467' } };
  ws.addRow([]);
  const header = ws.addRow([
    'N°', 'ESTUDIANTE', 'CÉDULA',
    ...currencies.map(c => `PAGADO ${c}`),
    ...currencies.map(c => `DEBE ${c}`),
    'CUMPLIMIENTO',
  ]);
  header.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5EA8' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  const money = '#,##0.00';
  const first = 4 + 1;
  rows.forEach((r, i) => {
    const row = ws.addRow([
      r.rosterNumber ?? i + 1, r.name, r.document,
      ...currencies.map(c => Number((r.paid[c] ?? 0).toFixed(2))),
      ...currencies.map(c => Number((r.pending[c] ?? 0).toFixed(2))),
      Number(r.progress.toFixed(4)),
    ]);
    row.eachCell((cell, col) => {
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFC5CAD2' } } };
      if (col > 3 && col <= 3 + currencies.length * 2) cell.numFmt = money;
      if (col === 4 + currencies.length * 2) cell.numFmt = '0%';
    });
    currencies.forEach((_, k) => {
      const debt = row.getCell(4 + currencies.length + k);
      if ((Number(debt.value) || 0) > 0.005) debt.font = { color: { argb: 'FFB42318' }, bold: true };
    });
  });

  const last = first + rows.length - 1;
  const colLetter = (n: number) => ws.getColumn(n).letter;
  const totals = ws.addRow([
    '', 'TOTAL', '',
    ...currencies.map((_, k) => rows.length ? { formula: `SUM(${colLetter(4 + k)}${first}:${colLetter(4 + k)}${last})` } : 0),
    ...currencies.map((_, k) => rows.length ? { formula: `SUM(${colLetter(4 + currencies.length + k)}${first}:${colLetter(4 + currencies.length + k)}${last})` } : 0),
    '',
  ]);
  totals.font = { bold: true };
  totals.eachCell((cell, col) => {
    cell.border = { top: { style: 'thin' } };
    if (col > 3 && col <= 3 + currencies.length * 2) cell.numFmt = money;
  });

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Ledger_${safeName(sectionLabel)}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
