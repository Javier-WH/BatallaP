import React, { useState, useEffect } from 'react';
import { Card, Tabs, Table, Button, Modal, Form, Input, Tag, message, Select, Space, Row, Col, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, EditOutlined, BookOutlined, AppstoreOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { TabPane } = Tabs;
const { Option } = Select;

const AcademicManagement: React.FC = () => {
  // State
  const [periods, setPeriods] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]); // New Subject State
  const [activePeriodId, setActivePeriodId] = useState<number | null>(null); // For structure view
  const [structure, setStructure] = useState<any[]>([]);

  // UI State
  const [isPeriodModalVisible, setIsPeriodModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forms
  const [periodForm] = Form.useForm();
  const [gradeCatalogForm] = Form.useForm();
  const [sectionCatalogForm] = Form.useForm();
  const [subjectCatalogForm] = Form.useForm(); // New Form

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [pRes, gRes, sRes, subRes] = await Promise.all([
        api.get('/academic/periods'),
        api.get('/academic/grades'),
        api.get('/academic/sections'),
        api.get('/academic/subjects')
      ]);
      setPeriods(pRes.data);
      setGrades(gRes.data);
      setSections(sRes.data);
      setSubjects(subRes.data);

      // Set default active period for viewing structure
      // Only set if not already set, or validate if current still exists
      if (!activePeriodId) {
        const active = pRes.data.find((p: any) => p.isActive);
        if (active) setActivePeriodId(active.id);
        else if (pRes.data.length > 0) setActivePeriodId(pRes.data[0].id);
      }

    } catch (error) {
      message.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchStructure = async () => {
    if (!activePeriodId) return;
    try {
      const res = await api.get(`/academic/structure/${activePeriodId}`);
      setStructure(res.data);
    } catch (error) {
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

  const handleCreatePeriod = async (values: any) => {
    try {
      await api.post('/academic/periods', values);
      message.success('Periodo creado');
      setIsPeriodModalVisible(false);
      periodForm.resetFields();
      fetchAll();
    } catch (error) {
      message.error('Error creando periodo');
    }
  };

  const handleActivatePeriod = async (id: number) => {
    try {
      await api.put(`/academic/periods/${id}/activate`);
      message.success('Periodo activado');
      fetchAll();
    } catch (error) {
      message.error('Error activando periodo');
    }
  };

  const handleAddGradeToStructure = async (gradeId: number) => {
    if (!activePeriodId) return message.warning('Seleccione un periodo');
    try {
      await api.post('/academic/structure/period-grade', { schoolPeriodId: activePeriodId, gradeId });
      message.success('Grado agregado al periodo');
      fetchStructure();
    } catch (error) {
      message.error('Error agregando grado');
    }
  };

  const handleRemoveGradeFromStructure = async (pgId: number) => {
    try {
      await api.delete(`/academic/structure/period-grade/${pgId}`);
      message.success('Grado eliminado del periodo');
      fetchStructure();
    } catch (error) {
      message.error('Error eliminando grado');
    }
  };

  const handleAddSectionToGrade = async (periodGradeId: number, sectionId: number) => {
    try {
      await api.post('/academic/structure/section', { periodGradeId, sectionId });
      message.success('Sección agregada');
      fetchStructure();
    } catch (error) {
      message.error('Error agregando sección');
    }
  };

  const handleRemoveSectionFromGrade = async (periodGradeId: number, sectionId: number) => {
    try {
      await api.post('/academic/structure/section/remove', { periodGradeId, sectionId });
      message.success('Sección removida');
      fetchStructure();
    } catch (error) {
      message.error('Error removiendo sección');
    }
  };

  const handleAddSubjectToGrade = async (periodGradeId: number, subjectId: number) => {
    try {
      await api.post('/academic/structure/subject', { periodGradeId, subjectId });
      message.success('Materia agregada');
      fetchStructure();
    } catch (error) {
      message.error('Error agregando materia');
    }
  };

  const handleRemoveSubjectFromGrade = async (periodGradeId: number, subjectId: number) => {
    try {
      await api.post('/academic/structure/subject/remove', { periodGradeId, subjectId });
      message.success('Materia removida');
      fetchStructure();
    } catch (error) {
      message.error('Error removiendo materia');
    }
  };

  // --- Columns ---

  const periodColumns = [
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    {
      title: 'Estado',
      key: 'status',
      render: (_: any, r: any) => r.isActive ? <Tag color="green">ACTIVO</Tag> : <Tag>INACTIVO</Tag>
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, r: any) => (
        !r.isActive && (
          <Button type="link" size="small" onClick={() => handleActivatePeriod(r.id)}>
            Activar Año Escolar
          </Button>
        )
      )
    }
  ];

  // --- Catalog Actions ---

  // State for editing catalogs
  const [editCatalogVisible, setEditCatalogVisible] = useState(false);
  const [editCatalogTarget, setEditCatalogTarget] = useState<{ type: 'grade' | 'section' | 'subject', id: number, name: string } | null>(null);
  const [editCatalogForm] = Form.useForm();

  const openEditCatalog = (type: 'grade' | 'section' | 'subject', record: any) => {
    setEditCatalogTarget({ type, id: record.id, name: record.name });
    editCatalogForm.setFieldsValue({ name: record.name });
    setEditCatalogVisible(true);
  };

  const handleEditCatalog = async (values: any) => {
    if (!editCatalogTarget) return;
    try {
      let url = '';
      switch (editCatalogTarget.type) {
        case 'grade': url = '/academic/grades'; break;
        case 'section': url = '/academic/sections'; break;
        case 'subject': url = '/academic/subjects'; break;
      }
      await api.put(`${url}/${editCatalogTarget.id}`, values);
      message.success('Actualizado exitosamente');
      setEditCatalogVisible(false);
      fetchAll();
    } catch (error) {
      message.error('Error actualizando');
    }
  };

  const handleDeleteCatalog = async (type: 'grade' | 'section' | 'subject', id: number) => {
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
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error eliminando (posiblemente en uso)');
    }
  };

  // Columns for Catalogs
  const catalogColumns = (type: 'grade' | 'section' | 'subject') => [
    { title: 'Nombre', dataIndex: 'name' },
    {
      title: 'Acciones',
      key: 'actions',
      width: 100,
      render: (_: any, r: any) => (
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

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Card title="Gestión Académica">
        <Tabs defaultActiveKey="1">
          {/* PERIODS TAB */}
          <TabPane tab="Periodos Escolares" key="1">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsPeriodModalVisible(true)} style={{ marginBottom: 16 }}>
              Nuevo Periodo
            </Button>
            <Table dataSource={periods} columns={periodColumns} rowKey="id" loading={loading} />
          </TabPane>

          {/* STRUCTURE TAB */}
          <TabPane tab="Estructura (Grados y Secciones)" key="2">
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
              <span>Periodo a gestionar:</span>
              <Select
                value={activePeriodId}
                style={{ width: 200 }}
                onChange={setActivePeriodId}
                loading={loading}
              >
                {periods.map(p => (
                  <Option key={p.id} value={p.id}>{p.name} {p.isActive && '(Activo)'}</Option>
                ))}
              </Select>
            </div>

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
                        // Filter out already added grades
                        options={grades
                          .filter(g => !structure.some(s => s.gradeId === g.id))
                          .map(g => ({ label: g.name, value: g.id }))
                        }
                      />
                    </Space>
                  </Card>
                </Col>

                {/* List of Active Grades in Period */}
                {structure.map((item: any) => (
                  <Col span={12} key={item.id}>
                    <Card
                      title={item.grade?.name}
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
                              .filter(s => !item.sections?.some((is: any) => is.id === s.id))
                              .map(s => ({ label: s.name, value: s.id }))
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
                              .filter(s => !item.subjects?.some((is: any) => is.id === s.id))
                              .map(s => ({ label: s.name, value: s.id }))
                            }
                          />
                        </div>
                      ]}
                    >
                      <Row gutter={16}>
                        <Col span={12}>
                          <h4>Secciones:</h4>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {item.sections?.map((sec: any) => (
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
                            {item.subjects?.map((sub: any) => (
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
          <Form.Item name="name" label="Nombre del Periodo" rules={[{ required: true, message: 'Ej. 2024-2025' }]}>
            <Input placeholder="2024-2025" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Crear Periodo</Button>
        </Form>
      </Modal>

      {/* Edit Catalog Modal */}
      <Modal
        title={`Editar Item`}
        open={editCatalogVisible}
        onCancel={() => setEditCatalogVisible(false)}
        footer={null}
      >
        <Form form={editCatalogForm} layout="vertical" onFinish={handleEditCatalog}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Guardar Cambios</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default AcademicManagement;
