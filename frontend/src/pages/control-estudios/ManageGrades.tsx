import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Tabs, Table, Button, message, Tag, Typography, Alert, Empty, Spin, Space } from 'antd';
import { BookOutlined, UserOutlined, ArrowLeftOutlined, DownloadOutlined, FilePdfOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import api from '@/services/api';
import dayjs from 'dayjs';
import { useGradeRounding } from '@/context/GradeRoundingContext';
import { formatGrade } from '@/utils/gradeFormat';
import EvaluationPlanPDFModal from '@/components/pdf/EvaluationPlanPDFModal';
import type { EvaluationPlanHeaderData } from '@/components/pdf/EvaluationPlanPDF';
import EvaluationPlanItemModal from '@/components/EvaluationPlanItemModal';

const { Title, Text } = Typography;

const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch { /* ignore */ }
};

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
  periodGradeSubject: {
    id: number;
    subject: { id: number; name: string };
    periodGrade: {
      id: number;
      grade: { id: number; name: string; order: number };
      schoolPeriod: { id: number; name: string; isActive: boolean };
    };
  };
  section: { id: number; name: string };
  teacher: { id: number; firstName: string; lastName: string; document: string };
}

interface EvaluationPlanItem {
  id: number;
  description: string;
  objetivo: string;
  tecnica: string;
  identificador: string;
  percentage: number;
  date: string;
  temaGenerador?: string;
  referentesTeoricos?: string;
  referentesEticos?: string;
  estrategiaEvaluacion?: string;
  tipoEvaluacion?: string;
  formaEvaluacion?: string;
  indicador?: string;
}

interface Qualification {
  id: number;
  evaluationPlanId: number;
  score: number;
  observations?: string;
  remedialScore?: number | null;
  isAbsent?: boolean;
  editedByOther?: boolean;
}

interface StudentEnrollment {
  id: number;
  student: { firstName: string; lastName: string; document: string };
  inscriptionSubjects: Array<{
    id: number;
    qualifications: Qualification[];
  }>;
}

