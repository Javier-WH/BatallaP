import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Table, Tag, Segmented, Button, Spin, message } from 'antd';
import { UserOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';
import type { AbsenceCategory, AbsenceDetailReport, AbsenceDetailRow } from './types';
import { pct } from './summaryUtils';

export type DetailFilter = 'unjustified' | 'justified' | 'late' | 'kicked' | 'all';

const CATEGORY_META: Record<AbsenceCategory, { label: string; color: string }> = {
  absent: { label: 'Inasistencia', color: 'red' },
  jubilado: { label: 'Jubilado/a', color: 'magenta' },
  justified: { label: 'Justificada', color: 'blue' },
  late: { label: 'Retardo', color: 'orange' },
  kicked: { label: 'Retirado de clase', color: 'volcano' },
};

const FILTER_MATCH: Record<DetailFilter, (c: AbsenceCategory) => boolean> = {
  unjustified: c => c === 'absent' || c === 'jubilado',
  justified: c => c === 'justified',
  late: c => c === 'late',
  kicked: c => c === 'kicked',
  all: () => true,
};

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const FILTER_LABEL: Record<DetailFilter, string> = {
  unjustified: 'Inasistencias injustificadas',
  justified: 'Inasistencias justificadas',
  late: 'Retardos',
  kicked: 'Retirado de clase',
  all: 'Todos los registros',
};

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Opens a clean, printable (landscape) data sheet of the listed rows in a new window. */
function printDetail(data: AbsenceDetailReport, rows: AbsenceDetailRow[], filter: DetailFilter) {
  const { student: s, counts: c } = data;
  const range = `${data.termName ?? 'Todo el año'}${data.dateFrom && data.dateTo ? ` (${dayjs(data.dateFrom).format('DD/MM/YYYY')} – ${dayjs(data.dateTo).format('DD/MM/YYYY')})` : ''}`;
  const body = rows.map((r, i) => `<tr>
    <td class="n">${i + 1}</td>
    <td>${esc(`${WEEKDAYS[dayjs(r.date).day()]} ${dayjs(r.date).format('DD/MM/YYYY')}`)}</td>
    <td>${esc(r.start && r.end ? `${r.start} – ${r.end}` : r.periodId)}</td>
    <td>${esc(r.subjectName ?? '—')}</td>
    <td>${esc(r.teacherName ?? '—')}</td>
    <td>${esc(CATEGORY_META[r.category].label)}</td>
    <td>${esc(r.reason || '—')}</td>
  </tr>`).join('');
  const stat = (label: string, value: number, sub: string) =>
    `<td><b>${value}</b> <small>${esc(sub)}</small><br><small>${esc(label)}</small></td>`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Detalle de asistencia — ${esc(s.lastName)}, ${esc(s.firstName)}</title>
    <style>
      @page { size: landscape; margin: 12mm; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
      h1 { font-size: 16px; margin: 0 0 2px; } .meta { color: #444; margin-bottom: 8px; line-height: 1.5; }
      table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #999; padding: 3px 5px; vertical-align: top; text-align: left; }
      th { background: #eee; } td.n { width: 28px; text-align: right; color: #555; } small { color: #555; }
      tr { page-break-inside: avoid; } thead { display: table-header-group; }
      table.stats { width: auto; margin-bottom: 10px; } table.stats td { text-align: center; padding: 4px 12px; }
      h2 { font-size: 13px; margin: 10px 0 4px; }
    </style></head><body>
    <h1>${esc(s.lastName)}, ${esc(s.firstName)}</h1>
    <div class="meta">
      C.I. ${esc(s.document)} · ${esc(s.gradeName)} ${esc(s.sectionName)}${s.withdrawn ? ' · Retirado' : ''}<br>
      ${esc(range)}
    </div>
    <table class="stats"><tr>
      ${stat('Inasistencias (horas)', c.absentBlocks, pct(c.absentBlocks, c.totalBlocks))}
      ${stat('Días con inasistencia', c.absentDays, pct(c.absentDays, c.totalDays))}
      ${stat('Justificadas (horas)', c.justifiedBlocks, pct(c.justifiedBlocks, c.totalBlocks))}
      ${stat('Retardos (horas)', c.lateBlocks, pct(c.lateBlocks, c.totalBlocks))}
      ${stat('Retirado de clase (horas)', c.kickedBlocks, pct(c.kickedBlocks, c.totalBlocks))}
      ${stat('Asistencia (horas)', c.attendedBlocks, pct(c.attendedBlocks, c.totalBlocks))}
    </tr></table>
    <h2>${esc(FILTER_LABEL[filter])} — ${rows.length} registro(s)</h2>
    <table><thead><tr><th>#</th><th>Fecha</th><th>Hora</th><th>Materia</th><th>Profesor</th><th>Tipo</th><th>Motivo</th></tr></thead>
    <tbody>${body || '<tr><td colspan="7">Sin registros en esta categoría</td></tr>'}</tbody></table>
    <div class="meta" style="margin-top:8px"><small>Impreso el ${esc(dayjs().format('DD/MM/YYYY HH:mm'))}</small></div>
  </body></html>`;
  const w = window.open('', '_blank', 'width=1100,height=800');
  if (!w) { message.error('El navegador bloqueó la ventana de impresión'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* window already closed */ } }, 300);
}

interface Props {
  open: boolean;
  inscriptionId: number | null;
  termId: number | null;
  initialFilter?: DetailFilter;
  onClose: () => void;
  /** Opens the "Por Estudiante" tab for this student over the same range. */
  onOpenStudent: (detail: AbsenceDetailReport) => void;
}

/**
 * Exactly when a student missed: every non-present block with date, hour,
 * subject and teacher, plus the student's totals and percentages.
 */
const AbsenceDetailModal: React.FC<Props> = ({ open, inscriptionId, termId, initialFilter = 'unjustified', onClose, onOpenStudent }) => {
  const [data, setData] = useState<AbsenceDetailReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<DetailFilter>(initialFilter);

  useEffect(() => { if (open) setFilter(initialFilter); }, [open, initialFilter]);

  useEffect(() => {
    if (!open || !inscriptionId) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    api.get('/attendance/reports/absence-detail', { params: { inscriptionId, termId: termId ?? undefined } })
      .then(res => { if (!cancelled) setData(res.data); })
      .catch(err => { if (!cancelled) message.error(err?.response?.data?.message || 'Error al cargar el detalle'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, inscriptionId, termId]);

  const rows = useMemo(() => (data?.rows ?? []).filter(r => FILTER_MATCH[filter](r.category)), [data, filter]);
  const c = data?.counts;
  const s = data?.student;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={860}
      destroyOnClose
      title={s ? `${s.lastName}, ${s.firstName}` : 'Detalle de asistencia'}
      footer={[
        <Button key="print" icon={<PrinterOutlined />} disabled={!data} onClick={() => data && printDetail(data, rows, filter)}>
          Imprimir
        </Button>,
        <Button key="student" icon={<UserOutlined />} disabled={!data} onClick={() => data && onOpenStudent(data)}>
          Ver en "Por Estudiante"
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>Cerrar</Button>,
      ]}
    >
      {loading && <div className="py-10 text-center"><Spin /></div>}
      {data && s && c && (
        <div className="space-y-3">
          <div className="text-xs text-slate-500">
            C.I. {s.document} · {s.gradeName} {s.sectionName}
            {s.withdrawn && <Tag color="orange" className="ml-2">Retirado</Tag>}
            <span className="ml-2">
              {data.termName ?? 'Todo el año'}
              {data.dateFrom && data.dateTo && ` (${dayjs(data.dateFrom).format('DD/MM/YYYY')} – ${dayjs(data.dateTo).format('DD/MM/YYYY')})`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <Stat label="Inasistencias (horas)" value={c.absentBlocks} sub={pct(c.absentBlocks, c.totalBlocks)} tone="red" />
            <Stat label="Días con inasistencia" value={c.absentDays} sub={pct(c.absentDays, c.totalDays)} tone="red" />
            <Stat label="Justificadas (horas)" value={c.justifiedBlocks} sub={pct(c.justifiedBlocks, c.totalBlocks)} tone="blue" />
            <Stat label="Asistencia (horas)" value={c.attendedBlocks} sub={pct(c.attendedBlocks, c.totalBlocks)} tone="green" />
          </div>

          <Segmented<DetailFilter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'unjustified', label: `Injustificadas (${c.absentBlocks})` },
              { value: 'justified', label: `Justificadas (${c.justifiedBlocks})` },
              { value: 'late', label: `Retardos (${c.lateBlocks})` },
              { value: 'kicked', label: `Retirado de clase (${c.kickedBlocks})` },
              { value: 'all', label: 'Todas' },
            ]}
          />

          <Table<AbsenceDetailRow>
            size="small"
            rowKey="recordId"
            dataSource={rows}
            pagination={rows.length > 12 ? { pageSize: 12, size: 'small' } : false}
            locale={{ emptyText: 'Sin registros en esta categoría' }}
            columns={[
              {
                title: 'Fecha',
                dataIndex: 'date',
                width: 130,
                render: (d: string) => `${WEEKDAYS[dayjs(d).day()]} ${dayjs(d).format('DD/MM/YYYY')}`,
              },
              {
                title: 'Hora',
                width: 120,
                render: (_: unknown, r) => (r.start && r.end ? `${r.start} – ${r.end}` : r.periodId),
              },
              { title: 'Materia', dataIndex: 'subjectName', render: (v: string | null) => v ?? '—' },
              { title: 'Profesor', dataIndex: 'teacherName', render: (v: string | null) => v ?? '—' },
              {
                title: 'Tipo',
                dataIndex: 'category',
                width: 140,
                render: (cat: AbsenceCategory) => <Tag color={CATEGORY_META[cat].color}>{CATEGORY_META[cat].label}</Tag>,
              },
              { title: 'Motivo', dataIndex: 'reason', render: (v: string | null) => v || '—' },
            ]}
          />
        </div>
      )}
    </Modal>
  );
};

const TONES = { red: 'text-red-600', blue: 'text-blue-600', green: 'text-green-600' };

const Stat: React.FC<{ label: string; value: number; sub: string; tone: keyof typeof TONES }> = ({ label, value, sub, tone }) => (
  <div className="rounded-lg bg-slate-50 px-2 py-2">
    <div className={`text-xl font-bold ${TONES[tone]}`}>{value}</div>
    <div className="text-[11px] font-semibold text-slate-600">{sub}</div>
    <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
  </div>
);

export default AbsenceDetailModal;
