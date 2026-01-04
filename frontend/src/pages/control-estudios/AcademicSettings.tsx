import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, InputNumber, Button, Typography, Space, message, Spin, DatePicker, Switch, Table, Modal, Popconfirm, Tooltip, Alert, Tag, Row, Col, Empty } from 'antd';
import {
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  UnlockOutlined,
  DashboardOutlined,
  CalendarOutlined,
  SettingOutlined,
  ControlOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';

const { Text, Title } = Typography;

interface Term {
  id: number;
  name: string;
  isBlocked: boolean;
  openDate?: string;
  closeDate?: string;
  schoolPeriodId: number;
  order: number;
  schoolPeriod?: {
    id: number;
    name: string;
  };
}

interface SettingsFormValues {
  max_grade?: number;
  passing_grade?: number;
  grade_lock_mode?: boolean;
  council_points_limit?: number;
}

interface TermFormValues {
  name: string;
  isBlocked: boolean;
  openDate?: dayjs.Dayjs;
  closeDate?: dayjs.Dayjs;
}

const AcademicSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [termForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [terms, setTerms] = useState<Term[]>([]);
  const [activePeriod, setActivePeriod] = useState<{ id: number; name: string; period: string } | null>(null);
  const [showTermModal, setShowTermModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [termSubmitting, setTermSubmitting] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      form.setFieldsValue({
        max_grade: res.data.max_grade !== undefined ? Number(res.data.max_grade) : 20,
        passing_grade: res.data.passing_grade !== undefined ? Number(res.data.passing_grade) : 10,
        grade_lock_mode: res.data.grade_lock_mode === 'true',
        council_points_limit: res.data.council_points_limit !== undefined ? Number(res.data.council_points_limit) : 2,
      });
    } catch (error) {
      console.error('Error fetching settings', error);
      message.error('Error al cargar configuraciones');
    } finally {
      setLoading(false);
    }
  }, [form]);

  const fetchTerms = useCallback(async () => {
    try {
      const periodRes = await api.get('/academic/active');
      const period = periodRes.data;
      setActivePeriod(period);

      if (period) {
        const termsRes = await api.get(`/terms?schoolPeriodId=${period.id}`);
        setTerms(termsRes.data.sort((a: any, b: any) => a.order - b.order));
      }
    } catch (error) {
      console.error('Error fetching terms', error);
      message.error('Error al cargar los lapsos');
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchTerms();
  }, [fetchSettings, fetchTerms]);

  const onFinish = async (values: SettingsFormValues) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        grade_lock_mode: String(values.grade_lock_mode)
      };
      await api.post('/settings', { settings: payload });
      message.success('Configuraciones guardadas correctamente');
    } catch (error) {
      console.error('Error saving settings', error);
      message.error('Error al guardar configuraciones');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTerm = () => {
    setEditingTerm(null);
    termForm.resetFields();
    termForm.setFieldsValue({ isBlocked: false });
    setShowTermModal(true);
  };

  const handleEditTerm = (term: Term) => {
    setEditingTerm(term);
    termForm.setFieldsValue({
      name: term.name,
      isBlocked: term.isBlocked,
      openDate: term.openDate ? dayjs(term.openDate) : undefined,
      closeDate: term.closeDate ? dayjs(term.closeDate) : undefined,
    });
    setShowTermModal(true);
  };

  const handleDeleteTerm = async (termId: number) => {
    try {
      await api.delete(`/terms/${termId}`);
      message.success('Lapso eliminado correctamente');
      fetchTerms();
    } catch (error) {
      console.error('Error deleting term', error);
      message.error('Error al eliminar el lapso');
    }
  };

  const handleSaveTerm = async (values: TermFormValues) => {
    if (!activePeriod) {
      message.error('No hay un período escolar activo');
      return;
    }

    setTermSubmitting(true);
    try {
      const payload = {
        name: values.name,
        isBlocked: values.isBlocked,
        openDate: values.openDate ? values.openDate.toISOString() : null,
        closeDate: values.closeDate ? values.closeDate.toISOString() : null,
        schoolPeriodId: activePeriod.id
      };

      if (editingTerm) {
        await api.put(`/terms/${editingTerm.id}`, payload);
        message.success('Lapso actualizado correctamente');
      } else {
        await api.post('/terms', payload);
        message.success('Lapso creado correctamente');
      }

      setShowTermModal(false);
      fetchTerms();
    } catch (error: any) {
      console.error('Error saving term', error);
      message.error(error.response?.data?.message || 'Error al guardar el lapso');
    } finally {
      setTermSubmitting(false);
    }
  };

  const toggleTermBlock = async (term: Term) => {
    try {
      await api.put(`/terms/${term.id}`, {
        isBlocked: !term.isBlocked
      });
      message.success(`Lapso ${!term.isBlocked ? 'bloqueado' : 'desbloqueado'} correctamente`);
      fetchTerms();
    } catch (error) {
      console.error('Error toggling term block', error);
      message.error('Error al cambiar el estado del lapso');
    }
  };

  const termColumns = [
    {
      title: 'Orden',
      dataIndex: 'order',
      key: 'order',
      width: 100,
      align: 'center' as const,
      render: (val: number) => (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 8,
          background: '#f0f2f5',
          color: '#595959',
          fontWeight: 800,
          fontSize: 14
        }}>
          {val}º
        </div>
      )
    },
    {
      title: 'Identificación Lapso',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text style={{ fontWeight: 700, color: '#262626', fontSize: 15 }}>{text}</Text>
    },
    {
      title: 'Estado de Acceso',
      key: 'status',
      render: (_: any, record: Term) => (
        <Tag
          icon={record.isBlocked ? <LockOutlined /> : <UnlockOutlined />}
          color={record.isBlocked ? "error" : "success"}
          style={{
            borderRadius: 20,
            padding: '2px 12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            fontSize: 10,
            border: 'none',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}
        >
          {record.isBlocked ? 'Bloqueado' : 'Abierto'}
        </Tag>
      )
    },
    {
      title: 'Cronograma',
      key: 'dates',
      render: (_: any, record: Term) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', fontWeight: 600 }}>Rango de Fechas</Text>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>
            {record.openDate ? dayjs(record.openDate).format('DD MMM YYYY') : 'N/A'} - {record.closeDate ? dayjs(record.closeDate).format('DD MMM YYYY') : 'N/A'}
          </Text>
        </Space>
      )
    },
    {
      title: 'Acciones',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: Term) => (
        <Space size="middle">
          <Tooltip title="Configurar detalles">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#1890ff' }} />}
              onClick={() => handleEditTerm(record)}
              className="action-btn-hover"
            />
          </Tooltip>
          <Tooltip title={record.isBlocked ? 'Permitir entrada de notas' : 'Restringir entrada de notas'}>
            <Button
              type="text"
              icon={record.isBlocked ? <UnlockOutlined style={{ color: '#52c41a' }} /> : <LockOutlined style={{ color: '#faad14' }} />}
              onClick={() => toggleTermBlock(record)}
              className="action-btn-hover"
            />
          </Tooltip>
          <Popconfirm
            title="¿Eliminar este lapso?"
            description="Esta acción desvinculará las notas cargadas en este término."
            onConfirm={() => handleDeleteTerm(record.id)}
            okText="Eliminar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              className="action-btn-hover-danger"
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
      <Spin size="large" />
      <Text type="secondary" style={{ letterSpacing: 1, textTransform: 'uppercase', fontSize: 12, fontWeight: 700 }}>Sincronizando Parámetros...</Text>
    </div>
  );

  return (
    <div style={{ paddingBottom: 40 }}>
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.98) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-card {
          animation: fadeInScale 0.6s cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        
        .premium-card {
          border-radius: 20px !important;
          border: 1px solid rgba(0,0,0,0.06) !important;
          box-shadow: 0 10px 30px rgba(0,0,0,0.04) !important;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .settings-header {
          background: linear-gradient(135deg, #001529 0%, #003a8c 100%);
          padding: 16px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .action-btn-hover:hover {
          background: #e6f7ff !important;
          transform: scale(1.1);
        }
        .action-btn-hover-danger:hover {
          background: #fff1f0 !important;
          transform: scale(1.1);
        }
        .ant-input-number, .ant-input, .ant-picker {
          border-radius: 12px !important;
        }
        .premium-table .ant-table-thead > tr > th {
          background: #fafafa !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          font-size: 11px !important;
          letter-spacing: 0.5px !important;
          color: #8c8c8c !important;
          border-bottom: 2px solid #f0f0f0 !important;
        }
      `}</style>

      {/* Hero Section */}
      <div style={{ marginBottom: 40, marginTop: 12 }} className="animate-card">
        <Row justify="space-between" align="middle">
          <Col>
            <Space size="middle" align="center">
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(24,144,255,0.3)'
              }}>
                <ControlOutlined style={{ fontSize: 28, color: '#fff' }} />
              </div>
              <div>
                <Title level={2} style={{ margin: 0, fontWeight: 900, letterSpacing: '-0.03em' }}>
                  Parámetros Académicos
                </Title>
                <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>
                  Configuración global del sistema de evaluación y gestión de términos.
                </Text>
              </div>
            </Space>
          </Col>
        </Row>
      </div>

      <Row gutter={[32, 32]}>
        {/* Rules Column */}
        <Col xs={24} lg={9}>
          <Card
            className="premium-card animate-card delay-1"
            styles={{ body: { padding: 0 } }}
          >
            <div className="settings-header">
              <SettingOutlined style={{ color: '#bae7ff', fontSize: 18 }} />
              <Title level={5} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>Reglas de Evaluación</Title>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              style={{ padding: '28px' }}
              requiredMark={false}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="max_grade"
                    label={<Text style={{ fontWeight: 700, fontSize: 13 }}>Escala Máxima</Text>}
                    tooltip="La nota más alta posible (Ej: 20 pts)"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} max={100} style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="passing_grade"
                    label={<Text style={{ fontWeight: 700, fontSize: 13 }}>Nota Mínima</Text>}
                    tooltip="Nota requerida para aprobar la materia"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0} max={100} style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="council_points_limit"
                label={<Text style={{ fontWeight: 700, fontSize: 13 }}>Créditos de Consejo</Text>}
                tooltip="Límite de puntos adicionales que el consejo puede otorgar"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} max={20} style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center' }} />
              </Form.Item>

              <div style={{
                background: '#f9f9f9',
                padding: '16px 20px',
                borderRadius: 16,
                marginTop: 8,
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px dashed #d9d9d9'
              }}>
                <div>
                  <Text style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>Bloqueo Inteligente</Text>
                  <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Restringir por fecha automáticamente</Text>
                </div>
                <Form.Item name="grade_lock_mode" valuePropName="checked" noStyle>
                  <Switch />
                </Form.Item>
              </div>

              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                icon={<SaveOutlined />}
                block
                size="large"
                style={{
                  height: 52,
                  borderRadius: 14,
                  fontWeight: 800,
                  fontSize: 16,
                  background: '#001529',
                  border: 'none',
                  boxShadow: '0 8px 20px rgba(0,21,41,0.2)'
                }}
              >
                Aplicar Cambios Globales
              </Button>
            </Form>
          </Card>
        </Col>

        {/* Terms Column */}
        <Col xs={24} lg={15}>
          <Card
            className="premium-card animate-card delay-2"
            styles={{ body: { padding: 0 } }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 12px' }}>
                <Space direction="vertical" size={2}>
                  <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1 }}>Cronograma Académico</Text>
                  <Title level={4} style={{ margin: 0, fontWeight: 800 }}>Gestión de Lapsos</Title>
                </Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAddTerm}
                  disabled={!activePeriod}
                  style={{
                    borderRadius: 12,
                    fontWeight: 700,
                    height: 44,
                    padding: '0 24px',
                    background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                    border: 'none'
                  }}
                >
                  Nuevo Lapso
                </Button>
              </div>
            }
          >
            {!activePeriod ? (
              <div style={{ padding: '60px 40px', textAlign: 'center' }}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Space direction="vertical">
                      <Text strong style={{ fontSize: 16 }}>No hay Periodo Escolar Activo</Text>
                      <Text type="secondary">Debe activar un periodo para poder gestionar sus términos académicos.</Text>
                    </Space>
                  }
                />
              </div>
            ) : (
              <Table
                columns={termColumns}
                dataSource={terms}
                rowKey="id"
                pagination={false}
                className="premium-table"
                style={{ padding: '4px' }}
              />
            )}
          </Card>

          {activePeriod && (
            <Alert
              message={<Text style={{ fontWeight: 700 }}>Periodo en Curso: {activePeriod.name}</Text>}
              description={<Text style={{ fontSize: 12 }}>Las configuraciones realizadas impactarán únicamente a las evaluaciones registradas dentro de este periodo escolar.</Text>}
              type="info"
              showIcon
              style={{ marginTop: 24, borderRadius: 16, border: 'none', background: '#e6f7ff' }}
              icon={<DashboardOutlined />}
            />
          )}
        </Col>
      </Row>

      {/* Modal Rediseño */}
      <Modal
        title={null}
        open={showTermModal}
        onCancel={() => setShowTermModal(false)}
        footer={null}
        destroyOnClose
        centered
        width={500}
        styles={{ body: { padding: 0, borderRadius: 24, overflow: 'hidden' } }}
      >
        <div style={{ borderRadius: 24, overflow: 'hidden' }}>
          <div style={{
            padding: '24px 32px',
            background: 'linear-gradient(135deg, #001529 0%, #003a8c 100%)',
            color: '#fff'
          }}>
            <Space size="middle">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarOutlined style={{ fontSize: 22 }} />
              </div>
              <div>
                <Title level={4} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>{editingTerm ? 'Ajustar Lapso' : 'Registrar Nuevo Lapso'}</Title>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Término Académico</Text>
              </div>
            </Space>
          </div>

          <Form
            form={termForm}
            layout="vertical"
            onFinish={handleSaveTerm}
            requiredMark={false}
            style={{ padding: '32px' }}
          >
            <Form.Item
              name="name"
              label={<Text style={{ fontWeight: 700 }}>Nombre / Identificación</Text>}
              rules={[{ required: true, message: 'Ingrese un nombre identificador' }]}
            >
              <Input placeholder="Ej: Primer Lapso o Primer Momento" size="large" />
            </Form.Item>

            <div style={{
              background: '#fff7e6',
              padding: '16px 20px',
              borderRadius: 16,
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1px solid #ffe7ba'
            }}>
              <Space>
                <LockOutlined style={{ color: '#faad14' }} />
                <div>
                  <Text style={{ display: 'block', fontWeight: 700, color: '#874d00' }}>Bloquear Lapso</Text>
                  <Text style={{ fontSize: 11, color: '#d46b08' }}>Impide la modificación de calificaciones</Text>
                </div>
              </Space>
              <Form.Item name="isBlocked" valuePropName="checked" noStyle>
                <Switch className="custom-switch-warning" />
              </Form.Item>
            </div>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="openDate" label={<Text style={{ fontWeight: 700, fontSize: 12 }}>Fecha de Apertura</Text>}>
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} size="large" placeholder="Desde" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="closeDate" label={<Text style={{ fontWeight: 700, fontSize: 12 }}>Fecha de Cierre</Text>}>
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} size="large" placeholder="Hasta" />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button onClick={() => setShowTermModal(false)} size="large" style={{ borderRadius: 12, fontWeight: 700 }}>
                Cancelar
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={termSubmitting}
                size="large"
                style={{
                  borderRadius: 12,
                  fontWeight: 800,
                  padding: '0 32px',
                  background: '#001529',
                  border: 'none'
                }}
              >
                {editingTerm ? 'Guardar Cambios' : 'Crear Lapso'}
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
    </div>
  );
};

export default AcademicSettings;