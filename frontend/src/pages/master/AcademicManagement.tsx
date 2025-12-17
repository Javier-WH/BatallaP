import React, { useState, useEffect } from 'react';
import { Card, Tabs, Table, Button, Modal, Form, Input, Tag, message, Select, Space, Row, Col, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { TabPane } = Tabs;
const { Option } = Select;

const AcademicManagement: React.FC = () => {
  // State
  const [periods, setPeriods] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<number | null>(null); // For structure view
  const [structure, setStructure] = useState<any[]>([]);

  // UI State
  const [isPeriodModalVisible, setIsPeriodModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forms
  const [periodForm] = Form.useForm();
  const [gradeCatalogForm] = Form.useForm();
  const [sectionCatalogForm] = Form.useForm();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [pRes, gRes, sRes] = await Promise.all([
        api.get('/academic/periods'),
        api.get('/academic/grades'),
        api.get('/academic/sections')
      ]);
      setPeriods(pRes.data);
      setGrades(gRes.data);
      setSections(sRes.data);

      // Set default active period for viewing structure
      const active = pRes.data.find((p: any) => p.isActive);
      if (active) setActivePeriodId(active.id);
      else if (pRes.data.length > 0) setActivePeriodId(pRes.data[0].id);

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
    if (!activePeriodId) return message.warn('Seleccione un periodo');
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
                  <Col span={8} key={item.id}>
                    <Card
                      title={item.grade?.name}
                      extra={
                        <Popconfirm title="Eliminar grado y sus secciones?" onConfirm={() => handleRemoveGradeFromStructure(item.id)}>
                          <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      }
                    >
                      <div style={{ marginBottom: 8 }}>Secciones:</div>
                      <Space wrap style={{ marginBottom: 8 }}>
                        {item.sections?.map((sec: any) => (
                          <Tag
                            key={sec.id}
                            closable
                            onClose={() => handleRemoveSectionFromGrade(item.id, sec.id)}
                          >
                            {sec.name}
                          </Tag>
                        ))}
                      </Space>

                      <Select
                        size="small"
                        placeholder="+ Sección"
                        style={{ width: 100, marginTop: 8 }}
                        onChange={(val) => handleAddSectionToGrade(item.id, val)}
                        options={sections
                          .filter(s => !item.sections?.some((is: any) => is.id === s.id))
                          .map(s => ({ label: s.name, value: s.id }))
                        }
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </TabPane>

          {/* CATALOGS TAB */}
          <TabPane tab="Catálogos Globales" key="3">
            <Row gutter={24}>
              <Col span={12}>
                <h3>Grados Disponibles</h3>
                <Form form={gradeCatalogForm} layout="inline" onFinish={async (v) => {
                  await api.post('/academic/grades', v);
                  message.success('Grado creado');
                  gradeCatalogForm.resetFields();
                  fetchAll();
                }}>
                  <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="Nombre (Ej. 1er Grado)" /></Form.Item>
                  <Form.Item><Button type="primary" htmlType="submit">Crear</Button></Form.Item>
                </Form>
                <Table
                  dataSource={grades}
                  rowKey="id"
                  size="small"
                  style={{ marginTop: 16 }}
                  columns={[{ title: 'Nombre', dataIndex: 'name' }]}
                />
              </Col>
              <Col span={12}>
                <h3>Secciones Disponibles</h3>
                <Form form={sectionCatalogForm} layout="inline" onFinish={async (v) => {
                  await api.post('/academic/sections', v);
                  message.success('Sección creada');
                  sectionCatalogForm.resetFields();
                  fetchAll();
                }}>
                  <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="Nombre (Ej. A, B)" /></Form.Item>
                  <Form.Item><Button type="primary" htmlType="submit">Crear</Button></Form.Item>
                </Form>
                <Table
                  dataSource={sections}
                  rowKey="id"
                  size="small"
                  style={{ marginTop: 16 }}
                  columns={[{ title: 'Nombre', dataIndex: 'name' }]}
                />
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
    </div>
  );
};

export default AcademicManagement;
