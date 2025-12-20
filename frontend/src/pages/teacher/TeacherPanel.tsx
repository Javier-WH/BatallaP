import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { Tabs, Card, Select, Table, Button, Modal, Form, Input, DatePicker, message, Space, Tag, Divider, Typography, InputNumber, Alert } from 'antd';
import { BookOutlined, PlusOutlined, DeleteOutlined, EditOutlined, LockOutlined } from '@ant-design/icons';
import api from '@/services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { Title, Text } = Typography;

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

class TeacherPanelErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TeacherPanel Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <Alert
            message="Error en el Panel del Profesor"
            description={
              <div>
                <p>Ha ocurrido un error al cargar el panel del profesor.</p>
                <p>Error: {this.state.error?.message}</p>
                <p>Por favor, recarga la página o contacta al administrador.</p>
                <Button
                  type="primary"
                  onClick={() => window.location.reload()}
                  style={{ marginTop: 16 }}
                >
                  Recargar Página
                </Button>
              </div>
            }
            type="error"
            showIcon
          />
        </div>
      );
    }

    return this.props.children;
  }
}

interface PlanItemFormValues {
  description: string;
  percentage: number;
  date: dayjs.Dayjs;
}

interface Qualification {
  id: number;
  evaluationPlanId: number;
  score: number;
  observations?: string;
}

interface InscriptionSubject {
  id: number;
  qualifications: Qualification[];
}

interface Student {
  firstName: string;
  lastName: string;
  document: string;
}

interface StudentEnrollment {
  id: number;
  student: Student;
  inscriptionSubjects: InscriptionSubject[];
}

interface EvaluationPlanItem {
  id: number;
  description: string;
  percentage: number;
  date: string;
}

interface Subject {
  id: number;
  name: string;
}

interface Grade {
  id: number;
  name: string;
}

interface SchoolPeriod {
  id: number;
  name: string;
}

interface PeriodGrade {
  id: number;
  grade: Grade;
  schoolPeriod: SchoolPeriod;
}

interface PeriodGradeSubject {
  id: number;
  subject: Subject;
  periodGrade: PeriodGrade;
}

interface Section {
  id: number;
  name: string;
}

interface Term {
  id: number;
  name: string;
  isBlocked: boolean;
  openDate?: string;
  closeDate?: string;
  schoolPeriodId: number;
  order: number;
}

interface Assignment {
  id: number;
  periodGradeSubjectId: number;
  sectionId: number;
  periodGradeSubject: PeriodGradeSubject;
  section: Section;
}

const TeacherPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
  const [availableTerms, setAvailableTerms] = useState<Term[]>([]);
  const [evaluationPlan, setEvaluationPlan] = useState<EvaluationPlanItem[]>([]);
  const [students, setStudents] = useState<StudentEnrollment[]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EvaluationPlanItem | null>(null);
  const [planForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('1');
  const [maxGrade, setMaxGrade] = useState<number>(20);

  useEffect(() => {
    const fetchMaxGrade = async () => {
      try {
        const res = await api.get('/settings/max_grade');
        if (res.data?.value) setMaxGrade(Number(res.data.value));
      } catch {
         
        console.error('Error fetching max_grade setting');
      }
    };
    fetchMaxGrade();
  }, []);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/evaluation/my-assignments');
      setAssignments(res.data);
      if (res.data.length > 0) {
        setSelectedAssignmentId(res.data[0].id);
      }
    } catch {
      message.error('Error al cargar asignaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTerms = useCallback(async () => {
    try {
      console.log('Fetching terms...');
      const res = await api.get('/academic/active');
      console.log('Active period response:', res.data);
      if (res.data) {
        const termsRes = await api.get(`/terms?schoolPeriodId=${res.data.id}`);
        console.log('Terms response:', termsRes.data);
        setAvailableTerms(termsRes.data);
        // Set first active term as default
        const activeTerm = termsRes.data.find((t: Term) => !t.isBlocked);
        if (activeTerm) {
          console.log('Setting active term:', activeTerm.id);
          setSelectedTerm(activeTerm.id);
        } else if (termsRes.data.length > 0) {
          console.log('No active terms, setting first term:', termsRes.data[0].id);
          setSelectedTerm(termsRes.data[0].id);
        } else {
          console.log('No terms available');
          setSelectedTerm(null);
        }
      }
    } catch (error) {
      console.error('Error fetching terms', error);
    }
  }, []);

  const fetchPlanAndStudents = useCallback(async () => {
    if (!selectedAssignmentId || !selectedTerm) {
      console.log('fetchPlanAndStudents: Missing selectedAssignmentId or selectedTerm', { selectedAssignmentId, selectedTerm });
      return;
    }

    const assignment = assignments.find(a => a.id === selectedAssignmentId);
    if (!assignment) {
      console.log('fetchPlanAndStudents: Assignment not found', { selectedAssignmentId, assignments });
      return;
    }

    console.log('fetchPlanAndStudents: Starting API calls', { assignment, selectedTerm });

    setLoading(true);
    try {
      const [planRes, studentsRes] = await Promise.all([
        api.get(`/evaluation/plan/${assignment.periodGradeSubjectId}?term=${selectedTerm}&sectionId=${assignment.sectionId}`),
        api.get(`/evaluation/students/${selectedAssignmentId}`)
      ]);

      console.log('fetchPlanAndStudents: API responses received', {
        planData: planRes.data,
        studentsData: studentsRes.data
      });

      setEvaluationPlan(planRes.data || []);
      setStudents(studentsRes.data || []);
    } catch (error: any) {
      console.error('fetchPlanAndStudents: API call failed', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      // Set empty arrays on error to prevent rendering issues
      setEvaluationPlan([]);
      setStudents([]);

      message.error('Error al cargar datos del lapso');
    } finally {
      setLoading(false);
    }
  }, [selectedAssignmentId, assignments, selectedTerm]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  useEffect(() => {
    fetchPlanAndStudents();
  }, [fetchPlanAndStudents]);

  const handleSavePlanItem = async (values: PlanItemFormValues) => {
    const assignment = assignments.find(a => a.id === selectedAssignmentId);
    if (!assignment) {
      message.error('No se pudo encontrar la asignación seleccionada');
      return;
    }
    const data = {
      ...values,
      periodGradeSubjectId: assignment.periodGradeSubjectId,
      sectionId: assignment.sectionId,
      termId: selectedTerm
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
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Error al guardar');
    }
  };

  const handleDeletePlanItem = async (id: number) => {
    try {
      await api.delete(`/evaluation/plan/${id}`);
      message.success('Item eliminado');
      fetchPlanAndStudents();
    } catch {
      message.error('Error al eliminar');
    }
  };


  const handleSaveScoreInGrid = async (enrollment: StudentEnrollment, evalPlanId: number, score: number | null) => {
    const inscriptionSubjectId = enrollment.inscriptionSubjects?.[0]?.id;

    try {
      await api.post('/evaluation/qualifications', {
        evaluationPlanId: evalPlanId,
        inscriptionSubjectId,
        inscriptionId: enrollment.id,
        score: score === null ? 0 : score,
        observations: ''
      });
      // message.success(`Nota guardada para ${enrollment.student?.lastName}`);
      fetchPlanAndStudents();
    } catch {
      message.error('Error al guardar nota');
    }
  };

  const planColumns = [
    { title: 'Descripción', dataIndex: 'description', key: 'description' },
    { title: 'Peso (%)', dataIndex: 'percentage', key: 'percentage', render: (val: number) => `${val}%` },
    { title: 'Fecha', dataIndex: 'date', key: 'date', render: (val: string) => dayjs(val).format('DD/MM/YYYY') },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, record: EvaluationPlanItem) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => { setEditingItem(record); planForm.setFieldsValue({ ...record, date: dayjs(record.date) }); setShowPlanModal(true); }} />
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDeletePlanItem(record.id)} />
        </Space>
      )
    }
  ];


  const currentAssignment = assignments?.find(a => a.id === selectedAssignmentId);
  const totalPercentage = evaluationPlan?.reduce((acc, curr) => acc + Number(curr?.percentage || 0), 0) || 0;

  return (
    <div style={{ padding: '8px 24px' }}>
      <style>{`
        .grading-row:hover {
          background-color: #f0f7ff !important;
        }
        .grading-row td {
          transition: background-color 0.2s;
        }
        .grading-table-container::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        .grading-table-container::-webkit-scrollbar-thumb {
          background: #e1e1e1;
          border-radius: 4px;
        }
        .grading-table-container::-webkit-scrollbar-track {
          background: #f5f5f5;
        }
        .custom-segmented {
          background: #f0f0f0;
          padding: 4px;
        }
        .custom-segmented .ant-segmented-item-selected {
          background-color: #1890ff !important;
          color: white !important;
          font-weight: bold;
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <BookOutlined style={{ fontSize: 24, color: '#1890ff' }} />
        <Title level={4} style={{ margin: 0 }}>Panel del Profesor</Title>
      </div>

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
                <Option key={as?.id || Math.random()} value={as?.id}>
                  {as?.periodGradeSubject?.subject?.name} - {as?.periodGradeSubject?.periodGrade?.grade?.name} ({as?.section?.name}) - {as?.periodGradeSubject?.periodGrade?.schoolPeriod?.name}
                </Option>
              ))}
            </Select>
            {currentAssignment && (
              <Tag color="purple">{currentAssignment.periodGradeSubject?.periodGrade?.schoolPeriod?.name}</Tag>
            )}
          </Space>

          <Space>
            <Text strong>Lapso:</Text>
            <Select
              style={{ width: 200 }}
              placeholder="Seleccione Lapso"
              value={selectedTerm}
              onChange={setSelectedTerm}
              disabled={availableTerms.length === 0}
            >
              {availableTerms.map(term => (
                <Option key={term.id} value={term.id}>
                  <Space>
                    {term.name}
                    {term.isBlocked && <LockOutlined style={{ color: '#ff4d4f' }} />}
                    {term.isBlocked && <Text type="danger">(Bloqueado)</Text>}
                  </Space>
                </Option>
              ))}
            </Select>
            {selectedTerm && availableTerms.find(t => t.id === selectedTerm)?.isBlocked && (
              <Alert
                message="Lapso bloqueado"
                description="Este lapso está bloqueado. Puedes ver la información pero no modificarla."
                type="warning"
                showIcon
                style={{ marginTop: 8 }}
              />
            )}
          </Space>
        </div>
      </Card>

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        type="card"
        items={[
          {
            key: '1',
            label: 'Plan de Evaluación',
            children: (
              <Card 
                extra={
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={() => { 
                      setEditingItem(null); 
                      planForm.resetFields(); 
                      setShowPlanModal(true); 
                    }}
                  >
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
            )
          },
          {
            key: '2',
            label: 'Calificaciones',
            children: evaluationPlan.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ marginBottom: 24 }}>
                  <Title level={4}>No hay Plan de Evaluación definido</Title>
                  <Text type="secondary">Para poder calificar este lapso, primero debe definir las actividades y sus porcentajes.</Text>
                </div>
                <Button type="primary" size="large" onClick={() => setActiveTab('1')}>
                  Crear Plan de Evaluación
                </Button>
              </Card>
            ) : (
              <Card bodyStyle={{ padding: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 350px)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fafafa' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', textAlign: 'left', minWidth: 250 }}>Estudiante</th>
                        {evaluationPlan.map((item) => (
                          <th key={item.id} style={{ padding: '12px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'center', minWidth: 100 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.description}</div>
                            <div style={{ fontSize: '11px', color: '#8c8c8c' }}>{item.percentage}%</div>
                          </th>
                        ))}
                        <th style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', textAlign: 'center', minWidth: 80 }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...students]
                        .sort((a, b) => {
                          const nameA = `${a.student?.lastName} ${a.student?.firstName}`.toLowerCase();
                          const nameB = `${b.student?.lastName} ${b.student?.firstName}`.toLowerCase();
                          return nameB.localeCompare(nameA); // Order descendiente
                        })
                        .map((enrollment, rowIndex) => {
                          const insSub = enrollment.inscriptionSubjects?.[0];
                          const studentQuals = insSub?.qualifications || [];

                          let rowTotal = 0;
                          evaluationPlan.forEach(item => {
                            const q = studentQuals.find((sq: Qualification) => sq.evaluationPlanId === item.id);
                            if (q) {
                              rowTotal += (Number(q.score) * Number(item.percentage)) / 100;
                            }
                          });

                          return (
                            <tr key={enrollment.id} className="grading-row">
                              <td style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
                                <div style={{ fontWeight: 500 }}>{enrollment.student?.lastName}, {enrollment.student?.firstName}</div>
                                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{enrollment.student?.document}</div>
                              </td>
                              {evaluationPlan.map((item, colIndex) => {
                                const q = studentQuals.find((sq: Qualification) => sq.evaluationPlanId === item.id);
                                const currentScore = q ? q.score : null;

                                return (
                                  <td key={item.id} style={{ padding: '4px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
                                    <InputNumber
                                      id={`grade-${rowIndex}-${colIndex}`}
                                      min={0}
                                      max={maxGrade}
                                      precision={2}
                                      value={currentScore}
                                      style={{ width: '80px' }}
                                      onKeyDown={(e) => {
                                        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
                                          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                            e.preventDefault();
                                          }

                                          let nextRow = rowIndex;
                                          let nextCol = colIndex;
                                          if (e.key === 'ArrowUp') nextRow--;
                                          if (e.key === 'ArrowDown' || e.key === 'Enter') {
                                            if (e.key === 'Enter') e.preventDefault();
                                            nextRow++;
                                          }
                                          if (e.key === 'ArrowLeft') nextCol--;
                                          if (e.key === 'ArrowRight') nextCol++;

                                          const nextInputId = `grade-${nextRow}-${nextCol}`;
                                          setTimeout(() => {
                                            const nextInput = document.getElementById(nextInputId);
                                            if (nextInput) {
                                              const inner = nextInput.querySelector('input');
                                              if (inner) {
                                                inner.focus();
                                                inner.select();
                                              } else {
                                                nextInput.focus();
                                              }
                                            }
                                          }, 0);
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const val = (e.target as HTMLInputElement).value === '' ? null : Number((e.target as HTMLInputElement).value);
                                        if (val !== currentScore) {
                                          handleSaveScoreInGrid(enrollment, item.id, val);
                                        }
                                      }}
                                    />
                                  </td>
                                );
                              })}
                              <td style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', textAlign: 'center', background: '#fafafa', fontWeight: 'bold' }}>
                                <Tag color={rowTotal >= (maxGrade * 0.5) ? 'green' : 'red'} style={{ margin: 0 }}>
                                  {rowTotal.toFixed(2)}
                                </Tag>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                {students.length === 0 && (
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <Alert message="No hay estudiantes inscritos en esta sección" type="info" />
                  </div>
                )}
              </Card>
            )
          }
        ]}
      />

      <Modal
        title={editingItem ? "Editar Evaluación" : "Nueva Evaluación"}
        open={showPlanModal}
        onCancel={() => setShowPlanModal(false)}
        onOk={() => planForm.submit()}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={() => setShowPlanModal(false)}>Cancelar</Button>,
          <Button key="submit" type="primary" onClick={() => planForm.submit()}>
            {editingItem ? 'Actualizar' : 'Guardar'}
          </Button>
        ]}
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

export default function TeacherPanelWithErrorBoundary() {
  return (
    <TeacherPanelErrorBoundary>
      <TeacherPanel />
    </TeacherPanelErrorBoundary>
  );
}
