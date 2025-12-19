/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Card, Tabs, Table, Button, Modal, Form, Input, Tag, message, Select, Space, Row, Col, Popconfirm, Checkbox } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, BookOutlined, AppstoreOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '@/services/api';

interface Period {
  id: number;
  period: string;
  name: string;
  isActive?: boolean;
}

interface BaseCatalogItem {
  id: number;
  name: string;
}

interface Grade extends BaseCatalogItem {
  isDiversified: boolean;
}

type Section = BaseCatalogItem;

type SubjectGroup = BaseCatalogItem;

interface Subject extends BaseCatalogItem {
  subjectGroupId?: number | null;
  subjectGroup?: SubjectGroup | null;
}

type Specialization = BaseCatalogItem;

interface PeriodGradeStructureItem {
  id: number;
  gradeId: number;
  grade?: Grade;
  specialization?: Specialization | null;
  sections?: Section[];
  subjects?: Subject[];
}

type CatalogType = 'grade' | 'section' | 'subject' | 'specialization';

type CatalogItem = Grade | Section | Subject | Specialization;

const { TabPane } = Tabs;

const AcademicManagement: React.FC = () => {
  // State
  const [periods, setPeriods] = useState<Period[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<number | null>(null); // For structure view
  const [structure, setStructure] = useState<PeriodGradeStructureItem[]>([]);



  // UI State
  const [isPeriodModalVisible, setIsPeriodModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forms
  const [periodForm] = Form.useForm();
  const [gradeCatalogForm] = Form.useForm();
  const [sectionCatalogForm] = Form.useForm();
  const [subjectCatalogForm] = Form.useForm();
  const [subjectGroupForm] = Form.useForm();

  const [editPeriodVisible, setEditPeriodVisible] = useState(false);
  const [editPeriodForm] = Form.useForm();
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);

  const [deletePeriodVisible, setDeletePeriodVisible] = useState(false);
  const [periodToDelete, setPeriodToDelete] = useState<Period | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [specializationModalVisible, setSpecializationModalVisible] = useState(false);
  const [selectedGradeForStructure, setSelectedGradeForStructure] = useState<Grade | null>(null);
  const [selectedSpecializationId, setSelectedSpecializationId] = useState<number | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [pRes, gRes, sRes, subRes, specRes, sgRes] = await Promise.all([
        api.get<Period[]>('/academic/periods'),
        api.get<Grade[]>('/academic/grades'),
        api.get<Section[]>('/academic/sections'),
        api.get<Subject[]>('/academic/subjects'),
        api.get<Specialization[]>('/academic/specializations'),
        api.get<SubjectGroup[]>('/academic/subject-groups'),
      ]);
      const periodsData = pRes.data;

      setPeriods(periodsData);
      setGrades(gRes.data);
      setSections(sRes.data);
      setSubjects(subRes.data);
      setSpecializations(specRes.data);
      setSubjectGroups(sgRes.data);

      // Always sync activePeriodId with current active period (or first available)
      if (periodsData.length > 0) {
        const active = periodsData.find((p) => p.isActive) ?? periodsData[0];
        setActivePeriodId(active.id);
      } else {
        setActivePeriodId(null);
      }

    } catch (error) {
      console.error(error);
      message.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const openEditPeriod = (period: Period) => {
    setEditingPeriod(period);
    editPeriodForm.setFieldsValue({ period: period.period, name: period.name });
    setEditPeriodVisible(true);
  };

  const handleEditPeriod = async (values: { name: string }) => {
    if (!editingPeriod) return;
    try {
      await api.put(`/academic/periods/${editingPeriod.id}`, {
        period: editingPeriod.period,
        name: values.name,
      });
      message.success('Periodo actualizado');
      setEditPeriodVisible(false);
      setEditingPeriod(null);
      fetchAll();
    } catch (error) {
      console.error(error);
      message.error('Error actualizando periodo');
    }
  };

  const openDeletePeriod = (period: Period) => {
    setPeriodToDelete(period);
    setDeleteConfirmText('');
    setDeletePeriodVisible(true);
  };

  const handleDeletePeriod = async (id: number) => {
    try {
      await api.delete(`/academic/periods/${id}`);
      message.success('Periodo eliminado');
      if (activePeriodId === id) {
        setActivePeriodId(null);
        setStructure([]);
      }
      fetchAll();
    } catch (error) {
      console.error(error);
      message.error('Error eliminando periodo (posiblemente en uso), ' + error);
    }
  };

  const fetchStructure = async () => {
    if (!activePeriodId) return;
    try {
      const res = await api.get<PeriodGradeStructureItem[]>(`/academic/structure/${activePeriodId}`);
      setStructure(res.data);
    } catch (error) {
      console.error(error);
      message.error('Error cargando estructura');
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    fetchStructure();
  }, [activePeriodId]);

  // --- Actions ---

  const handleCreatePeriod = async (values: { period: string; name: string }) => {
    try {
      const { period, name } = values;
      if (periods.some((p) => p.period === period)) {
        message.error('Ese periodo ya existe');
        return;
      }
      await api.post('/academic/periods', { period, name });
      message.success('Periodo creado');
      setIsPeriodModalVisible(false);
      periodForm.resetFields();
      fetchAll();
    } catch (error) {
      console.error(error);
      message.error('Error creando periodo');
    }
  };

  const handleActivatePeriod = async (id: number) => {
    try {
      await api.put(`/academic/periods/${id}/activate`);
      message.success('Periodo activado');
      fetchAll();
    } catch (error) {
      console.error(error);
      message.error('Error activando periodo');
    }
  };

  const handleAddGradeToStructure = async (gradeId: number) => {
    if (!activePeriodId) return message.warning('Seleccione un periodo');

    const grade = grades.find((g) => g.id === gradeId);

    // Si el grado está marcado como diversificado, pedimos mención antes de crear
    if (grade && grade.isDiversified) {
      setSelectedGradeForStructure(grade);
      setSelectedSpecializationId(null);
      setSpecializationModalVisible(true);
      return;
    }

    try {
      await api.post('/academic/structure/period-grade', { schoolPeriodId: activePeriodId, gradeId });
      message.success('Grado agregado al periodo');
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error agregando grado');
    }
  };

  const handleConfirmDiversifiedGrade = async () => {
    if (!activePeriodId || !selectedGradeForStructure) return;
    if (!selectedSpecializationId) {
      message.warning('Seleccione una especialización');
      return;
    }

    try {
      await api.post('/academic/structure/period-grade', {
        schoolPeriodId: activePeriodId,
        gradeId: selectedGradeForStructure.id,
        specializationId: selectedSpecializationId,
      });
      message.success('Grado diversificado agregado al periodo');
      setSpecializationModalVisible(false);
      setSelectedGradeForStructure(null);
      setSelectedSpecializationId(null);
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error agregando grado diversificado');
    }
  };

  const handleRemoveGradeFromStructure = async (pgId: number) => {
    try {
      await api.delete(`/academic/structure/period-grade/${pgId}`);
      message.success('Grado eliminado del periodo');
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error eliminando grado');
    }
  };

  const handleAddSectionToGrade = async (periodGradeId: number, sectionId: number) => {
    try {
      await api.post('/academic/structure/section', { periodGradeId, sectionId });
      message.success('Sección agregada');
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error agregando sección');
    }
  };

  const handleRemoveSectionFromGrade = async (periodGradeId: number, sectionId: number) => {
    try {
      await api.post('/academic/structure/section/remove', { periodGradeId, sectionId });
      message.success('Sección removida');
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error removiendo sección');
    }
  };

  const handleAddSubjectToGrade = async (periodGradeId: number, subjectId: number) => {
    try {
      await api.post('/academic/structure/subject', { periodGradeId, subjectId });
      message.success('Materia agregada');
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error agregando materia');
    }
  };

  const handleRemoveSubjectFromGrade = async (periodGradeId: number, subjectId: number) => {
    try {
      await api.post('/academic/structure/subject/remove', { periodGradeId, subjectId });
      message.success('Materia removida');
      fetchStructure();
    } catch (error) {
      console.error(error);
      message.error('Error removiendo materia');
    }
  };

  // --- Columns ---

  const periodColumns = [
    { title: 'Periodo', dataIndex: 'period', key: 'period' },
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    {
      title: 'Estado',
      key: 'status',
      render: (_: unknown, r: Period) => r.isActive ? <Tag color="green">ACTIVO</Tag> : <Tag>INACTIVO</Tag>
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, r: Period) => (
        <Space>
          {!r.isActive && (
            <Button type="text" size="small" onClick={() => handleActivatePeriod(r.id)} icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} />
          )}
          <Button type="text" size="small" onClick={() => openEditPeriod(r)} icon={<EditOutlined />} />
          <Button type="text" size="small" danger onClick={() => openDeletePeriod(r)} icon={<DeleteOutlined />} />
        </Space>
      )
    }
  ];

  // --- Catalog Actions ---

  // State for editing catalogs
  const [editCatalogVisible, setEditCatalogVisible] = useState(false);
  const [editCatalogTarget, setEditCatalogTarget] = useState<{ type: CatalogType; id: number; name: string } | null>(null);
  const [editCatalogForm] = Form.useForm();

  const openEditCatalog = (type: CatalogType, record: CatalogItem) => {
    setEditCatalogTarget({ type, id: record.id, name: record.name });

    if (type === 'grade') {
      const gradeRecord = record as Grade;
      editCatalogForm.setFieldsValue({
        name: gradeRecord.name,
        isDiversified: gradeRecord.isDiversified,
      });
    } else if (type === 'subject') {
      const subjectRecord = record as Subject;
      editCatalogForm.setFieldsValue({
        name: subjectRecord.name,
        subjectGroupId: subjectRecord.subjectGroupId ?? null,
      });
    } else {
      editCatalogForm.setFieldsValue({ name: record.name });
    }
    setEditCatalogVisible(true);
  };

  const handleEditCatalog = async (values: { name: string; isDiversified?: boolean; subjectGroupId?: number | null }) => {
    if (!editCatalogTarget) return;
    try {
      let url = '';
      switch (editCatalogTarget.type) {
        case 'grade': url = '/academic/grades'; break;
        case 'section': url = '/academic/sections'; break;
        case 'subject': url = '/academic/subjects'; break;
        case 'specialization': url = '/academic/specializations'; break;
      }
      // Para grados, enviamos también isDiversified; para el resto solo name
      if (editCatalogTarget.type === 'grade') {
        await api.put(`${url}/${editCatalogTarget.id}`, {
          name: values.name,
          isDiversified: values.isDiversified ?? false,
        });
      } else if (editCatalogTarget.type === 'subject') {
        await api.put(`${url}/${editCatalogTarget.id}`, {
          name: values.name,
          subjectGroupId: values.subjectGroupId ?? null,
        });
      } else {
        await api.put(`${url}/${editCatalogTarget.id}`, { name: values.name });
      }
      message.success('Actualizado exitosamente');
      setEditCatalogVisible(false);
      fetchAll();
    } catch (error) {
      console.error(error);
      message.error('Error actualizando => ' + error);
    }
  };

  const handleDeleteCatalog = async (type: CatalogType, id: number) => {
    try {
      let url = '';
      switch (type) {
        case 'grade': url = '/academic/grades'; break;
        case 'section': url = '/academic/sections'; break;
        case 'subject': url = '/academic/subjects'; break;
      }
      await api.delete(`${url}/${id}`);
      message.success('Eliminado exitosamente');
      fetchAll();
    } catch (error) {
      console.error(error);
      const err = error as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || 'Error eliminando (posiblemente en uso)');
    }
  };

  // Columns for Catalogs
  const catalogColumns = (type: CatalogType) => [
    {
      title: 'Nombre',
      dataIndex: 'name',
      render: (text: string, record: CatalogItem) => {
        if (type === 'grade' && 'isDiversified' in record && (record as Grade).isDiversified) {
          return (
            <Space>
              <span>{text}</span>
              <Tag color="purple" style={{ borderRadius: 12 }}>Diversificado</Tag>
            </Space>
          );
        }
        if (type === 'subject') {
          const subjectRecord = record as Subject;
          if (subjectRecord.subjectGroup) {
            return (
              <Space>
                <span>{text}</span>
                <Tag color="blue" style={{ borderRadius: 12 }}>{subjectRecord.subjectGroup.name}</Tag>
              </Space>
            );
          }
        }
        return text;
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 100,
      render: (_: unknown, r: CatalogItem) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditCatalog(type, r)} />
          <Popconfirm title="¿Eliminar?" onConfirm={() => handleDeleteCatalog(type, r.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  // --- Render ---

  const activePeriod = periods.find((p) => p.isActive);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Card title="Gestión Académica">
        {activePeriod && (
          <div style={{ marginBottom: 12 }}>
            <Tag color="blue">
              Periodo activo: <strong>{activePeriod.period}</strong> - {activePeriod.name}
            </Tag>
          </div>
        )}
        <Tabs defaultActiveKey="1">
          {/* PERIODS TAB */}
          <TabPane tab="Periodos Escolares" key="1">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsPeriodModalVisible(true)} style={{ marginBottom: 16 }}>
              Nuevo Periodo
            </Button>
            <Table
              dataSource={periods}
              columns={periodColumns}
              rowKey="id"
              loading={loading}
              rowClassName={(record: Period) => (record.isActive ? 'active-period-row' : '')}
            />
          </TabPane>

          {/* STRUCTURE TAB */}
          <TabPane tab="Estructura (Grados y Secciones)" key="2">
            {activePeriodId && (
              <Row gutter={[16, 16]}>
                {/* Grade Adder */}
                <Col span={24}>
                  <Card size="small" title="Agregar Grado a este Periodo">
                    <Space>
                      <Select
                        placeholder="Seleccionar Grado del Catálogo"
                        style={{ width: 250 }}
                        onChange={handleAddGradeToStructure}
                        // Filter out already added grades (by gradeId + specializationId when applicable)
                        options={grades.map((g) => ({ label: g.name, value: g.id }))}
                      />
                    </Space>
                  </Card>
                </Col>

                {/* List of Active Grades in Period */}
                {structure.map((item: PeriodGradeStructureItem) => (
                  <Col span={12} key={item.id}>
                    <Card
                      title={`${item.grade?.name ?? ''}${item.specialization ? ` - ${item.specialization.name}` : ''}`}
                      style={{ border: '1px solid #d9d9d9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                      headStyle={{ backgroundColor: '#fafafa', borderBottom: '1px solid #d9d9d9' }}
                      extra={
                        <Popconfirm title="Eliminar grado y todo su contenido?" onConfirm={() => handleRemoveGradeFromStructure(item.id)}>
                          <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      }
                      actions={[
                        <div style={{ padding: '0 16px', textAlign: 'left' }}>
                          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Agregar Sección:</div>
                          <Select
                            size="small"
                            placeholder="+ Sección"
                            style={{ width: '100%' }}
                            onChange={(val) => handleAddSectionToGrade(item.id, val)}
                            options={sections
                              .filter((s) => !item.sections?.some((is: Section) => is.id === s.id))
                              .map((s) => ({ label: s.name, value: s.id }))
                            }
                          />
                        </div>,
                        <div style={{ padding: '0 16px', textAlign: 'left' }}>
                          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Agregar Materia:</div>
                          <Select
                            size="small"
                            placeholder="+ Materia"
                            style={{ width: '100%' }}
                            onChange={(val) => handleAddSubjectToGrade(item.id, val)}
                            options={subjects
                              .filter((s) => !item.subjects?.some((is: Subject) => is.id === s.id))
                              .map((s) => ({ label: s.name, value: s.id }))
                            }
                          />
                        </div>
                      ]}
                    >
                      <Row gutter={16}>
                        <Col span={12}>
                          <h4>Secciones:</h4>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {item.sections?.map((sec: Section) => (
                              <div key={sec.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <Space><AppstoreOutlined style={{ color: '#1890ff' }} /> {sec.name}</Space>
                                <DeleteOutlined
                                  style={{ color: '#ff4d4f', cursor: 'pointer' }}
                                  onClick={() => handleRemoveSectionFromGrade(item.id, sec.id)}
                                />
                              </div>
                            ))}
                            {(!item.sections || item.sections.length === 0) && <span style={{ color: '#ccc' }}>Sin secciones</span>}
                          </Space>
                        </Col>
                        <Col span={12} style={{ borderLeft: '1px solid #f0f0f0' }}>
                          <h4>Materias:</h4>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {item.subjects?.map((sub: Subject) => (
                              <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <Space><BookOutlined /> {sub.name}</Space>
                                <DeleteOutlined
                                  style={{ color: '#ff4d4f', cursor: 'pointer' }}
                                  onClick={() => handleRemoveSubjectFromGrade(item.id, sub.id)}
                                />
                              </div>
                            ))}
                            {(!item.subjects || item.subjects.length === 0) && <span style={{ color: '#ccc' }}>Sin materias</span>}
                          </Space>
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </TabPane>

          {/* CATALOGS TAB */}
          <TabPane tab="Catálogos Globales" key="3">
            <Row gutter={24}>
              <Col span={8}>
                <Card
                  title="Grados"
                  style={{ border: '1px solid #d9d9d9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                  headStyle={{ backgroundColor: '#fafafa', borderBottom: '1px solid #d9d9d9' }}
                >
                  <Form form={gradeCatalogForm} layout="inline" onFinish={async (v) => {
                    await api.post('/academic/grades', v);
                    message.success('Grado creado');
                    gradeCatalogForm.resetFields();
                    fetchAll();
                  }}>
                    <Form.Item name="name" rules={[{ required: true }]} style={{ width: 150 }}><Input placeholder="Nombre" /></Form.Item>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />} />
                  </Form>
                  <Table
                    dataSource={grades}
                    rowKey="id"
                    size="small"
                    style={{ marginTop: 16 }}
                    columns={catalogColumns('grade')}
                    pagination={{ pageSize: 5 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  title="Secciones"
                  style={{ border: '1px solid #d9d9d9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                  headStyle={{ backgroundColor: '#fafafa', borderBottom: '1px solid #d9d9d9' }}
                >
                  <Form form={sectionCatalogForm} layout="inline" onFinish={async (v) => {
                    await api.post('/academic/sections', v);
                    message.success('Sección creada');
                    sectionCatalogForm.resetFields();
                    fetchAll();
                  }}>
                    <Form.Item name="name" rules={[{ required: true }]} style={{ width: 150 }}><Input placeholder="Nombre" /></Form.Item>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />} />
                  </Form>
                  <Table
                    dataSource={sections}
                    rowKey="id"
                    size="small"
                    style={{ marginTop: 16 }}
                    columns={catalogColumns('section')}
                    pagination={{ pageSize: 5 }}
                  />
                </Card>
              </Col>

              {/* Subjects */}
              <Col span={8}>
                <Card
                  title="Materias"
                  style={{ border: '1px solid #d9d9d9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                  headStyle={{ backgroundColor: '#fafafa', borderBottom: '1px solid #d9d9d9' }}
                >
                  <Form form={subjectCatalogForm} layout="inline" onFinish={async (v) => {
                    await api.post('/academic/subjects', v);
                    message.success('Creado');
                    subjectCatalogForm.resetFields();
                    fetchAll();
                  }}>
                    <Form.Item name="name" rules={[{ required: true }]} style={{ width: 150 }}><Input placeholder="Nombre" /></Form.Item>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />} />
                  </Form>
                  <Table dataSource={subjects} rowKey="id" size="small" style={{ marginTop: 16 }} columns={catalogColumns('subject')} pagination={{ pageSize: 5 }} />
                </Card>

                <Card
                  title="Grupos de Materias"
                  style={{ border: '1px solid #d9d9d9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginTop: 24 }}
                  headStyle={{ backgroundColor: '#fafafa', borderBottom: '1px solid #d9d9d9' }}
                >
                  <Form
                    form={subjectGroupForm}
                    layout="inline"
                    onFinish={async (v) => {
                      await api.post('/academic/subject-groups', v);
                      message.success('Grupo creado');
                      subjectGroupForm.resetFields();
                      fetchAll();
                    }}
                  >
                    <Form.Item name="name" rules={[{ required: true }]} style={{ width: 150 }}>
                      <Input placeholder="Nombre del grupo" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />} />
                  </Form>

                  <Table
                    dataSource={subjectGroups}
                    rowKey="id"
                    size="small"
                    style={{ marginTop: 16 }}
                    columns={[
                      { title: 'Nombre', dataIndex: 'name' },
                      {
                        title: 'Acciones',
                        key: 'actions',
                        width: 100,
                        render: (_: unknown, record: SubjectGroup) => (
                          <Popconfirm
                            title="¿Eliminar grupo?"
                            onConfirm={async () => {
                              try {
                                await api.delete(`/academic/subject-groups/${record.id}`);
                                message.success('Grupo eliminado');
                                fetchAll();
                              } catch (error) {
                                console.error(error);
                                message.error('Error eliminando grupo (posiblemente en uso)');
                              }
                            }}
                          >
                            <Button type="text" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        ),
                      },
                    ]}
                    pagination={{ pageSize: 5 }}
                  />
                </Card>
              </Col>

              {/* Specializations */}
              <Col span={8} style={{ marginTop: 24 }}>
                <Card
                  title="Especializaciones / Menciones"
                  style={{ border: '1px solid #d9d9d9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                  headStyle={{ backgroundColor: '#fafafa', borderBottom: '1px solid #d9d9d9' }}
                >
                  <Form
                    layout="inline"
                    onFinish={async (v) => {
                      await api.post('/academic/specializations', v);
                      message.success('Especialización creada');
                      fetchAll();
                    }}
                  >
                    <Form.Item name="name" rules={[{ required: true }]} style={{ width: 180 }}>
                      <Input placeholder="Ej. Ciencias, Humanidades" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />} />
                  </Form>
                  <Table
                    dataSource={specializations}
                    rowKey="id"
                    size="small"
                    style={{ marginTop: 16 }}
                    columns={catalogColumns('specialization')}
                    pagination={{ pageSize: 5 }}
                  />
                </Card>
              </Col>
            </Row>
          </TabPane>
        </Tabs>
      </Card>

      {/* Create Period Modal */}
      <Modal
        title="Nuevo Periodo Escolar"
        open={isPeriodModalVisible}
        onCancel={() => setIsPeriodModalVisible(false)}
        footer={null}
      >
        <Form form={periodForm} layout="vertical" onFinish={handleCreatePeriod}>
          <Form.Item
            name="period"
            label="Periodo (Año-Año)"
            rules={[{ required: true, message: 'Seleccione el periodo escolar' }]}
          >
            <Select placeholder="Seleccione periodo">
              {(() => {
                const options: string[] = [];
                const currentYear = new Date().getFullYear();
                const maxStart = currentYear;
                const minStart = 2000;
                for (let y = maxStart; y >= minStart; y -= 1) {
                  options.push(`${y}-${y + 1}`);
                }
                return options.map((p) => (
                  <Select.Option key={p} value={p}>{p}</Select.Option>
                ));
              })()}
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="Nombre del Periodo"
            rules={[{ required: true, message: 'Ingrese un nombre descriptivo, ej. Año Escolar 2025-2026' }]}
          >
            <Input placeholder="Año Escolar 2025-2026" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block>Crear Periodo</Button>
        </Form>
      </Modal>

      {/* Edit Catalog Modal */}
      <Modal
        title={editCatalogTarget?.type === 'grade' ? 'Editar Grado' : 'Editar Item'}
        open={editCatalogVisible}
        onCancel={() => setEditCatalogVisible(false)}
        footer={null}
      >
        <Form form={editCatalogForm} layout="vertical" onFinish={handleEditCatalog}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          {editCatalogTarget?.type === 'grade' && (
            <Form.Item name="isDiversified" valuePropName="checked">
              <Checkbox>Diversificado</Checkbox>
            </Form.Item>
          )}

          {editCatalogTarget?.type === 'subject' && (
            <Form.Item name="subjectGroupId" label="Grupo de Materia">
              <Select
                allowClear
                placeholder="Sin grupo"
                options={subjectGroups.map((g) => ({ label: g.name, value: g.id }))}
              />
            </Form.Item>
          )}

          <Button type="primary" htmlType="submit" block>Guardar Cambios</Button>
        </Form>
      </Modal>

      <Modal
        title="Editar Periodo Escolar"
        open={editPeriodVisible}
        onCancel={() => setEditPeriodVisible(false)}
        footer={null}
      >
        <Form form={editPeriodForm} layout="vertical" onFinish={handleEditPeriod}>
          <Form.Item label="Periodo">
            <Input value={editingPeriod?.period} disabled />
          </Form.Item>

          <Form.Item
            name="name"
            label="Nombre del Periodo"
            rules={[{ required: true, message: 'Ingrese un nombre descriptivo, ej. Año Escolar 2025-2026' }]}
          >
            <Input placeholder="Año Escolar 2025-2026" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block>Guardar Cambios</Button>
        </Form>
      </Modal>

      <Modal
        title="Eliminar Periodo Escolar"
        open={deletePeriodVisible}
        onCancel={() => setDeletePeriodVisible(false)}
        onOk={() => periodToDelete && handleDeletePeriod(periodToDelete.id)}
        okButtonProps={{
          danger: true,
          disabled: deleteConfirmText !== 'DELETE',
        }}
        okText="Eliminar definitivamente"
      >
        <p>
          Esta acción <strong>no se puede deshacer</strong>. Se eliminará el periodo{' '}
          <strong>{periodToDelete?.name}</strong> ({periodToDelete?.period}) y{' '}
          <strong>todos los datos relacionados</strong> a este año escolar (estructura, inscripciones, etc.).
        </p>
        <p>Para confirmar, escriba <code>DELETE</code> en el siguiente campo:</p>
        <Input
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder="Escriba DELETE para confirmar"
        />
      </Modal>

      <Modal
        title="Seleccionar Especialización"
        open={specializationModalVisible}
        onCancel={() => {
          setSpecializationModalVisible(false);
          setSelectedGradeForStructure(null);
          setSelectedSpecializationId(null);
        }}
        onOk={handleConfirmDiversifiedGrade}
        okButtonProps={{ disabled: !selectedSpecializationId }}
        okText="Agregar Grado con Mención"
      >
        <p>
          Seleccione la especialización/mención para el grado{' '}
          <strong>{selectedGradeForStructure?.name}</strong> en este periodo.
        </p>
        <Select
          placeholder="Seleccione una especialización"
          style={{ width: '100%' }}
          value={selectedSpecializationId ?? undefined}
          onChange={(val) => setSelectedSpecializationId(val)}
          options={specializations.map((s) => ({ label: s.name, value: s.id }))}
        />
      </Modal>
    </div>
  );
};

export default AcademicManagement;
