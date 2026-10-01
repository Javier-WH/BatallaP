import React from 'react';
import type { ReportCell, ReportCellCode } from './types';

export interface DatasheetLeadColumn {
  label: string;
  width: number;
  mono?: boolean;
}

export interface DatasheetColumn {
  key: string;
  label: string;
  sub?: string;
  title?: string;
  onClick?: () => void;
}

export interface DatasheetRow {
  key: string | number;
  lead: string[];
  cells: Record<string, ReportCell | null | undefined>;
  /** Column keys rendered as unavailable (e.g. days outside the range). */
  disabled?: Set<string>;
  onCellClick?: (columnKey: string) => void;
}

interface AttendanceDatasheetProps {
  title: string;
  subtitle?: string;
  leadColumns: DatasheetLeadColumn[];
  columns: DatasheetColumn[];
  rows: DatasheetRow[];
  loading?: boolean;
  emptyText?: string;
}

export const CELL_STYLE: Record<ReportCellCode, { color: string; background: string; fontWeight?: number }> = {
  present: { color: '#166534', background: 'transparent' },
  late: { color: '#92400e', background: '#fef3c7' },
  absent: { color: '#b91c1c', background: '#fee2e2' },
  excused: { color: '#1d4ed8', background: '#dbeafe' },
  kicked: { color: '#ffffff', background: '#334155', fontWeight: 600 },
  jubilado: { color: '#6b21a8', background: '#f3e8ff', fontWeight: 700 },
};

export const LEGEND: { code: ReportCellCode; label: string }[] = [
  { code: 'present', label: 'Presente' },
  { code: 'late', label: 'Tarde' },
  { code: 'absent', label: 'Ausente' },
  { code: 'excused', label: 'Justificado' },
  { code: 'kicked', label: 'Expulsado' },
  { code: 'jubilado', label: 'Jubilado/a (ausente sin justificar tras estar presente)' },
];

const BORDER = '1px solid #cbd5e1';
const th: React.CSSProperties = {
  border: BORDER, background: '#f1f5f9', color: '#334155', fontWeight: 600,
  padding: '3px 6px', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1,
};
const td: React.CSSProperties = {
  border: BORDER, padding: '2px 6px', whiteSpace: 'nowrap', height: 22,
};

/**
 * Dense spreadsheet-style grid for attendance reports: fixed identity columns
 * on the left, one status column per day or class block. Plain table markup —
 * no cards, no floating widgets.
 */
const AttendanceDatasheet: React.FC<AttendanceDatasheetProps> = ({
  title, subtitle, leadColumns, columns, rows, loading, emptyText = 'Sin datos',
}) => (
  <div style={{ fontSize: 12, color: '#0f172a' }}>
    <div style={{ border: BORDER, borderBottom: 0, background: '#e2e8f0', padding: '4px 8px' }}>
      <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{title}</span>
      {subtitle && <span style={{ marginLeft: 10, color: '#475569' }}>{subtitle}</span>}
    </div>
    <div style={{ overflow: 'auto', maxHeight: 'calc(100dvh - 330px)', border: BORDER, borderTop: 0 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 34, textAlign: 'right' }}>N°</th>
            {leadColumns.map(c => (
              <th key={c.label} style={{ ...th, width: c.width, minWidth: c.width }}>{c.label}</th>
            ))}
            {columns.map(c => (
              <th
                key={c.key}
                title={c.title}
                onClick={c.onClick}
                style={{
                  ...th, textAlign: 'center', minWidth: 78,
                  cursor: c.onClick ? 'pointer' : 'default',
                  textDecoration: c.onClick ? 'underline dotted' : undefined,
                }}
              >
                <div>{c.label}</div>
                {c.sub && <div style={{ fontWeight: 400, fontSize: 10, color: '#64748b' }}>{c.sub}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td style={{ ...td, color: '#64748b' }} colSpan={1 + leadColumns.length + columns.length}>Cargando…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td style={{ ...td, color: '#64748b' }} colSpan={1 + leadColumns.length + columns.length}>{emptyText}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={row.key} style={{ background: i % 2 ? '#f8fafc' : '#ffffff' }}>
              <td style={{ ...td, textAlign: 'right', color: '#64748b' }}>{i + 1}</td>
              {row.lead.map((value, li) => (
                <td
                  key={li}
                  style={{
                    ...td, maxWidth: leadColumns[li]?.width, overflow: 'hidden', textOverflow: 'ellipsis',
                    fontFamily: leadColumns[li]?.mono ? 'ui-monospace, monospace' : undefined,
                  }}
                  title={value}
                >
                  {value}
                </td>
              ))}
              {columns.map(c => {
                if (row.disabled?.has(c.key)) {
                  return <td key={c.key} style={{ ...td, background: '#e2e8f0' }} />;
                }
                const cell = row.cells[c.key] ?? null;
                const style = cell ? CELL_STYLE[cell.code] : null;
                return (
                  <td
                    key={c.key}
                    onClick={row.onCellClick ? () => row.onCellClick!(c.key) : undefined}
                    title={cell?.reason ? `${cell.label} — ${cell.reason}` : cell?.label}
                    style={{
                      ...td, textAlign: 'center',
                      color: style?.color ?? '#94a3b8',
                      background: style?.background,
                      fontWeight: style?.fontWeight,
                      cursor: row.onCellClick ? 'pointer' : 'default',
                    }}
                  >
                    {cell?.label ?? '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6, color: '#475569', fontSize: 11 }}>
      {LEGEND.map(l => (
        <span key={l.code} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            display: 'inline-block', width: 10, height: 10, border: BORDER,
            background: CELL_STYLE[l.code].background === 'transparent' ? '#ffffff' : CELL_STYLE[l.code].background,
          }} />
          {l.label}
        </span>
      ))}
      <span>— sin registro</span>
    </div>
  </div>
);

export default AttendanceDatasheet;
