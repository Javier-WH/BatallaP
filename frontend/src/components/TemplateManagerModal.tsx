import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Upload, Button, Table, Typography, Space, Popconfirm, message, Empty, Select, Tag, Tabs } from 'antd';
import { DeleteOutlined, FileExcelOutlined, InboxOutlined, LinkOutlined, DisconnectOutlined } from '@ant-design/icons';
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
  sections?: { id: number; name: string }[];
}

export interface TemplateManagerModalProps {
  open: boolean;
  onClose: () => void;
  selectedTemplate?: string | null;
  onSelect: (templateName: string) => void;
  // When provided, restricts the modal to managing assignments for this
  // grade. The modal will show its sections and allow per-section assignment.
  defaultGradeId?: number | null;
  defaultSectionId?: number | null;
}

const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  open,
  onClose,
  selectedTemplate,
  onSelect,
  defaultGradeId,
  defaultSectionId,
}) => {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<GradeOption[]>([]);
      const [selectedGradeId, setSelectedGradeId] = useState<number | null>(defaultGradeId ?? null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(defaultSectionId ?? null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const [tplRes, asgRes, activeRes, periodsRes] = await Promise.all([
        api.get<TemplateInfo[]>('/templates'),
        api.get<Record<string, string>>('/templates/assignments'),
        api.get('/academic/active'),
        api.get('/academic/periods'),
      ]);
      setTemplates(tplRes.data);
      setAssignments(asgRes.data);
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
            sections: g.sections || [],
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
      if (defaultSectionId) setSelectedSectionId(defaultSectionId);
    }
  }, [open, defaultGradeId, defaultSectionId]);

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
      // The key is in the form "gradeId" or "gradeId:sectionId"
      const parts = key.split(':');
      const gradeId = Number(parts[0]);
      const sectionId = parts[1] ? Number(parts[1]) : null;
      if (templateName) {
        await api.post('/templates/assignment', { gradeId, sectionId, templateName });
      } else {
        const qs = sectionId ? `?sectionId=${sectionId}` : '';
        await api.delete(`/templates/assignment/${gradeId}${qs}`);
      }
      message.success(templateName ? 'Plantilla asignada' : 'Asignación eliminada');
      // Refresh assignments
      const asgRes = await api.get<Record<string, string>>('/templates/assignments');
      setAssignments(asgRes.data);
    } catch (error: any) {
      console.error('Error assigning template', error);
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
  const availableSections = selectedGrade?.sections || [];

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
        const assignedToSection = selectedGradeId && selectedSectionId
          ? assignments[`${selectedGradeId}:${selectedSectionId}`] === record.name
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
                type={assignedToSection ? 'primary' : assignedToGrade ? 'default' : 'dashed'}
                icon={assignedToSection ? <DisconnectOutlined /> : <LinkOutlined />}
                onClick={async () => {
                  const key = selectedSectionId
                    ? `${selectedGradeId}:${selectedSectionId}`
                    : String(selectedGradeId);
                  if (assignedToSection) {
                    await assignToKey(key, '');
                  } else {
                    await assignToKey(key, record.name);
                  }
                }}
                title={
                  selectedSectionId
                    ? `Asignar a la sección`
                    : `Asignar a todo el grado`
                }
              >
                {assignedToSection
                  ? 'Quitar de sección'
                  : assignedToGrade
                    ? 'Asignar a sección'
                    : 'Asignar a grado'}
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
  const assignmentRows = grades.map((g) => {
    const gradeAssignment = assignments[String(g.id)] || null;
    const sectionRows = (g.sections || []).map((s) => ({
      key: `${g.id}:${s.id}`,
      gradeId: g.id,
      sectionId: s.id,
      scope: `Sección ${s.name}`,
      templateName: assignments[`${g.id}:${s.id}`] || null,
      inheritedFrom: assignments[`${g.id}:${s.id}`] ? null : gradeAssignment,
    }));
    return { gradeId: g.id, scope: `Grado ${g.name}`, templateName: gradeAssignment, sections: sectionRows };
  });

  return (
    <Modal
      title="Gestión de plantillas (Resumen de Rendimiento)"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>Cerrar</Button>,
      ]}
      width={860}
    >
      <Tabs
        defaultActiveKey="files"
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

                {grades.length > 0 && (
                  <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Text strong>Asignar a:</Text>
                    <Select
                      placeholder="Seleccione un grado"
                      style={{ minWidth: 180 }}
                      value={selectedGradeId}
                      onChange={(v) => {
                        setSelectedGradeId(v);
                        setSelectedSectionId(null);
                      }}
                      options={grades.map(g => ({ label: g.name, value: g.id }))}
                      allowClear
                    />
                    {selectedGradeId && availableSections.length > 0 && (
                      <Select
                        placeholder="Sección (opcional)"
                        style={{ minWidth: 160 }}
                        value={selectedSectionId}
                        onChange={(v) => setSelectedSectionId(v ?? null)}
                        options={availableSections.map(s => ({ label: s.name, value: s.id }))}
                        allowClear
                      />
                    )}
                    {selectedGradeId && (
                      <Tag color="blue">
                        {selectedSectionId
                          ? `Asignando a ${selectedGrade?.name} - ${availableSections.find(s => s.id === selectedSectionId)?.name}`
                          : `Asignando a todo ${selectedGrade?.name}`}
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
          {
            key: 'assignments',
            label: 'Asignaciones por grado',
            children: (
              <>
                {assignmentRows.length === 0 ? (
                  <Empty description="No hay grados configurados" />
                ) : (
                  <Table
                    rowKey={(r) => r.key}
                    loading={loading}
                    dataSource={assignmentRows.flatMap(g => [
                      { key: `g-${g.gradeId}`, scope: g.scope, templateName: g.templateName, gradeId: g.gradeId, sectionId: null },
                      ...g.sections.map(s => ({ key: s.key, scope: `  ↳ ${s.scope}`, templateName: s.templateName, gradeId: g.gradeId, sectionId: s.sectionId, inheritedFrom: (s as any).inheritedFrom })),
                    ])}
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: 'Grado / Sección',
                        dataIndex: 'scope',
                        key: 'scope',
                      },
                      {
                        title: 'Plantilla asignada',
                        dataIndex: 'templateName',
                        key: 'templateName',
                        width: 280,
                        render: (name: string | null) =>
                          name ? <Tag color="green">{name}</Tag> : <Text type="secondary">Sin plantilla</Text>,
                      },
                      {
                        title: 'Acciones',
                        key: 'actions',
                        width: 220,
                        render: (_: any, row: any) => {
                          const key = row.sectionId
                            ? `${row.gradeId}:${row.sectionId}`
                            : String(row.gradeId);
                          const isAssigned = !!row.templateName;
                          return (
                            <Space>
                              <Button
                                size="small"
                                danger={isAssigned}
                                onClick={async () => {
                                  if (isAssigned) await assignToKey(key, '');
                                  else {
                                    // Quick assign: use currently selected template
                                    if (selectedTemplate) {
                                      await assignToKey(key, selectedTemplate);
                                    } else {
                                      message.info('Selecciona una plantilla primero (botón "Seleccionar" en la pestaña Archivos)');
                                    }
                                  }
                                }}
                              >
                                {isAssigned ? 'Desasignar' : 'Asignar selección'}
                              </Button>
                            </Space>
                          );
                        },
                      },
                    ]}
                  />
                )}
              </>
            ),
          },
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
          • Puedes asignar una plantilla a un <strong>grado entero</strong> o a una <strong>sección específica</strong>.
        </Text>
      </div>
    </Modal>
  );
};

export default TemplateManagerModal;