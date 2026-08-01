import React, { useState, useEffect, useCallback, Component, useMemo } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, Card, Table, Button, message, Space, Tag, Typography, Alert, Empty, Tooltip } from 'antd';
import { BookOutlined, PlusOutlined, DeleteOutlined, EditOutlined, LockOutlined, FilePdfOutlined, DownloadOutlined, ToolOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { isAxiosError } from 'axios';
import api from '@/services/api';
import dayjs from 'dayjs';
import { useGradeRounding } from '@/context/GradeRoundingContext';
import { formatGrade } from '@/utils/gradeFormat';
import EvaluationPlanPDFModal from '@/components/pdf/EvaluationPlanPDFModal';
import type { EvaluationPlanHeaderData } from '@/components/pdf/EvaluationPlanPDF';
import EvaluationPlanItemModal from '@/components/EvaluationPlanItemModal';

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



interface Qualification {
  id: number;
  evaluationPlanId: number;
  score: number;
  observations?: string;
  remedialScore?: number | null;
  isAbsent?: boolean;
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
  identificador: string;
  percentage: number;
  date: string;
  tecnica: string;
  temaGenerador?: string;
  referentesTeoricos?: string | string[];
  referentesEticos?: string | string[];
  indicador?: string | string[];
  objetivo?: string;
  tipoEvaluacion?: string;
  formaEvaluacion?: string;
  estrategiaEvaluacion?: string;
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
  teacher?: {
    id: number;
    firstName: string;
    lastName: string;
  };
}



const TeacherPanel: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
  const [availableTerms, setAvailableTerms] = useState<Term[]>([]);
  const [evaluationPlan, setEvaluationPlan] = useState<EvaluationPlanItem[]>([]);
  const [students, setStudents] = useState<StudentEnrollment[]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EvaluationPlanItem | null>(null);
  const [activeTab, setActiveTab] = useState('1');
  const [maxGrade, setMaxGrade] = useState<number>(20);
  const [passingGrade, setPassingGrade] = useState<number>(10);
  const [remedialFailurePercentage, setRemedialFailurePercentage] = useState<number>(30);
  const [remedialMinGrade, setRemedialMinGrade] = useState<number>(1);
  const [remedialMaxGrade, setRemedialMaxGrade] = useState<number>(9);
  const [showPDFModal, setShowPDFModal] = useState(false);
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
          // No grade at all — neither failed nor absent
        } else if (q.score <= 0) {
          // Score is 0 — count as failed (reprobado)
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

  useEffect(() => {
    const fetchMaxGrade = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data?.max_grade) setMaxGrade(Number(res.data.max_grade));
        if (res.data?.passing_grade) setPassingGrade(Number(res.data.passing_grade));
        if (res.data?.remedial_failure_percentage !== undefined) {
          setRemedialFailurePercentage(Number(res.data.remedial_failure_percentage));
        }
        if (res.data?.remedial_min_grade !== undefined) {
          setRemedialMinGrade(Number(res.data.remedial_min_grade));
        }
        if (res.data?.remedial_max_grade !== undefined) {
          setRemedialMaxGrade(Number(res.data.remedial_max_grade));
        }
      } catch {
        console.error('Error fetching settings');
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
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        console.error('fetchPlanAndStudents: API call failed', error);
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
      } else if (error instanceof Error) {
        console.error('fetchPlanAndStudents: API call failed', error);
        console.error('Error details:', {
          message: error.message
        });
      } else {
        console.error('Unexpected error', error);
      }

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

  if (!loading && assignments.length === 0) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <BookOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={4} style={{ margin: 0 }}>Panel del Profesor</Title>
        </div>
        <Card style={{ textAlign: 'center', padding: '40px 0' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div style={{ maxWidth: 400, margin: '0 auto' }}>
                <Title level={5}>No tienes materias asignadas</Title>
                <Text type="secondary">
                  Actualmente no tienes asignaciones de materia y sección para el período académico activo. 
                  Si consideras que esto es un error, por favor contacta al personal administrativo o de control de estudios.
                </Text>
              </div>
            }
          />
        </Card>
      </div>
    );
  }



  const handleDeletePlanItem = async (id: number) => {
    if (isSelectedTermBlocked) {
      message.warning('Este lapso está bloqueado. No puedes modificar el plan de evaluación.');
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


  const handleSaveScoreInGrid = async (enrollment: StudentEnrollment, evalPlanId: number, score: number | null, remedialScore?: number | null) => {
    if (isSelectedTermBlocked) {
      message.warning('Este lapso está bloqueado. No puedes modificar calificaciones.');
      return;
    }
    const inscriptionSubjectId = enrollment.inscriptionSubjects?.[0]?.id;

    try {
      const payload: any = {
        evaluationPlanId: evalPlanId,
        inscriptionSubjectId,
        inscriptionId: enrollment.id,
        score: score === null ? 0 : score,
        isAbsent: false,
        observations: ''
      };
      if (remedialScore !== undefined) {
        payload.remedialScore = remedialScore;
      }
      await api.post('/evaluation/qualifications', payload);
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

  const handleSaveRemedialScoreInGrid = async (enrollment: StudentEnrollment, evalPlanId: number, remedialScore: number | null) => {
    if (isSelectedTermBlocked) {
      message.warning('Este lapso está bloqueado. No puedes modificar calificaciones.');
      return;
    }
    const inscriptionSubjectId = enrollment.inscriptionSubjects?.[0]?.id;

    try {
      await api.post('/evaluation/qualifications', {
        evaluationPlanId: evalPlanId,
        inscriptionSubjectId,
        inscriptionId: enrollment.id,
        remedialScore: remedialScore,
        observations: ''
      });
      // message.success(`Nota remedial guardada para ${enrollment.student?.lastName}`);
      fetchPlanAndStudents();
    } catch {
      message.error('Error al guardar nota remedial');
    }
  };

  const planColumns: ColumnsType<EvaluationPlanItem> = [
    { title: 'ID', dataIndex: 'identificador', key: 'identificador', width: 80 },
    { title: 'Tema Generador', dataIndex: 'temaGenerador', key: 'temaGenerador', ellipsis: true, width: 150 },
    { title: 'Referentes Teóricos', key: 'refTeoricos', width: 180,
      render: (_: unknown, r: EvaluationPlanItem) => {
        const items = typeof r.referentesTeoricos === 'string' ? (() => { try { return JSON.parse(r.referentesTeoricos); } catch { return [r.referentesTeoricos]; } })() : r.referentesTeoricos;
        if (Array.isArray(items) && items.length > 0) {
          return <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
        }
        return <span style={{ fontSize: 12 }}>{Array.isArray(items) ? '-' : (r.referentesTeoricos || '-')}</span>;
      }
    },
    { title: 'Referentes Éticos e Indispensables', key: 'refEticos', width: 180,
      render: (_: unknown, r: EvaluationPlanItem) => {
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
      render: (_: unknown, r: EvaluationPlanItem) => {
        const items = typeof r.indicador === 'string' ? (() => { try { return JSON.parse(r.indicador); } catch { return [r.indicador]; } })() : r.indicador;
        if (Array.isArray(items) && items.length > 0) {
          return <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
        }
        return <span style={{ fontSize: 12 }}>{Array.isArray(items) ? '-' : (r.indicador || '-')}</span>;
      }
    },
    { title: 'Puntaje', dataIndex: 'percentage', key: 'percentage', render: (val: number) => `${val}%`, width: 70 },
    { title: 'Fecha', dataIndex: 'date', key: 'date', render: (val: string) => dayjs(val).format('DD/MM/YYYY'), width: 90 },
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
                onClick={() => {
                  setEditingItem(record);
                  setShowPlanModal(true);
                }}
              />
              <Button icon={<DeleteOutlined />} danger onClick={() => handleDeletePlanItem(record.id)} />
            </>
          )}
        </Space>
      )
    }
  ];


const totalPercentage = evaluationPlan?.reduce((acc, curr) => acc + Number(curr?.percentage || 0), 0) || 0;

  const downloadExcel = async (filled: boolean) => {
    if (!selectedAssignmentId) return;
    try {
      const res = await api.get(`/evaluation/export-grades/${selectedAssignmentId}`, {
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

  const playBeep = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 800;
      gain.gain.value = 0.1;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch { /* audio not available */ }
  };

  return (
    <div className="h-full overflow-y-auto theme-page-bg p-4 md:p-8">
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<ToolOutlined />} onClick={() => navigate('/profesor/reparacion')}>
          Reparación de Materias
        </Button>
      </div>
      <style>{`
        .grading-row:hover { background-color: color-mix(in srgb, var(--color-accent) 4%, transparent) !important; }
        .grading-row td { transition: background-color 0.2s; }
        .grading-cell .ant-input-number-input { text-align: center !important; padding: 0 !important; }
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
        /* table row hover handled by global theme rules */
        /* Luxury Scrollbar */
        .grading-table-container::-webkit-scrollbar { height: 8px; width: 8px; }
        .grading-table-container::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.18); border-radius: 4px; }
        .grading-table-container::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.04); }
        
        .luxury-segmented .ant-segmented-item-selected {
          background-color: var(--color-accent) !important;
          color: white !important;
          font-weight: 600;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .ant-table-thead > tr > th {
          background-color: color-mix(in srgb, var(--color-text-main) 4%, var(--color-content-bg)) !important;
          color: var(--color-text-main) !important;
        }
        .ant-table-tbody > tr > td {
          background-color: var(--color-content-bg) !important;
        }
      `}</style>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--color-text-main)' }}>Configuración del Plan de Evaluación</h1>
        </div>
      </div>

      {/* Top Grid Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        {/* Subjects & Terms combined in a single card-like block or flex */}
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Asignaturas Seleccionables */}
          <div className="rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col" style={{ backgroundColor: 'var(--color-brand-secondary)' }}>
            <span className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-main)', opacity: 0.5 }}>Seleccionar Asignatura</span>
            <div className="flex gap-3 overflow-x-auto pb-2 shrink-0">
              {assignments.map(as => {
                const isSelected = as.id === selectedAssignmentId;
                return (
                  <div
                    key={as.id}
                    onClick={() => setSelectedAssignmentId(as.id)}
                    className="cursor-pointer min-w-[160px] rounded-xl p-3 transition-all flex items-center gap-3 border-none"
                    style={{
                      backgroundColor: isSelected ? 'var(--color-accent)' : 'var(--color-inactive)',
                      color: isSelected ? 'var(--color-header-text)' : 'var(--color-text-main)'
                    }}
                  >
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                        color: 'inherit'
                      }}
                    >
                      <BookOutlined className="text-lg" />
                    </div>
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'inherit' }}>
                        {as.periodGradeSubject.subject.name}
                      </div>
                      <div className="text-[10px] font-medium" style={{ opacity: 0.8, color: 'inherit' }}>
                        Sec. {as.section.name}
                      </div>
                    </div>
                  </div>
                );
              })}
              {assignments.length === 0 && <div className="text-[var(--color-text-muted)] text-sm py-4">No hay asignaturas</div>}
            </div>
          </div>

          {/* Lazos */}
          <div className="rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center" style={{ backgroundColor: 'var(--color-brand-secondary)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-main)', opacity: 0.5 }}>Lapso Académico</span>
              {isSelectedTermBlocked && <Tag color="error">Cerrado</Tag>}
            </div>
            <div className="flex p-1 gap-2 rounded-xl w-full" style={{ backgroundColor: 'var(--color-input-bg)' }}>
              {availableTerms.map(term => {
                const isSelected = selectedTerm === term.id;
                return (
                  <button
                    key={term.id}
                    onClick={() => setSelectedTerm(term.id)}
                    className="flex-1 py-2 text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-2 border-none"
                    style={{
                      backgroundColor: isSelected ? 'var(--color-accent)' : 'var(--color-inactive)',
                      color: isSelected ? 'var(--color-header-text)' : 'var(--color-text-main)'
                    }}
                  >
                    {term.name}
                    {term.isBlocked && <LockOutlined style={{ opacity: 0.8 }} />}
                  </button>
                );
              })}
              {availableTerms.length === 0 && <div className="text-[var(--color-text-muted)] text-sm text-center w-full py-2">Sin lapsos</div>}
            </div>
          </div>
        </div>

        {/* Progress Planificado */}
        <div className="rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-center relative overflow-hidden" style={{ backgroundColor: 'var(--color-brand-secondary)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-lg m-0" style={{ color: 'var(--color-text-main)' }}>Total Planificado</h3>
            <span className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full ${totalPercentage === 100 ? 'bg-green-100 text-green-700' : totalPercentage > 100 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
              {totalPercentage}% Completado
            </span>
          </div>
          <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">Avance del periodo actual</p>
          
          <div className="h-3 w-full bg-slate-100 rounded-full mt-2 mb-2 relative overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${totalPercentage === 100 ? 'bg-green-500' : totalPercentage > 100 ? 'bg-red-500' : ''}`} 
              style={{ 
                width: `${Math.min(totalPercentage, 100)}%`,
                backgroundColor: (totalPercentage <= 100 && totalPercentage !== 100) ? 'var(--color-luxury-sidebar)' : undefined 
              }} 
            />
          </div>
          <div className="flex justify-between text-[11px] font-bold text-[var(--color-text-muted)] mb-4">
            <span>0%</span>
            <span style={{ color: 'var(--color-luxury-sidebar)' }}>{totalPercentage}% de 100%</span>
            <span>100%</span>
          </div>
          
          {totalPercentage < 100 && (
            <div className="bg-orange-50 text-orange-700 text-xs p-3 rounded-xl border border-orange-100 font-medium flex gap-2 items-start mt-auto">
               <span>ℹ️</span> Faltan {100 - totalPercentage}% por asignar para completar el plan de evaluación.
            </div>
          )}
          {totalPercentage === 100 && (
             <div className="bg-green-50 text-green-700 text-xs p-3 rounded-xl border border-green-100 font-medium flex gap-2 items-start mt-auto">
               <span>✅</span> Exito. Planificación distribuida correctamente al 100%.
            </div>
          )}
        </div>
      </div>

      {isSelectedTermBlocked && (
        <Alert
          message="Lapso bloqueado"
          description="Este lapso está bloqueado. No puedes modificar la planificación ni las notas."
          type="warning"
          showIcon
           className="mb-8 rounded-xl border-orange-200 bg-orange-50"
        />
      )}

      {/* Main Tabs content equivalent */}
      <div className="p-6 rounded-2xl shadow-sm border border-slate-100 mb-8" style={{ backgroundColor: 'var(--color-brand-secondary)' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: '1',
              label: <span className="font-bold text-[15px] px-4 py-1">Evaluaciones Programadas</span>,
              children: (
                <div className="pt-4">
                  <Table<EvaluationPlanItem>
                    loading={loading}
                    columns={planColumns}
                    dataSource={evaluationPlan}
                    rowKey="id"
                    pagination={false}
                    bordered
                    className="rounded-xl overflow-hidden"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-input-bg), black 3%)' }}
                  />
                  
                  <div
                    className={`mt-4 w-full h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer border-none shadow-sm ${isSelectedTermBlocked || !selectedAssignmentId ? 'opacity-50 pointer-events-none' : 'hover:scale-[1.01]'}`}
                    style={{ 
                      backgroundColor: isSelectedTermBlocked || !selectedAssignmentId ? 'var(--color-brand-secondary)' : 'var(--color-accent)',
                      color: isSelectedTermBlocked || !selectedAssignmentId ? 'var(--color-text-main)' : 'var(--color-header-text)' 
                    }}
                    onClick={() => {
                      if(isSelectedTermBlocked || !selectedAssignmentId) return;
                      setEditingItem(null);
                      setShowPlanModal(true);
                    }}
                  >
                    <PlusOutlined className="text-3xl font-bold" />
                  </div>

<div className="mt-6 flex justify-between items-center px-2">
                      <span className="font-medium text-sm" style={{ color: 'var(--color-text-main)' }}>Mostrando {evaluationPlan.length} evaluaciones registradas</span>
                      <div className="flex items-center gap-4">
                        <Button
                          icon={<FilePdfOutlined />}
                          onClick={() => setShowPDFModal(true)}
                          disabled={!selectedAssignmentId || evaluationPlan.length === 0}
                        >
                          Generar PDF
                        </Button>
                        <span className="font-black" style={{ color: 'var(--color-text-main)' }}>Total Puntaje Acumulado: {totalPercentage}%</span>
                      </div>
                   </div>
                </div>
              )
            },
          {
            key: '2',
            label: 'Calificaciones',
            children: evaluationPlan.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: '40px 0', backgroundColor: 'var(--color-input-bg)', border: 'none' }}>
                <div style={{ marginBottom: 24 }}>
                  <Title level={4}>No hay Plan de Evaluación definido</Title>
                  <Text type="secondary">Para poder calificar este lapso, primero debe definir las actividades y sus porcentajes.</Text>
                </div>
                <Button type="primary" size="large" onClick={() => setActiveTab('1')}>
                  Crear Plan de Evaluación
                </Button>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {students.length > 0 && (
                      <span style={{
                        fontSize: '13px',
                        color: pendingGradesCount.missing > 0 ? 'var(--color-brand-primary)' : '#16a34a',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        {pendingGradesCount.missing > 0
                          ? `⚠ ${pendingGradesCount.missing} de ${pendingGradesCount.total} alumnos con notas pendientes`
                          : `✓ Todos los alumnos calificados (${pendingGradesCount.total})`
                        }
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      icon={<DownloadOutlined />}
                      size="small"
                      onClick={() => downloadExcel(true)}
                      disabled={!selectedAssignmentId || students.length === 0}
                    >
                      Excel con notas
                    </Button>
                    <Button
                      icon={<DownloadOutlined />}
                      size="small"
                      onClick={() => downloadExcel(false)}
                      disabled={!selectedAssignmentId}
                    >
                      Excel vacío
                    </Button>
                  </div>
                </div>
                <Card bodyStyle={{ padding: 0 }} style={{ overflow: 'hidden', backgroundColor: 'var(--color-input-bg)', border: 'none' }}>
                <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 350px)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid var(--color-text-muted)' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr>
                        <th style={{ padding: '4px 6px', border: '1px solid var(--color-text-muted)', textAlign: 'center', backgroundColor: '#e5e7eb', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>Cédula</th>
                        <th style={{ padding: '4px 6px', border: '1px solid var(--color-text-muted)', textAlign: 'left', backgroundColor: '#e5e7eb', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>Estudiante</th>
                        {evaluationPlan.map((item) => {
                          const stats = evalStats.get(item.id);
                          const hasRemedial = (stats?.failedPct ?? 0) >= remedialFailurePercentage;
                          return (
                          <th key={item.id} colSpan={hasRemedial ? 2 : 1} style={{ padding: '3px 4px', border: '1px solid var(--color-text-muted)', textAlign: 'center', backgroundColor: '#e5e7eb', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
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
                            <tr key={enrollment.id} className="grading-row">
                              <td style={{ padding: '2px 4px', border: '1px solid var(--color-text-muted)', textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-input-bg)' : '#f9fafb', fontSize: 11, fontWeight: 500 }}>
                                {enrollment.student?.document || '-'}
                              </td>
                              <td style={{ padding: '2px 6px', border: '1px solid var(--color-text-muted)', textAlign: 'left', background: rowIndex % 2 === 0 ? 'var(--color-input-bg)' : '#f9fafb', fontSize: 12 }}>
                                {enrollment.student?.lastName}, {enrollment.student?.firstName}
                              </td>
                              {evaluationPlan.map((item, colIndex) => {
                                const q = studentQuals.find((sq: Qualification) => sq.evaluationPlanId === item.id);
                                const currentScore = q ? q.score : null;
                                const isAbsent = !!(q?.isAbsent);
                                const stats = evalStats.get(item.id);
                                const hasRemedial = (stats?.failedPct ?? 0) >= remedialFailurePercentage;
                                const isRemedialEligible = !isAbsent && currentScore !== null && currentScore > 0 && currentScore >= remedialMinGrade && currentScore <= remedialMaxGrade;

                                return (
                                  <React.Fragment key={item.id}>
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
                                      defaultValue={isAbsent ? '' : (currentScore !== null ? Math.round(currentScore) : '')}
                                      key={`${enrollment.id}-${item.id}${isAbsent ? '-a' : ''}`}
                                      style={{
                                        width: '48px',
                                        textAlign: 'center',
                                        border: 'none',
                                        outline: 'none',
                                        background: 'transparent',
                                        fontSize: 12,
                                        padding: 0,
                                        color: currentScore !== null && currentScore > 0 && currentScore < passingGrade ? '#dc2626' : undefined,
                                        fontWeight: currentScore !== null && currentScore > 0 && currentScore < passingGrade ? 700 : undefined,
                                      }}
                                      disabled={isSelectedTermBlocked || (q?.remedialScore != null && q.remedialScore > 0 && isRemedialEligible)}
                                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                        if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E' || e.key === '-' || e.key === '+') {
                                          e.preventDefault();
                                          return;
                                        }
                                        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
                                          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                            e.preventDefault();
                                          }

                                          let nextRow = rowIndex;
                                          let nextCol = colIndex;
                                          let targetType = 'grade';

                                          if (e.key === 'ArrowUp') nextRow--;
                                          if (e.key === 'ArrowDown' || e.key === 'Enter') {
                                            if (e.key === 'Enter') e.preventDefault();
                                            nextRow++;
                                          }
                                          if (e.key === 'ArrowLeft') {
                                            const prevCol = colIndex - 1;
                                            if (prevCol >= 0) {
                                              const prevItem = evaluationPlan[prevCol];
                                              const prevStats = evalStats.get(prevItem.id);
                                              const prevHasRemedial = (prevStats?.failedPct ?? 0) >= remedialFailurePercentage;
                                              nextCol = prevCol;
                                              if (prevHasRemedial) {
                                                targetType = 'remedial';
                                              } else {
                                                targetType = 'grade';
                                              }
                                            }
                                          }
                                          if (e.key === 'ArrowRight') {
                                            if (hasRemedial) {
                                              targetType = 'remedial';
                                            } else {
                                              nextCol = colIndex + 1;
                                              targetType = 'grade';
                                            }
                                          }

                                          const nextInputId = `${targetType}-${nextRow}-${nextCol}`;
                                          setTimeout(() => {
                                            const nextInput = document.getElementById(nextInputId);
                                            if (nextInput) nextInput.focus();
                                          }, 0);
                                        }
                                      }}
                                      onInput={(e: React.FormEvent<HTMLInputElement>) => {
                                        (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
                                      }}
                                      onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                        const raw = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
                                        (e.target as HTMLInputElement).value = raw;
                                        if (raw === '') return;
                                        const val = parseInt(raw, 10);
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
                                          // Clear remedial if grade is no longer eligible
                                          const needsRemedialClear = val <= 0 || val < remedialMinGrade || val > remedialMaxGrade;
                                          handleSaveScoreInGrid(enrollment, item.id, val, needsRemedialClear ? null : undefined);
                                        }
                                      }}
                                    />
                                  </td>
                                  {hasRemedial && (
                                    <td key={`${item.id}-b`} className="grading-cell remedial-cell" style={{ padding: '2px', border: '1px solid var(--color-text-muted)', textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-input-bg)' : '#f9fafb', width: '50px' }}
                                      onContextMenu={(e) => e.preventDefault()}
                                    >
                                      <Tooltip
                                        mouseEnterDelay={0}
                                        title={
                                          !isRemedialEligible && (currentScore !== null || (q?.isAbsent))
                                            ? (isAbsent || (currentScore !== null && currentScore < remedialMinGrade)
                                                ? `Nota por debajo de la mínima para remedial (${remedialMinGrade})`
                                                : currentScore !== null && currentScore > remedialMaxGrade
                                                  ? `Nota por encima de la máxima para remedial (${remedialMaxGrade})`
                                                  : '')
                                            : undefined
                                        }
                                      >
                                      <input
                                        type="number"
                                        id={`remedial-${rowIndex}-${colIndex}`}
                                        min={0}
                                        max={maxGrade}
                                        step={1}
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        defaultValue={q?.remedialScore != null ? Math.round(q.remedialScore) : ''}
                                        key={`rem-${enrollment.id}-${item.id}-${q?.remedialScore ?? 'n'}`}
                                        style={{
                                          width: '48px',
                                          textAlign: 'center',
                                          border: 'none',
                                          outline: 'none',
                                          background: 'transparent',
                                          fontSize: 12,
                                          padding: 0,
                                          backgroundColor: !isRemedialEligible && currentScore !== null && currentScore > 0
                                            ? (currentScore < remedialMinGrade ? '#fef2f2' : currentScore > remedialMaxGrade ? '#f0fdf4' : undefined)
                                            : undefined,
                                          color: q?.remedialScore != null && q.remedialScore > 0 && q.remedialScore < passingGrade ? '#dc2626' : undefined,
                                          fontWeight: q?.remedialScore != null && q.remedialScore > 0 && q.remedialScore < passingGrade ? 700 : undefined,
                                          cursor: !isRemedialEligible && currentScore !== null && currentScore > 0 ? 'not-allowed' : undefined,
                                        }}
                                        disabled={isSelectedTermBlocked || !isRemedialEligible}
                                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                          if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E' || e.key === '-' || e.key === '+') {
                                            e.preventDefault();
                                            return;
                                          }
                                          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
                                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                              e.preventDefault();
                                            }

                                            let nextRow = rowIndex;
                                            let nextCol = colIndex;
                                            let targetType = 'remedial';

                                            if (e.key === 'ArrowUp') nextRow--;
                                            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                                              if (e.key === 'Enter') e.preventDefault();
                                              nextRow++;
                                            }
                                            if (e.key === 'ArrowLeft') {
                                              // Focus the regular grade input of the same evaluation on the same row
                                              targetType = 'grade';
                                            }
                                            if (e.key === 'ArrowRight') {
                                              // Focus the regular grade input of the next evaluation on the same row
                                              nextCol++;
                                              targetType = 'grade';
                                            }

                                            const nextInputId = `${targetType}-${nextRow}-${nextCol}`;
                                            setTimeout(() => {
                                              const nextInput = document.getElementById(nextInputId);
                                              if (nextInput) nextInput.focus();
                                            }, 0);
                                          }
                                        }}
                                        onInput={(e: React.FormEvent<HTMLInputElement>) => {
                                          (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
                                        }}
                                        onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                          const raw = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
                                          (e.target as HTMLInputElement).value = raw;
                                          
                                          const currentRemedialScore = q ? q.remedialScore : null;
                                          if (raw === '') {
                                            if (currentRemedialScore !== null) {
                                              handleSaveRemedialScoreInGrid(enrollment, item.id, null);
                                            }
                                            return;
                                          }
                                          
                                          const val = parseInt(raw, 10);
                                          if (val < 0 || val > maxGrade) {
                                            playBeep();
                                            const wrapper = e.target.closest('.grading-cell');
                                            if (wrapper) {
                                              e.target.value = currentRemedialScore !== null ? String(currentRemedialScore) : '';
                                              wrapper.classList.add('grade-invalid');
                                              setTimeout(() => wrapper.classList.remove('grade-invalid'), 1500);
                                            }
                                            return;
                                          }
                                          if (val !== currentRemedialScore) {
                                            handleSaveRemedialScoreInGrid(enrollment, item.id, val);
                                          }
                                        }}
                                      />
                                      </Tooltip>
                                    </td>
                                  )}
                                  </React.Fragment>
                                );
                              })}
                              <td style={{ padding: '2px 4px', border: '1px solid var(--color-text-muted)', textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-input-bg)' : '#f9fafb', fontWeight: 700, fontSize: 12 }}>
                                <Tag color={rowTotal >= (maxGrade * 0.5) ? 'green' : 'red'} style={{ margin: 0 }}>
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
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <Alert message="No hay estudiantes inscritos en esta sección" type="info" />
                  </div>
                )}
              </Card>
              </>
            )
          }
        ]}
      />
      </div>

      {selectedAssignmentId && selectedTerm && (() => {
        const assignment = assignments.find(a => a.id === selectedAssignmentId);
        if (!assignment) return null;
        return (
          <EvaluationPlanItemModal
            open={showPlanModal}
            onClose={() => setShowPlanModal(false)}
            onSaved={fetchPlanAndStudents}
            editingItem={editingItem}
            periodGradeSubjectId={assignment.periodGradeSubjectId}
            sectionId={assignment.sectionId}
            termId={selectedTerm}
            selectedTermDateRange={selectedTermDateRange}
            schoolPeriod={assignment.periodGradeSubject?.periodGrade?.schoolPeriod}
            existingItems={evaluationPlan}
          />
        );
      })()}

      <EvaluationPlanPDFModal
        open={showPDFModal}
        onClose={() => setShowPDFModal(false)}
        header={(() => {
          const assignment = assignments.find(a => a.id === selectedAssignmentId);
          if (!assignment) return null as unknown as EvaluationPlanHeaderData;
          const termObj = availableTerms.find(t => t.id === selectedTerm);
          return {
            periodName: assignment.periodGradeSubject?.periodGrade?.schoolPeriod?.name || '-',
            gradeName: assignment.periodGradeSubject?.periodGrade?.grade?.name || '-',
            subjectName: assignment.periodGradeSubject?.subject?.name || '-',
            sectionName: assignment.section?.name || '-',
            termName: termObj?.name || '-',
            teacherName: assignment.teacher
              ? `${assignment.teacher.firstName} ${assignment.teacher.lastName}`
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
