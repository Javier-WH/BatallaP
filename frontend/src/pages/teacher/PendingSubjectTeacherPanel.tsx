import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Select, Button, Space, Typography, Spin, message, Tag, Empty,
  InputNumber, Table, Divider, Alert, Tabs, Input, Modal,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SaveOutlined, ReloadOutlined, BookOutlined, EditOutlined,
  PlusOutlined, DeleteOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import api from '@/services/api';
import { compareStudents } from '@/utils/studentSort';

const { Title, Text } = Typography;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface MpAssignment {
  id: number;
  periodGradeSubjectId: number;
  subjectId: number;
  subjectName: string;
  gradeId: number;
}

interface MpStudent {
  inscriptionId: number;
  inscriptionSubjectId: number;
  personId: number;
  studentName: string;
  studentDni: string;
  documentType: string;
  finalGrade: {
    finalScore: number | null;
    status: string;
    gradeType: string;
    calculatedAt: string;
  } | null;
  qualifications: {
    id: number;
    score: number;
    remedialScore: number | null;
    isAbsent: boolean;
    evaluationPlanId: number;
    percentage: number;
    termId: number;
    description: string;
  }[];
}

interface EvaluationPlanItem {
  id: number;
  description: string;
  percentage: number;
  date: string;
  termId: number;
  term?: { name: string };
}

interface Term {
  id: number;
  name: string;
  order: number;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
const PendingSubjectTeacherPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState<MpAssignment[]>([]);
  const [selectedPgsId, setSelectedPgsId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{
    periodGradeSubject: any;
    subjectName: string;
    students: MpStudent[];
    evaluationPlans: EvaluationPlanItem[];
    terms: Term[];
  } | null>(null);

  // Grade editing
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [gradeModalStudent, setGradeModalStudent] = useState<MpStudent | null>(null);
  const [gradeValue, setGradeValue] = useState<number | null>(null);

  // Evaluation plan modal
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planForm, setPlanForm] = useState({ description: '', percentage: 100, termId: 0, date: '' });

