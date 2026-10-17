import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Table, Tag, Segmented, Button, Spin, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
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
