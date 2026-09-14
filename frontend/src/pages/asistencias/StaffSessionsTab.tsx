import React, { useState, useEffect, useCallback } from 'react';
import { Table, DatePicker, Button, Tag, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import type { SessionListItem } from './types';
import SessionRosterModal from './SessionRosterModal';

/**
 * Staff tab (Control de Estudios / Administración): browse sessions in a date
 * range with counts; open any session to view or edit.
 */
const StaffSessionsTab: React.FC = () => {
  const { viewPeriod } = useSchool();
  const [dateFrom, setDateFrom] = useState<Dayjs>(dayjs());
  const [dateTo, setDateTo] = useState<Dayjs>(dayjs());
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SessionListItem | null>(null);

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

  const columns: ColumnsType<SessionListItem> = [
    { title: 'Fecha', dataIndex: 'sessionDate', width: 100, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Período', dataIndex: 'periodId', width: 80, render: v => (v ?? '').toUpperCase() },
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
      width: 80,
      render: (_v, s) => <Button size="small" onClick={() => setSelected(s)}>Ver</Button>,
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
        sessionTitle={
          selected
            ? `Asistencia — ${selected.subjectName || 'Sin materia'} (${selected.gradeName} "${selected.sectionName}") — ${dayjs(selected.sessionDate).format('DD/MM/YYYY')}`
            : ''
        }
        canEdit
        onClose={() => setSelected(null)}
        onSaved={fetchSessions}
      />
    </div>
  );
};

export default StaffSessionsTab;
