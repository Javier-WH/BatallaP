import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, message, Space, Tag, Typography, Row, Col, Tabs, Popconfirm, DatePicker, Tooltip } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
  UserOutlined,
  FileTextOutlined,
  LockOutlined,
  EditOutlined,
  AuditOutlined,
  FilterOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import api from '@/services/api';
import { gradeEditPermissionService } from '@/services/gradeEditPermissionService';
import type { GradeEditPermission, GradeChangeLogEntry } from '@/services/gradeEditPermissionService';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface User {
  id: number;
  username: string;
  person?: {
    firstName: string;
    lastName: string;
  };
}

interface SchoolPeriod {
  id: number;
  name: string;
  period: string;
  status: 'preinscripcion' | 'activo' | 'historico' | 'externo';
  isActive: boolean;
}

const GradeEditPermissions: React.FC = () => {
  const [permissions, setPermissions] = useState<GradeEditPermission[]>([]);
  const [unifiedAuditLog, setUnifiedAuditLog] = useState<GradeChangeLogEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [schoolPeriods, setSchoolPeriods] = useState<SchoolPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [form] = Form.useForm();

  // Unified audit filters
  const [filterEntityType, setFilterEntityType] = useState<string | undefined>(undefined);
  const [filterGradeType, setFilterGradeType] = useState<string | undefined>(undefined);
  const [filterEditedBy, setFilterEditedBy] = useState<number | undefined>(undefined);
  const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  useEffect(() => {
    fetchPermissions();
    fetchUnifiedAuditLog();
    fetchUsers();
    fetchSchoolPeriods();
  }, []);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const data = await gradeEditPermissionService.getPermissions();
      setPermissions(data);
    } catch {
      message.error('Error al cargar permisos');
    } finally {
      setLoading(false);
    }
  };

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

  const fetchSchoolPeriods = async () => {
    try {
      const response = await api.get('/academic/periods');
      // Only closed periods can have their final grades edited under permission
      setSchoolPeriods(response.data.filter((p: SchoolPeriod) => p.status === 'historico'));
    } catch (err) {
      console.error('Error fetching periods:', err);
    }
  };

  const handleCreatePermission = async (values: {
    schoolPeriodId?: number;
    grantedTo: number;
    actCode: string;
    observations: string;
  }) => {
    try {
      await gradeEditPermissionService.createPermission(values);
      message.success('Permiso creado correctamente');
      setShowPermissionModal(false);
      form.resetFields();
      fetchPermissions();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error.response?.data?.message || 'Error al crear permiso');
    }
  };

  const handleRevokePermission = async (id: number) => {
    try {
      await gradeEditPermissionService.revokePermission(id);
      message.success('Permiso revocado correctamente');
      fetchPermissions();
    } catch {
      message.error('Error al revocar permiso');
    }
  };

  const permissionColumns = [
    {
      title: 'Período',
      dataIndex: 'schoolPeriod',
      key: 'period',
      render: (schoolPeriod: GradeEditPermission['schoolPeriod']) => (
        <Text strong>
          {schoolPeriod ? `${schoolPeriod.name} (${schoolPeriod.period})` : 'Todos los períodos'}
        </Text>
      )
    },
    {
      title: 'Otorgado por',
      dataIndex: 'granter',
      key: 'granter',
      render: (granter: GradeEditPermission['granter']) => (
        <Space>
          <UserOutlined />
          <Text>{granter?.person ? `${granter.person.firstName} ${granter.person.lastName}` : 'N/A'}</Text>
        </Space>
      )
    },
    {
      title: 'Otorgado a',
      dataIndex: 'recipient',
      key: 'recipient',
      render: (recipient: GradeEditPermission['recipient']) => (
        <Space>
          <UserOutlined />
          <Text>{recipient?.person ? `${recipient.person.firstName} ${recipient.person.lastName}` : 'N/A'}</Text>
        </Space>
      )
    },
    {
      title: 'Código de Acta',
      dataIndex: 'actCode',
      key: 'actCode',
      render: (actCode: string) => (
        <Tag color="blue" icon={<FileTextOutlined />}>
          {actCode}
        </Tag>
      )
    },
    {
      title: 'Observaciones',
      dataIndex: 'observations',
      key: 'observations',
      ellipsis: true,
      render: (observations: string) => (
        <Text style={{ fontSize: 12 }}>{observations}</Text>
      )
    },
    {
      title: 'Estado',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag
          icon={isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          color={isActive ? 'success' : 'default'}
        >
          {isActive ? 'Activo' : 'Revocado'}
        </Tag>
      )
    },
    {
      title: 'Fecha',
      dataIndex: 'grantedAt',
      key: 'grantedAt',
      render: (date: string) => (
        <Text style={{ fontSize: 12 }}>
          {new Date(date).toLocaleString('es-VE')}
        </Text>
      )
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, record: GradeEditPermission) => (
        <Space>
          {record.isActive && (
            <Popconfirm
              title="¿Revocar este permiso?"
              description="Esta acción impedirá que el usuario modifique notas anteriores"
              onConfirm={() => handleRevokePermission(record.id)}
              okText="Sí"
              cancelText="No"
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                size="small"
              >
                Revocar
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

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
            <Tag color="blue" icon={<FileTextOutlined />} style={{ fontSize: 10, margin: 0 }}>
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
              background: 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <LockOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <div>
              <Title level={3} style={{ margin: 0 }}>Permisos de Edición de Notas</Title>
              <Text type="secondary">Gestión de permisos para modificar notas de períodos anteriores</Text>
            </div>
          </Space>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowPermissionModal(true)}
          >
            Nuevo Permiso
          </Button>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="permissions"
        items={[
          {
            key: 'permissions',
            label: (
              <span>
                <LockOutlined />
                Permisos Activos
              </span>
            ),
            children: (
              <Card>
                <Table
                  columns={permissionColumns}
                  dataSource={permissions}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )
          },
          {
            key: 'unified-audit',
            label: (
              <span>
                <AuditOutlined />
                Auditoría de Notas
                {unifiedAuditLog.length > 0 && (
                  <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>
                    {unifiedAuditLog.length}
                  </Tag>
                )}
              </span>
            ),
            children: (
              <div>
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
            )
          }
        ]}
      />

      <Modal
        title="Otorgar Permiso de Edición"
        open={showPermissionModal}
        onCancel={() => {
          setShowPermissionModal(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreatePermission}
        >
          <Form.Item
            name="grantedTo"
            label="Usuario"
            rules={[{ required: true, message: 'Seleccione un usuario' }]}
          >
            <Select
              placeholder="Seleccione un usuario"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {users.map((user: User) => (
                <Option key={user.id} value={user.id}>
                  {user.person ? `${user.person.firstName} ${user.person.lastName}` : user.username}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="schoolPeriodId"
            label="Período Escolar"
            help="Deje vacío para permiso global (todos los períodos)"
          >
            <Select
              placeholder="Seleccione período (opcional)"
              allowClear
            >
              {schoolPeriods.map((period: SchoolPeriod) => (
                <Option key={period.id} value={period.id}>
                  {period.name} ({period.period})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="actCode"
            label="Código de Acta"
            rules={[{ required: true, message: 'Ingrese el código de acta' }]}
          >
            <Input placeholder="Ej: ACTA-2024-001" />
          </Form.Item>

          <Form.Item
            name="observations"
            label="Observaciones"
            rules={[{ required: true, message: 'Ingrese las observaciones' }]}
          >
            <TextArea
              rows={4}
              placeholder="Describa el motivo del permiso"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setShowPermissionModal(false)}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit">
                Otorgar Permiso
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GradeEditPermissions;
