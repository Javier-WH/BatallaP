import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Upload, Button, Table, Typography, Space, Popconfirm, message, Empty, Select, Tag, Tabs, Popover, List, Collapse } from 'antd';
import { DeleteOutlined, FileExcelOutlined, DisconnectOutlined, SwapOutlined, UploadOutlined } from '@ant-design/icons';
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
  // Required for the "Profesores Firmantes" tab (group signer selection).
  schoolPeriodId?: number | null;
}

const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  open,
  onClose,
  selectedTemplate,
  onSelect,
  mode = 'resumen',
  schoolPeriodId,
}) => {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [certifiedAssignments, setCertifiedAssignments] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openPopoverGradeId, setOpenPopoverGradeId] = useState<number | null>(null);
  const [openPopoverPeriod, setOpenPopoverPeriod] = useState<string | null>(null);
  const [groupTeachers, setGroupTeachers] = useState<any[]>([]);
  const [groupSignerSaving, setGroupSignerSaving] = useState(false);

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

  // Fetch group teachers for the "Profesores Firmantes" tab.
  // Loads data for all grades of the active period.
  const fetchGroupTeachers = useCallback(async () => {
    if (!schoolPeriodId || grades.length === 0) {
      setGroupTeachers([]);
      return;
    }
    try {
      const results = await Promise.all(
        grades.map(async (g) => {
          const res = await api.get('/performance-summary/group-teachers', {
            params: { schoolPeriodId, gradeId: g.id },
          });
          return { gradeId: g.id, gradeName: g.name, groups: res.data || [] };
        })
      );
      setGroupTeachers(results.filter((r: any) => r.groups.length > 0));
    } catch (error) {
      console.error('Error fetching group teachers', error);
      setGroupTeachers([]);
    }
  }, [schoolPeriodId, grades]);

  useEffect(() => {
    if (open && mode === 'resumen' && schoolPeriodId) {
      fetchGroupTeachers();
    }
  }, [open, mode, schoolPeriodId, fetchGroupTeachers]);

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

  const saveGroupSigner = async (gradeId: number, subjectGroupId: number, personId: number | null) => {
    if (!schoolPeriodId) return;
    setGroupSignerSaving(true);
    try {
      await api.post('/performance-summary/group-signer', {
        schoolPeriodId,
        gradeId,
        subjectGroupId,
        personId,
      });
      // Update local state to reflect the change immediately
      setGroupTeachers(prev => prev.map((gt: any) => {
        if (gt.gradeId !== gradeId) return gt;
        return {
          ...gt,
          groups: gt.groups.map((g: any) =>
            g.subjectGroupId === subjectGroupId
              ? { ...g, currentSignerPersonId: personId }
              : g
          ),
        };
      }));
      message.success(personId ? 'Profesor firmante guardado' : 'Asignación eliminada');
    } catch (error: any) {
      console.error('Error saving group signer', error);
      message.error(error?.response?.data?.message || 'Error al guardar el profesor firmante');
    } finally {
      setGroupSignerSaving(false);
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

  // Templates list (filtered to the selected grade, if any).
  const templatesColumns = [
    {
      title: 'Plantillas',
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
      width: 100,
      render: (_: any, record: TemplateInfo) => (
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
      ),
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
    ? 'Configuración (Notas Certificadas)'
    : 'Configuración';

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
        defaultActiveKey={mode === 'certified' ? 'files' : 'signers'}
        items={[
          // ─── Profesores Firmantes tab (resumen mode only) ───
          ...(mode === 'resumen' ? [{
            key: 'signers',
            label: 'Profesores Firmantes',
            children: (
              <>
                {groupTeachers.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No hay grupos de materias que requieran selección de profesor firmante."
                  />
                ) : (
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                      Seleccione qué profesor firmará por cada grupo de materias en el resumen de rendimiento.
                      Esta asignación es por grado y se mantiene para todas las exportaciones.
                    </Text>
                    {groupTeachers.map((gt: any) => (
                      <div key={gt.gradeId} style={{ marginBottom: 20 }}>
                        <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
                          {gt.gradeName}
                        </Text>
                        {gt.groups.map((g: any) => {
                          // Collect all unique teachers across subjects in the group
                          const allTeachers: { personId: number; fullName: string }[] = [];
                          for (const subj of g.subjects) {
                            for (const t of subj.teachers) {
                              if (!allTeachers.some((at: any) => at.personId === t.personId)) {
                                allTeachers.push(t);
                              }
                            }
                          }
                          return (
                            <div key={g.subjectGroupId} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                              <Text style={{ minWidth: 200, fontSize: 13 }}>
                                {g.subjectGroupName}:
                              </Text>
                              <Select
                                style={{ minWidth: 240 }}
                                placeholder="Seleccione un profesor"
                                value={g.currentSignerPersonId ?? undefined}
                                loading={groupSignerSaving}
                                onChange={(personId: number | null) => saveGroupSigner(gt.gradeId, g.subjectGroupId, personId)}
                                options={allTeachers.map((t: any) => ({
                                  label: t.fullName,
                                  value: t.personId,
                                }))}
                                allowClear
                                showSearch
                                optionFilterProp="label"
                              />
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                ({g.subjects.length} materias)
                              </Text>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ),
          }] : []),
          // ─── Plantillas tab (resumen mode) / Archivos tab (certified mode) ───
          {
            key: 'files',
            label: mode === 'certified' ? 'Archivos' : 'Plantillas',
            children: (
              <>
                {/* Resumen mode: "Asignación por año" always visible first,
                    then templates list + upload in a collapsible panel below. */}
                {mode === 'resumen' && assignmentRows.length > 0 && (
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

                {/* Templates list + upload button.
                    In resumen mode: inside a Collapse (closed by default).
                    In certified mode: always visible. */}
                {mode === 'resumen' ? (
                  <Collapse
                    style={{ marginTop: 16 }}
                    items={[{
                      key: 'templates',
                      label: 'Plantillas subidas',
                      children: (
                        <>
                          <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Upload {...uploadProps} accept=".xlsx,.xls" showUploadList={false}>
                              <Button icon={<UploadOutlined />} loading={uploading}>
                                Subir plantilla
                              </Button>
                            </Upload>
                            {uploading && <Text type="secondary">Subiendo…</Text>}
                          </div>

                          {templates.length === 0 && !loading ? (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description="No hay plantillas. Sube la primera con el botón de arriba."
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
                    }]}
                  />
                ) : (
                  <>
                    <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Upload {...uploadProps} accept=".xlsx,.xls" showUploadList={false}>
                        <Button icon={<UploadOutlined />} loading={uploading}>
                          Subir plantilla
                        </Button>
                      </Upload>
                      {uploading && <Text type="secondary">Subiendo…</Text>}
                    </div>

                    {templates.length === 0 && !loading ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No hay plantillas. Sube la primera con el botón de arriba."
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
                )}
              </>
            ),
          },
          ...(mode === 'certified' ? [{
            key: 'certified-assignments',
            label: 'Plantillas por Periodo',
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
