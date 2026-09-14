import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Card, Select, Table, Tag, Statistic, Row, Col, List, Spin, Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import type { StudentSummary, StudentSummaryRecord, ClearanceReason } from './types';
import { STATUS_LABELS, STATUS_COLORS } from './types';

/**
 * Administration tab: student attendance summary lookup + clearance reasons
 * catalog.
 */
const AdminAttendanceTab: React.FC = () => {
  const { viewPeriod } = useSchool();
  const [options, setOptions] = useState<{ value: number; label: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<number | null>(null);
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [reasons, setReasons] = useState<ClearanceReason[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get('/attendance/clearance-reasons')
      .then(res => setReasons(res.data ?? []))
      .catch(() => setReasons([]));
  }, []);

  const handleSearch = useCallback((q: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q || q.length < 2) { setOptions([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/users', { params: { q, activeOnly: true, page: 1, pageSize: 20 } });
        const rows = res.data?.data ?? res.data ?? [];
        setOptions(rows.map((r: any) => ({
          value: r.id ?? r.personId,
          label: `${r.lastName ?? ''}, ${r.firstName ?? ''}${r.document ? ` — ${r.document}` : ''}`,
        })));
      } catch {
        setOptions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const fetchSummary = useCallback(async (personId: number) => {
    if (!viewPeriod?.id) return;
    setLoadingSummary(true);
    try {
      const res = await api.get(`/attendance/students/${personId}/summary`, {
        params: { schoolPeriodId: viewPeriod.id },
      });
      setSummary(res.data);
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [viewPeriod]);

  const columns: ColumnsType<StudentSummaryRecord> = [
    { title: 'Fecha', dataIndex: 'sessionDate', width: 100 },
    { title: 'Período', dataIndex: 'periodId', width: 80, render: v => (v ?? '').toUpperCase() },
    { title: 'Materia', dataIndex: 'subjectName', render: v => v || '—' },
    { title: 'Profesor', dataIndex: 'teacherName', render: v => v || '—' },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 110,
      render: (v: StudentSummaryRecord['status']) => <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v]}</Tag>,
    },
    { title: 'Motivo', dataIndex: 'reason', render: v => v || '—' },
    {
      title: 'Bloqueo',
      dataIndex: 'blocked',
      width: 180,
      render: (_v, r) => r.blocked
        ? <Tag color="volcano">Bloqueado</Tag>
        : (r.clearedAt ? <Tag color="blue">Desbloqueado</Tag> : null),
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <Card size="small" title="Resumen por estudiante" className="rounded-xl">
          <Select
            showSearch
            placeholder="Buscar estudiante por nombre o cédula"
            style={{ width: '100%', marginBottom: 16 }}
            filterOption={false}
            onSearch={handleSearch}
            notFoundContent={searching ? <Spin size="small" /> : null}
            options={options}
            value={selectedPerson}
            onChange={v => { setSelectedPerson(v); fetchSummary(v); }}
          />

          {loadingSummary ? (
            <div className="flex justify-center py-10"><Spin /></div>
          ) : !summary ? (
            <Empty description="Seleccione un estudiante" />
          ) : (
            <>
              <Row gutter={8} className="mb-4">
                <Col span={4}><Statistic title="Presentes" value={summary.totals?.present ?? 0} valueStyle={{ color: '#22a547' }} /></Col>
                <Col span={4}><Statistic title="Ausentes" value={summary.totals?.absent ?? 0} valueStyle={{ color: '#dc2626' }} /></Col>
                <Col span={4}><Statistic title="Tarde" value={summary.totals?.late ?? 0} valueStyle={{ color: '#f59e0b' }} /></Col>
                <Col span={4}><Statistic title="Justificados" value={summary.totals?.excused ?? 0} /></Col>
                <Col span={4}><Statistic title="Expulsados" value={summary.totals?.kicked ?? 0} valueStyle={{ color: '#ea580c' }} /></Col>
              </Row>
              <Table
                rowKey="id"
                size="small"
                columns={columns}
                dataSource={summary.records}
                pagination={{ pageSize: 10, showSizeChanger: false }}
                rowClassName={() => 'striped-row'}
                locale={{ emptyText: 'Sin registros de asistencia en el período' }}
              />
            </>
          )}
        </Card>
      </div>

      <div>
        <Card size="small" title="Motivos de desbloqueo" className="rounded-xl">
          <List
            size="small"
            dataSource={reasons}
            renderItem={r => (
              <List.Item>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{r.label}</span>
                  <span className="text-[11px] text-slate-400">{r.code}{r.requiresNote ? ' · requiere nota' : ''}</span>
                </div>
              </List.Item>
            )}
            locale={{ emptyText: 'Sin motivos configurados' }}
          />
        </Card>
      </div>
    </div>
  );
};

export default AdminAttendanceTab;
