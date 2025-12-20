import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, InputNumber, Button, Typography, Space, message, Spin, DatePicker, Switch, Table, Modal, Popconfirm, Tooltip, Alert } from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined, EditOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';

const { Text } = Typography;

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
  grade_lock_mode?: string;
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
        max_grade: res.data.max_grade ? Number(res.data.max_grade) : 20,
        passing_grade: res.data.passing_grade ? Number(res.data.passing_grade) : undefined,
        grade_lock_mode: res.data.grade_lock_mode || 'never',
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
      // Get active period first
      const periodRes = await api.get('/academic/active');
      const period = periodRes.data;
      setActivePeriod(period);

      if (period) {
        const termsRes = await api.get(`/terms?schoolPeriodId=${period.id}`);
        setTerms(termsRes.data);
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
      await api.post('/settings', { settings: values });
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
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      console.error('Error saving term', error);
      message.error(err.response?.data?.message || 'Error al guardar el lapso');
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
      width: 80,
    },
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Estado',
      key: 'status',
      render: (_: unknown, record: Term) => (
        <Space>
          {record.isBlocked ? (
            <Tooltip title="Bloqueado">
              <LockOutlined style={{ color: '#ff4d4f' }} />
            </Tooltip>
          ) : (
            <Tooltip title="Desbloqueado">
              <UnlockOutlined style={{ color: '#52c41a' }} />
            </Tooltip>
          )}
          <Text type={record.isBlocked ? 'danger' : 'success'}>
            {record.isBlocked ? 'Bloqueado' : 'Activo'}
          </Text>
        </Space>
      )
    },
    {
      title: 'Fecha de Apertura',
      dataIndex: 'openDate',
      key: 'openDate',
      render: (date: string) => date ? dayjs(date).format('DD/MM/YYYY') : '-'
    },
    {
      title: 'Fecha de Cierre',
      dataIndex: 'closeDate',
      key: 'closeDate',
      render: (date: string) => date ? dayjs(date).format('DD/MM/YYYY') : '-'
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, record: Term) => (
        <Space>
          <Tooltip title="Editar">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditTerm(record)}
            />
          </Tooltip>
          <Tooltip title={record.isBlocked ? 'Desbloquear' : 'Bloquear'}>
            <Button
              type="text"
              icon={record.isBlocked ? <UnlockOutlined /> : <LockOutlined />}
              onClick={() => toggleTermBlock(record)}
              style={{ color: record.isBlocked ? '#52c41a' : '#ff4d4f' }}
            />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Popconfirm
              title="¿Eliminar este lapso?"
              description="Esta acción no se puede deshacer"
              onConfirm={() => handleDeleteTerm(record.id)}
              okText="Sí, eliminar"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" tip="Cargando configuración..." /></div>;

  return (
    <div>
      {/* Configuraciones Generales */}
      <Card title="Configuraciones Académicas Generales" style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="max_grade"
              label="Nota Máxima"
              rules={[{ required: true, message: 'Ingrese la nota máxima' }]}
            >
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="passing_grade"
              label="Nota de Aprobación"
            >
              <InputNumber min={0} max={100} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="grade_lock_mode"
              label="Modo de Bloqueo de Calificaciones"
              style={{ gridColumn: 'span 2' }}
            >
              <Switch
                checkedChildren="Automático"
                unCheckedChildren="Manual"
                defaultChecked={false}
              />
            </Form.Item>
          </div>

          <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
              Guardar Configuraciones
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Gestión de Lapsos */}
      <Card
        title={
          <Space>
            <span>Gestión de Lapsos</span>
            {activePeriod && <Text type="secondary">({activePeriod.name})</Text>}
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddTerm}
            disabled={!activePeriod}
          >
            Agregar Lapso
          </Button>
        }
      >
        {!activePeriod ? (
          <Alert
            message="No hay período escolar activo"
            description="Para gestionar lapsos, primero debe haber un período escolar activo."
            type="warning"
            showIcon
          />
        ) : (
          <Table
            columns={termColumns}
            dataSource={terms}
            rowKey="id"
            pagination={false}
            size="small"
          />
        )}
      </Card>

      {/* Modal para crear/editar lapso */}
      <Modal
        title={editingTerm ? 'Editar Lapso' : 'Crear Nuevo Lapso'}
        open={showTermModal}
        onCancel={() => setShowTermModal(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={termForm} layout="vertical" onFinish={handleSaveTerm}>
          <Form.Item
            name="name"
            label="Nombre del Lapso"
            rules={[{ required: true, message: 'Ingrese el nombre del lapso' }]}
          >
            <Input placeholder="Ej: Primer Lapso, Segundo Lapso, etc." />
          </Form.Item>

          <Form.Item name="isBlocked" label="Estado" valuePropName="checked">
            <Switch
              checkedChildren="Bloqueado"
              unCheckedChildren="Activo"
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="openDate" label="Fecha de Apertura">
              <DatePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                placeholder="Seleccionar fecha"
              />
            </Form.Item>

            <Form.Item name="closeDate" label="Fecha de Cierre">
              <DatePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                placeholder="Seleccionar fecha"
              />
            </Form.Item>
          </div>

          <Form.Item style={{ marginTop: 24, marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setShowTermModal(false)}>Cancelar</Button>
              <Button type="primary" htmlType="submit" loading={termSubmitting}>
                {editingTerm ? 'Actualizar' : 'Crear'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AcademicSettings;