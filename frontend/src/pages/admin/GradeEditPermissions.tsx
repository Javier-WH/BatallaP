import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, message, Space, Tag, Typography, Row, Col, Tabs, Popconfirm } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
  UserOutlined,
  FileTextOutlined,
  LockOutlined
} from '@ant-design/icons';
import api from '@/services/api';
import { gradeEditPermissionService } from '@/services/gradeEditPermissionService';
import type { GradeEditPermission, GradeEditAudit } from '@/services/gradeEditPermissionService';

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
  isActive: boolean;
}

const GradeEditPermissions: React.FC = () => {
  const [permissions, setPermissions] = useState<GradeEditPermission[]>([]);
  const [auditLog, setAuditLog] = useState<GradeEditAudit[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [schoolPeriods, setSchoolPeriods] = useState<SchoolPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchPermissions();
    fetchAuditLog();
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

  const fetchAuditLog = async () => {
    try {
      const data = await gradeEditPermissionService.getAuditLog({ limit: 100 });
      setAuditLog(data);
    } catch (err) {
      console.error('Error fetching audit log:', err);
    }
  };

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
      setSchoolPeriods(response.data.filter((p: SchoolPeriod) => !p.isActive));
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

  const auditColumns = [
    {
      title: 'Fecha',
      dataIndex: 'editedAt',
      key: 'editedAt',
      render: (date: string) => (
        <Text style={{ fontSize: 12 }}>
          {new Date(date).toLocaleString('es-VE')}
        </Text>
      )
    },
    {
      title: 'Estudiante',
      key: 'student',
      render: (_: unknown, record: GradeEditAudit) => (
        <Text>
          {record.subjectFinalGrade?.inscriptionSubject?.inscription?.student
            ? `${record.subjectFinalGrade.inscriptionSubject.inscription.student.firstName} ${record.subjectFinalGrade.inscriptionSubject.inscription.student.lastName}`
            : 'N/A'}
        </Text>
      )
    },
    {
      title: 'Materia',
      key: 'subject',
      render: (_: unknown, record: GradeEditAudit) => (
        <Text>
          {record.subjectFinalGrade?.inscriptionSubject?.subject?.name || 'N/A'}
        </Text>
      )
    },
    {
      title: 'Período',
      key: 'period',
      render: (_: unknown, record: GradeEditAudit) => (
        <Text>
          {record.subjectFinalGrade?.inscriptionSubject?.inscription?.period
            ? `${record.subjectFinalGrade.inscriptionSubject.inscription.period.name}`
            : 'N/A'}
        </Text>
      )
    },
    {
      title: 'Acta',
      key: 'actCode',
      render: (_: unknown, record: GradeEditAudit) => (
        <Tag color="blue" icon={<FileTextOutlined />}>
          {record.actCode || record.permission?.actCode || 'N/A'}
        </Tag>
      )
    },
    {
      title: 'Nota',
      key: 'score',
      render: (_: unknown, record: GradeEditAudit) => (
        <Space direction="vertical" size={0}>
          <Text delete style={{ color: '#ff4d4f' }}>{record.previousScore}</Text>
          <Text strong style={{ color: '#52c41a' }}>{record.newScore}</Text>
        </Space>
      )
    },
    {
      title: 'Estado',
      key: 'status',
      render: (_: unknown, record: GradeEditAudit) => (
        <Space direction="vertical" size={0}>
          <Tag color="default">{record.previousStatus}</Tag>
          <Tag color={record.newStatus === 'aprobada' ? 'success' : 'error'}>{record.newStatus}</Tag>
        </Space>
      )
    },
    {
      title: 'Modificado por',
      key: 'editor',
      render: (_: unknown, record: GradeEditAudit) => (
        <Text>
          {record.editor?.person
            ? `${record.editor.person.firstName} ${record.editor.person.lastName}`
            : 'N/A'}
        </Text>
      )
    },
    {
      title: 'Razón',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (reason: string) => (
        <Text style={{ fontSize: 12 }}>{reason}</Text>
      )
    }
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
            key: 'audit',
            label: (
              <span>
                <HistoryOutlined />
                Historial de Modificaciones
              </span>
            ),
            children: (
              <Card>
                <Table
                  columns={auditColumns}
                  dataSource={auditLog}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1200 }}
                />
              </Card>
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
