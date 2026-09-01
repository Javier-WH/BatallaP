import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Upload, Button, Table, Typography, Space, Popconfirm, message, Empty, Select, Tag, Tabs, Popover, List } from 'antd';
import { DeleteOutlined, FileExcelOutlined, InboxOutlined, LinkOutlined, DisconnectOutlined, SwapOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import api from '@/services/api';

const { Text } = Typography;

export interface TemplateInfo {
  name: string;
  size: number;
  updatedAt: string;
}

export interface GradeOption {
  id: number;
  name: string;
  order?: number;
}

export interface TemplateManagerModalProps {
  open: boolean;
  onClose: () => void;
  selectedTemplate?: string | null;
  onSelect: (templateName: string) => void;
  // When provided, restricts the modal to managing assignments for this
  // grade. Templates are assigned per-grade (all sections share the same
  // template).
  defaultGradeId?: number | null;
  // 'resumen' = Resumen de Rendimiento (assign by grade, only "Asignar por Año" tab)
  // 'certified' = Notas Certificadas (assign by period: "Pre 2018" / "Actual")
  mode?: 'resumen' | 'certified';
}

const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  open,
  onClose,
  selectedTemplate,
  onSelect,
  defaultGradeId,
  mode = 'resumen',
}) => {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [certifiedAssignments, setCertifiedAssignments] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(defaultGradeId ?? null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openPopoverGradeId, setOpenPopoverGradeId] = useState<number | null>(null);
  const [openPopoverPeriod, setOpenPopoverPeriod] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const [tplRes, asgRes, activeRes, periodsRes, certAsgRes] = await Promise.all([
        api.get<TemplateInfo[]>('/templates'),
        api.get<Record<string, string>>('/templates/assignments'),
        api.get('/academic/active'),
        api.get('/academic/periods'),
        api.get<Record<string, string>>('/templates/certified-assignments'),
      ]);
      setTemplates(tplRes.data);
      setAssignments(asgRes.data);
      setCertifiedAssignments(certAsgRes.data || {});
      const period = activeRes.data;

      // Load grade list for the active period (or first period).
      const periods = Array.isArray(periodsRes.data) ? periodsRes.data : [];
      const targetPeriodId = period?.id ?? periods[0]?.id;
      if (targetPeriodId) {
        try {
          const structRes = await api.get<any[]>(`/academic/structure/${targetPeriodId}`);
          const list: GradeOption[] = (structRes.data || []).map((g: any) => ({
            id: g.grade.id,
            name: g.grade.name,
            order: g.grade.order,
          })).sort((a, b) => (a.order || 0) - (b.order || 0));
          setGrades(list);
        } catch (err) {
          console.error('Error loading grades', err);
        }
      }
    } catch (error) {
      console.error('Error fetching templates', error);
      message.error('Error al cargar las plantillas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, fetchTemplates]);

  // When a grade is provided from the parent, pre-select it on open.
  useEffect(() => {
    if (open) {
      if (defaultGradeId) setSelectedGradeId(defaultGradeId);
    }
  }, [open, defaultGradeId]);

  const handleDelete = async (name: string) => {
    try {
      await api.delete(`/templates/${encodeURIComponent(name)}`);
      message.success('Plantilla eliminada');
      fetchTemplates();
      if (selectedTemplate === name) {
        onSelect('');
      }
    } catch (error) {
      console.error('Error deleting template', error);
      message.error('Error al eliminar la plantilla');
    }
  };

  const assignToKey = async (key: string, templateName: string) => {
    try {
      const gradeId = Number(key);
      if (templateName) {
        await api.post('/templates/assignment', { gradeId, templateName });
      } else {
        await api.delete(`/templates/assignment/${gradeId}`);
      }
      message.success(templateName ? 'Plantilla asignada' : 'Asignación eliminada');
      // Refresh assignments
      const asgRes = await api.get<Record<string, string>>('/templates/assignments');
      setAssignments(asgRes.data);
      // Close the popover so the table row re-renders with the new state.
      setOpenPopoverGradeId(null);
    } catch (error: any) {
      console.error('Error assigning template', error);
      message.error(error?.response?.data?.message || 'Error al asignar la plantilla');
    }
  };

  const assignCertified = async (periodKey: string, templateName: string) => {
    try {
      if (templateName) {
        await api.post('/templates/certified-assignment', { periodKey, templateName });
      } else {
        await api.delete(`/templates/certified-assignment/${periodKey}`);
      }
      message.success(templateName ? 'Plantilla asignada' : 'Asignación eliminada');
      const certAsgRes = await api.get<Record<string, string>>('/templates/certified-assignments');
      setCertifiedAssignments(certAsgRes.data || {});
      setOpenPopoverPeriod(null);
    } catch (error: any) {
      console.error('Error assigning certified template', error);
      message.error(error?.response?.data?.message || 'Error al asignar la plantilla');
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    accept: '.xlsx,.xls',
    multiple: false,
    showUploadList: false,
    beforeUpload: (file) => {
      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
      if (!isExcel) {
        message.error('Solo se permiten archivos Excel (.xlsx, .xls)');
        return Upload.LIST_IGNORE;
      }
      const under10MB = file.size / 1024 / 1024 < 10;
      if (!under10MB) {
        message.error('El archivo supera el límite de 10MB');
        return Upload.LIST_IGNORE;
      }
      setUploading(true);
      return true;
    },
    customRequest: async (options) => {
      const { file, onSuccess, onError } = options;
      const formData = new FormData();
      formData.append('file', file as File);
      try {
        await api.post('/templates', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        onSuccess?.({}, new XMLHttpRequest());
        setUploading(false);
        message.success('Plantilla subida correctamente');
        fetchTemplates();
      } catch (err: any) {
        onError?.(err);
        setUploading(false);
        const msg = err?.response?.data?.message || 'Error al subir la plantilla';
        message.error(msg);
      }
    },
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-VE');
    } catch {
      return iso;
    }
  };

  const selectedGrade = grades.find(g => g.id === selectedGradeId);

  // Templates list (filtered to the selected grade, if any).
  const templatesColumns = [
    {
      title: 'Plantilla',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <FileExcelOutlined style={{ color: '#059669' }} />
          <Text>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Tamaño',
      dataIndex: 'size',
      key: 'size',
      width: 110,
      render: (size: number) => <Text type="secondary">{formatSize(size)}</Text>,
    },
    {
      title: 'Modificada',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (d: string) => <Text type="secondary">{formatDate(d)}</Text>,
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 240,
      render: (_: any, record: TemplateInfo) => {
        const assignedToGrade = selectedGradeId
          ? assignments[String(selectedGradeId)] === record.name
          : false;
        return (
          <Space wrap>
            <Button
              size="small"
              type={selectedTemplate === record.name ? 'primary' : 'default'}
              onClick={() => onSelect(selectedTemplate === record.name ? '' : record.name)}
            >
              {selectedTemplate === record.name ? 'Seleccionada' : 'Seleccionar'}
            </Button>
            {selectedGradeId && (
              <Button
                size="small"
                type={assignedToGrade ? 'primary' : 'dashed'}
                icon={assignedToGrade ? <DisconnectOutlined /> : <LinkOutlined />}
                onClick={async () => {
                  const key = String(selectedGradeId);
                  if (assignedToGrade) {
                    await assignToKey(key, '');
                  } else {
                    await assignToKey(key, record.name);
                  }
                }}
                title={`Asignar a todo el grado ${selectedGrade?.name}`}
              >
                {assignedToGrade ? 'Quitar asignación' : 'Asignar a grado'}
              </Button>
            )}
            <Popconfirm
              title="¿Eliminar esta plantilla?"
              description="No se puede deshacer."
              onConfirm={() => handleDelete(record.name)}
              okText="Sí, eliminar"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  // Assignments table: shows current grade -> template mapping
  const assignmentRows = grades.map((g) => ({
    key: `g-${g.id}`,
    gradeId: g.id,
    scope: g.name,
    templateName: assignments[String(g.id)] || null,
  }));

  // Certified period options
  const certifiedPeriods = [
    { key: 'pre2018', label: 'Pre 2018' },
    { key: 'actual', label: 'Actual' },
  ];

  const renderPeriodPopover = (periodKey: string, _periodLabel: string) => {
    const currentTemplateName = certifiedAssignments[periodKey] || null;
    const isAssigned = !!currentTemplateName;
    const content = (
      <div style={{ width: 280 }}>
        <List
          size="small"
          dataSource={templates}
          locale={{ emptyText: 'No hay plantillas subidas' }}
          renderItem={(tpl) => (
            <List.Item
              actions={[
                <Button
                  key="pick"
                  size="small"
                  type={currentTemplateName === tpl.name ? 'primary' : 'default'}
                  onClick={async () => { await assignCertified(periodKey, tpl.name); }}
                >
                  {currentTemplateName === tpl.name ? 'Asignada' : 'Asignar'}
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<FileExcelOutlined style={{ color: '#059669' }} />}
                title={<Text style={{ fontSize: 13 }}>{tpl.name}</Text>}
              />
            </List.Item>
          )}
        />
        {isAssigned && (
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Button
              size="small"
              danger
              icon={<DisconnectOutlined />}
              onClick={async () => { await assignCertified(periodKey, ''); }}
            >
              Quitar asignación
            </Button>
          </div>
        )}
      </div>
    );
    return (
      <Popover
        content={content}
        trigger="click"
        placement="left"
        title="Seleccionar plantilla"
        open={openPopoverPeriod === periodKey}
        onOpenChange={(visible) => setOpenPopoverPeriod(visible ? periodKey : null)}
      >
        <Button size="small" icon={<SwapOutlined />}>
          Cambiar
        </Button>
      </Popover>
    );
  };

  const modalTitle = mode === 'certified'
    ? 'Gestión de plantillas (Notas Certificadas)'
    : 'Gestión de plantillas (Resumen de Rendimiento)';

  return (
    <Modal
      title={modalTitle}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>Cerrar</Button>,
      ]}
      width={860}
    >
      <Tabs
        defaultActiveKey={mode === 'certified' ? 'files' : 'assignments'}
        items={[
          {
            key: 'files',
            label: 'Archivos',
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Upload.Dragger {...uploadProps}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined style={{ color: '#059669' }} />
                    </p>
                    <p className="ant-upload-text">Haz click o arrastra un archivo Excel aquí</p>
                    <p className="ant-upload-hint">
                      Solo se aceptan archivos .xlsx o .xls (máx 10MB). El nombre se sanitiza automáticamente.
                    </p>
                  </Upload.Dragger>
                  {uploading && <div style={{ marginTop: 8 }}><Text type="secondary">Subiendo…</Text></div>}
                </div>

                {mode === 'resumen' && grades.length > 0 && (
                  <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Text strong>Asignar a:</Text>
                    <Select
                      placeholder="Seleccione un año"
                      style={{ minWidth: 180 }}
                      value={selectedGradeId}
                      onChange={(v) => setSelectedGradeId(v ?? null)}
                      options={grades.map(g => ({ label: g.name, value: g.id }))}
                      allowClear
                    />
                    {selectedGradeId && (
                      <Tag color="blue">
                        Asignando a todo {selectedGrade?.name}
                      </Tag>
                    )}
                  </div>
                )}

                {templates.length === 0 && !loading ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No hay plantillas. Sube la primera con el cuadro de arriba."
                  />
                ) : (
                  <Table
                    rowKey="name"
                    loading={loading}
                    dataSource={templates}
                    columns={templatesColumns}
                    pagination={false}
                    size="small"
                    locale={{ emptyText: 'No hay plantillas' }}
                  />
                )}
              </>
            ),
          },
          ...(mode === 'resumen' ? [{
            key: 'assignments',
            label: 'Asignar por Año',
            children: (
              <>
                {assignmentRows.length === 0 ? (
                  <Empty description="No hay años configurados" />
                ) : (
                  <Table
                    rowKey="key"
                    loading={loading}
                    dataSource={assignmentRows}
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: 'Año',
                        dataIndex: 'scope',
                        key: 'scope',
                      },
                      {
                        title: 'Plantilla asignada',
                        dataIndex: 'templateName',
                        key: 'templateName',
                        render: (name: string | null) =>
                          name ? <Tag color="green">{name}</Tag> : <Text type="secondary">Sin plantilla</Text>,
                      },
                      {
                        title: '',
                        key: 'actions',
                        width: 120,
                        render: (_: any, row: any) => {
                          const gradeKey = String(row.gradeId);
                          const currentTemplateName = assignments[gradeKey] || null;
                          const isAssigned = !!currentTemplateName;
                          const content = (
                            <div style={{ width: 280 }}>
                              <List
                                size="small"
                                dataSource={templates}
                                locale={{ emptyText: 'No hay plantillas subidas' }}
                                renderItem={(tpl) => (
                                  <List.Item
                                    actions={[
                                      <Button
                                        key="pick"
                                        size="small"
                                        type={currentTemplateName === tpl.name ? 'primary' : 'default'}
                                        onClick={async () => {
                                          await assignToKey(gradeKey, tpl.name);
                                        }}
                                      >
                                        {currentTemplateName === tpl.name ? 'Asignada' : 'Asignar'}
                                      </Button>,
                                    ]}
                                  >
                                    <List.Item.Meta
                                      avatar={<FileExcelOutlined style={{ color: '#059669' }} />}
                                      title={<Text style={{ fontSize: 13 }}>{tpl.name}</Text>}
                                    />
                                  </List.Item>
                                )}
                              />
                              {isAssigned && (
                                <div style={{ marginTop: 8, textAlign: 'right' }}>
                                  <Button
                                    size="small"
                                    danger
                                    icon={<DisconnectOutlined />}
                                    onClick={async () => { await assignToKey(gradeKey, ''); }}
                                  >
                                    Quitar asignación
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                          return (
                            <Popover
                              content={content}
                              trigger="click"
                              placement="left"
                              title="Seleccionar plantilla"
                              open={openPopoverGradeId === row.gradeId}
                              onOpenChange={(visible) => setOpenPopoverGradeId(visible ? row.gradeId : null)}
                            >
                              <Button size="small" icon={<SwapOutlined />}>
                                Cambiar
                              </Button>
                            </Popover>
                          );
                        },
                      },
                    ]}
                  />
                )}
              </>
            ),
          }] : []),
          ...(mode === 'certified' ? [{
            key: 'certified-assignments',
            label: 'Asignar por Periodo',
            children: (
              <Table
                rowKey="key"
                loading={loading}
                dataSource={certifiedPeriods.map(p => ({
                  key: p.key,
                  periodKey: p.key,
                  scope: p.label,
                  templateName: certifiedAssignments[p.key] || null,
                }))}
                pagination={false}
                size="small"
                columns={[
                  {
                    title: 'Periodo',
                    dataIndex: 'scope',
                    key: 'scope',
                  },
                  {
                    title: 'Plantilla asignada',
                    dataIndex: 'templateName',
                    key: 'templateName',
                    render: (name: string | null) =>
                      name ? <Tag color="green">{name}</Tag> : <Text type="secondary">Sin plantilla</Text>,
                  },
                  {
                    title: '',
                    key: 'actions',
                    width: 120,
                    render: (_: any, row: any) => renderPeriodPopover(row.periodKey, row.scope),
                  },
                ]}
              />
            ),
          }] : []),
        ]}
      />

      <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
        <Text style={{ color: '#166534', fontSize: 12 }}>
          • El archivo .xlsx debe contener <strong>named ranges</strong> que el backend usa como guía para rellenar los datos.
        </Text><br />
        <Text style={{ color: '#166534', fontSize: 12 }}>
          • Ejemplos de nombres esperados: <code>inst_name</code>, <code>std_doc_1</code>, <code>grade_2_1</code>, <code>subj_3</code>.
        </Text><br />
        <Text style={{ color: '#166534', fontSize: 12 }}>
          {mode === 'certified'
            ? '• La plantilla se asigna por periodo (Pre 2018 o Actual).'
            : '• La plantilla se asigna por año y aplica a todas las secciones.'}
        </Text>
      </div>
    </Modal>
  );
};

export default TemplateManagerModal;
