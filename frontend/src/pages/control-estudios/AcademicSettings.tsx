import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, InputNumber, Button, Typography, Space, message, Spin, DatePicker, Switch, Table, Modal, Popconfirm, Tooltip, Alert, Tag, Row, Col } from 'antd';
import {
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  UnlockOutlined,
  DashboardOutlined,
  CalendarOutlined,
  BlockOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
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
      // Ensure values are strings for the settings table
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
      render: (val: number) => <Tag className="rounded-lg font-bold border-none bg-slate-100 text-slate-600">{val}º</Tag>
    },
    {
      title: 'Nombre del Lapso',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <span className="font-bold text-slate-700">{text}</span>
    },
    {
      title: 'Estado',
      key: 'status',
      render: (_: unknown, record: Term) => (
        <Space>
          {record.isBlocked ? (
            <Tag color="error" icon={<LockOutlined />} className="rounded-full px-3 font-bold uppercase text-[10px]">Bloqueado</Tag>
          ) : (
            <Tag color="success" icon={<UnlockOutlined />} className="rounded-full px-3 font-bold uppercase text-[10px]">Activo</Tag>
          )}
        </Space>
      )
    },
    {
      title: 'Apertura',
      dataIndex: 'openDate',
      key: 'openDate',
      render: (date: string) => date ? <span className="text-slate-500 font-medium">{dayjs(date).format('DD/MM/YYYY')}</span> : <Text type="secondary">-</Text>
    },
    {
      title: 'Cierre',
      dataIndex: 'closeDate',
      key: 'closeDate',
      render: (date: string) => date ? <span className="text-slate-500 font-medium">{dayjs(date).format('DD/MM/YYYY')}</span> : <Text type="secondary">-</Text>
    },
    {
      title: 'Acciones',
      key: 'actions',
      align: 'right' as const,
      render: (_: unknown, record: Term) => (
        <Space>
          <Tooltip title="Editar detalles">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditTerm(record)}
              className="hover:bg-blue-50 text-blue-600"
            />
          </Tooltip>
          <Tooltip title={record.isBlocked ? 'Activar Lapso' : 'Bloquear Lapso'}>
            <Button
              type="text"
              icon={record.isBlocked ? <UnlockOutlined /> : <LockOutlined />}
              onClick={() => toggleTermBlock(record)}
              className={record.isBlocked ? "text-emerald-500 hover:bg-emerald-50" : "text-amber-500 hover:bg-amber-50"}
            />
          </Tooltip>
          <Popconfirm
            title="¿Eliminar lapso?"
            description="Se perderán los registros asociados."
            onConfirm={() => handleDeleteTerm(record.id)}
            okText="Eliminar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              className="hover:bg-red-50 text-red-500"
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-24 gap-4">
      <Spin size="large" />
      <Text className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cargando Configuración...</Text>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <DashboardOutlined className="text-brand-primary" /> Parámetros Académicos
        </h1>
        <p className="text-slate-500 font-medium">Controla las reglas globales de calificación, bloqueos y gestión de periodos temporales.</p>
      </div>

      <Row gutter={[24, 24]}>
        {/* General Settings Form */}
        <Col span={24} lg={8}>
          <Card className="glass-card h-full !p-0 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4">
              <h3 className="text-white font-bold flex items-center gap-2"><BlockOutlined className="text-brand-primary" /> Reglas de Evaluación</h3>
            </div>
            <Form form={form} layout="vertical" onFinish={onFinish} className="p-6" requiredMark={false}>
              <div className="space-y-6">
                <Form.Item
                  name="max_grade"
                  label={<span className="text-slate-700 font-bold">Nota Máxima</span>}
                  rules={[{ required: true, message: 'Requerido' }]}
                >
                  <InputNumber min={1} max={100} className="w-full !rounded-xl h-10 flex items-center px-2" />
                </Form.Item>

                <Form.Item
                  name="passing_grade"
                  label={<span className="text-slate-700 font-bold">Nota de Aprobación</span>}
                  rules={[{ required: true, message: 'Requerido' }]}
                >
                  <InputNumber min={0} max={100} className="w-full !rounded-xl h-10 flex items-center px-2" />
                </Form.Item>

                <Form.Item
                  name="council_points_limit"
                  label={<span className="text-slate-700 font-bold">Límite Puntos Consejo</span>}
                  tooltip="Puntos máximos que se pueden otorgar en Consejo de Curso por materia"
                  rules={[{ required: true, message: 'Requerido' }]}
                >
                  <InputNumber min={0} max={20} className="w-full !rounded-xl h-10 flex items-center px-2" />
                </Form.Item>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-slate-700 font-bold block">Bloqueo Automático</span>
                    <span className="text-[10px] text-slate-400 font-medium uppercase">Gestionado por fecha</span>
                  </div>
                  <Form.Item name="grade_lock_mode" valuePropName="checked" noStyle>
                    <Switch />
                  </Form.Item>
                </div>

                <div className="pt-4">
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={saving}
                    icon={<SaveOutlined />}
                    block
                    className="h-12 bg-slate-900 border-none rounded-xl font-bold shadow-lg"
                  >
                    Guardar Reglas
                  </Button>
                </div>
              </div>
            </Form>
          </Card>
        </Col>

        {/* Lapsos Management Table */}
        <Col span={24} className="lg:col-span-2">
          <Card
            className="glass-card !p-0 overflow-hidden"
            title={
              <div className="py-2">
                <h3 className="text-slate-800 font-black tracking-tight mb-0">Gestión de Lapsos / Términos</h3>
                {activePeriod && <Text className="text-[10px] uppercase font-black text-brand-primary tracking-widest">{activePeriod.name}</Text>}
              </div>
            }
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddTerm}
                disabled={!activePeriod}
                className="bg-brand-primary border-none rounded-xl font-bold h-10 px-6 shadow-md"
              >
                Nuevo Lapso
              </Button>
            }
          >
            {!activePeriod ? (
              <div className="p-12 text-center">
                <Alert
                  message="Sin Periodo Escolar"
                  description="Debe activar un periodo escolar en el módulo Maestro para gestionar lapsos."
                  type="warning"
                  showIcon
                  className="rounded-2xl"
                />
              </div>
            ) : (
              <Table
                columns={termColumns}
                dataSource={terms}
                rowKey="id"
                pagination={false}
                className="premium-table"
              />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={
          <div className="flex items-center gap-3 py-2 border-b border-slate-100 mb-6">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <CalendarOutlined />
            </div>
            <div>
              <h3 className="m-0 font-black text-slate-800 tracking-tight">{editingTerm ? 'Configurar Lapso' : 'Nuevo Lapso'}</h3>
              <p className="text-[10px] text-slate-400 uppercase font-bold m-0 tracking-widest">Definición de Término Académico</p>
            </div>
          </div>
        }
        open={showTermModal}
        onCancel={() => setShowTermModal(false)}
        footer={null}
        destroyOnClose
        className="luxury-modal"
        centered
      >
        <Form form={termForm} layout="vertical" onFinish={handleSaveTerm} requiredMark={false}>
          <Form.Item
            name="name"
            label={<span className="text-slate-700 font-bold">Identificador del Lapso</span>}
            rules={[{ required: true, message: 'Ingrese el nombre del lapso' }]}
          >
            <Input placeholder="Ej: Primer Lapso (Evaluación Continua)" className="h-11 rounded-xl" />
          </Form.Item>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LockOutlined className="text-amber-600" />
              <span className="text-amber-900 font-bold text-sm">Bloquear entrada de notas</span>
            </div>
            <Form.Item name="isBlocked" valuePropName="checked" noStyle>
              <Switch className="bg-slate-200" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Form.Item name="openDate" label={<span className="text-slate-700 font-bold text-xs uppercase tracking-wider">Fecha de Apertura</span>}>
              <DatePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                placeholder="20/09/2025"
                className="h-11 rounded-xl"
              />
            </Form.Item>

            <Form.Item name="closeDate" label={<span className="text-slate-700 font-bold text-xs uppercase tracking-wider">Fecha de Cierre</span>}>
              <DatePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                placeholder="15/12/2025"
                className="h-11 rounded-xl"
              />
            </Form.Item>
          </div>

          <Alert
            type="info"
            showIcon
            message="Sincronización Automática"
            description="Las fechas definen la visibilidad del lapso en el panel del profesor si el modo automático está activo."
            className="mt-6 mb-8 rounded-xl bg-blue-50/50 border-blue-100 text-blue-800"
          />

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <Button onClick={() => setShowTermModal(false)} className="h-11 px-8 rounded-xl font-bold">Descartar</Button>
            <Button type="primary" htmlType="submit" loading={termSubmitting} className="h-11 px-10 bg-slate-900 border-none rounded-xl font-bold flex items-center gap-2">
              {editingTerm ? 'Actualizar Cambios' : 'Confirmar Creación'} <ArrowRightOutlined className="text-[10px]" />
            </Button>
          </div>
        </Form>
      </Modal>
    </div >
  );
};

export default AcademicSettings;