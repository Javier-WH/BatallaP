import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, InputNumber, Button, Typography, Space, message, Spin, DatePicker, TimePicker, Switch, Table, Modal, Popconfirm, Tooltip, Alert, Tag, Row, Col, Empty, Tabs, Divider } from 'antd';
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
  ControlOutlined,
  MergeOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';
import LetterGradeSlider from '@/components/LetterGradeSlider';
import type { LetterGrade } from '@/components/LetterGradeSlider';
import TermSectionClosurePanel from '@/components/shared/TermSectionClosurePanel';
import AcademicManagement from '@/pages/master/AcademicManagement';
import SchoolManagement from '@/pages/admin/SchoolManagement';

const { Text, Title } = Typography;

interface Term {
  id: number;
  name: string;
  isBlocked: boolean;
  isActive: boolean;
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
  council_points_per_subject_limit?: number;
  pending_subject_max_encounters?: number;
  letter_grades?: LetterGrade[];
  remedial_min_grade?: number;
  remedial_max_grade?: number;
  remedial_failure_percentage?: number;
}

interface TermFormValues {
  name: string;
  isBlocked: boolean;
  openDate?: dayjs.Dayjs;
  closeDate?: dayjs.Dayjs;
}

interface CatalogItem {
  id: number;
  type: 'tecnica' | 'instrumento' | 'estrategia';
  name: string;
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
  const [letterGrades, setLetterGrades] = useState<LetterGrade[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([]);
  const [catalogModal, setCatalogModal] = useState<{ open: boolean; editing?: CatalogItem | null; type: 'tecnica' | 'instrumento' | 'estrategia'; name: string }>({ open: false, type: 'tecnica', name: '' });
  const [catalogSubmitting, setCatalogSubmitting] = useState(false);
  const [selectedTecnicaKeys, setSelectedTecnicaKeys] = useState<React.Key[]>([]);
  const [selectedInstrumentoKeys, setSelectedInstrumentoKeys] = useState<React.Key[]>([]);
  const [selectedEstrategiaKeys, setSelectedEstrategiaKeys] = useState<React.Key[]>([]);
  const [mergeModal, setMergeModal] = useState<{ open: boolean; type: 'tecnica' | 'instrumento' | 'estrategia'; ids: number[]; names: string[]; newName: string }>({ open: false, type: 'tecnica', ids: [], names: [], newName: '' });
  const [mergeSubmitting, setMergeSubmitting] = useState(false);
  const [sortTecnica, setSortTecnica] = useState<'asc' | 'desc'>('asc');
  const [sortInstrumento, setSortInstrumento] = useState<'asc' | 'desc'>('asc');
  const [sortEstrategia, setSortEstrategia] = useState<'asc' | 'desc'>('asc');
  const [structure, setStructure] = useState<any[]>([]);
  const [closurePanelTerm, setClosurePanelTerm] = useState<Term | null>(null);
  const [autoTransition, setAutoTransition] = useState(false);
  const [scheduleForm] = Form.useForm();
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [timeFormat, setTimeFormat] = useState<'12' | '24'>('24');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      form.setFieldsValue({
        max_grade: res.data.max_grade !== undefined ? Number(res.data.max_grade) : 20,
        passing_grade: res.data.passing_grade !== undefined ? Number(res.data.passing_grade) : 10,
        grade_lock_mode: res.data.grade_lock_mode === 'true',
        council_points_limit: res.data.council_points_limit !== undefined ? Number(res.data.council_points_limit) : 2,
        council_points_per_subject_limit: res.data.council_points_per_subject_limit !== undefined ? Number(res.data.council_points_per_subject_limit) : 2,
        pending_subject_max_encounters: res.data.pending_subject_max_encounters !== undefined ? Number(res.data.pending_subject_max_encounters) : 4,
        remedial_min_grade: res.data.remedial_min_grade !== undefined ? Number(res.data.remedial_min_grade) : 1,
        remedial_max_grade: res.data.remedial_max_grade !== undefined ? Number(res.data.remedial_max_grade) : 9,
        remedial_failure_percentage: res.data.remedial_failure_percentage !== undefined ? Number(res.data.remedial_failure_percentage) : 50,
      });
      
      // Load letter grades configuration
      if (res.data.letter_grades) {
        try {
          const parsed = typeof res.data.letter_grades === 'string' 
            ? JSON.parse(res.data.letter_grades) 
            : res.data.letter_grades;
          setLetterGrades(parsed.scale || []);
        } catch (e) {
          console.error('Error parsing letter_grades', e);
          setLetterGrades([]);
        }
      } else {
        setLetterGrades([
          { letter: 'A', max: 20 },
          { letter: 'B', max: 15 },
          { letter: 'C', max: 10 },
          { letter: 'D', max: 5 },
          { letter: 'E', max: 0 }
        ]);
      }
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
        const [termsRes, structureRes] = await Promise.all([
          api.get(`/terms?schoolPeriodId=${period.id}`),
          api.get(`/academic/structure/${period.id}`),
        ]);
        setTerms(termsRes.data.sort((a: any, b: any) => a.order - b.order));
        setStructure(structureRes.data || []);
      }
      const settingsRes = await api.get('/settings');
      setAutoTransition(settingsRes.data.auto_term_transition === 'true');
      const tf = settingsRes.data.time_format === '12' ? '12' : '24';
      setTimeFormat(tf);
      scheduleForm.setFieldsValue({
        academic_hour_minutes: settingsRes.data.academic_hour_minutes !== undefined ? Number(settingsRes.data.academic_hour_minutes) : 45,
        min_academic_hours_per_block: settingsRes.data.min_academic_hours_per_block !== undefined ? Number(settingsRes.data.min_academic_hours_per_block) : 1,
        morning_start_time: settingsRes.data.morning_start_time ? dayjs(settingsRes.data.morning_start_time, 'HH:mm') : dayjs('07:00', 'HH:mm'),
        afternoon_start_time: settingsRes.data.afternoon_start_time ? dayjs(settingsRes.data.afternoon_start_time, 'HH:mm') : dayjs('13:00', 'HH:mm'),
      });
    } catch (error) {
      console.error('Error fetching terms', error);
      message.error('Error al cargar los lapsos');
    }
  }, []);

  const fetchCatalogs = useCallback(async () => {
    try {
      const res = await api.get('/evaluation/catalogs');
      setCatalogs(res.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchTerms();
    fetchCatalogs();
  }, [fetchSettings, fetchTerms, fetchCatalogs]);

  const handleAddCatalog = (type: 'tecnica' | 'instrumento' | 'estrategia') => {
    setCatalogModal({ open: true, editing: null, type, name: '' });
  };

  const handleEditCatalog = (item: CatalogItem) => {
    setCatalogModal({ open: true, editing: item, type: item.type, name: item.name });
  };

  const handleDeleteCatalog = async (id: number) => {
    try {
      await api.delete(`/evaluation/catalogs/${id}`);
      message.success('Elemento eliminado');
      fetchCatalogs();
    } catch {
      message.error('Error al eliminar');
    }
  };

  const handleSaveCatalog = async () => {
    if (!catalogModal.name.trim()) {
      message.warning('El nombre es requerido');
      return;
    }
    setCatalogSubmitting(true);
    try {
      if (catalogModal.editing) {
        await api.put(`/evaluation/catalogs/${catalogModal.editing.id}`, { name: catalogModal.name.trim() });
        message.success('Actualizado correctamente');
      } else {
        await api.post('/evaluation/catalogs', { type: catalogModal.type, name: catalogModal.name.trim() });
        message.success('Creado correctamente');
      }
      setCatalogModal(prev => ({ ...prev, open: false }));
      fetchCatalogs();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al guardar');
    } finally {
      setCatalogSubmitting(false);
    }
  };

  const handleOpenMerge = (type: 'tecnica' | 'instrumento' | 'estrategia', keys: React.Key[]) => {
    const selected = catalogs.filter(c => c.type === type && keys.includes(c.id));
    setMergeModal({
      open: true,
      type,
      ids: selected.map(s => s.id),
      names: selected.map(s => s.name),
      newName: selected[0]?.name || '',
    });
  };

  const handleMergeConfirm = async () => {
    if (!mergeModal.newName.trim()) {
      message.warning('El nombre es requerido');
      return;
    }
    setMergeSubmitting(true);
    try {
      await api.post('/evaluation/catalogs/merge', {
        type: mergeModal.type,
        name: mergeModal.newName.trim(),
        ids: mergeModal.ids,
      });
      message.success('Fusión completada correctamente');
      setMergeModal(prev => ({ ...prev, open: false }));
      setSelectedTecnicaKeys([]);
      setSelectedInstrumentoKeys([]);
      setSelectedEstrategiaKeys([]);
      fetchCatalogs();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al fusionar');
    } finally {
      setMergeSubmitting(false);
    }
  };

  const onFinish = async (values: SettingsFormValues) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        grade_lock_mode: String(values.grade_lock_mode),
        letter_grades: JSON.stringify({ scale: letterGrades })
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

  const toggleTermActive = async (term: Term) => {
    try {
      await api.put(`/terms/${term.id}`, { isActive: !term.isActive });
      message.success(`Lapso ${!term.isActive ? 'activado' : 'desactivado'} correctamente`);
      fetchTerms();
    } catch (error) {
      console.error('Error toggling term active', error);
      message.error('Error al cambiar el lapso activo');
    }
  };

  const handleToggleAutoTransition = async (checked: boolean) => {
    try {
      await api.post('/settings', { settings: { auto_term_transition: String(checked) } });
      setAutoTransition(checked);
      message.success(`Transición automática ${checked ? 'activada' : 'desactivada'}`);
    } catch (error) {
      console.error('Error updating auto transition setting', error);
      message.error('Error al actualizar la configuración');
    }
  };

  const onSaveSchedule = async (values: any) => {
    setSavingSchedule(true);
    try {
      await api.post('/settings', {
        settings: {
          academic_hour_minutes: String(values.academic_hour_minutes),
          min_academic_hours_per_block: String(values.min_academic_hours_per_block),
          morning_start_time: values.morning_start_time ? values.morning_start_time.format('HH:mm') : '07:00',
          afternoon_start_time: values.afternoon_start_time ? values.afternoon_start_time.format('HH:mm') : '13:00',
        },
      });
      message.success('Configuración de horarios guardada');
    } catch (error) {
      console.error('Error saving schedule settings', error);
      message.error('Error al guardar la configuración de horarios');
    } finally {
      setSavingSchedule(false);
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
      title: 'Lapso Activo',
      dataIndex: 'isActive',
      key: 'isActive',
      align: 'center' as const,
      width: 110,
      render: (val: boolean, record: Term) => (
        <Tooltip title={val ? 'Lapso activo actual' : 'Marcar como lapso activo'}>
          <Switch checked={val} onChange={() => toggleTermActive(record)} size="small" />
        </Tooltip>
      )
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
              icon={record.isBlocked ? <LockOutlined style={{ color: '#faad14' }} /> : <UnlockOutlined style={{ color: '#52c41a' }} />}
              onClick={() => toggleTermBlock(record)}
              className="action-btn-hover"
            />
          </Tooltip>
          <Tooltip title="Cerrar por sección">
            <Button
              type="text"
              icon={<ControlOutlined style={{ color: '#722ed1' }} />}
              onClick={() => setClosurePanelTerm(record)}
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

      <Tabs
        defaultActiveKey="configuracion"
        items={[
          {
            key: 'configuracion',
            label: 'Evaluación',
            children: (
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

              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="council_points_limit"
                    label={<Text style={{ fontWeight: 700, fontSize: 13 }}>Créditos de Consejo (Total)</Text>}
                    tooltip="Límite total de puntos que el consejo puede otorgar por lapso a cada estudiante"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0} max={20} style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="council_points_per_subject_limit"
                    label={<Text style={{ fontWeight: 700, fontSize: 13 }}>Créditos de Consejo (Por Materia)</Text>}
                    tooltip="Límite máximo de puntos que el consejo puede otorgar a una sola materia"
                    rules={[
                      { required: true },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (value !== undefined && value > getFieldValue('council_points_limit')) {
                            return Promise.reject(new Error('El límite por materia no puede ser mayor al límite total'));
                          }
                          return Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <InputNumber min={0} max={20} style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="pending_subject_max_encounters"
                    label={<Text style={{ fontWeight: 700, fontSize: 13 }}>Encuentros de Materia Pendiente</Text>}
                    tooltip="Cantidad máxima de encuentros de Materia Pendiente en el año escolar (por defecto 4)"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} max={12} style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center' }} />
                  </Form.Item>
                </Col>
              </Row>

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

              <div style={{
                background: '#fff7e6',
                padding: '20px',
                borderRadius: 16,
                marginTop: 8,
                marginBottom: 24,
                border: '1px dashed #ffe7ba'
              }}>
                <LetterGradeSlider
                  value={letterGrades}
                  onChange={setLetterGrades}
                  maxGrade={form.getFieldValue('max_grade') || 20}
                />
              </div>

              <div style={{
                background: '#f0f5ff',
                padding: '20px',
                borderRadius: 16,
                marginTop: 8,
                marginBottom: 24,
                border: '1px dashed #adc6ff'
              }}>
                <Text style={{ display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 16, color: '#1d39c4' }}>
                  Configuración de Remedial
                </Text>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="remedial_min_grade"
                      label={<Text style={{ fontWeight: 600, fontSize: 12 }}>Nota Mínima para Remedial</Text>}
                      tooltip="Nota desde la cual un estudiante es candidato a remedial"
                    >
                      <InputNumber min={0} max={20} style={{ width: '100%', height: 40 }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="remedial_max_grade"
                      label={<Text style={{ fontWeight: 600, fontSize: 12 }}>Nota Máxima para Remedial</Text>}
                      tooltip="Nota hasta la cual un estudiante es candidato a remedial"
                    >
                      <InputNumber min={0} max={20} style={{ width: '100%', height: 40 }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item
                  name="remedial_failure_percentage"
                  label={<Text style={{ fontWeight: 600, fontSize: 12 }}>% de Reprobados en la Sección para Remedial</Text>}
                  tooltip="Porcentaje mínimo de estudiantes reprobados en la sección para activar remedial"
                  rules={[{ required: true, message: 'Requerido' }]}
                >
                  <InputNumber min={0} max={100} style={{ width: '100%', height: 40 }} addonAfter="%" />
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
              <>
                <Table
                  columns={termColumns}
                  dataSource={terms}
                  rowKey="id"
                  pagination={false}
                  className="premium-table"
                  style={{ padding: '4px' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
                  <Tooltip title="Al marcar todos los consejos de curso del lapso activo como completados, el lapso activo pasará automáticamente al siguiente.">
                    <Text style={{ fontSize: 13, color: '#595959' }}>Transición automática al completar consejos</Text>
                  </Tooltip>
                  <Switch checked={autoTransition} onChange={handleToggleAutoTransition} size="small" />
                </div>
              </>
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
            ),
          },
          {
            key: 'evaluacion',
            label: 'Listas',
            children: (
              <>
              <Row gutter={[32, 32]} style={{ marginTop: 32 }}>
        <Col xs={24} lg={12}>
          <Card
            className="premium-card animate-card"
            styles={{ body: { padding: 0 } }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 12px' }}>
                <Space>
                  <Text style={{ fontWeight: 800, fontSize: 16 }}>Estrategias de Evaluación</Text>
                  <Tooltip title={sortEstrategia === 'asc' ? 'Orden ascendente' : 'Orden descendente'}>
                    <Button
                      type="text"
                      icon={sortEstrategia === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                      onClick={() => setSortEstrategia(prev => prev === 'asc' ? 'desc' : 'asc')}
                      style={{ padding: '4px 8px' }}
                    />
                  </Tooltip>
                </Space>
                <Space>
                  {selectedEstrategiaKeys.length >= 2 && (
                    <Button icon={<MergeOutlined />} onClick={() => handleOpenMerge('estrategia', selectedEstrategiaKeys)} style={{ borderRadius: 12, fontWeight: 700, height: 40 }}>
                      Fusionar ({selectedEstrategiaKeys.length})
                    </Button>
                  )}
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAddCatalog('estrategia')} style={{ borderRadius: 12, fontWeight: 700, height: 40 }}>
                    Nueva Estrategia
                  </Button>
                </Space>
              </div>
            }
          >
            <Table
              dataSource={[...catalogs.filter(c => c.type === 'estrategia')].sort((a, b) => sortEstrategia === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))}
              rowKey="id"
              pagination={false}
              className="premium-table"
              style={{ padding: '4px' }}
              rowSelection={{
                selectedRowKeys: selectedEstrategiaKeys,
                onChange: setSelectedEstrategiaKeys,
              }}
              columns={[
                { title: 'Nombre', dataIndex: 'name', key: 'name', render: (t: string) => <Text style={{ fontWeight: 600 }}>{t}</Text> },
                { title: 'Acciones', key: 'actions', align: 'right' as const, width: 120, render: (_: any, r: CatalogItem) => (
                  <Space>
                    <Tooltip title="Editar"><Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => handleEditCatalog(r)} /></Tooltip>
                    <Popconfirm title="¿Eliminar?" onConfirm={() => handleDeleteCatalog(r.id)} okText="Sí" cancelText="No" okButtonProps={{ danger: true }}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                )},
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            className="premium-card animate-card"
            styles={{ body: { padding: 0 } }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 12px' }}>
                <Space>
                  <Text style={{ fontWeight: 800, fontSize: 16 }}>Técnicas de Evaluación</Text>
                  <Tooltip title={sortTecnica === 'asc' ? 'Orden ascendente' : 'Orden descendente'}>
                    <Button
                      type="text"
                      icon={sortTecnica === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                      onClick={() => setSortTecnica(prev => prev === 'asc' ? 'desc' : 'asc')}
                      style={{ padding: '4px 8px' }}
                    />
                  </Tooltip>
                </Space>
                <Space>
                  {selectedTecnicaKeys.length >= 2 && (
                    <Button icon={<MergeOutlined />} onClick={() => handleOpenMerge('tecnica', selectedTecnicaKeys)} style={{ borderRadius: 12, fontWeight: 700, height: 40 }}>
                      Fusionar ({selectedTecnicaKeys.length})
                    </Button>
                  )}
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAddCatalog('tecnica')} style={{ borderRadius: 12, fontWeight: 700, height: 40 }}>
                    Nueva Técnica
                  </Button>
                </Space>
              </div>
            }
          >
            <Table
              dataSource={[...catalogs.filter(c => c.type === 'tecnica')].sort((a, b) => sortTecnica === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))}
              rowKey="id"
              pagination={false}
              className="premium-table"
              style={{ padding: '4px' }}
              rowSelection={{
                selectedRowKeys: selectedTecnicaKeys,
                onChange: setSelectedTecnicaKeys,
              }}
              columns={[
                { title: 'Nombre', dataIndex: 'name', key: 'name', render: (t: string) => <Text style={{ fontWeight: 600 }}>{t}</Text> },
                { title: 'Acciones', key: 'actions', align: 'right' as const, width: 120, render: (_: any, r: CatalogItem) => (
                  <Space>
                    <Tooltip title="Editar"><Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => handleEditCatalog(r)} /></Tooltip>
                    <Popconfirm title="¿Eliminar?" onConfirm={() => handleDeleteCatalog(r.id)} okText="Sí" cancelText="No" okButtonProps={{ danger: true }}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                )},
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            className="premium-card animate-card"
            styles={{ body: { padding: 0 } }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 12px' }}>
                <Space>
                  <Text style={{ fontWeight: 800, fontSize: 16 }}>Instrumentos de Evaluación</Text>
                  <Tooltip title={sortInstrumento === 'asc' ? 'Orden ascendente' : 'Orden descendente'}>
                    <Button
                      type="text"
                      icon={sortInstrumento === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                      onClick={() => setSortInstrumento(prev => prev === 'asc' ? 'desc' : 'asc')}
                      style={{ padding: '4px 8px' }}
                    />
                  </Tooltip>
                </Space>
                <Space>
                  {selectedInstrumentoKeys.length >= 2 && (
                    <Button icon={<MergeOutlined />} onClick={() => handleOpenMerge('instrumento', selectedInstrumentoKeys)} style={{ borderRadius: 12, fontWeight: 700, height: 40 }}>
                      Fusionar ({selectedInstrumentoKeys.length})
                    </Button>
                  )}
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAddCatalog('instrumento')} style={{ borderRadius: 12, fontWeight: 700, height: 40 }}>
                    Nuevo Instrumento
                  </Button>
                </Space>
              </div>
            }
          >
            <Table
              dataSource={[...catalogs.filter(c => c.type === 'instrumento')].sort((a, b) => sortInstrumento === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))}
              rowKey="id"
              pagination={false}
              className="premium-table"
              style={{ padding: '4px' }}
              rowSelection={{
                selectedRowKeys: selectedInstrumentoKeys,
                onChange: setSelectedInstrumentoKeys,
              }}
              columns={[
                { title: 'Nombre', dataIndex: 'name', key: 'name', render: (t: string) => <Text style={{ fontWeight: 600 }}>{t}</Text> },
                { title: 'Acciones', key: 'actions', align: 'right' as const, width: 120, render: (_: any, r: CatalogItem) => (
                  <Space>
                    <Tooltip title="Editar"><Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => handleEditCatalog(r)} /></Tooltip>
                    <Popconfirm title="¿Eliminar?" onConfirm={() => handleDeleteCatalog(r.id)} okText="Sí" cancelText="No" okButtonProps={{ danger: true }}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                )},
              ]}
            />
          </Card>
        </Col>
      </Row>
      <div style={{ marginTop: 32 }}>
        <SchoolManagement />
      </div>
              </>
            ),
          },
          {
            key: 'academico',
            label: 'Académico',
            children: <AcademicManagement />,
          },
          {
            key: 'horarios',
            label: 'Horarios',
            children: (
              <Row gutter={[32, 32]} style={{ marginTop: 32 }}>
                <Col xs={24} lg={12}>
                  <Card
                    className="premium-card animate-card"
                    styles={{ body: { padding: 0 } }}
                  >
                    <div className="settings-header">
                      <ClockCircleOutlined style={{ color: '#bae7ff', fontSize: 18 }} />
                      <Title level={5} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>Configuración de Horarios</Title>
                    </div>
                    <Form
                      form={scheduleForm}
                      layout="vertical"
                      onFinish={onSaveSchedule}
                      style={{ padding: '28px' }}
                      requiredMark={false}
                    >
                      <Alert
                        message="Hora académica"
                        description="Define la duración en minutos de una hora académica (hora-clase). Se usa para calcular bloques y cargas horarias."
                        type="info"
                        showIcon
                        style={{ marginBottom: 20, borderRadius: 12, border: 'none', background: '#e6f7ff' }}
                      />
                      <Form.Item
                        name="academic_hour_minutes"
                        label={<Text style={{ fontWeight: 700, fontSize: 13 }}>Duración de la hora académica (minutos)</Text>}
                        rules={[{ required: true, message: 'Ingrese la duración' }]}
                      >
                        <InputNumber min={1} max={120} style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center' }} />
                      </Form.Item>

                      <Form.Item
                        name="min_academic_hours_per_block"
                        label={<Text style={{ fontWeight: 700, fontSize: 13 }}>Mínimo de horas académicas por bloque</Text>}
                        tooltip="Cantidad mínima de horas académicas que debe tener un bloque de clase"
                        rules={[{ required: true, message: 'Ingrese el mínimo' }]}
                      >
                        <InputNumber min={1} max={10} style={{ width: '100%', height: 44, display: 'flex', alignItems: 'center' }} />
                      </Form.Item>

                      <Divider style={{ margin: '24px 0' }} />

                      <Alert
                        message="Turnos"
                        description="Indica la hora de inicio de cada turno. Se usa para generar y validar horarios."
                        type="info"
                        showIcon
                        style={{ marginBottom: 20, borderRadius: 12, border: 'none', background: '#f6ffed' }}
                      />
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            name="morning_start_time"
                            label={<Text style={{ fontWeight: 700, fontSize: 13 }}>Inicio turno Mañana</Text>}
                            rules={[{ required: true, message: 'Ingrese la hora' }]}
                          >
                            <TimePicker format={timeFormat === '12' ? 'h:mm A' : 'HH:mm'} style={{ width: '100%', height: 44 }} minuteStep={5} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name="afternoon_start_time"
                            label={<Text style={{ fontWeight: 700, fontSize: 13 }}>Inicio turno Tarde</Text>}
                            rules={[{ required: true, message: 'Ingrese la hora' }]}
                          >
                            <TimePicker format={timeFormat === '12' ? 'h:mm A' : 'HH:mm'} style={{ width: '100%', height: 44 }} minuteStep={5} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SaveOutlined />}
                        loading={savingSchedule}
                        size="large"
                        style={{ width: '100%', borderRadius: 12, marginTop: 8 }}
                      >
                        Guardar configuración de horarios
                      </Button>
                    </Form>
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />

      {/* Catalog Modal */}
      <Modal
        title={catalogModal.editing ? 'Editar' : 'Agregar'}
        open={catalogModal.open}
        onCancel={() => setCatalogModal(prev => ({ ...prev, open: false }))}
        onOk={handleSaveCatalog}
        confirmLoading={catalogSubmitting}
        okText="Guardar"
        cancelText="Cancelar"
        centered
        width={400}
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label={catalogModal.type === 'tecnica' ? 'Técnica' : catalogModal.type === 'instrumento' ? 'Instrumento' : 'Estrategia'} required>
            <Input
              value={catalogModal.name}
              onChange={e => setCatalogModal(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ingrese el nombre..."
              maxLength={100}
              autoFocus
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Merge Modal */}
      <Modal
        title="Fusionar registros"
        open={mergeModal.open}
        onCancel={() => setMergeModal(prev => ({ ...prev, open: false }))}
        onOk={handleMergeConfirm}
        confirmLoading={mergeSubmitting}
        okText="Fusionar"
        cancelText="Cancelar"
        centered
        width={450}
      >
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
            Se creará un nuevo registro con el nombre indicado y todos los planes de evaluación que referencian los registros seleccionados apuntarán al nuevo. Los registros antiguos se eliminarán.
          </Text>
          <Text style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>Registros a fusionar:</Text>
          <div style={{ marginBottom: 16 }}>
            {mergeModal.names.map((n, i) => (
              <Tag key={i} style={{ marginBottom: 4 }}>{n}</Tag>
            ))}
          </div>
          <Form layout="vertical">
            <Form.Item label="Nuevo nombre" required>
              <Input
                value={mergeModal.newName}
                onChange={e => setMergeModal(prev => ({ ...prev, newName: e.target.value }))}
                placeholder="Ingrese el nombre unificado..."
                maxLength={100}
                autoFocus
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>

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

      <TermSectionClosurePanel
        open={!!closurePanelTerm}
        onClose={() => setClosurePanelTerm(null)}
        term={closurePanelTerm}
        structure={structure}
      />
    </div>
  );
};

export default AcademicSettings;