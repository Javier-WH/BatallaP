import React, { useState, useEffect, useCallback, Component, useMemo } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Tabs, Card, Select, Table, Button, Modal, Form, Input, DatePicker, message, Space, Tag, Typography, InputNumber, Alert, Empty } from 'antd';
import { BookOutlined, PlusOutlined, DeleteOutlined, EditOutlined, LockOutlined, FilePdfOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { isAxiosError } from 'axios';
import api from '@/services/api';
import dayjs from 'dayjs';
import { useGradeRounding } from '@/context/GradeRoundingContext';
import { formatGrade } from '@/utils/gradeFormat';
import EvaluationPlanPDFModal from '@/components/pdf/EvaluationPlanPDFModal';
import type { EvaluationPlanHeaderData, EvaluationPlanItemData } from '@/components/pdf/EvaluationPlanPDF';

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
  description?: string;
  objetivo: string;
  tecnica: string;
  identificador: string;
  percentage: number;
  date: dayjs.Dayjs;
  instrumentOption?: string;
  customInstrument?: string;
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

const evaluationInstruments = [
  'Examen escrito',
  'Prueba objetiva (selección múltiple o verdadero/falso)',
  'Cuestionario diagnóstico',
  'Exposición oral',
  'Debate guiado',
  'Mesa redonda',
  'Proyecto integrador',
  'Estudio de caso',
  'Ensayo crítico',
  'Portafolio digital',
  'Trabajo de laboratorio',
  'Bitácora de aprendizaje',
  'Rúbrica de desempeño',
  'Observación de clase',
  'Demostración práctica',
  'Simulación o role play',
  'Mapa conceptual',
  'Investigación de campo',
  'Análisis de textos',
  'Diseño de prototipo',
  'Taller participativo',
  'Diario reflexivo',
  'Evaluación entre pares',
  'Autoevaluación dirigida',
  'Evaluación gamificada'
];

const CUSTOM_INSTRUMENT_VALUE = '__custom__';

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
  const [planForm] = Form.useForm<PlanItemFormValues>();
  const [activeTab, setActiveTab] = useState('1');
  const [maxGrade, setMaxGrade] = useState<number>(20);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const instrumentSelection = Form.useWatch('instrumentOption', planForm);
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

  const handleSavePlanItem = async (values: PlanItemFormValues) => {
    if (isSelectedTermBlocked) {
      message.warning('Este lapso está bloqueado. No puedes modificar el plan de evaluación.');
      return;
    }
    const assignment = assignments.find(a => a.id === selectedAssignmentId);
    if (!assignment) {
      message.error('No se pudo encontrar la asignación seleccionada');
      return;
    }

    const { instrumentOption, customInstrument, ...restValues } = values;
    const selectedInstrument =
      instrumentOption === CUSTOM_INSTRUMENT_VALUE
        ? customInstrument?.trim()
        : instrumentOption;

    if (!selectedInstrument) {
      message.error('Selecciona o especifica un instrumento de evaluación.');
      return;
    }

    const data = {
      ...restValues,
      description: selectedInstrument,
      tecnica: values.tecnica,
      identificador: values.identificador,
      periodGradeSubjectId: assignment.periodGradeSubjectId,
      sectionId: assignment.sectionId,
      termId: selectedTerm,
      temaGenerador: values.temaGenerador,
      referentesTeoricos: values.referentesTeoricos,
      referentesEticos: values.referentesEticos,
      estrategiaEvaluacion: values.estrategiaEvaluacion,
      tipoEvaluacion: values.tipoEvaluacion,
      formaEvaluacion: values.formaEvaluacion,
      indicador: values.indicador
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
      if (isAxiosError<{ message?: string }>(error)) {
        message.error(error.response?.data?.message || 'Error al guardar');
      } else {
        message.error('Error al guardar');
      }
    }
  };

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


  const handleSaveScoreInGrid = async (enrollment: StudentEnrollment, evalPlanId: number, score: number | null) => {
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
        score: score === null ? 0 : score,
        observations: ''
      });
      // message.success(`Nota guardada para ${enrollment.student?.lastName}`);
      fetchPlanAndStudents();
    } catch {
      message.error('Error al guardar nota');
    }
  };

  const planColumns: ColumnsType<EvaluationPlanItem> = [
    { title: 'ID', dataIndex: 'identificador', key: 'identificador', width: 80 },
    { title: 'Instrumento', dataIndex: 'description', key: 'description', width: 120 },
    { title: 'Técnica', dataIndex: 'tecnica', key: 'tecnica', width: 100 },
    { title: 'Tipo', dataIndex: 'tipoEvaluacion', key: 'tipoEvaluacion', width: 90 },
    { title: 'Forma', dataIndex: 'formaEvaluacion', key: 'formaEvaluacion', width: 90 },
    { title: 'Indicador', dataIndex: 'indicador', key: 'indicador', ellipsis: true, width: 150 },
    { title: 'Tema Generador', dataIndex: 'temaGenerador', key: 'temaGenerador', ellipsis: true, width: 150 },
    { title: 'Referentes Teóricos', dataIndex: 'referentesTeoricos', key: 'referentesTeoricos', ellipsis: true, width: 150 },
    { title: 'Referentes Éticos', dataIndex: 'referentesEticos', key: 'referentesEticos', ellipsis: true, width: 150 },
    { title: 'Estrategia', dataIndex: 'estrategiaEvaluacion', key: 'estrategiaEvaluacion', ellipsis: true, width: 150 },
    { title: 'Objetivo', dataIndex: 'objetivo', key: 'objetivo', ellipsis: true, width: 150 },
    { title: 'Peso (%)', dataIndex: 'percentage', key: 'percentage', render: (val: number) => `${val}%`, width: 70 },
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
                  const matchedInstrument = evaluationInstruments.find(
                    instrument => instrument.toLowerCase() === record.description.toLowerCase()
                  );

                  planForm.setFieldsValue({
                    instrumentOption: matchedInstrument ?? CUSTOM_INSTRUMENT_VALUE,
                    customInstrument: matchedInstrument ? undefined : record.description,
                    tecnica: record.tecnica,
                    identificador: record.identificador,
                    objetivo: record.objetivo,
                    percentage: Number(record.percentage),
                    date: dayjs(record.date),
                    temaGenerador: record.temaGenerador,
                    referentesTeoricos: record.referentesTeoricos,
                    referentesEticos: record.referentesEticos,
                    estrategiaEvaluacion: record.estrategiaEvaluacion,
                    tipoEvaluacion: record.tipoEvaluacion,
                    formaEvaluacion: record.formaEvaluacion,
                    indicador: record.indicador
                  });

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
  return (
    <div className="h-full overflow-y-auto theme-page-bg p-4 md:p-8">
      <style>{`
        .grading-row:hover { background-color: #f8fafc !important; }
        .grading-row td { transition: background-color 0.2s; }
        /* Luxury Scrollbar */
        .grading-table-container::-webkit-scrollbar { height: 8px; width: 8px; }
        .grading-table-container::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .grading-table-container::-webkit-scrollbar-track { background: #f1f5f9; }
        
        .luxury-segmented .ant-segmented-item-selected {
          background-color: var(--color-brand-primary, #1e40af) !important;
          color: white !important;
          font-weight: 600;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .ant-table-thead > tr > th {
          background-color: color-mix(in srgb, var(--color-input-bg), black 5%) !important;
          color: var(--color-text-main) !important;
        }
        .ant-table-tbody > tr > td {
          background-color: var(--color-input-bg) !important;
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
              {assignments.length === 0 && <div className="text-slate-400 text-sm py-4">No hay asignaturas</div>}
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
              {availableTerms.length === 0 && <div className="text-slate-400 text-sm text-center w-full py-2">Sin lapsos</div>}
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
          <p className="text-xs font-semibold text-slate-400 mb-2">Avance del periodo actual</p>
          
          <div className="h-3 w-full bg-slate-100 rounded-full mt-2 mb-2 relative overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${totalPercentage === 100 ? 'bg-green-500' : totalPercentage > 100 ? 'bg-red-500' : ''}`} 
              style={{ 
                width: `${Math.min(totalPercentage, 100)}%`,
                backgroundColor: (totalPercentage <= 100 && totalPercentage !== 100) ? 'var(--color-luxury-sidebar)' : undefined 
              }} 
            />
          </div>
          <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-4">
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
                    className="border border-slate-200 rounded-xl overflow-hidden"
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
                      planForm.resetFields();
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
                        <span className="font-black" style={{ color: 'var(--color-text-main)' }}>Total Peso Acumulado: {totalPercentage}%</span>
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
              <Card bodyStyle={{ padding: 0 }} style={{ overflow: 'hidden', backgroundColor: 'var(--color-input-bg)', border: 'none' }}>
                <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 350px)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'color-mix(in srgb, var(--color-input-bg), black 7%)' }}>
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
                          return nameA.localeCompare(nameB); // Order A-Z
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

                          const isEven = rowIndex % 2 === 0;

                          return (
                            <tr key={enrollment.id} className="grading-row">
                              <td style={{ 
                                padding: '8px 16px', 
                                borderBottom: '1px solid #f0f0f0', 
                                borderRight: '1px solid #f0f0f0',
                                background: 'var(--color-input-bg)' 
                              }}>
                                <div style={{ fontWeight: 500 }}>{enrollment.student?.lastName}, {enrollment.student?.firstName}</div>
                                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{enrollment.student?.document}</div>
                              </td>
                              {evaluationPlan.map((item, colIndex) => {
                                const q = studentQuals.find((sq: Qualification) => sq.evaluationPlanId === item.id);
                                const currentScore = q ? q.score : null;

                                  return (
                                    <td key={item.id} style={{ 
                                      padding: '4px 8px', 
                                      borderBottom: '1px solid #f0f0f0', 
                                      borderRight: '1px solid #f0f0f0',
                                      textAlign: 'center',
                                      background: 'var(--color-input-bg)' 
                                    }}>
                                    <InputNumber
                                      id={`grade-${rowIndex}-${colIndex}`}
                                      min={0}
                                      max={maxGrade}
                                      precision={2}
                                      value={currentScore}
                                      style={{ width: '80px' }}
                                      disabled={isSelectedTermBlocked}
                                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
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
                                      onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                        const val = (e.target as HTMLInputElement).value === '' ? null : Number((e.target as HTMLInputElement).value);
                                        if (val !== currentScore) {
                                          handleSaveScoreInGrid(enrollment, item.id, val);
                                        }
                                      }}
                                    />
                                  </td>
                                );
                              })}
                              <td style={{ 
                                padding: '8px 16px', 
                                borderBottom: '1px solid #f0f0f0', 
                                borderRight: '1px solid #f0f0f0', 
                                textAlign: 'center', 
                                background: 'var(--color-input-bg)', 
                                fontWeight: 'bold',
                                color: 'var(--color-text-main)'
                              }}>
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
            )
          }
        ]}
      />
      </div>

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
          <Form.Item
            name="instrumentOption"
            label="Instrumento"
            rules={[{ required: true, message: 'Selecciona un instrumento de evaluación' }]}
          >
            <Select
              showSearch
              placeholder="Selecciona el instrumento de evaluación"
              optionFilterProp="children"
              filterOption={(input, option) =>
                String(option?.children ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              onChange={(value: string) => {
                planForm.setFieldValue('instrumentOption', value);
                if (value !== CUSTOM_INSTRUMENT_VALUE) {
                  planForm.setFieldValue('customInstrument', undefined);
                }
              }}
            >
              {evaluationInstruments.map(instrument => (
                <Option key={instrument} value={instrument}>
                  {instrument}
                </Option>
              ))}
              <Option value={CUSTOM_INSTRUMENT_VALUE}>Otro (especificar)</Option>
            </Select>
          </Form.Item>

          {instrumentSelection === CUSTOM_INSTRUMENT_VALUE && (
            <Form.Item
              name="customInstrument"
              label="Describe el instrumento"
              rules={[
                { required: true, message: 'Ingresa el instrumento de evaluación' },
                { min: 3, message: 'Debe tener al menos 3 caracteres' }
              ]}
            >
              <Input placeholder="Ej: Evaluación práctica en laboratorio..." />
            </Form.Item>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item 
              name="identificador" 
              label="Identificador" 
              rules={[{ required: true, message: 'Requerido' }, { max: 15, message: 'Máximo 15 caracteres' }]}
            >
              <Input placeholder="Ej: PRUEBA-1" maxLength={15} />
            </Form.Item>
            <Form.Item 
              name="tecnica" 
              label="Técnica" 
              rules={[{ required: true, message: 'Requerido' }, { max: 30, message: 'Máximo 30 caracteres' }]}
            >
              <Input placeholder="Ej: Observación Directa" maxLength={30} />
            </Form.Item>
          </div>

          <Form.Item name="objetivo" label="Objetivo a evaluar" rules={[{ required: true }]}>
            <Input.TextArea 
              rows={3} 
              placeholder="Ej: Evaluar la comprensión de ecuaciones lineales..." 
            />
          </Form.Item>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="percentage" label="Porcentaje (1-100)" rules={[{ required: true }]}>
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="date"
              label="Fecha de Evaluación"
              rules={[
                { required: true, message: 'Fecha requerida' },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const { openDate, closeDate } = selectedTermDateRange;
                    if (openDate && value.isBefore(openDate, 'day')) {
                      return Promise.reject(`La fecha debe ser a partir del ${openDate.format('DD/MM/YYYY')} (inicio del lapso)`);
                    }
                    if (closeDate && value.isAfter(closeDate, 'day')) {
                      return Promise.reject(`La fecha debe ser hasta el ${closeDate.format('DD/MM/YYYY')} (cierre del lapso)`);
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <DatePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                disabledDate={(current) => {
                  if (!current) return false;
                  const { openDate, closeDate } = selectedTermDateRange;
                  if (openDate && current.isBefore(openDate, 'day')) return true;
                  if (closeDate && current.isAfter(closeDate, 'day')) return true;
                  return false;
                }}
              />
            </Form.Item>
          </div>

          <Form.Item name="temaGenerador" label="Tema Generador">
            <Input.TextArea rows={2} placeholder="Describe el tema generador..." />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="referentesTeoricos" label="Referentes Teóricos">
              <Input.TextArea rows={2} placeholder="Fundamentos teóricos..." />
            </Form.Item>
            <Form.Item name="referentesEticos" label="Referentes Éticos e Indispensables">
              <Input.TextArea rows={2} placeholder="Consideraciones éticas..." />
            </Form.Item>
          </div>

          <Form.Item name="estrategiaEvaluacion" label="Estrategia de Evaluación">
            <Input.TextArea rows={2} placeholder="Describe la estrategia de evaluación..." />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="tipoEvaluacion" label="Tipo de Evaluación">
              <Input placeholder="Ej: Diagnóstica, Formativa, Sumativa" />
            </Form.Item>
            <Form.Item name="formaEvaluacion" label="Forma de Evaluación">
              <Input placeholder="Ej: Individual, Grupal" />
            </Form.Item>
          </div>

          <Form.Item name="indicador" label="Indicador">
            <Input.TextArea rows={2} placeholder="Describe el indicador de desempeño..." />
          </Form.Item>
        </Form>
      </Modal>

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
