import React, { useState, useEffect, useCallback, Component, useMemo } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, Card, Table, Button, message, Space, Tag, Alert, Empty, Tooltip, Modal, Checkbox } from 'antd';
import { BookOutlined, PlusOutlined, DeleteOutlined, EditOutlined, LockOutlined, FilePdfOutlined, DownloadOutlined, ToolOutlined, CopyOutlined, PrinterOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { isAxiosError } from 'axios';
import api from '@/services/api';
import dayjs from 'dayjs';
import { useGradeRounding } from '@/context/GradeRoundingContext';
import { useSchool } from '@/context/SchoolContext';
import { formatGrade } from '@/utils/gradeFormat';
import { generateSingleNomina } from '@/utils/generateNomina';
import EvaluationPlanPDFModal from '@/components/pdf/EvaluationPlanPDFModal';
import type { EvaluationPlanHeaderData, EvaluationPlanRowData } from '@/components/pdf/EvaluationPlanPDF';
import EvaluationPlanItemModal, { type CatalogOption } from '@/components/EvaluationPlanItemModal';
import { getSubjectVisual, withAlpha } from '@/utils/subjectVisuals';
import { useDragScroll } from '@/utils/useDragScroll';
import ContentTab from './ContentTab';

/** Extracts a numeric order from grade names like "Primer Año", "Segundo Año", etc. */
const GRADE_ORDINALS: Record<string, number> = {
  primer: 1, primero: 1,
  segundo: 2,
  tercer: 3, tercero: 3,
  cuarto: 4,
  quinto: 5,
  sexto: 6,
  septimo: 7,
  octavo: 8,
  noveno: 9,
  decimo: 10,
};
const gradeOrder = (name: string): number => {
  const lower = name.toLowerCase().trim();
  const firstWord = lower.split(/\s+/)[0];
  return GRADE_ORDINALS[firstWord] ?? 99;
};


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
  editedByOther?: boolean;
  lastEditDate?: string | null;
  lastEditUser?: string;
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
  thematicComponentId?: number | null;
  thematicComponent?: { id: number; title: string } | null;
  thematicContentIds?: number[] | null;
  thematicContents?: { id: number; title: string; thematicComponent?: { id: number; title: string } }[];
  criteria?: { id: number; name: string; points: number; indicators?: { id: number; name: string; points: number }[] }[];
  evaluationType?: string | null;
  tecnicaId?: number | null;
  instrumentoId?: number | null;
  estrategiaId?: number | null;
  tecnicaCatalog?: { id: number; name: string } | null;
  instrumentoCatalog?: { id: number; name: string } | null;
  estrategiaCatalog?: { id: number; name: string } | null;
  shortDescription?: string | null;
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
  order?: number | null;
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

interface ThematicComponentData {
  id: number;
  title: string;
  order: number;
  contents?: ThematicContentData[];
}

interface ThematicContentData {
  id: number;
  title: string;
  order: number;
  learnings?: ExpectedLearningData[];
}

interface ExpectedLearningData {
  id: number;
  description: string;
  order: number;
}

const TeacherPanel: React.FC = () => {
  const navigate = useNavigate();
  const { viewPeriod, isReadOnly } = useSchool();
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
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
  const [thematicComponents, setThematicComponents] = useState<ThematicComponentData[]>([]);
  const [tecnicaOptions, setTecnicaOptions] = useState<CatalogOption[]>([]);
  const [instrumentoOptions, setInstrumentoOptions] = useState<CatalogOption[]>([]);
  const [estrategiaOptions, setEstrategiaOptions] = useState<CatalogOption[]>([]);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyTargetSectionIds, setCopyTargetSectionIds] = useState<number[]>([]);
  const [copySubmitting, setCopySubmitting] = useState(false);
  const [nominaGenerating, setNominaGenerating] = useState(false);
  const { enableRounding } = useGradeRounding();
  const dragScroll = useDragScroll<HTMLDivElement>();
  // null = all closed (term globally blocked), array = specific { sectionId, gradeId } closed
  const [closedSections, setClosedSections] = useState<{ sectionId: number; gradeId: number }[] | null>(null);

  // Pad grade to fixed number of digits based on maxGrade (20 → 2 digits, 100 → 3 digits)
  const gradeDigits = Math.max(2, String(maxGrade).length);
  const padGrade = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    return String(Math.round(val)).padStart(gradeDigits, '0');
  };

  const isSelectedTermBlocked = useMemo(() => {
    if (!selectedTerm) return false;
    const term = availableTerms.find(t => t.id === selectedTerm);
    if (term?.isBlocked) return true;
    // Check section-aware closure
    const assignment = assignments.find(a => a.id === selectedAssignmentId);
    if (!assignment) return false;
    const gradeId = assignment.periodGradeSubject?.periodGrade?.grade?.id;
    if (!gradeId) return false;
    if (closedSections === null) return true; // all closed
    return closedSections.some(c => c.sectionId === assignment.sectionId && c.gradeId === gradeId);
  }, [availableTerms, selectedTerm, selectedAssignmentId, assignments, closedSections]);

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

  const contentIndexLabel = useMemo(() => {
    const map = new Map<number, string>();
    thematicComponents.forEach((comp, compIdx) => {
      (comp.contents || []).forEach((content, contentIdx) => {
        map.set(content.id, `${compIdx + 1}.${contentIdx + 1}`);
      });
    });
    return map;
  }, [thematicComponents]);

  const planningPDFRows = useMemo<EvaluationPlanRowData[]>(() => {
    const contentMap = new Map<number, {
      label: string;
      componentTitle: string;
      contentTitle: string;
      learnings: string[];
    }>();
    thematicComponents.forEach((component, componentIndex) => {
      (component.contents || []).forEach((content, contentIndex) => {
        contentMap.set(content.id, {
          label: `${componentIndex + 1}.${contentIndex + 1}`,
          componentTitle: component.title,
          contentTitle: content.title,
          learnings: (content.learnings || []).map(learning => learning.description),
        });
      });
    });

    return evaluationPlan.flatMap(plan => {
      const linkedContents = (plan.thematicContentIds || [])
        .map(contentId => contentMap.get(contentId))
        .filter((content): content is NonNullable<typeof content> => Boolean(content));
      const component = [...new Set(linkedContents.map(content => content.componentTitle))].join('\\n')
        || plan.thematicComponent?.title
        || '';
      const content = linkedContents.map(item => `${item.label} ${item.contentTitle}`).join('\\n');
      const learnings = [...new Set(linkedContents.flatMap(item => item.learnings))]
        .map(learning => `• ${learning}`)
        .join('\\n');
      const types = (plan.evaluationType || '').toLowerCase().split(',').filter(Boolean);
      const criteria = plan.criteria?.length ? plan.criteria : [null];

      return criteria.flatMap(criterion => {
        const indicators = criterion?.indicators?.length ? criterion.indicators : [null];
        return indicators.map((indicator, criterionIndex) => ({
          component: criterionIndex === 0 ? component : '',
          content: criterionIndex === 0 ? content : '',
          learnings: criterionIndex === 0 ? learnings : '',
          strategy: criterionIndex === 0 ? plan.description : '',
          tecnica: criterionIndex === 0 ? plan.tecnicaCatalog?.name || '' : '',
          instrumento: criterionIndex === 0 ? plan.instrumentoCatalog?.name || '' : '',
          criterion: criterionIndex === 0 ? criterion?.name || '' : '',
          indicator: indicator?.name || '',
          points: indicator?.points ?? '',
          criterionTotalPoints: criterionIndex === 0 && criterion
            ? criterion.indicators?.reduce((sum, item) => sum + Number(item.points || 0), 0) || 0
            : '',
          intra: criterionIndex === 0 && types.includes('intra'),
          inter: criterionIndex === 0 && types.includes('inter'),
          trans: criterionIndex === 0 && types.includes('trans'),
          date: criterionIndex === 0 ? dayjs(plan.date).format('DD/MM/YYYY') : '',
          percentage: criterionIndex === 0 ? Number(plan.percentage) : '',
        }));
      });
    });
  }, [evaluationPlan, thematicComponents]);

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
      const params: any = {};
      if (viewPeriod?.id) params.schoolPeriodId = viewPeriod.id;
      const res = await api.get('/evaluation/my-assignments', { params });
      setAssignments(res.data);
      // Don't auto-select assignment on load; let the user pick a subject/grade/section
      setSelectedAssignmentId(null);
    } catch {
      message.error('Error al cargar asignaciones');
    } finally {
      setLoading(false);
    }
  }, [viewPeriod]);

  const fetchTerms = useCallback(async () => {
    try {
      console.log('Fetching terms...');
      if (viewPeriod) {
        const termsRes = await api.get(`/terms?schoolPeriodId=${viewPeriod.id}`);
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
  }, [viewPeriod]);

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
    // Reset selections when the view period changes
    setSelectedAssignmentId(null);
    setSelectedSubjectId(null);
    setSelectedGradeId(null);
    setSelectedTerm(null);
    setEvaluationPlan([]);
    setStudents([]);
    fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  // Fetch section closures when the selected term changes
  useEffect(() => {
    if (!selectedTerm) {
      setClosedSections(null);
      return;
    }
    const term = availableTerms.find(t => t.id === selectedTerm);
    if (!term) {
      setClosedSections(null);
      return;
    }
    if (term.isBlocked) {
      setClosedSections(null); // all closed
      return;
    }
    let cancelled = false;
    api.get(`/terms/${selectedTerm}/section-closures`)
      .then(res => {
        if (cancelled) return;
        setClosedSections(res.data?.closedSections ?? []);
      })
      .catch(() => {
        if (!cancelled) setClosedSections([]);
      });
    return () => { cancelled = true; };
  }, [selectedTerm, availableTerms]);

  useEffect(() => {
    fetchPlanAndStudents();
  }, [fetchPlanAndStudents]);

  const fetchThematicComponents = useCallback(async () => {
    if (!selectedAssignmentId || !selectedTerm) {
      setThematicComponents([]);
      return;
    }
    const assignment = assignments.find(a => a.id === selectedAssignmentId);
    if (!assignment) {
      setThematicComponents([]);
      return;
    }
    try {
      const res = await api.get(`/thematic-components`, {
        params: {
          pgsId: assignment.periodGradeSubjectId,
          sectionId: assignment.sectionId,
          termId: selectedTerm,
        },
      });
      setThematicComponents(res.data || []);
    } catch {
      setThematicComponents([]);
    }
  }, [selectedAssignmentId, assignments, selectedTerm]);

  useEffect(() => {
    fetchThematicComponents();
  }, [fetchThematicComponents]);

  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        const [tecRes, instRes, estRes] = await Promise.all([
          api.get('/evaluation/catalogs?type=tecnica'),
          api.get('/evaluation/catalogs?type=instrumento'),
          api.get('/evaluation/catalogs?type=estrategia'),
        ]);
        setTecnicaOptions(tecRes.data);
        setInstrumentoOptions(instRes.data);
        setEstrategiaOptions(estRes.data);
      } catch {
        // silent
      }
    };
    fetchCatalogs();
  }, []);

  useEffect(() => {
    const fetchRevisionStatus = async () => {
      if (!viewPeriod) return;
      try {
        const revRes = await api.get(`/revision-periods/${viewPeriod.id}`);
        setRevisionOpen(revRes.data?.revisionPeriod?.status === 'open');
      } catch {
        setRevisionOpen(false);
      }
    };
    fetchRevisionStatus();
  }, [viewPeriod]);

  // Derive unique subjects from all assignments (sorted by PeriodGradeSubject.order)
  const availableSubjects = useMemo(() => {
    const map = new Map<number, { id: number; pgsId: number; name: string; order: number }>();
    assignments.forEach(a => {
      const s = a.periodGradeSubject?.subject;
      const order = a.periodGradeSubject?.order ?? Number.MAX_SAFE_INTEGER;
      if (s && !map.has(s.id)) {
        map.set(s.id, { id: s.id, pgsId: a.periodGradeSubjectId, name: s.name, order });
      } else if (s && map.has(s.id)) {
        // Keep the minimum order (most prioritized) across grades
        const existing = map.get(s.id)!;
        if (order < existing.order) {
          map.set(s.id, { id: s.id, pgsId: existing.pgsId, name: s.name, order });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  }, [assignments]);

  // Derive unique grades for the selected subject (sorted by ordinal extracted from name)
  const availableGrades = useMemo(() => {
    if (!selectedSubjectId) return [];
    const map = new Map<number, { id: number; name: string }>();
    assignments.forEach(a => {
      if (a.periodGradeSubject?.subject?.id !== selectedSubjectId) return;
      const g = a.periodGradeSubject?.periodGrade?.grade;
      if (g && !map.has(g.id)) map.set(g.id, { id: g.id, name: g.name });
    });
    return Array.from(map.values()).sort((a, b) => gradeOrder(a.name) - gradeOrder(b.name));
  }, [assignments, selectedSubjectId]);

  // Derive available sections for the selected subject + grade
  const availableSections = useMemo(() => {
    if (!selectedSubjectId || !selectedGradeId) return [];
    return assignments
      .filter(a =>
        a.periodGradeSubject?.subject?.id === selectedSubjectId &&
        a.periodGradeSubject?.periodGrade?.grade?.id === selectedGradeId
      )
      .map(a => ({ assignmentId: a.id, sectionId: a.sectionId, sectionName: a.section.name }))
      .sort((a, b) => a.sectionName.localeCompare(b.sectionName, 'es'));
  }, [assignments, selectedSubjectId, selectedGradeId]);

  // Auto-select: if only one subject, select it; if only one grade, select it; if only one section, select it
  useEffect(() => {
    if (selectedSubjectId === null && availableSubjects.length === 1) {
      setSelectedSubjectId(availableSubjects[0].id);
    }
  }, [availableSubjects, selectedSubjectId]);

  useEffect(() => {
    if (selectedSubjectId && availableGrades.length === 1 && selectedGradeId === null) {
      setSelectedGradeId(availableGrades[0].id);
    }
  }, [availableGrades, selectedSubjectId, selectedGradeId]);

  useEffect(() => {
    if (availableSections.length === 1 && selectedAssignmentId !== availableSections[0].assignmentId) {
      setSelectedAssignmentId(availableSections[0].assignmentId);
    }
  }, [availableSections, selectedAssignmentId]);

  // If the selected assignment is no longer valid for the current subject+grade
  // (e.g. the teacher changed the year and doesn't teach that section there),
  // try to preserve the same section name; otherwise clear the selection.
  useEffect(() => {
    if (!selectedAssignmentId) return;
    if (availableSections.length === 0) return;

    const current = assignments.find(a => a.id === selectedAssignmentId);
    const currentSectionName = current?.section?.name;
    const stillValid = availableSections.some(s => s.assignmentId === selectedAssignmentId);

    if (!stillValid && currentSectionName) {
      // Try to find the same section name in the new year
      const match = availableSections.find(s => s.sectionName === currentSectionName);
      if (match) {
        setSelectedAssignmentId(match.assignmentId);
      } else {
        setSelectedAssignmentId(null);
      }
    }
  }, [availableSections, selectedAssignmentId, assignments]);

  // Target sections for copy: same subject + same grade + same teacher, excluding current section
  const copyTargetAssignments = useMemo(() => {
    if (!selectedAssignmentId) return [];
    const current = assignments.find(a => a.id === selectedAssignmentId);
    if (!current) return [];
    return assignments.filter(a =>
      a.id !== selectedAssignmentId &&
      a.periodGradeSubjectId === current.periodGradeSubjectId &&
      a.sectionId !== current.sectionId
    );
  }, [assignments, selectedAssignmentId]);

  if (!loading && assignments.length === 0) {
    return (
      <div className="h-full overflow-y-auto theme-page-bg p-4 md:p-8">
        <div className="app-page-header">
          <h1 className="font-headline">Panel Académico</h1>
          <p>Gestión de planificación, contenidos y calificaciones</p>
        </div>
        <div className="app-card p-12 flex flex-col items-center justify-center" style={{ minHeight: 400 }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' }}>
            <BookOutlined style={{ fontSize: 28, color: 'var(--color-accent)' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-main)' }}>No tienes materias asignadas</h2>
          <p className="text-sm max-w-md text-center" style={{ color: 'var(--color-text-muted)' }}>
            Actualmente no tienes asignaciones de materia y sección para el período académico activo.
            Si consideras que esto es un error, por favor contacta al personal administrativo o de control de estudios.
          </p>
        </div>
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
    { title: 'Descripción Breve', key: 'shortDescription', width: 180,
      render: (_: unknown, r: EvaluationPlanItem) => r.shortDescription || <span style={{ color: '#999' }}>—</span>
    },
    { title: 'Estrategia de Evaluación', key: 'description', width: 200,
      render: (_: unknown, r: EvaluationPlanItem) => <span style={{ fontWeight: 600 }}>{r.estrategiaCatalog?.name || r.description}</span>
    },
    { title: 'Técnica', key: 'tecnica', width: 120,
      render: (_: unknown, r: EvaluationPlanItem) => r.tecnicaCatalog?.name || <span style={{ color: '#999' }}>—</span>
    },
    { title: 'Instrumento', key: 'instrumento', width: 120,
      render: (_: unknown, r: EvaluationPlanItem) => r.instrumentoCatalog?.name || <span style={{ color: '#999' }}>—</span>
    },
    { title: 'Contenidos Temáticos', key: 'thematicContents', width: 220,
      render: (_: unknown, r: EvaluationPlanItem) => {
        if (!r.thematicContents || r.thematicContents.length === 0)
          return <span style={{ color: '#999' }}>—</span>;
        return (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
            {r.thematicContents.map(c => (
              <li key={c.id}>{contentIndexLabel.get(c.id) ? `${contentIndexLabel.get(c.id)} ` : ''}{c.title}{c.thematicComponent ? <span style={{ color: '#999', fontSize: 10 }}> ({c.thematicComponent.title})</span> : null}</li>
            ))}
          </ul>
        );
      }
    },
    { title: 'Criterios', key: 'criteria', width: 280,
      render: (_: unknown, r: EvaluationPlanItem) => {
        if (!r.criteria || r.criteria.length === 0) return <span style={{ color: '#999' }}>—</span>;
        return (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
            {r.criteria.map(c => (
              <li key={c.id}>
                <span style={{ fontWeight: 500 }}>{c.name}</span> ({c.points} pts)
                {c.indicators && c.indicators.length > 0 && (
                  <ul style={{ margin: '2px 0 0 0', paddingLeft: 16, fontSize: 11, color: 'var(--color-text-muted, #888)' }}>
                    {c.indicators.map(ind => (
                      <li key={ind.id}>{ind.name} ({ind.points} pts)</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        );
      }
    },
    { title: 'Porcentaje', dataIndex: 'percentage', key: 'percentage', render: (val: number) => `${val}%`, width: 90 },
    { title: 'Puntaje', key: 'points', width: 90, render: (_: unknown, r: EvaluationPlanItem) => `${((r.percentage / 100) * maxGrade).toFixed(1)} pts` },
    {
      title: 'Tipo de Evaluación',
      key: 'evaluationType',
      children: [
        { title: 'Intra', key: 'intra', width: 60, align: 'center' as const, render: (_: unknown, r: EvaluationPlanItem) => (r.evaluationType || '').split(',').includes('intra') ? <Tag color="blue" style={{ margin: 0 }}>✓</Tag> : <span style={{ color: '#ccc' }}>—</span> },
        { title: 'Inter', key: 'inter', width: 60, align: 'center' as const, render: (_: unknown, r: EvaluationPlanItem) => (r.evaluationType || '').split(',').includes('inter') ? <Tag color="green" style={{ margin: 0 }}>✓</Tag> : <span style={{ color: '#ccc' }}>—</span> },
        { title: 'Trans', key: 'trans', width: 60, align: 'center' as const, render: (_: unknown, r: EvaluationPlanItem) => (r.evaluationType || '').split(',').includes('trans') ? <Tag color="purple" style={{ margin: 0 }}>✓</Tag> : <span style={{ color: '#ccc' }}>—</span> },
      ],
    },
    { title: 'Fecha', dataIndex: 'date', key: 'date', render: (val: string) => dayjs(val).format('DD/MM/YYYY'), width: 100 },
    {
      title: 'Acciones',
      key: 'actions',
      width: 90,
      render: (_: unknown, record: EvaluationPlanItem) => (
        <Space>
          {!isSelectedTermBlocked && !isReadOnly && (
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

  const handleCopyPlan = async () => {
    if (!selectedAssignmentId || copyTargetSectionIds.length === 0) return;
    const current = assignments.find(a => a.id === selectedAssignmentId);
    if (!current || !selectedTerm) return;
    setCopySubmitting(true);
    try {
      const res = await api.post('/evaluation/copy-plan', {
        sourcePeriodGradeSubjectId: current.periodGradeSubjectId,
        sourceSectionId: current.sectionId,
        targetPeriodGradeSubjectId: current.periodGradeSubjectId,
        targetSectionIds: copyTargetSectionIds,
        termId: selectedTerm,
      });
      const data = res.data;
      const created = data.results?.filter((r: any) => r.created > 0).length || 0;
      const skipped = data.results?.filter((r: any) => r.skipped > 0).length || 0;
      if (created > 0 && skipped === 0) {
        message.success(`Plan copiado a ${created} sección${created > 1 ? 'es' : ''}`);
      } else if (created > 0 && skipped > 0) {
        message.warning(`Copiado a ${created} sección${created > 1 ? 'es' : ''}, ${skipped} ya tenían plan y se omitieron`);
      } else if (created === 0 && skipped > 0) {
        message.info('Las secciones seleccionadas ya tenían un plan de evaluación');
      }
      setCopyModalOpen(false);
      setCopyTargetSectionIds([]);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al copiar el plan');
    } finally {
      setCopySubmitting(false);
    }
  };

  const downloadOfficialGradeReport = async () => {
    if (!selectedAssignmentId) return;
    try {
      const res = await api.get(`/evaluation/export-grades-oficial/${selectedAssignmentId}`, {
        params: { filled: 'true', term: selectedTerm ?? undefined },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'acta-de-notas.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Error al descargar el acta de notas');
    }
  };

  const downloadPlanningExcel = async () => {
    if (!selectedAssignmentId || !selectedTerm) return;
    try {
      const res = await api.get(`/evaluation/export-planning/${selectedAssignmentId}`, {
        params: { term: selectedTerm },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'planificacion.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Error al generar el Excel de planificación');
    }
  };

  const handlePrintNomina = async () => {
    if (!selectedAssignmentId) return;
    const assignment = assignments.find(a => a.id === selectedAssignmentId);
    if (!assignment) return;
    const grade = assignment.periodGradeSubject?.periodGrade?.grade;
    const schoolPeriod = assignment.periodGradeSubject?.periodGrade?.schoolPeriod;
    if (!grade || !schoolPeriod) return;
    setNominaGenerating(true);
    try {
      const count = await generateSingleNomina({
        gradeId: grade.id,
        sectionId: assignment.sectionId,
        schoolPeriodId: schoolPeriod.id,
        gradeName: grade.name,
        sectionName: assignment.section?.name || '',
        periodName: schoolPeriod.name || '',
      });
      message.success(`Nómina generada (${count} estudiantes)`);
    } catch (error) {
      console.error('Error generando nómina:', error);
      message.error('Error al generar la nómina');
    } finally {
      setNominaGenerating(false);
    }
  };

  // ── Paste handler: distribute clipboard values across grade cells ──
  const handleGradePaste = (e: React.ClipboardEvent<HTMLInputElement>, startRow: number, startCol: number) => {
    if (isReadOnly || isSelectedTermBlocked) return;
    e.preventDefault();

    const raw = e.clipboardData.getData('text');
    if (!raw) return;

    // Parse clipboard into a 2D grid (rows separated by \n, columns by \t)
    // Only trim trailing empty lines (e.g. final newline); keep blank rows in the middle
    // so that empty cells from Excel/Word are respected as null grades.
    const allLines = raw.split(/\r?\n/);
    let grid: string[][] = allLines.map(line => line.split(/\t/).map(c => c.trim()));
    // Remove trailing empty lines
    while (grid.length > 0 && grid[grid.length - 1].every(c => c === '')) {
      grid.pop();
    }
    // Remove leading empty lines
    while (grid.length > 0 && grid[0].every(c => c === '')) {
      grid.shift();
    }

    if (grid.length === 0) return;

    const isVertical = grid.length > 1 && (grid[0].length === 1 || grid.every(row => row.length === 1));
    const isHorizontal = grid.length === 1 && grid[0].length > 1;

    // Flatten values into a simple list
    const values: string[] = isVertical
      ? grid.map(row => row[0])
      : isHorizontal
        ? grid[0]
        : grid.flat();

    if (values.length === 0) return;

    // Build the list of target cells starting from (startRow, startCol)
    // Use the same sort order as the render to ensure row indices match
    const sortedStudents = [...students].sort((a, b) => {
      const parseDoc = (doc: string) => parseInt((doc || '').replace(/\D/g, ''), 10) || 0;
      return parseDoc(a.student?.document) - parseDoc(b.student?.document);
    });

    const targets: { row: number; col: number; enrollment: StudentEnrollment; evalPlanId: number }[] = [];

    if (isVertical || (!isHorizontal && !isVertical)) {
      for (let i = 0; i < values.length; i++) {
        const row = startRow + i;
        const col = startCol;
        if (row >= sortedStudents.length) break;
        const enrollment = sortedStudents[row];
        if (!enrollment || !evaluationPlan[col]) break;
        targets.push({ row, col, enrollment, evalPlanId: evaluationPlan[col].id });
      }
    } else {
      for (let i = 0; i < values.length; i++) {
        const row = startRow;
        const col = startCol + i;
        if (col >= evaluationPlan.length) break;
        const enrollment = sortedStudents[row];
        if (!enrollment || !evaluationPlan[col]) break;
        targets.push({ row, col, enrollment, evalPlanId: evaluationPlan[col].id });
      }
    }

    if (targets.length === 0) return;

    // Parse and validate all values first
    // Empty values are respected as null (blank cell), not skipped.
    const parsed: { target: typeof targets[0]; score: number | null }[] = [];
    let skippedCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const valStr = values[i].replace(/[^0-9]/g, '');
      if (valStr === '') {
        // Empty cell from clipboard → blank grade (null)
        parsed.push({ target: targets[i], score: null });
        continue;
      }
      const val = parseInt(valStr, 10);
      if (isNaN(val) || val < 0 || val > maxGrade) { skippedCount++; continue; }
      parsed.push({ target: targets[i], score: val === 0 ? null : val });
    }

    if (parsed.length === 0) {
      if (skippedCount > 0) message.warning(`${skippedCount} valor(es) inválido(s) o vacío(s)`);
      return;
    }

    // Optimistic update: update all qualifications in the students state at once
    setStudents(prev => prev.map(s => {
      const updates = parsed.filter(p => p.target.enrollment.id === s.id);
      if (updates.length === 0) return s;
      const insSub = s.inscriptionSubjects?.[0];
      if (!insSub) return s;
      const quals = [...(insSub.qualifications || [])];
      for (const u of updates) {
        const idx = quals.findIndex(q => q.evaluationPlanId === u.target.evalPlanId);
        if (idx >= 0) {
          quals[idx] = { ...quals[idx], score: u.score ?? 0, isAbsent: false };
        } else {
          quals.push({ id: 0, evaluationPlanId: u.target.evalPlanId, score: u.score ?? 0, isAbsent: false, remedialScore: null });
        }
      }
      return { ...s, inscriptionSubjects: [{ ...insSub, qualifications: quals }] };
    }));

    // Update input elements visually
    for (const p of parsed) {
      const inputEl = document.getElementById(`grade-${p.target.row}-${p.target.col}`) as HTMLInputElement | null;
      if (inputEl) inputEl.value = p.score === null ? '' : padGrade(p.score);
    }

    // Save all notes to backend in parallel, then refresh once
    Promise.all(parsed.map(p => {
      const inscriptionSubjectId = p.target.enrollment.inscriptionSubjects?.[0]?.id;
      return api.post('/evaluation/qualifications', {
        evaluationPlanId: p.target.evalPlanId,
        inscriptionSubjectId,
        inscriptionId: p.target.enrollment.id,
        score: p.score === null ? 0 : p.score,
        isAbsent: false,
        observations: '',
      }).catch(() => { /* individual errors swallowed, will be caught by final fetch */ });
    })).then(() => {
      // Small delay to ensure React has painted the optimistic update before refetching
      setTimeout(() => fetchPlanAndStudents(), 100);
    }).catch(() => {
      message.error('Error al guardar algunas notas pegadas');
      fetchPlanAndStudents();
    });

    // Move focus to the last processed cell
    const lastTarget = parsed[parsed.length - 1].target;
    setTimeout(() => {
      const lastInput = document.getElementById(`grade-${lastTarget.row}-${lastTarget.col}`) as HTMLInputElement | null;
      if (lastInput) lastInput.focus();
    }, 0);

    message.success(`${parsed.length} nota(s) pegada(s)${skippedCount > 0 ? `, ${skippedCount} omitida(s)` : ''}`);
  };

  // ── Thematic Component handlers ──────────────────────────────────
  const handleCreateComponent = async (title: string) => {
    if (!selectedAssignmentId || !selectedTerm) return;
    const assignment = assignments.find(a => a.id === selectedAssignmentId);
    if (!assignment) return;
    try {
      await api.post('/thematic-components', {
        periodGradeSubjectId: assignment.periodGradeSubjectId,
        sectionId: assignment.sectionId,
        termId: selectedTerm,
        title,
      });
      fetchThematicComponents();
    } catch {
      message.error('Error al crear componente');
    }
  };

  const handleUpdateComponent = async (id: number, title: string) => {
    try {
      await api.put(`/thematic-components/${id}`, { title });
      fetchThematicComponents();
    } catch {
      message.error('Error al actualizar componente');
    }
  };

  const handleDeleteComponent = async (id: number) => {
    try {
      await api.delete(`/thematic-components/${id}`);
      fetchThematicComponents();
    } catch {
      message.error('Error al eliminar componente');
    }
  };

  const handleCreateContent = async (componentId: number, title: string) => {
    try {
      await api.post(`/thematic-components/${componentId}/contents`, { title });
      fetchThematicComponents();
    } catch {
      message.error('Error al crear contenido');
    }
  };

  const handleUpdateContent = async (contentId: number, title: string) => {
    try {
      await api.put(`/thematic-components/contents/${contentId}`, { title });
      fetchThematicComponents();
    } catch {
      message.error('Error al actualizar contenido');
    }
  };

  const handleDeleteContent = async (contentId: number) => {
    try {
      await api.delete(`/thematic-components/contents/${contentId}`);
      fetchThematicComponents();
    } catch {
      message.error('Error al eliminar contenido');
    }
  };

  const handleReorderContents = async (componentId: number, contentIds: number[]) => {
    try {
      await api.patch('/thematic-components/contents/reorder', { contentIds });
      fetchThematicComponents();
      fetchPlanAndStudents();
    } catch {
      message.error('Error al reordenar contenidos');
      fetchThematicComponents();
    }
  };

  const handleReorderComponents = async (componentIds: number[]) => {
    try {
      await api.patch('/thematic-components/reorder', { componentIds });
      fetchThematicComponents();
      fetchPlanAndStudents();
    } catch {
      message.error('Error al reordenar componentes');
      fetchThematicComponents();
    }
  };

  const handleCreateLearning = async (contentIds: number[], description: string) => {
    try {
      await api.post('/thematic-components/learnings', { contentIds, description });
      fetchThematicComponents();
    } catch {
      message.error('Error al crear aprendizaje esperado');
    }
  };

  const handleDeleteLearning = async (learningId: number) => {
    try {
      await api.delete(`/thematic-components/learnings/${learningId}`);
      fetchThematicComponents();
    } catch {
      message.error('Error al eliminar aprendizaje');
    }
  };

  const handleUpdateLearning = async (learningId: number, description: string, contentIds?: number[]) => {
    try {
      await api.put(`/thematic-components/learnings/${learningId}`, { description, contentIds });
      fetchThematicComponents();
    } catch {
      message.error('Error al actualizar aprendizaje');
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

        /* Hide scrollbar on drag-scroll containers (Chrome/Safari/Edge) */
        .drag-scroll-container::-webkit-scrollbar { display: none; }
        
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
      <div className="app-page-header">
        <h1 className="font-headline">Configuración del Plan de Evaluación</h1>
        <p>Gestiona contenidos, evaluaciones y calificaciones por lapso académico</p>
      </div>

      {/* Top Grid Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        {/* Subjects & Terms combined in a single card-like block or flex */}
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Asignaturas Seleccionables — 3 niveles: materia → año → sección */}
          <div className="app-card app-card-hover p-5 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Seleccionar Asignatura</span>

            {/* Nivel 1: Materia (scroll horizontal con drag, sin repetir, con icono+color) */}
            <div
              ref={dragScroll.ref}
              onMouseDown={dragScroll.onMouseDown}
              onMouseMove={dragScroll.onMouseMove}
              onMouseUp={dragScroll.onMouseUp}
              onMouseLeave={dragScroll.onMouseLeave}
              onClickCapture={dragScroll.onClickCapture}
              onTouchStart={dragScroll.onTouchStart}
              onTouchMove={dragScroll.onTouchMove}
              onTouchEnd={dragScroll.onTouchEnd}
              className="flex gap-2.5 overflow-x-auto pb-2 shrink-0 drag-scroll-container"
              style={{ minHeight: 64, cursor: 'grab', scrollbarWidth: 'none', msOverflowStyle: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
            >
              {availableSubjects.map(s => {
                const isSelected = s.id === selectedSubjectId;
                const { Icon, color } = getSubjectVisual({ name: s.name });
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSubjectId(s.id);
                      setSelectedGradeId(null);
                      setSelectedAssignmentId(null);
                    }}
                    className="cursor-pointer min-w-[180px] rounded-xl p-3 transition-all flex items-center gap-3 border-none"
                    style={{
                      backgroundColor: isSelected ? 'var(--color-accent)' : 'var(--color-inactive)',
                      color: isSelected ? 'var(--color-header-text)' : 'var(--color-text-main)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : withAlpha(color, 0.12),
                      }}
                    >
                      <Icon style={{ color: isSelected ? '#fff' : color, fontSize: 18 }} />
                    </div>
                    <div className="font-bold text-sm leading-tight" style={{ color: 'inherit' }}>
                      {s.name}
                    </div>
                  </div>
                );
              })}
              {availableSubjects.length === 0 && (
                <span className="text-xs self-center" style={{ color: 'var(--color-text-muted)' }}>Sin materias</span>
              )}
            </div>

            {/* Nivel 2: Año — altura fija para evitar layout shift */}
            <div className="flex gap-2 mt-3 w-full" style={{ minHeight: 40 }}>
              {selectedSubjectId && availableGrades.map(g => {
                const isSelected = g.id === selectedGradeId;
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      setSelectedGradeId(g.id);
                    }}
                    className="flex-1 py-2.5 text-sm font-bold rounded-lg transition-all border-none cursor-pointer"
                    style={{
                      backgroundColor: isSelected ? 'var(--color-accent)' : 'var(--color-inactive)',
                      color: isSelected ? 'var(--color-header-text)' : 'var(--color-text-main)',
                    }}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>

            {/* Nivel 3: Sección — altura fija para evitar layout shift */}
            <div className="flex gap-2 mt-2 w-full" style={{ minHeight: 40 }}>
              {selectedGradeId && availableSections.map(sec => {
                const isSelected = sec.assignmentId === selectedAssignmentId;
                return (
                  <button
                    key={sec.assignmentId}
                    onClick={() => setSelectedAssignmentId(sec.assignmentId)}
                    className="flex-1 py-2.5 text-sm font-bold rounded-lg transition-all border-none cursor-pointer"
                    style={{
                      backgroundColor: isSelected ? 'var(--color-accent)' : 'var(--color-inactive)',
                      color: isSelected ? 'var(--color-header-text)' : 'var(--color-text-main)',
                    }}
                  >
                    {sec.sectionName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lazos */}
          <div className="app-card app-card-hover p-5 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Lapso Académico</span>
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
            {revisionOpen && (
              <Button
                icon={<ToolOutlined />}
                onClick={() => navigate('/profesor/reparacion')}
                style={{ marginTop: 12, width: '100%' }}
                type="primary"
                danger
              >
                Reparación de Materias
              </Button>
            )}
          </div>
        </div>

        {/* Progress Planificado */}
        <div className="app-card app-card-hover p-6 flex flex-col justify-center relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-lg m-0" style={{ color: 'var(--color-text-main)' }}>Total Planificado</h3>
            <span className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full ${totalPercentage === 100 ? 'bg-green-100 text-green-700' : totalPercentage > 100 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
              {totalPercentage}% Completado
            </span>
          </div>
          <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">Avance del periodo actual</p>
          
          <div className="h-3 w-full rounded-full mt-2 mb-2 relative overflow-hidden" style={{ backgroundColor: 'var(--color-inactive)' }}>
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${totalPercentage === 100 ? 'bg-green-500' : totalPercentage > 100 ? 'bg-red-500' : ''}`} 
              style={{ 
                width: `${Math.min(totalPercentage, 100)}%`,
                backgroundColor: (totalPercentage <= 100 && totalPercentage !== 100) ? 'var(--color-accent)' : undefined 
              }} 
            />
          </div>
          <div className="flex justify-between text-[11px] font-bold text-[var(--color-text-muted)] mb-4">
            <span>0%</span>
            <span style={{ color: 'var(--color-accent)' }}>{totalPercentage}% de 100%</span>
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
      <div className="app-card p-6 mb-8">
        <Tabs
          activeKey={activeTab}
          tabBarExtraContent={(
            <div className="flex items-center gap-4">
              {false && (
                <Button
                  icon={<FilePdfOutlined />}
                  onClick={() => setShowPDFModal(true)}
                  disabled={!selectedAssignmentId || evaluationPlan.length === 0}
                >
                  Generar PDF
                </Button>
              )}
              <Button
                icon={<DownloadOutlined />}
                onClick={downloadPlanningExcel}
                disabled={!selectedAssignmentId || !selectedTerm}
                className={(!selectedAssignmentId || !selectedTerm) ? 'opacity-40 cursor-not-allowed' : ''}
              >
                Crear Excel de planificación
              </Button>
              <Button
                icon={<PrinterOutlined />}
                onClick={handlePrintNomina}
                disabled={!selectedAssignmentId}
                loading={nominaGenerating}
                className={!selectedAssignmentId ? 'opacity-40 cursor-not-allowed' : ''}
              >
                Imprimir Nómina
              </Button>
            </div>
          )}
          onChange={(key) => {
            setActiveTab(key);
            if (key === '2' || key === '3') {
              fetchPlanAndStudents();
            }
          }}
          items={[
            {
              key: '1',
              label: <span className="font-bold text-[15px] px-4 py-1">Contenido</span>,
              children: (
                <div className="pt-4">
                  <ContentTab
                    thematicComponents={thematicComponents}
                    isBlocked={isSelectedTermBlocked || isReadOnly}
                    onCreateComponent={handleCreateComponent}
                    onUpdateComponent={handleUpdateComponent}
                    onDeleteComponent={handleDeleteComponent}
                    onCreateContent={handleCreateContent}
                    onUpdateContent={handleUpdateContent}
                    onDeleteContent={handleDeleteContent}
                    onCreateLearning={handleCreateLearning}
                    onUpdateLearning={handleUpdateLearning}
                    onDeleteLearning={handleDeleteLearning}
                    onReorderContents={handleReorderContents}
                    onReorderComponents={handleReorderComponents}
                  />
                </div>
              )
            },
            {
              key: '2',
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
                    style={{ backgroundColor: 'var(--color-content-bg)', border: '1px solid rgba(15, 23, 42, 0.06)' }}
                  />
                  
                  {totalPercentage < 100 && (
                    <div
                      className={`mt-4 w-full h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer border-none shadow-sm ${isSelectedTermBlocked || !selectedAssignmentId || isReadOnly ? 'opacity-50 pointer-events-none' : 'hover:scale-[1.01]'}`}
                      style={{ backgroundColor: isSelectedTermBlocked || !selectedAssignmentId || isReadOnly ? 'var(--color-inactive)' : 'var(--color-accent)',
                        color: isSelectedTermBlocked || !selectedAssignmentId || isReadOnly ? 'var(--color-text-main)' : 'var(--color-header-text)' }}
                      onClick={() => {
                        if(isSelectedTermBlocked || !selectedAssignmentId || isReadOnly) return;
                        setEditingItem(null);
                        setShowPlanModal(true);
                      }}
                    >
                      <PlusOutlined className="text-3xl font-bold" />
                    </div>
                  )}

                  {totalPercentage === 100 && copyTargetAssignments.length > 0 && !isSelectedTermBlocked && !isReadOnly && (
                    <div
                      className="mt-3 w-full h-14 flex items-center justify-center gap-3 rounded-xl transition-all cursor-pointer border-none shadow-sm hover:scale-[1.01]"
                      style={{ backgroundColor: '#16a34a', color: '#fff' }}
                      onClick={() => { setCopyTargetSectionIds([]); setCopyModalOpen(true); }}
                    >
                      <CopyOutlined className="text-2xl font-bold" />
                      <span className="text-lg font-bold">Listo 100% — Copiar a otras secciones</span>
                    </div>
                  )}

<div className="mt-6 flex justify-between items-center px-2">
                      <span className="font-medium text-sm" style={{ color: 'var(--color-text-main)' }}>Mostrando {evaluationPlan.length} evaluaciones registradas</span>
                      <span className="font-black" style={{ color: 'var(--color-text-main)' }}>Total Puntaje Acumulado: {totalPercentage}%</span>
                   </div>
                </div>
              )
            },
          {
            key: '3',
            label: <span className="font-bold text-[15px] px-4 py-1">Calificaciones</span>,
            children: evaluationPlan.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' }}>
                  <BookOutlined style={{ fontSize: 24, color: 'var(--color-accent)' }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-main)' }}>No hay Plan de Evaluación definido</h3>
                <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>Para poder calificar este lapso, primero debe definir las actividades y sus porcentajes.</p>
                <Button type="primary" size="large" onClick={() => setActiveTab('2')} className="rounded-xl">
                  Crear Plan de Evaluación
                </Button>
              </div>
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
                      icon={<FilePdfOutlined />}
                      size="small"
                      onClick={downloadOfficialGradeReport}
                      disabled={!selectedAssignmentId || !selectedTerm || students.length === 0}
                    >
                      Acta de notas
                    </Button>
                  </div>
                </div>
                <Card bodyStyle={{ padding: 0 }} style={{ overflow: 'hidden', backgroundColor: 'var(--color-content-bg)', border: '1px solid rgba(15, 23, 42, 0.08)' }}>
                <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 350px)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid rgba(15, 23, 42, 0.08)' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr>
                        <th style={{ padding: '4px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', backgroundColor: 'color-mix(in srgb, var(--color-text-main) 6%, var(--color-content-bg))', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', color: 'var(--color-text-main)', width: 36 }}>#</th>
                        <th style={{ padding: '4px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', backgroundColor: 'color-mix(in srgb, var(--color-text-main) 6%, var(--color-content-bg))', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', color: 'var(--color-text-main)' }}>Cédula</th>
                        <th style={{ padding: '4px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'left', backgroundColor: 'color-mix(in srgb, var(--color-text-main) 6%, var(--color-content-bg))', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', color: 'var(--color-text-main)' }}>Estudiante</th>
                        {evaluationPlan.map((item, colIndex) => {
                          const stats = evalStats.get(item.id);
                          const hasRemedial = (stats?.failedPct ?? 0) >= remedialFailurePercentage;
                          return (
                          <th key={item.id} colSpan={hasRemedial ? 2 : 1} style={{ padding: '3px 4px', border: '1px solid rgba(15, 23, 42, 0.08)', borderLeft: colIndex > 0 ? '2px solid color-mix(in srgb, var(--color-text-main) 35%, transparent)' : undefined, textAlign: 'center', backgroundColor: 'color-mix(in srgb, var(--color-text-main) 6%, var(--color-content-bg))', verticalAlign: 'top', whiteSpace: 'nowrap', color: 'var(--color-text-main)' }}>
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
                            <div style={{ fontSize: 9, fontWeight: 700, lineHeight: 1.2, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.shortDescription || item.description}>
                              {item.shortDescription || item.description || '—'}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--color-text-muted)', lineHeight: 1.2, marginTop: 1 }}>
                              {item.percentage}%
                            </div>
                          </th>
                          );
                        })}
                        <th style={{ padding: '3px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', backgroundColor: 'color-mix(in srgb, var(--color-text-main) 6%, var(--color-content-bg))', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', color: 'var(--color-text-main)' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...students]
                        .sort((a, b) => {
                          const parseDoc = (doc: string) => parseInt((doc || '').replace(/\D/g, ''), 10) || 0;
                          return parseDoc(a.student?.document) - parseDoc(b.student?.document);
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
                              <td style={{ padding: '2px 4px', border: '1px solid var(--color-text-muted)', textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-content-bg)' : 'color-mix(in srgb, var(--color-text-main) 2%, var(--color-content-bg))', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                {rowIndex + 1}
                              </td>
                              <td style={{ padding: '2px 4px', border: '1px solid var(--color-text-muted)', textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-content-bg)' : 'color-mix(in srgb, var(--color-text-main) 2%, var(--color-content-bg))', fontSize: 11, fontWeight: 500 }}>
                                {enrollment.student?.document || '-'}
                              </td>
                              <td style={{ padding: '2px 6px', border: '1px solid var(--color-text-muted)', textAlign: 'left', background: rowIndex % 2 === 0 ? 'var(--color-content-bg)' : 'color-mix(in srgb, var(--color-text-main) 2%, var(--color-content-bg))', fontSize: 12 }}>
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
                                  <td key={`${item.id}-a`} className={`grading-cell${isAbsent ? ' grading-absent' : ''}`} style={{ padding: '2px', border: '1px solid rgba(15, 23, 42, 0.08)', borderLeft: colIndex > 0 ? '2px solid color-mix(in srgb, var(--color-text-main) 35%, transparent)' : undefined, textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-content-bg)' : 'color-mix(in srgb, var(--color-text-main) 2%, var(--color-content-bg))', width: '50px', cursor: isReadOnly ? 'default' : 'context-menu' }}
                                    title={isReadOnly ? undefined : "Click derecho: marcar/desmarcar inasistente. Click izquierdo: desmarcar NP"}
                                    onContextMenu={(e) => {
                                      if (isReadOnly) return;
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleToggleAbsent(enrollment, item.id, q?.isAbsent);
                                    }}
                                    onClick={() => {
                                      if (isReadOnly) return;
                                      if (isAbsent) {
                                        handleToggleAbsent(enrollment, item.id, true);
                                        setTimeout(() => {
                                          const input = document.getElementById(`grade-${rowIndex}-${colIndex}`);
                                          if (input) (input as HTMLInputElement).focus();
                                        }, 0);
                                      }
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
                                      onPaste={(e) => handleGradePaste(e, rowIndex, colIndex)}
                                      defaultValue={isAbsent ? '' : (currentScore !== null ? padGrade(currentScore) : '')}
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
                                        color: currentScore !== null && currentScore > 0 && currentScore < passingGrade ? '#dc2626' : undefined,
                                        fontWeight: currentScore !== null && currentScore > 0 && currentScore < passingGrade ? 700 : undefined,
                                      }}
                                      title={q?.editedByOther
                                        ? `Editada el ${new Date(q.lastEditDate || '').toLocaleString('es-VE')} por ${q.lastEditUser || 'usuario desconocido'}`
                                        : undefined}
                                      disabled={isReadOnly || isSelectedTermBlocked || (q?.remedialScore != null && q.remedialScore > 0 && isRemedialEligible)}
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
                                        if (val === 0) {
                                          // Score 0 is treated as NP (absent)
                                          handleToggleAbsent(enrollment, item.id, q?.isAbsent);
                                          return;
                                        }
                                        (e.target as HTMLInputElement).value = padGrade(val);
                                        if (val !== currentScore) {
                                          // Clear remedial if grade is no longer eligible
                                          const needsRemedialClear = val < remedialMinGrade || val > remedialMaxGrade;
                                          handleSaveScoreInGrid(enrollment, item.id, val, needsRemedialClear ? null : undefined);
                                        }
                                      }}
                                    />
                                  </td>
                                  {hasRemedial && (
                                    <td key={`${item.id}-b`} className="grading-cell remedial-cell" style={{ padding: '2px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-content-bg)' : 'color-mix(in srgb, var(--color-text-main) 2%, var(--color-content-bg))', width: '50px' }}
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
                                        defaultValue={q?.remedialScore != null ? padGrade(q.remedialScore) : ''}
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
                                        disabled={isReadOnly || isSelectedTermBlocked || !isRemedialEligible}
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
                                              e.target.value = currentRemedialScore !== null ? padGrade(currentRemedialScore) : '';
                                              wrapper.classList.add('grade-invalid');
                                              setTimeout(() => wrapper.classList.remove('grade-invalid'), 1500);
                                            }
                                            return;
                                          }
                                          (e.target as HTMLInputElement).value = padGrade(val);
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
                              <td style={{ padding: '2px 4px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-content-bg)' : 'color-mix(in srgb, var(--color-text-main) 2%, var(--color-content-bg))', fontWeight: 700, fontSize: 12 }}>
                                <Tag color={Math.round(rowTotal) >= passingGrade ? 'green' : 'red'} style={{ margin: 0 }}>
                                  {padGrade(rowTotal)}
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
                    <Empty description="No hay estudiantes inscritos en esta sección" />
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
            thematicComponents={thematicComponents}
            tecnicaOptions={tecnicaOptions}
            instrumentoOptions={instrumentoOptions}
            estrategiaOptions={estrategiaOptions}
            maxGrade={maxGrade}
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
        rows={planningPDFRows}
        totalPercentage={totalPercentage}
      />

      <Modal
        title="Copiar plan de evaluación a otras secciones"
        open={copyModalOpen}
        onCancel={() => { setCopyModalOpen(false); setCopyTargetSectionIds([]); }}
        onOk={handleCopyPlan}
        confirmLoading={copySubmitting}
        okText="Copiar"
        cancelText="Cancelar"
        okButtonProps={{ disabled: copyTargetSectionIds.length === 0 }}
      >
        <p className="mb-4" style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          Selecciona las secciones donde quieres copiar el plan actual ({totalPercentage}% completado).
          Las secciones que ya tengan un plan serán omitidas.
        </p>
        <Checkbox.Group
          value={copyTargetSectionIds}
          onChange={(values) => setCopyTargetSectionIds(values as number[])}
          className="flex flex-col gap-2"
        >
          {copyTargetAssignments.map(a => (
            <Checkbox key={a.id} value={a.sectionId}>
              Sección {a.section.name}
            </Checkbox>
          ))}
        </Checkbox.Group>
        {copyTargetAssignments.length === 0 && (
          <Empty description="No hay otras secciones con esta materia asignada a ti" />
        )}
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