const ManageGrades: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [availableTerms, setAvailableTerms] = useState<Term[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
  const [evaluationPlan, setEvaluationPlan] = useState<EvaluationPlanItem[]>([]);
  const [students, setStudents] = useState<StudentEnrollment[]>([]);
  const [maxGrade, setMaxGrade] = useState<number>(20);
  const [passingGrade, setPassingGrade] = useState<number>(10);
  const [activeTab, setActiveTab] = useState('1');
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EvaluationPlanItem | null>(null);
  const { enableRounding } = useGradeRounding();

  const isSelectedTermBlocked = useMemo(() => {
    if (!selectedTerm) return false;
    const term = availableTerms.find(t => t.id === selectedTerm);
    return term?.isBlocked ?? false;
  }, [availableTerms, selectedTerm]);

  const selectedTermDateRange = useMemo(() => {
    if (!selectedTerm) return { openDate: null as dayjs.Dayjs | null, closeDate: null as dayjs.Dayjs | null };
    const term = availableTerms.find(t => t.id === selectedTerm);
    return {
      openDate: term?.openDate ? dayjs(term.openDate) : null,
      closeDate: term?.closeDate ? dayjs(term.closeDate) : null,
    };
  }, [availableTerms, selectedTerm]);

  // Group assignments by grade
  const groupedAssignments = useMemo(() => {
    const groups = new Map<number, { gradeName: string; assignments: Assignment[] }>();
    allAssignments.forEach(a => {
      const pg = a.periodGradeSubject?.periodGrade;
      const grade = pg?.grade;
      if (!grade) return;
      if (!groups.has(grade.id)) {
        groups.set(grade.id, { gradeName: grade.name, assignments: [] });
      }
      groups.get(grade.id)!.assignments.push(a);
    });
    return Array.from(groups.values());
  }, [allAssignments]);

  useEffect(() => {
    fetchAllAssignments();
    fetchTerms();
    fetchMaxGrade();
  }, []);

  const fetchMaxGrade = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data?.max_grade) setMaxGrade(Number(res.data.max_grade));
      if (res.data?.passing_grade) setPassingGrade(Number(res.data.passing_grade));
    } catch { /* ignore */ }
  };

  const fetchAllAssignments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/evaluation/all-assignments');
      setAllAssignments(res.data);
    } catch {
      message.error('Error al cargar asignaciones');
    } finally {
      setLoading(false);
    }
  };

  const fetchTerms = async () => {
    try {
      const periodRes = await api.get('/academic/active');
      if (periodRes.data) {
        const termsRes = await api.get(`/terms?schoolPeriodId=${periodRes.data.id}`);
        setAvailableTerms(termsRes.data);
        const activeTerm = termsRes.data.find((t: Term) => !t.isBlocked);
        if (activeTerm) setSelectedTerm(activeTerm.id);
        else if (termsRes.data.length > 0) setSelectedTerm(termsRes.data[0].id);
      }
    } catch { /* ignore */ }
  };

  const fetchPlanAndStudents = useCallback(async () => {
    if (!selectedAssignment || !selectedTerm) return;
    setLoading(true);
    try {
      const [planRes, studentsRes] = await Promise.all([
        api.get(`/evaluation/plan/${selectedAssignment.periodGradeSubjectId}?term=${selectedTerm}&sectionId=${selectedAssignment.sectionId}`),
        api.get(`/evaluation/students/${selectedAssignment.id}`)
      ]);
      setEvaluationPlan(planRes.data || []);
      setStudents(studentsRes.data || []);
    } catch {
      message.error('Error al cargar datos del lapso');
      setEvaluationPlan([]);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedAssignment, selectedTerm]);

  useEffect(() => {
    fetchPlanAndStudents();
  }, [fetchPlanAndStudents]);

  const handleSaveScoreInGrid = async (enrollment: StudentEnrollment, evalPlanId: number, score: number | null) => {
    if (isSelectedTermBlocked) {
      message.warning('Este lapso está bloqueado.');
      return;
    }
    const inscriptionSubjectId = enrollment.inscriptionSubjects?.[0]?.id;
    try {
      await api.post('/evaluation/qualifications', {
        evaluationPlanId: evalPlanId,
        inscriptionSubjectId,
        inscriptionId: enrollment.id,
        score: score === null ? 0 : score,
        isAbsent: false,
        observations: ''
      });
      fetchPlanAndStudents();
    } catch {
      message.error('Error al guardar nota');
    }
  };

const handleToggleAbsent = async (enrollment: StudentEnrollment, evalPlanId: number, currentIsAbsent?: boolean) => {
    if (isSelectedTermBlocked) {
      message.warning('Este lapso está bloqueado.');
      return;
    }

    const insSub = enrollment.inscriptionSubjects?.[0];
    const existingQ = insSub?.qualifications?.find(q => q.evaluationPlanId === evalPlanId);
    const previousScore = existingQ?.score;
    const previousRemedial = existingQ?.remedialScore;

    // Optimistic update: toggle locally immediately
    setStudents(prev => prev.map(s => {
      if (s.id !== enrollment.id) return s;
      const insSubS = s.inscriptionSubjects?.[0];
      if (!insSubS) return s;
      const quals = insSubS.qualifications?.some(q => q.evaluationPlanId === evalPlanId)
        ? insSubS.qualifications.map(q => q.evaluationPlanId === evalPlanId
          ? { ...q, isAbsent: !currentIsAbsent, score: !currentIsAbsent ? 0 : (previousScore ?? q.score), remedialScore: !currentIsAbsent ? null : (previousRemedial ?? q.remedialScore) }
          : q)
        : [...(insSubS.qualifications || []), {
            id: 0, evaluationPlanId: evalPlanId, score: 0, isAbsent: !currentIsAbsent
          }];
      return {
        ...s,
        inscriptionSubjects: [{ ...insSubS, qualifications: quals }]
      };
    }));

    // Sync with backend
    const inscriptionSubjectId = enrollment.inscriptionSubjects?.[0]?.id;
    try {
      await api.post('/evaluation/qualifications', {
        evaluationPlanId: evalPlanId,
        inscriptionSubjectId,
        inscriptionId: enrollment.id,
        isAbsent: !currentIsAbsent,
        score: !currentIsAbsent ? 0 : (previousScore ?? undefined),
        remedialScore: !currentIsAbsent ? null : (previousRemedial ?? undefined),
        observations: ''
      });
    } catch {
      message.error('Error al cambiar estado de inasistencia');
      fetchPlanAndStudents(); // revert to server state on error
    }
  };

  const handleSelectAssignment = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setActiveTab('1');
  };

  const handleBack = () => {
    setSelectedAssignment(null);
    setEvaluationPlan([]);
    setStudents([]);
  };

  const handleDeletePlanItem = async (id: number) => {
    if (isSelectedTermBlocked) {
      message.warning('Este lapso está bloqueado. No se puede modificar el plan de evaluación.');
      return;
    }
    try {
      await api.delete(`/evaluation/plan/${id}`);
      message.success('Item eliminado');
      fetchPlanAndStudents();
    } catch {
      message.error('Error al eliminar');
    }
  };

  const pendingGradesCount = useMemo(() => {
    if (evaluationPlan.length === 0 || students.length === 0) return { missing: 0, total: 0 };
    let missing = 0;
    students.forEach(enrollment => {
      const insSub = enrollment.inscriptionSubjects?.[0];
      const quals = insSub?.qualifications || [];
      const hasAll = evaluationPlan.every(plan => {
        return quals.some((q: Qualification) => q.evaluationPlanId === plan.id && (!!q.isAbsent || (q.score !== null && q.score > 0)));
      });
      if (!hasAll) missing++;
    });
    return { missing, total: students.length };
  }, [evaluationPlan, students]);

  const evalStats = useMemo(() => {
    const map = new Map<number, { failed: number; failedPct: number; missing: number; missingPct: number; date: string }>();
    if (students.length === 0) return map;
    evaluationPlan.forEach(ep => {
      let failed = 0;
      let missing = 0;
      students.forEach(enrollment => {
        const insSub = enrollment.inscriptionSubjects?.[0];
        const q = insSub?.qualifications?.find((sq: Qualification) => sq.evaluationPlanId === ep.id);
        if (!!q?.isAbsent) {
          missing++;
        } else if (!q || q.score === null) {
          // No grade at all
        } else if (q.score <= 0) {
          failed++;
        } else if (q.score < passingGrade) {
          failed++;
        }
      });
      map.set(ep.id, {
        failed,
        failedPct: students.length > 0 ? Math.round((failed / students.length) * 100) : 0,
        missing,
        missingPct: students.length > 0 ? Math.round((missing / students.length) * 100) : 0,
        date: ep.date,
      });
    });
    return map;
  }, [evaluationPlan, students, passingGrade]);

  const totalPercentage = evaluationPlan?.reduce((acc, curr) => acc + Number(curr?.percentage || 0), 0) || 0;

  const downloadExcel = async (filled: boolean) => {
    if (!selectedAssignment?.id) return;
    try {
      const res = await api.get(`/evaluation/export-grades/${selectedAssignment.id}`, {
        params: { filled: filled ? 'true' : 'false' },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filled ? 'calificaciones.xlsx' : 'plantilla-calificaciones.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Error al descargar Excel');
    }
  };

  const planColumns = [
    { title: 'ID', dataIndex: 'identificador', key: 'identificador', width: 80 },
    { title: 'Tema Generador', dataIndex: 'temaGenerador', key: 'temaGenerador', ellipsis: true, width: 150 },
    { title: 'Referentes Teóricos', key: 'refTeoricos', width: 180,
      render: (_: unknown, r: any) => {
        const items = typeof r.referentesTeoricos === 'string' ? (() => { try { return JSON.parse(r.referentesTeoricos); } catch { return [r.referentesTeoricos]; } })() : r.referentesTeoricos;
        if (Array.isArray(items) && items.length > 0) {
          return <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{items.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>;
        }
        return <span style={{ fontSize: 12 }}>{Array.isArray(items) ? '-' : (r.referentesTeoricos || '-')}</span>;
      }
    },
    { title: 'Referentes Éticos e Indispensables', key: 'refEticos', width: 180,
      render: (_: unknown, r: any) => {
        const items = typeof r.referentesEticos === 'string' ? (() => { try { return JSON.parse(r.referentesEticos); } catch { return [r.referentesEticos]; } })() : r.referentesEticos;
        if (Array.isArray(items) && items.length > 0) {
          return <Space size={[2, 2]} wrap>{items.map((c: string) => <Tag key={c} style={{ fontSize: 11 }}>{c}</Tag>)}</Space>;
        }
        return <span style={{ fontSize: 12 }}>-</span>;
      }
    },
    { title: 'Técnicas e Instrumento', dataIndex: 'tecnica', key: 'tecnica', width: 120 },
    { title: 'Estrategia de evaluación', dataIndex: 'description', key: 'description', width: 120 },
    { title: 'Indicador', key: 'indicadorCol', width: 180,
      render: (_: unknown, r: any) => {
        const items = typeof r.indicador === 'string' ? (() => { try { return JSON.parse(r.indicador); } catch { return [r.indicador]; } })() : r.indicador;
        if (Array.isArray(items) && items.length > 0) {
          return <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{items.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>;
        }
        return <span style={{ fontSize: 12 }}>{Array.isArray(items) ? '-' : (r.indicador || '-')}</span>;
      }
    },
    { title: 'Puntaje', dataIndex: 'percentage', key: 'percentage', render: (v: number) => `${v}%`, width: 70 },
    { title: 'Fecha', dataIndex: 'date', key: 'date', render: (v: string) => dayjs(v).format('DD/MM/YYYY'), width: 90 },
    {
      title: 'Acciones',
      key: 'actions',
      width: 90,
      render: (_: unknown, record: EvaluationPlanItem) => (
        <Space>
          {!isSelectedTermBlocked && (
            <>
              <Button
                icon={<EditOutlined />}
                size="small"
                onClick={() => {
                  setEditingItem(record);
                  setShowPlanModal(true);
                }}
              />
              <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDeletePlanItem(record.id)} />
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6" style={{ backgroundColor: 'var(--color-page-bg)' }}>
      <style>{`
        @keyframes flash-red {
          0%, 100% { outline: 3px solid #ef4444; }
          50% { outline: 3px solid transparent; }
        }
        .grade-invalid { animation: flash-red 0.5s ease-in-out 3; }
        .grading-absent { position: relative; }
        .grading-absent::before {
          content: 'NP';
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
          z-index: 1;
        }
        .grading-absent input { opacity: 0; }
      `}</style>
      {!selectedAssignment ? (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-black" style={{ color: 'var(--color-text-main)' }}>Calificaciones por Sección</h1>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Selecciona una sección para ver y editar sus calificaciones
            </p>
          </div>

          <Spin spinning={loading}>
            {groupedAssignments.length === 0 ? (
              <Card style={{ backgroundColor: 'var(--color-content-bg)' }}>
                <Empty description="No hay secciones configuradas en el período activo" />
              </Card>
            ) : (
              groupedAssignments.map((group) => (
                <div key={group.gradeName} className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOutlined style={{ color: 'var(--color-brand-primary)' }} />
                    <Title level={5} style={{ margin: 0, color: 'var(--color-text-main)' }}>
                      {group.gradeName}
                    </Title>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {group.assignments.map((a) => (
                      <Card
                        key={a.id}
                        hoverable
                        size="small"
                        onClick={() => handleSelectAssignment(a)}
                        style={{ cursor: 'pointer', backgroundColor: 'var(--color-content-bg)' }}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <Tag color="blue">{a.section.name}</Tag>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-main)' }}>
                              {a.periodGradeSubject.subject.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                            <UserOutlined />
                            <span>{a.teacher?.firstName} {a.teacher?.lastName}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))
            )}
          </Spin>
        </>
      ) : (
        <>
          {/* Back button and header */}
          <div className="flex items-center gap-3 mb-4">
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>Volver</Button>
            <div>
              <Title level={4} style={{ margin: 0, color: 'var(--color-text-main)' }}>
                {selectedAssignment.periodGradeSubject.subject.name}
              </Title>
              <Text style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                {selectedAssignment.periodGradeSubject.periodGrade.grade.name} • Sección {selectedAssignment.section.name} • Prof. {selectedAssignment.teacher?.firstName} {selectedAssignment.teacher?.lastName}
              </Text>
            </div>
          </div>

          {/* Term selector */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {availableTerms.map(term => (
              <Button
                key={term.id}
                size="small"
                type={selectedTerm === term.id ? 'primary' : 'default'}
                onClick={() => setSelectedTerm(term.id)}
              >
                {term.name}
                {term.isBlocked && ' 🔒'}
              </Button>
            ))}
          </div>

          {isSelectedTermBlocked && (
            <Alert message="Lapso bloqueado. No se pueden modificar calificaciones ni el plan de evaluación." type="warning" showIcon className="mb-4" />
          )}

          <Tabs activeKey={activeTab} onChange={setActiveTab}
            items={[
              {
                key: '1',
                label: 'Plan de Evaluación',
                children: (
                  <>
                    <Table
                      loading={loading}
                      columns={planColumns}
                      dataSource={evaluationPlan}
                      rowKey="id"
                      pagination={false}
                      size="small"
                      bordered
                      scroll={{ x: 1000 }}
                      style={{ backgroundColor: 'var(--color-content-bg)' }}
                    />
                    {!isSelectedTermBlocked && selectedAssignment && (
                      <div
                        className="mt-4 w-full h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer border-none shadow-sm hover:scale-[1.01]"
                        style={{ 
                          backgroundColor: 'var(--color-accent)',
                          color: 'var(--color-header-text)' 
                        }}
                        onClick={() => {
                          setEditingItem(null);
                          setShowPlanModal(true);
                        }}
                      >
                        <PlusOutlined className="text-3xl font-bold" />
                      </div>
                    )}
                    <div className="mt-4 flex justify-end items-center px-2">
                      <span className="font-black" style={{ color: 'var(--color-text-main)' }}>Total Puntaje Acumulado: {totalPercentage}%</span>
                    </div>
                  </>
                )
              },
              {
                key: '2',
                label: 'Calificaciones',
                children: evaluationPlan.length === 0 ? (
                  <Card style={{ backgroundColor: 'var(--color-input-bg)', textAlign: 'center', padding: 40 }}>
                    <Title level={4}>No hay Plan de Evaluación</Title>
                    <Text type="secondary">Primero debe definirse el plan de evaluación para este lapso.</Text>
                  </Card>
                ) : (
                  <Card bodyStyle={{ padding: 0 }} style={{ overflow: 'hidden', backgroundColor: 'var(--color-input-bg)' }}>
                    <div className="flex items-center justify-between p-3 flex-wrap gap-2">
                      <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        {pendingGradesCount.missing > 0
                          ? `⚠ ${pendingGradesCount.missing} de ${pendingGradesCount.total} alumnos con notas pendientes`
                          : `✓ Todos los alumnos calificados (${pendingGradesCount.total})`}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button icon={<FilePdfOutlined />} size="small" onClick={() => setShowPDFModal(true)} disabled={evaluationPlan.length === 0}>PDF</Button>
                        <Button icon={<DownloadOutlined />} size="small" onClick={() => downloadExcel(true)} disabled={students.length === 0}>Excel con notas</Button>
                        <Button icon={<DownloadOutlined />} size="small" onClick={() => downloadExcel(false)}>Excel vacío</Button>
                      </div>
                    </div>
                    <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid var(--color-text-muted)' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                          <tr>
                            <th style={{ padding: '4px 6px', border: '1px solid var(--color-text-muted)', textAlign: 'center', backgroundColor: '#e5e7eb', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>Cédula</th>
                            <th style={{ padding: '4px 6px', border: '1px solid var(--color-text-muted)', textAlign: 'left', backgroundColor: '#e5e7eb', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>Estudiante</th>
                            {evaluationPlan.map(item => {
                              const stats = evalStats.get(item.id);
                              return (
                              <th key={item.id} colSpan={2} style={{ padding: '3px 4px', border: '1px solid var(--color-text-muted)', textAlign: 'center', backgroundColor: '#e5e7eb', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                <div style={{ fontSize: 9, color: '#b45309', lineHeight: 1.2 }}>
                                  Apl. {stats?.failed ?? 0} ({stats?.failedPct ?? 0}%)
                                </div>
                                <div style={{ fontSize: 9, color: '#dc2626', lineHeight: 1.2, marginTop: 1 }}>
                                  Ina. ({stats?.missingPct ?? 0}%)
                                </div>
                                <br />
                                <div style={{ fontSize: 9, fontWeight: 600, lineHeight: 1.2 }}>
                                  {item.date ? new Date(item.date).toLocaleDateString('es-VE') : '—'}
                                </div>
                                <div style={{ fontSize: 9, fontWeight: 700, lineHeight: 1.2, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.identificador}>
                                  {item.identificador || '—'}
                                </div>
                                <div style={{ fontSize: 9, color: 'var(--color-text-muted)', lineHeight: 1.2, marginTop: 1 }}>
                                  {item.percentage}%
                                </div>
                              </th>
                              );
                            })}
                            <th style={{ padding: '3px 6px', border: '1px solid var(--color-text-muted)', textAlign: 'center', backgroundColor: '#e5e7eb', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...students]
                            .sort((a, b) => {
                              const nameA = `${a.student?.lastName} ${a.student?.firstName}`.toLowerCase();
                              const nameB = `${b.student?.lastName} ${b.student?.firstName}`.toLowerCase();
                              return nameA.localeCompare(nameB);
                            })
                            .map((enrollment, rowIndex) => {
                              const insSub = enrollment.inscriptionSubjects?.[0];
                              const studentQuals = insSub?.qualifications || [];
                              let rowTotal = 0;
                              evaluationPlan.forEach(item => {
                                const q = studentQuals.find((sq: Qualification) => sq.evaluationPlanId === item.id);
                                if (q) {
                                  if (q.isAbsent) {
                                    // absent counts as 0
                                  } else {
                                    const effectiveScore = q.remedialScore != null && q.remedialScore > 0 ? q.remedialScore : q.score;
                                    rowTotal += (Number(effectiveScore) * Number(item.percentage)) / 100;
                                  }
                                }
                              });

                              return (
                                <tr key={enrollment.id}>
                                  <td style={{ padding: '2px 4px', border: '1px solid var(--color-text-muted)', textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-input-bg)' : '#f9fafb', fontSize: 11, fontWeight: 500 }}>
                                    {enrollment.student?.document || '-'}
                                  </td>
                                  <td style={{ padding: '2px 6px', border: '1px solid var(--color-text-muted)', textAlign: 'left', background: rowIndex % 2 === 0 ? 'var(--color-input-bg)' : '#f9fafb', fontSize: 12 }}>
                                    {enrollment.student?.lastName}, {enrollment.student?.firstName}
                                  </td>
                                   {evaluationPlan.map((item, colIndex) => {
                                    const q = studentQuals.find((sq: Qualification) => sq.evaluationPlanId === item.id);
                                    const isAbsent = !!(q?.isAbsent);
                                    return (
                                      <>
                                      <td key={`${item.id}-a`} className={`grading-cell${isAbsent ? ' grading-absent' : ''}`} style={{ padding: '2px', border: '1px solid var(--color-text-muted)', textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-input-bg)' : '#f9fafb', width: '50px', cursor: 'context-menu' }}
                                        title="Click derecho: marcar/desmarcar inasistente"
                                        onContextMenu={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleToggleAbsent(enrollment, item.id, q?.isAbsent);
                                        }}
                                      >
                                        <input
                                          type="number"
                                          id={`grade-${rowIndex}-${colIndex}`}
                                          min={0}
                                          max={maxGrade}
                                          step={1}
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          defaultValue={isAbsent ? '' : (q?.score != null ? Math.round(q.score) : '')}
                                          key={`${enrollment.id}-${item.id}${isAbsent ? '-a' : ''}`}
                                          style={{
                                            width: '48px',
                                            textAlign: 'center',
                                            border: q?.editedByOther ? '1px solid #93c5fd' : 'none',
                                            outline: 'none',
                                            borderRadius: q?.editedByOther ? 4 : undefined,
                                            boxShadow: q?.editedByOther ? '0 0 0 1px #bfdbfe inset' : undefined,
                                            background: q?.editedByOther ? '#eff6ff' : 'transparent',
                                            fontSize: 12,
                                            padding: q?.editedByOther ? '1px' : 0,
                                            color: q?.score != null && q.score > 0 && q.score < passingGrade ? '#dc2626' : undefined,
                                            fontWeight: q?.score != null && q.score > 0 && q.score < passingGrade ? 700 : undefined,
                                          }}
                                          title={q?.editedByOther ? 'Nota editada por otra persona (diferente al profesor)' : undefined}
                                          disabled={isSelectedTermBlocked}
                                          onKeyDown={(e) => {
                                            if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E' || e.key === '-' || e.key === '+') {
                                              e.preventDefault();
                                              return;
                                            }
                                            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                                              e.preventDefault();
                                              let nextRow = rowIndex;
                                              let nextCol = colIndex;
                                              if (e.key === 'ArrowUp') nextRow--;
                                              if (e.key === 'ArrowDown') nextRow++;
                                              if (e.key === 'ArrowLeft') nextCol--;
                                              if (e.key === 'ArrowRight') nextCol++;
                                              if (nextRow < 0 || nextRow >= students.length || nextCol < 0 || nextCol >= evaluationPlan.length) return;
                                              setTimeout(() => {
                                                const el = document.getElementById(`grade-${nextRow}-${nextCol}`) as HTMLInputElement | null;
                                                if (el) el.focus();
                                              }, 0);
                                            }
                                          }}
                                          onInput={(e: React.FormEvent<HTMLInputElement>) => {
                                            (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
                                          }}
                                          onBlur={(e) => {
                                            const raw = e.target.value.replace(/[^0-9]/g, '');
                                            e.target.value = raw;
                                            if (raw === '') return;
                                            const val = parseInt(raw, 10);
                                            const currentScore = q ? q.score : null;
                                            if (val < 0 || val > maxGrade) {
                                              playBeep();
                                              const wrapper = e.target.closest('.grading-cell');
                                              if (wrapper) {
                                                e.target.value = '';
                                                wrapper.classList.add('grade-invalid');
                                                setTimeout(() => wrapper.classList.remove('grade-invalid'), 1500);
                                              }
                                              return;
                                            }
                                            if (val !== currentScore) {
                                              handleSaveScoreInGrid(enrollment, item.id, val);
                                            }
                                          }}
                                        />
                                      </td>
                                      <td key={`${item.id}-b`} style={{ padding: '2px', border: '1px solid var(--color-text-muted)', background: rowIndex % 2 === 0 ? 'var(--color-input-bg)' : '#f9fafb', width: '50px' }} onContextMenu={(e) => e.preventDefault()}></td>
                                      </>
                                    );
                                  })}
                                  <td style={{ padding: '2px 4px', border: '1px solid var(--color-text-muted)', textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-input-bg)' : '#f9fafb', fontWeight: 700, fontSize: 12 }}>
                                    <Tag color={rowTotal >= (maxGrade * 0.5) ? 'green' : 'red'}>
                                      {formatGrade(rowTotal, enableRounding)}
                                    </Tag>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                    {students.length === 0 && (
                      <div style={{ padding: 40, textAlign: 'center' }}>
                        <Alert message="No hay estudiantes inscritos en esta sección" type="info" />
                      </div>
                    )}
                  </Card>
                )
              }
            ]}
          />
        </>
      )}

      <EvaluationPlanPDFModal
        open={showPDFModal}
        onClose={() => setShowPDFModal(false)}
        header={(() => {
          if (!selectedAssignment) return null as unknown as EvaluationPlanHeaderData;
          const termObj = availableTerms.find(t => t.id === selectedTerm);
          return {
            periodName: selectedAssignment.periodGradeSubject?.periodGrade?.schoolPeriod?.name || '-',
            gradeName: selectedAssignment.periodGradeSubject?.periodGrade?.grade?.name || '-',
            subjectName: selectedAssignment.periodGradeSubject?.subject?.name || '-',
            sectionName: selectedAssignment.section?.name || '-',
            termName: termObj?.name || '-',
            teacherName: selectedAssignment.teacher
              ? `${selectedAssignment.teacher.firstName} ${selectedAssignment.teacher.lastName}`
              : '-',
          };
        })()}
        items={evaluationPlan.map(ep => ({
          identificador: ep.identificador,
          description: ep.description,
          tecnica: ep.tecnica,
          objetivo: ep.objetivo,
          tipoEvaluacion: ep.tipoEvaluacion,
          formaEvaluacion: ep.formaEvaluacion,
          indicador: ep.indicador,
          temaGenerador: ep.temaGenerador,
          referentesTeoricos: ep.referentesTeoricos,
          referentesEticos: ep.referentesEticos,
          estrategiaEvaluacion: ep.estrategiaEvaluacion,
          percentage: Number(ep.percentage),
          date: ep.date,
        }))}
      />

      {selectedAssignment && selectedTerm && (
        <EvaluationPlanItemModal
          open={showPlanModal}
          onClose={() => setShowPlanModal(false)}
          onSaved={fetchPlanAndStudents}
          editingItem={editingItem}
          periodGradeSubjectId={selectedAssignment.periodGradeSubjectId}
          sectionId={selectedAssignment.sectionId}
          termId={selectedTerm}
          selectedTermDateRange={selectedTermDateRange}
          schoolPeriod={selectedAssignment.periodGradeSubject?.periodGrade?.schoolPeriod}
          existingItems={evaluationPlan}
        />
      )}
    </div>
  );
};

export default ManageGrades;