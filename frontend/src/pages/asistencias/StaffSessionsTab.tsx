import React, { useState, useEffect, useCallback } from 'react';
import { Table, DatePicker, Button, Tag, Space, message } from 'antd';
import { ReloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import type { SessionListItem } from './types';
import SessionRosterModal from './SessionRosterModal';
import { exportSessionRosterExcel } from './exportSessionExcel';

/**
 * Staff tab (Control de Estudios / Administración): browse sessions in a date
 * range with counts; open any session to view, export rosters to Excel, or
 * edit in exceptional cases.
 */
const StaffSessionsTab: React.FC = () => {
  const { viewPeriod } = useSchool();
  const [dateFrom, setDateFrom] = useState<Dayjs>(dayjs());
  const [dateTo, setDateTo] = useState<Dayjs>(dayjs());
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<number | null>(null);
  const [selected, setSelected] = useState<SessionListItem | null>(null);
  const [editMode, setEditMode] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!viewPeriod?.id) return;
    setLoading(true);
    try {
      const res = await api.get('/attendance/sessions', {
        params: {
          schoolPeriodId: viewPeriod.id,
          dateFrom: dateFrom.format('YYYY-MM-DD'),
          dateTo: dateTo.format('YYYY-MM-DD'),
        },
      });
      setSessions(res.data ?? []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [viewPeriod, dateFrom, dateTo]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleExportRoster = async (s: SessionListItem) => {
    setExporting(s.id);
    try {
      await exportSessionRosterExcel(s.id);
    } catch {
      message.error('No se pudo exportar la nómina');
    } finally {
      setExporting(null);
    }
  };

  const columns: ColumnsType<SessionListItem> = [
    { title: 'Fecha', dataIndex: 'sessionDate', width: 100, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Bloque', dataIndex: 'periodId', width: 110, render: (v, r) => `${(v ?? '').toUpperCase()}${r.periodStart ? ` ${r.periodStart}` : ''}` },
    { title: 'Materia', dataIndex: 'subjectName', render: v => v || '—' },
    { title: 'Grado', dataIndex: 'gradeName', width: 110 },
    { title: 'Sección', dataIndex: 'sectionName', width: 80 },
    { title: 'Profesor', dataIndex: 'teacherName', render: v => v || '—' },
    {
      title: 'Resumen',
      width: 260,
      render: (_v, s) => (
        <Space size={4} wrap>
          <Tag color="green">{s.counts.present} P</Tag>
          {s.counts.absent > 0 && <Tag color="red">{s.counts.absent} A</Tag>}
          {s.counts.late > 0 && <Tag color="orange">{s.counts.late} T</Tag>}
          {s.counts.kicked > 0 && <Tag color="volcano">{s.counts.kicked} E</Tag>}
          {s.counts.blocked > 0 && <Tag color="volcano">{s.counts.blocked} bloq.</Tag>}
          <Tag>{s.counts.total} reg.</Tag>
        </Space>
      ),
    },
    {
      title: '',
      width: 190,
      render: (_v, s) => (
        <Space size={4}>
          <Button size="small" onClick={() => { setEditMode(false); setSelected(s); }}>Ver</Button>
          <Button
            size="small"
            icon={<FileExcelOutlined />}
            loading={exporting === s.id}
            onClick={() => handleExportRoster(s)}
            title="Exportar nómina a Excel"
          />
          <Button size="small" onClick={() => { setEditMode(true); setSelected(s); }}>Editar</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs font-semibold text-slate-500">Desde</span>
        <DatePicker value={dateFrom} onChange={d => d && setDateFrom(d)} allowClear={false} />
        <span className="text-xs font-semibold text-slate-500">Hasta</span>
        <DatePicker value={dateTo} onChange={d => d && setDateTo(d)} allowClear={false} />
        <Button type="primary" icon={<ReloadOutlined />} onClick={fetchSessions}>Consultar</Button>
      </div>

      <Table
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={sessions}
        rowClassName={() => 'striped-row'}
        pagination={{ pageSize: 15, showSizeChanger: false }}
        locale={{ emptyText: 'Sin sesiones en el rango seleccionado' }}
      />

      <SessionRosterModal
        open={selected !== null}
        sessionId={selected?.id ?? null}
        sessionTitle={selected ? `Asistencia — ${selected.subjectName || 'Sin materia'}` : ''}
        canEdit={editMode}
        onClose={() => setSelected(null)}
        onSaved={fetchSessions}
      />
    </div>
  );
};

export default StaffSessionsTab;
