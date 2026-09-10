import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Select, message, Space, Tag, Typography, Row, Col, DatePicker, Tooltip } from 'antd';
import {
  AuditOutlined,
  FilterOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import api from '@/services/api';
import { gradeEditPermissionService } from '@/services/gradeEditPermissionService';
import type { GradeChangeLogEntry } from '@/services/gradeEditPermissionService';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

interface User {
  id: number;
  username: string;
  person?: {
    firstName: string;
    lastName: string;
  };
}

const GradeAuditLog: React.FC = () => {
  const [unifiedAuditLog, setUnifiedAuditLog] = useState<GradeChangeLogEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Unified audit filters
  const [filterEntityType, setFilterEntityType] = useState<string | undefined>(undefined);
  const [filterGradeType, setFilterGradeType] = useState<string | undefined>(undefined);
  const [filterEditedBy, setFilterEditedBy] = useState<number | undefined>(undefined);
  const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  useEffect(() => {
    fetchUnifiedAuditLog();
    fetchUsers();
  }, []);

  const fetchUnifiedAuditLog = useCallback(async () => {
    try {
      setAuditLoading(true);
      const params: Record<string, any> = { limit: 200 };
      if (filterEntityType) params.entityType = filterEntityType;
      if (filterGradeType) params.gradeType = filterGradeType;
      if (filterEditedBy) params.editedBy = filterEditedBy;
      if (filterDateRange && filterDateRange[0]) params.dateFrom = filterDateRange[0].format('YYYY-MM-DD');
      if (filterDateRange && filterDateRange[1]) params.dateTo = filterDateRange[1].format('YYYY-MM-DD');
      const data = await gradeEditPermissionService.getUnifiedAuditLog(params);
      setUnifiedAuditLog(data);
    } catch {
      message.error('Error al cargar historial de auditoría');
    } finally {
      setAuditLoading(false);
    }
  }, [filterEntityType, filterGradeType, filterEditedBy, filterDateRange]);

  useEffect(() => {
    fetchUnifiedAuditLog();
  }, [fetchUnifiedAuditLog]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const entityTypeLabels: Record<string, { label: string; color: string }> = {
    qualification: { label: 'Evaluación', color: 'blue' },
    subject_final_grade: { label: 'Nota Final', color: 'purple' },
    historical_grade: { label: 'Histórica', color: 'orange' },
    inscription_subject_revision: { label: 'Revisión', color: 'magenta' },
    pending_subject_encounter: { label: 'Materia Pendiente', color: 'gold' },
  };

  const gradeTypeLabels: Record<string, string> = {
    regular: 'Regular',
    revision: 'Revisión',
    materia_pendiente: 'Materia Pendiente',
    transferencia: 'Transferencia',
    equivalencia: 'Equivalencia',
    revision_materia_pendiente: 'Revisión MP',
  };

  const roleLabels: Record<string, string> = {
    teacher: 'Profesor',
    control_estudios: 'Control de Estudios',
    admin: 'Administrador',
    master: 'Master',
  };

  const scoreColor = (score: number | null): string => {
    if (score === null) return '#999';
    return score >= 10 ? '#52c41a' : '#ff4d4f';
  };

  const unifiedAuditColumns: ColumnsType<GradeChangeLogEntry> = [
    {
      title: 'Fecha',
      dataIndex: 'editedAt',
      key: 'editedAt',
      width: 150,
      sorter: (a, b) => new Date(a.editedAt).getTime() - new Date(b.editedAt).getTime(),
      render: (date: string) => (
        <Text style={{ fontSize: 12 }}>
          {new Date(date).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
        </Text>
      )
    },
    {
      title: 'Tipo',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 130,
      filters: Object.entries(entityTypeLabels).map(([value, { label }]) => ({ text: label, value })),
      onFilter: (value, record) => record.entityType === value,
      render: (type: string) => {
        const info = entityTypeLabels[type] || { label: type, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      }
    },
    {
      title: 'Estudiante',
      key: 'student',
      width: 180,
      render: (_: unknown, record: GradeChangeLogEntry) => {
        const personId = record.metadata?.personId;
        if (!personId) return <Text type="secondary">—</Text>;
        return <Text style={{ fontSize: 12 }}>ID: {personId}</Text>;
      }
    },
    {
      title: 'Materia',
      key: 'subject',
      width: 140,
      render: (_: unknown, record: GradeChangeLogEntry) => {
        const subjectName = record.metadata?.subjectName;
        const subjectId = record.metadata?.subjectId;
        if (subjectName) return <Text style={{ fontSize: 12 }}>{subjectName}</Text>;
        if (subjectId) return <Text style={{ fontSize: 12 }} type="secondary">ID: {subjectId}</Text>;
        return <Text type="secondary">—</Text>;
      }
    },
    {
      title: 'Nota Ant.',
      dataIndex: 'previousScore',
      key: 'previousScore',
      width: 90,
      align: 'center',
      render: (score: number | null) => (
        <Text delete style={{ color: scoreColor(score), fontSize: 13, fontWeight: 600 }}>
          {score !== null ? score : '—'}
        </Text>
      )
    },
    {
      title: 'Nota Nueva',
      dataIndex: 'newScore',
      key: 'newScore',
      width: 90,
      align: 'center',
      render: (score: number | null) => (
        <Text strong style={{ color: scoreColor(score), fontSize: 14 }}>
          {score !== null ? score : '—'}
        </Text>
      )
    },
    {
      title: 'Estado',
      key: 'status',
      width: 120,
      render: (_: unknown, record: GradeChangeLogEntry) => (
        <Space direction="vertical" size={0}>
          {record.previousStatus && (
            <Tag style={{ fontSize: 10, margin: 0 }}>
              {record.previousStatus}
            </Tag>
          )}
          {record.newStatus && (
            <Tag
              color={record.newStatus === 'aprobada' || record.newStatus === 'approved' ? 'success' : 'error'}
              style={{ fontSize: 10, margin: 0 }}
            >
              {record.newStatus}
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: 'Modalidad',
      dataIndex: 'gradeType',
      key: 'gradeType',
      width: 120,
      render: (type: string | null) => (
        type ? <Tag color="cyan" style={{ fontSize: 10 }}>{gradeTypeLabels[type] || type}</Tag> : <Text type="secondary">—</Text>
      )
    },
    {
      title: 'Editado por',
      key: 'editor',
      width: 150,
      render: (_: unknown, record: GradeChangeLogEntry) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>
            {record.editor?.person
              ? `${record.editor.person.firstName} ${record.editor.person.lastName}`
              : record.editor?.username || 'N/A'}
          </Text>
          {record.editorRole && (
            <Tag style={{ fontSize: 10, margin: 0 }} color="geekblue">
              {roleLabels[record.editorRole] || record.editorRole}
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: 'Razón / Acta',
      key: 'reason',
      width: 160,
      ellipsis: true,
      render: (_: unknown, record: GradeChangeLogEntry) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          {record.reason && (
            <Tooltip title={record.reason}>
              <Text style={{ fontSize: 11 }} ellipsis>{record.reason}</Text>
            </Tooltip>
          )}
          {record.actCode && (
            <Tag color="blue" icon={<AuditOutlined />} style={{ fontSize: 10, margin: 0 }}>
              {record.actCode}
            </Tag>
          )}
          {!record.reason && !record.actCode && <Text type="secondary">—</Text>}
        </Space>
      )
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Space>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AuditOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <div>
              <Title level={3} style={{ margin: 0 }}>Auditoría de Notas</Title>
              <Text type="secondary">Historial completo de ediciones de notas</Text>
            </div>
          </Space>
        </Col>
      </Row>

      {/* Filters toolbar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="auto">
            <Space wrap>
              <FilterOutlined style={{ color: '#999' }} />
              <Select
                placeholder="Tipo de nota"
                allowClear
                style={{ width: 180 }}
                value={filterEntityType}
                onChange={setFilterEntityType}
                options={Object.entries(entityTypeLabels).map(([value, { label }]) => ({ value, label }))}
              />
              <Select
                placeholder="Modalidad"
                allowClear
                style={{ width: 160 }}
                value={filterGradeType}
                onChange={setFilterGradeType}
                options={Object.entries(gradeTypeLabels).map(([value, label]) => ({ value, label }))}
              />
              <Select
                placeholder="Usuario editor"
                allowClear
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: 200 }}
                value={filterEditedBy}
                onChange={setFilterEditedBy}
              >
                {users.map((user: User) => (
                  <Option key={user.id} value={user.id}>
                    {user.person ? `${user.person.firstName} ${user.person.lastName}` : user.username}
                  </Option>
                ))}
              </Select>
              <DatePicker.RangePicker
                value={filterDateRange as any}
                onChange={(range) => setFilterDateRange(range as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
                placeholder={['Desde', 'Hasta']}
                format="DD/MM/YYYY"
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setFilterEntityType(undefined);
                  setFilterGradeType(undefined);
                  setFilterEditedBy(undefined);
                  setFilterDateRange(null);
                }}
              >
                Limpiar
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={unifiedAuditColumns}
          dataSource={unifiedAuditLog}
          rowKey="id"
          loading={auditLoading}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (total) => `${total} registros`,
          }}
          scroll={{ x: 1300 }}
          size="middle"
          locale={{
            emptyText: 'No hay registros de edición de notas',
          }}
          expandable={{
            expandedRowRender: (record: GradeChangeLogEntry) => {
              if (!record.metadata) return <Text type="secondary">Sin metadatos</Text>;
              const entries = Object.entries(record.metadata);
              return (
                <Space wrap size={[8, 4]}>
                  {entries.map(([key, value]) => (
                    <Tag key={key} style={{ fontSize: 11 }}>
                      <Text type="secondary" style={{ fontSize: 10 }}>{key}:</Text>{' '}
                      <Text strong style={{ fontSize: 11 }}>{String(value)}</Text>
                    </Tag>
                  ))}
                </Space>
              );
            },
            rowExpandable: (record: GradeChangeLogEntry) => !!record.metadata && Object.keys(record.metadata).length > 0,
          }}
        />
      </Card>
    </div>
  );
};

export default GradeAuditLog;
