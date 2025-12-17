import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, Card, Select, Table, Button, Modal, Form, Input, DatePicker, message, Space, Tag, Divider, Typography, List, InputNumber, Alert, Segmented } from 'antd';
import { BookOutlined, PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import api from '@/services/api';
import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { Option } = Select;
const { Title, Text } = Typography;

const TeacherPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<number>(1);
  const [evaluationPlan, setEvaluationPlan] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [planForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('1');

  // For Grading
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [qualifications, setQualifications] = useState<any>({}); // { evalPlanId: score }

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/evaluation/my-assignments');
      setAssignments(res.data);
      if (res.data.length > 0) {
        setSelectedAssignmentId(res.data[0].id);
      }
    } catch (error) {
      message.error('Error al cargar asignaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlanAndStudents = useCallback(async () => {
    if (!selectedAssignmentId) return;
    const assignment = assignments.find(a => a.id === selectedAssignmentId);
    if (!assignment) return;

    setLoading(true);
    try {
      const [planRes, studentsRes] = await Promise.all([
        api.get(`/evaluation/plan/${assignment.periodGradeSubjectId}?term=${selectedTerm}`),
        api.get(`/evaluation/students/${selectedAssignmentId}`)
      ]);
      setEvaluationPlan(planRes.data);
      setStudents(studentsRes.data);
    } catch (error) {
      message.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [selectedAssignmentId, assignments, selectedTerm]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    fetchPlanAndStudents();
  }, [fetchPlanAndStudents]);

  const handleSavePlanItem = async (values: any) => {
    const assignment = assignments.find(a => a.id === selectedAssignmentId);
    const data = {
      ...values,
      periodGradeSubjectId: assignment.periodGradeSubjectId,
      term: selectedTerm
    };

    try {
      if (editingItem) {
        await api.put(`/evaluation/plan/${editingItem.id}`, data);
        message.success('Item actualizado');
      } else {
        await api.post('/evaluation/plan', data);
        message.success('Item creado');
      }
      setShowPlanModal(false);
      fetchPlanAndStudents();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al guardar');
    }
  };

  const handleDeletePlanItem = async (id: number) => {
    try {
      await api.delete(`/evaluation/plan/${id}`);
      message.success('Item eliminado');
      fetchPlanAndStudents();
    } catch (error) {
      message.error('Error al eliminar');
    }
  };

  const handleOpenGrading = async (enrollment: any) => {
    setSelectedStudent(enrollment);
    // Load existing qualifications for this student-subject
    const inscriptionSubjectId = enrollment.inscriptionSubjects?.[0]?.id;
    if (!inscriptionSubjectId) return;

    try {
      const res = await api.get(`/evaluation/qualifications/${inscriptionSubjectId}`);
      const qualsMap: any = {};
      res.data.forEach((q: any) => {
        qualsMap[q.evaluationPlanId] = { score: q.score, observations: q.observations };
      });
      setQualifications(qualsMap);
    } catch (error) {
      message.error('Error al cargar notas');
    }
  };

  const handleSaveScore = async (evalPlanId: number, score: number, observations: string) => {
    const enrollment = selectedStudent;
    const inscriptionSubjectId = enrollment.inscriptionSubjects?.[0]?.id;

    try {
      await api.post('/evaluation/qualifications', {
        evaluationPlanId: evalPlanId,
        inscriptionSubjectId,
        score,
        observations
      });
      message.success('Nota guardada');
      // Update local state
      setQualifications({
        ...qualifications,
        [evalPlanId]: { score, observations }
      });
    } catch (error) {
      message.error('Error al guardar nota');
    }
  };

  const planColumns = [
    { title: 'Descripción', dataIndex: 'description', key: 'description' },
    { title: 'Peso (%)', dataIndex: 'percentage', key: 'percentage', render: (val: any) => `${val}%` },
    { title: 'Fecha', dataIndex: 'date', key: 'date', render: (val: any) => dayjs(val).format('DD/MM/YYYY') },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => { setEditingItem(record); planForm.setFieldsValue({ ...record, date: dayjs(record.date) }); setShowPlanModal(true); }} />
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDeletePlanItem(record.id)} />
        </Space>
      )
    }
  ];

  const studentColumns = [
    {
      title: 'Estudiante',
      key: 'student',
      render: (_: any, record: any) => `${record.student?.firstName} ${record.student?.lastName}`
    },
    { title: 'Cédula', dataIndex: ['student', 'document'], key: 'document' },
    {
      title: 'Progreso',
      key: 'progress',
      render: () => {
        // Calculation of total score could go here
        return <Tag color="blue">Ver Detalle</Tag>;
      }
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button type="primary" size="small" onClick={() => handleOpenGrading(record)}>Calificar</Button>
      )
    }
  ];

  const currentAssignment = assignments.find(a => a.id === selectedAssignmentId);
  const totalPercentage = evaluationPlan.reduce((acc, curr) => acc + Number(curr.percentage), 0);

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <BookOutlined style={{ marginRight: 8 }} />
        Panel del Profesor
      </Title>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <Space>
            <Text strong>Asignación:</Text>
            <Select
              style={{ width: 400 }}
              placeholder="Seleccione Materia/Sección"
              value={selectedAssignmentId}
              onChange={setSelectedAssignmentId}
            >
              {assignments.map(as => (
                <Option key={as.id} value={as.id}>
                  {as.periodGradeSubject?.subject?.name} - {as.periodGradeSubject?.periodGrade?.grade?.name} ({as.section?.name})
                </Option>
              ))}
            </Select>
            {currentAssignment && (
              <Tag color="purple">{currentAssignment.periodGradeSubject?.periodGrade?.schoolPeriod?.name}</Tag>
            )}
          </Space>

          <Space>
            <Text strong>Lapso:</Text>
            <Segmented
              options={[
                { label: 'Lapso 1', value: 1 },
                { label: 'Lapso 2', value: 2 },
                { label: 'Lapso 3', value: 3 }
              ]}
              value={selectedTerm}
              onChange={(val) => setSelectedTerm(val as number)}
              size="large"
            />
          </Space>
        </div>
      </Card>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        <TabPane tab="Plan de Evaluación" key="1">
          <Card extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); planForm.resetFields(); setShowPlanModal(true); }}>
              Agregar Evaluación
            </Button>
          }>
            <Table
              loading={loading}
              columns={planColumns}
              dataSource={evaluationPlan}
              rowKey="id"
              pagination={false}
            />
            <Divider />
            <div style={{ textAlign: 'right' }}>
              <Text strong>Total Planificado (Lapso {selectedTerm}): </Text>
              <Tag color={totalPercentage > 100 ? 'red' : totalPercentage === 100 ? 'green' : 'orange'}>
                {totalPercentage}% / 100%
              </Tag>
            </div>
          </Card>
        </TabPane>

        <TabPane tab="Calificaciones" key="2">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <Card title="Lista de Estudiantes">
              <Table
                loading={loading}
                columns={studentColumns}
                dataSource={students}
                rowKey="id"
                size="small"
                onRow={(record) => ({
                  onClick: () => handleOpenGrading(record),
                  style: { cursor: 'pointer', background: selectedStudent?.id === record.id ? '#e6f7ff' : 'transparent' }
                })}
              />
            </Card>

            <Card title={selectedStudent ? `Notas: ${selectedStudent.student?.firstName} ${selectedStudent.student?.lastName}` : 'Seleccione un estudiante'}>
              {selectedStudent ? (
                <List
                  dataSource={evaluationPlan}
                  renderItem={item => (
                    <List.Item key={item.id}>
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text strong>{item.description} ({item.percentage}%)</Text>
                          <Text type="secondary">{dayjs(item.date).format('DD/MM')}</Text>
                        </div>
                        <Space align="start">
                          <InputNumber
                            min={0}
                            max={20} // Assuming 20 is max score
                            placeholder="Nota"
                            value={qualifications[item.id]?.score}
                            onChange={(val) => setQualifications({ ...qualifications, [item.id]: { ...qualifications[item.id], score: val } })}
                          />
                          <Input
                            placeholder="Observaciones"
                            value={qualifications[item.id]?.observations}
                            onChange={(e) => setQualifications({ ...qualifications, [item.id]: { ...qualifications[item.id], observations: e.target.value } })}
                          />
                          <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={() => handleSaveScore(item.id, qualifications[item.id]?.score, qualifications[item.id]?.observations)}
                          />
                        </Space>
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                <Alert message="Haga clic en un estudiante de la lista para ver y editar sus calificaciones." type="info" showIcon />
              )}
            </Card>
          </div>
        </TabPane>
      </Tabs>

      <Modal
        title={editingItem ? "Editar Evaluación" : "Nueva Evaluación"}
        open={showPlanModal}
        onCancel={() => setShowPlanModal(false)}
        onOk={() => planForm.submit()}
        destroyOnClose
      >
        <Form form={planForm} layout="vertical" onFinish={handleSavePlanItem}>
          <Form.Item name="description" label="Descripción de la actividad" rules={[{ required: true }]}>
            <Input placeholder="Ej: Primer Parcial, Taller de Ecuaciones..." />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="percentage" label="Porcentaje (1-100)" rules={[{ required: true }]}>
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="date" label="Fecha de Evaluación" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default TeacherPanel;