  /* ------------------- Fetch assignments ------------------- */
  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ assignments: MpAssignment[] }>('/pending-subjects/teacher-assignments');
      setAssignments(res.data.assignments || []);
      if ((res.data.assignments || []).length > 0 && !selectedPgsId) {
        setSelectedPgsId(res.data.assignments[0].periodGradeSubjectId);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al cargar asignaciones');
    } finally {
      setLoading(false);
    }
  }, [selectedPgsId]);

  /* ------------------- Fetch detail ------------------- */
  const fetchDetail = useCallback(async (pgsId: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/pending-subjects/assignment/${pgsId}`);
      setDetail(res.data);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al cargar detalle');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);
  useEffect(() => { if (selectedPgsId) fetchDetail(selectedPgsId); }, [selectedPgsId, fetchDetail]);

  /* ------------------- Save direct grade ------------------- */
  const handleSaveGrade = async () => {
    if (!gradeModalStudent || gradeValue == null) return;
    setSaving(true);
    try {
      await api.post('/pending-subjects/final-grade', {
        inscriptionSubjectId: gradeModalStudent.inscriptionSubjectId,
        finalScore: gradeValue,
      });
      message.success('Nota guardada');
      setGradeModalOpen(false);
      if (selectedPgsId) fetchDetail(selectedPgsId);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  /* ------------------- Create evaluation plan item ------------------- */
  const handleCreatePlanItem = async () => {
    if (!selectedPgsId || !detail) return;
    if (!planForm.description || !planForm.termId) {
      message.warning('Complete todos los campos');
      return;
    }
    setSaving(true);
    try {
      const mpSection = await api.get('/pending-subjects/structure');
      // We need the MP section id — get it from the structure
      const sectionId = mpSection.data?.grades?.[0]?.mpSection?.id;
      if (!sectionId) {
        message.error('No se pudo determinar la sección de materia pendiente');
        return;
      }
      await api.post('/pending-subjects/evaluation-plan', {
        periodGradeSubjectId: selectedPgsId,
        sectionId,
        termId: planForm.termId,
        description: planForm.description,
        percentage: planForm.percentage,
        date: planForm.date || new Date().toISOString(),
      });
      message.success('Item de evaluación creado');
      setPlanModalOpen(false);
      setPlanForm({ description: '', percentage: 100, termId: 0, date: '' });
      if (selectedPgsId) fetchDetail(selectedPgsId);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al crear item');
    } finally {
      setSaving(false);
    }
  };

  /* ------------------- Student table columns ------------------- */
  const studentColumns: ColumnsType<MpStudent> = [
    {
      title: 'Estudiante',
      key: 'name',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.studentName}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.documentType === 'Venezolano' ? 'V' : r.documentType === 'Extranjero' ? 'E' : r.documentType === 'Pasaporte' ? 'P' : 'CE'}-{r.studentDni}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Nota Final',
      key: 'finalGrade',
      width: 120,
      render: (_, r) => {
        if (!r.finalGrade || r.finalGrade.finalScore == null) {
          return <Tag color="default">Sin nota</Tag>;
        }
        const isApproved = r.finalGrade.status === 'aprobada';
        return (
          <Tag color={isApproved ? 'success' : 'error'}>
            {Number(r.finalGrade.finalScore).toFixed(0)} — {isApproved ? 'Aprobada' : 'Reprobada'}
          </Tag>
        );
      },
    },
    {
      title: 'Fecha',
      key: 'date',
      width: 120,
      render: (_, r) => r.finalGrade?.calculatedAt
        ? new Date(r.finalGrade.calculatedAt).toLocaleDateString('es-VE')
        : '—',
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 100,
      render: (_, r) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            setGradeModalStudent(r);
            setGradeValue(r.finalGrade?.finalScore ?? null);
            setGradeModalOpen(true);
          }}
        >
          Calificar
        </Button>
      ),
    },
  ];

  /* ------------------- Render ------------------- */
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Materia Pendiente</Title>
          <Text type="secondary">Panel de evaluación de materias pendientes</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchAssignments} loading={loading}>Actualizar</Button>
      </div>

      {assignments.length === 0 && !loading ? (
        <Card>
          <Empty description="No tiene asignaciones de materia pendiente" />
        </Card>
      ) : (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Space>
              <Text strong>Asignación:</Text>
              <Select
                style={{ width: 350 }}
                value={selectedPgsId ?? undefined}
                onChange={v => setSelectedPgsId(v)}
                options={assignments.map(a => ({
                  value: a.periodGradeSubjectId,
                  label: `${a.subjectName}`,
                }))}
              />
            </Space>
          </Card>

          <Spin spinning={loading}>
            {detail && (
              <Tabs
                items={[
                  {
                    key: 'students',
                    label: 'Estudiantes',
                    children: (
                      <Card
                        title={
                          <Space>
                            <BookOutlined />
                            <span>{detail.subjectName}</span>
                            <Tag>{detail.students.length} estudiantes</Tag>
                          </Space>
                        }
                      >
                        <Alert
                          type="info"
                          message="Evaluación de Materia Pendiente"
                          description="Puede registrar una nota final directa o crear un plan de evaluación. Si el estudiante aprueba en el primer lapso, ya aprobó la materia (no se promedian lapsos)."
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                        <Table
                          dataSource={detail.students}
                          columns={studentColumns}
                          rowKey="inscriptionSubjectId"
                          size="small"
                          pagination={false}
                        />
                      </Card>
                    ),
                  },
                  {
                    key: 'plan',
                    label: 'Plan de Evaluación',
                    children: (
                      <Card
                        title={
                          <Space>
                            <span>Plan de Evaluación</span>
                            <Button
                              size="small"
                              type="primary"
                              icon={<PlusOutlined />}
                              onClick={() => {
                                setPlanForm({
                                  description: '',
                                  percentage: 100,
                                  termId: detail.terms[0]?.id || 0,
                                  date: new Date().toISOString().split('T')[0],
                                });
                                setPlanModalOpen(true);
                              }}
                            >
                              Nuevo item
                            </Button>
                          </Space>
                        }
                      >
                        {detail.evaluationPlans.length === 0 ? (
                          <Empty description="No hay items de evaluación. Use nota directa en la tab de Estudiantes." />
                        ) : (
                          <Table
                            dataSource={detail.evaluationPlans}
                            rowKey="id"
                            size="small"
                            pagination={false}
                            columns={[
                              { title: 'Descripción', dataIndex: 'description', key: 'description' },
                              { title: 'Lapso', key: 'term', render: (_, r) => r.term?.name || '—' },
                              { title: 'Porcentaje', dataIndex: 'percentage', key: 'percentage', render: v => `${v}%` },
                              { title: 'Fecha', dataIndex: 'date', key: 'date', render: v => new Date(v).toLocaleDateString('es-VE') },
                            ]}
                          />
                        )}
                      </Card>
                    ),
                  },
                ]}
              />
            )}
          </Spin>
        </>
      )}

      {/* Grade modal */}
      <Modal
        open={gradeModalOpen}
        title="Registrar Nota de Materia Pendiente"
        onCancel={() => setGradeModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setGradeModalOpen(false)}>Cancelar</Button>,
          <Button key="save" type="primary" icon={<SaveOutlined />} loading={saving} disabled={gradeValue == null} onClick={handleSaveGrade}>
            Guardar
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>{gradeModalStudent?.studentName}</Text>
        </div>
        <Divider />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text>Nota final:</Text>
          <InputNumber min={1} max={20} step={1} value={gradeValue} onChange={v => setGradeValue(v)} style={{ width: 120 }} autoFocus />
          <Text type="secondary" style={{ fontSize: 12 }}>(1-20, mínimo 10)</Text>
        </div>
      </Modal>

      {/* Plan item modal */}
      <Modal
        open={planModalOpen}
        title="Nuevo Item de Evaluación"
        onCancel={() => setPlanModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setPlanModalOpen(false)}>Cancelar</Button>,
          <Button key="save" type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleCreatePlanItem}>Crear</Button>,
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text>Descripción:</Text>
            <Input value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })} style={{ marginTop: 4 }} />
          </div>
          <div>
            <Text>Lapso:</Text>
            <Select
              style={{ width: '100%', marginTop: 4 }}
              value={planForm.termId || undefined}
              onChange={v => setPlanForm({ ...planForm, termId: v })}
              options={detail?.terms.map(t => ({ value: t.id, label: t.name })) || []}
            />
          </div>
          <div>
            <Text>Porcentaje:</Text>
            <InputNumber min={1} max={100} value={planForm.percentage} onChange={v => setPlanForm({ ...planForm, percentage: v || 100 })} style={{ width: '100%', marginTop: 4 }} />
          </div>
          <div>
            <Text>Fecha:</Text>
            <Input type="date" value={planForm.date} onChange={e => setPlanForm({ ...planForm, date: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PendingSubjectTeacherPanel;
