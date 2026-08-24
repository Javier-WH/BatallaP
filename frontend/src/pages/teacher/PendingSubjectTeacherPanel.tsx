import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Select, Button, Space, Typography, Spin, message, Tag, Empty,
  InputNumber, Table, Divider, Alert, Tabs, Input, Modal, Popconfirm, DatePicker,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SaveOutlined, ReloadOutlined, BookOutlined, EditOutlined,
  PlusOutlined, DeleteOutlined, CheckCircleOutlined, CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
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

  // Grade editing (direct final grade)
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [gradeModalStudent, setGradeModalStudent] = useState<MpStudent | null>(null);
  const [gradeValue, setGradeValue] = useState<number | null>(null);

  // Evaluation plan modal (create/edit)
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planEditingId, setPlanEditingId] = useState<number | null>(null);
  const [planForm, setPlanForm] = useState({
    description: '',
    percentage: 100,
    termId: 0,
    date: dayjs(),
  });

  // Qualification grid — inline editing
  const [qualEdits, setQualEdits] = useState<Record<string, number | null>>({});

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
      setQualEdits({});
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

  /* ------------------- Open plan modal (create or edit) ------------------- */
  const openPlanModal = (item?: EvaluationPlanItem) => {
    if (item) {
      setPlanEditingId(item.id);
      setPlanForm({
        description: item.description,
        percentage: item.percentage,
        termId: item.termId,
        date: dayjs(item.date),
      });
    } else {
      setPlanEditingId(null);
      setPlanForm({
        description: '',
        percentage: 100,
        termId: detail?.terms[0]?.id || 0,
        date: dayjs(),
      });
    }
    setPlanModalOpen(true);
  };

  /* ------------------- Save plan item (create or update) ------------------- */
  const handleSavePlanItem = async () => {
    if (!selectedPgsId || !detail) return;
    if (!planForm.description || !planForm.termId) {
      message.warning('Complete todos los campos');
      return;
    }
    setSaving(true);
    try {
      // Get MP section id from structure
      const structRes = await api.get('/pending-subjects/structure');
      const sectionId = structRes.data?.grades?.[0]?.mpSection?.id;
      if (!sectionId) {
        message.error('No se pudo determinar la sección de materia pendiente');
        return;
      }
      if (planEditingId) {
        // Update
        await api.put(`/pending-subjects/evaluation-plan/${planEditingId}`, {
          description: planForm.description,
          percentage: planForm.percentage,
          termId: planForm.termId,
          date: planForm.date.format('YYYY-MM-DD'),
        });
        message.success('Item actualizado');
      } else {
        // Create
        await api.post('/pending-subjects/evaluation-plan', {
          periodGradeSubjectId: selectedPgsId,
          sectionId,
          termId: planForm.termId,
          description: planForm.description,
          percentage: planForm.percentage,
          date: planForm.date.format('YYYY-MM-DD'),
        });
        message.success('Item de evaluación creado');
      }
      setPlanModalOpen(false);
      if (selectedPgsId) fetchDetail(selectedPgsId);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al guardar item');
    } finally {
      setSaving(false);
    }
  };

  /* ------------------- Delete plan item ------------------- */
  const handleDeletePlanItem = async (id: number) => {
    setSaving(true);
    try {
      await api.delete(`/pending-subjects/evaluation-plan/${id}`);
      message.success('Item eliminado');
      if (selectedPgsId) fetchDetail(selectedPgsId);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  /* ------------------- Save qualification (inline grid) ------------------- */
  const handleSaveQualification = async (student: MpStudent, planItem: EvaluationPlanItem, score: number | null) => {
    if (score == null) return;
    setSaving(true);
    try {
      await api.post('/pending-subjects/qualification', {
        evaluationPlanId: planItem.id,
        inscriptionSubjectId: student.inscriptionSubjectId,
        score,
      });
      const isNp = score === 0;
      message.success(`Calificación guardada: ${student.studentName} — ${isNp ? 'NP' : score}`);
      // Clear the edit buffer for this cell
      setQualEdits(prev => { const n = { ...prev }; delete n[`${student.inscriptionSubjectId}-${planItem.id}`]; return n; });
      if (selectedPgsId) fetchDetail(selectedPgsId);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al guardar calificación');
    } finally {
      setSaving(false);
    }
  };

  /* ------------------- Student table columns (with plan items) ------------------- */
  const studentColumns: ColumnsType<MpStudent> = useMemo(() => {
    const baseCols: ColumnsType<MpStudent> = [
      {
        title: 'Estudiante',
        key: 'name',
        width: 200,
        render: (_, r) => (
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 12 }}>{r.studentName}</Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {r.documentType === 'Venezolano' ? 'V' : r.documentType === 'Extranjero' ? 'E' : r.documentType === 'Pasaporte' ? 'P' : 'CE'}-{r.studentDni}
            </Text>
          </Space>
        ),
      },
    ];

    // Add a column per evaluation plan item
    if (detail?.evaluationPlans.length) {
      detail.evaluationPlans.forEach(planItem => {
        baseCols.push({
          title: (
            <div style={{ textAlign: 'center', fontSize: 11 }}>
              <div style={{ fontWeight: 700 }}>{planItem.description}</div>
              <div style={{ color: '#999', fontSize: 9 }}>
                {planItem.term?.name} · {planItem.percentage}%
              </div>
              <div style={{ color: '#999', fontSize: 9 }}>
                {dayjs(planItem.date).format('DD/MM/YYYY')}
              </div>
            </div>
          ),
          key: `plan-${planItem.id}`,
          width: 90,
          align: 'center',
          render: (_, student) => {
            const qual = student.qualifications.find(q => q.evaluationPlanId === planItem.id);
            const editKey = `${student.inscriptionSubjectId}-${planItem.id}`;
            const editValue = qualEdits[editKey];
            const isAbsent = !!qual?.isAbsent;
            const displayValue = editValue !== undefined ? editValue : (qual ? Number(qual.score) : null);
            const isApproved = student.finalGrade?.status === 'aprobada';
            // Show NP overlay when absent (and not currently editing)
            const showNp = isAbsent && editValue === undefined;
            return (
              <div className="mp-grading-cell" style={{ position: 'relative' }}>
                <InputNumber
                  size="small"
                  min={0}
                  max={20}
                  step={1}
                  value={displayValue}
                  disabled={isApproved}
                  style={{ width: 60 }}
                  onChange={v => setQualEdits(prev => ({ ...prev, [editKey]: v }))}
                  onBlur={() => {
                    if (editValue !== undefined && editValue !== null) {
                      handleSaveQualification(student, planItem, editValue);
                    }
                  }}
                  onPressEnter={() => {
                    if (editValue !== undefined && editValue !== null) {
                      handleSaveQualification(student, planItem, editValue);
                    }
                  }}
                />
                {showNp && <span className="mp-np-overlay">NP</span>}
              </div>
            );
          },
        });
      });
    }

    // Final grade column
    baseCols.push({
      title: 'Nota Final',
      key: 'finalGrade',
      width: 110,
      render: (_, r) => {
        if (!r.finalGrade || r.finalGrade.finalScore == null) {
          return <Tag color="default">Sin nota</Tag>;
        }
        const isApproved = r.finalGrade.status === 'aprobada';
        const isAbsent = r.finalGrade.finalScore === 0;
        return (
          <Tag color={isApproved ? 'success' : 'error'}>
            {isAbsent ? 'NP' : Number(r.finalGrade.finalScore).toFixed(0)} — {isApproved ? 'Aprobada' : 'Reprobada'}
          </Tag>
        );
      },
    });

    // Date column — shows the date from the evaluation plan
    baseCols.push({
      title: 'Fecha',
      key: 'date',
      width: 100,
      render: (_, r) => r.finalGrade?.calculatedAt
        ? dayjs(r.finalGrade.calculatedAt).format('DD/MM/YYYY')
        : '—',
    });

    // Direct grade button — only show when there are no evaluation plan items
    if (!detail?.evaluationPlans.length) {
      baseCols.push({
        title: 'Directa',
        key: 'actions',
        width: 90,
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
            Nota
          </Button>
        ),
      });
    }

    return baseCols;
  }, [detail, qualEdits]);

  /* ------------------- Plan items columns ------------------- */
  const planColumns: ColumnsType<EvaluationPlanItem> = [
    { title: 'Descripción', dataIndex: 'description', key: 'description' },
    {
      title: 'Lapso',
      key: 'term',
      width: 120,
      render: (_, r) => r.term?.name || '—',
    },
    {
      title: 'Porcentaje',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 100,
      render: v => `${v}%`,
    },
    {
      title: 'Fecha',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 120,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openPlanModal(r)} />
          <Popconfirm
            title="¿Eliminar este item?"
            description="Se eliminarán también las calificaciones asociadas."
            onConfirm={() => handleDeletePlanItem(r.id)}
            okText="Sí"
            cancelText="No"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /* ------------------- Render ------------------- */
  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
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
                  label: a.subjectName,
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
                    label: `Estudiantes (${detail.students.length})`,
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
                          description="Si un estudiante aprueba en cualquier item de evaluación (nota ≥ 10), la materia queda aprobada inmediatamente con la fecha del plan. Los lapsos NO se promedian. También puede usar el botón «Nota» para registrar una nota final directa."
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                        {detail.students.length === 0 ? (
                          <Empty description="No hay estudiantes registrados" />
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <Table
                              dataSource={detail.students}
                              columns={studentColumns}
                              rowKey="inscriptionSubjectId"
                              size="small"
                              pagination={false}
                              scroll={{ x: 'max-content' }}
                              rowClassName={r => r.finalGrade?.status === 'aprobada' ? 'mp-row-approved' : ''}
                            />
                          </div>
                        )}
                      </Card>
                    ),
                  },
                  {
                    key: 'plan',
                    label: `Plan de Evaluación (${detail.evaluationPlans.length})`,
                    children: (
                      <Card
                        title={
                          <Space>
                            <CalendarOutlined />
                            <span>Plan de Evaluación</span>
                            <Button
                              size="small"
                              type="primary"
                              icon={<PlusOutlined />}
                              onClick={() => openPlanModal()}
                            >
                              Nuevo item
                            </Button>
                          </Space>
                        }
                      >
                        {detail.evaluationPlans.length === 0 ? (
                          <Empty description="No hay items de evaluación. Cree items para calificar por lapsos, o use nota directa en la tab de Estudiantes." />
                        ) : (
                          <Table
                            dataSource={detail.evaluationPlans}
                            columns={planColumns}
                            rowKey="id"
                            size="small"
                            pagination={false}
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

      {/* Direct grade modal */}
      <Modal
        open={gradeModalOpen}
        title="Registrar Nota Directa de Materia Pendiente"
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
          <InputNumber min={0} max={20} step={1} value={gradeValue} onChange={v => setGradeValue(v)} style={{ width: 120 }} autoFocus />
          <Text type="secondary" style={{ fontSize: 12 }}>(0=NP, 1-20, mínimo 10)</Text>
          {gradeValue === 0 && <Tag color="red">NP (Inasistente)</Tag>}
        </div>
        <Alert
          type="warning"
          message="Esta nota reemplaza cualquier calificación del plan de evaluación."
          style={{ marginTop: 16 }}
          showIcon
        />
      </Modal>

      {/* Plan item modal (create/edit) */}
      <Modal
        open={planModalOpen}
        title={planEditingId ? 'Editar Item de Evaluación' : 'Nuevo Item de Evaluación'}
        onCancel={() => setPlanModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setPlanModalOpen(false)}>Cancelar</Button>,
          <Button key="save" type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSavePlanItem}>
            {planEditingId ? 'Actualizar' : 'Crear'}
          </Button>,
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text>Descripción:</Text>
            <Input
              value={planForm.description}
              onChange={e => setPlanForm({ ...planForm, description: e.target.value })}
              style={{ marginTop: 4 }}
              placeholder="Ej: Examen, Taller, etc."
            />
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
            <InputNumber
              min={1}
              max={100}
              value={planForm.percentage}
              onChange={v => setPlanForm({ ...planForm, percentage: v || 100 })}
              style={{ width: '100%', marginTop: 4 }}
              addonAfter="%"
            />
          </div>
          <div>
            <Text>Fecha de evaluación:</Text>
            <DatePicker
              style={{ width: '100%', marginTop: 4 }}
              value={planForm.date}
              onChange={d => setPlanForm({ ...planForm, date: d || dayjs() })}
              format="DD/MM/YYYY"
            />
          </div>
        </div>
      </Modal>

      <style>{`
        .mp-row-approved {
          background: #f6ffed !important;
        }
        .mp-row-approved:hover > td {
          background: #d9f7be !important;
        }
        .mp-grading-cell { position: relative; }
        .mp-np-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fef2f2;
          color: #dc2626;
          font-weight: 700;
          font-size: 14px;
          pointer-events: none;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default PendingSubjectTeacherPanel;
