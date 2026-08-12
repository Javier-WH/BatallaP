import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, Tabs, Table, Button, message, Tag, Typography, Alert, Empty, Spin, Space, Dropdown, Modal, Descriptions, Input, Select } from 'antd';
import { BookOutlined, UserOutlined, ArrowLeftOutlined, DownloadOutlined, FilePdfOutlined, EditOutlined, DeleteOutlined, PlusOutlined, HistoryOutlined } from '@ant-design/icons';
import api from '@/services/api';
import dayjs from 'dayjs';
import { useGradeRounding } from '@/context/GradeRoundingContext';
import { formatGrade } from '@/utils/gradeFormat';
import EvaluationPlanPDFModal from '@/components/pdf/EvaluationPlanPDFModal';
import type { EvaluationPlanHeaderData } from '@/components/pdf/EvaluationPlanPDF';
import EvaluationPlanItemModal, { type CatalogOption } from '@/components/EvaluationPlanItemModal';

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

const normalizeText = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
  const [auditModal, setAuditModal] = useState<{ open: boolean; studentName?: string; itemLabel?: string }>({ open: false });
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [commentModal, setCommentModal] = useState<{ open: boolean; enrollment?: StudentEnrollment; evalPlanId?: number; value?: number; inputId?: string; originalValue?: number }>({ open: false });
  const isRightClickRef = useRef(false);
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<number | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([]);
  const [thematicComponents, setThematicComponents] = useState<{
    id: number;
    title: string;
    order?: number;
    contents?: { id: number; title: string; order: number }[];
  }[]>([]);
  const [tecnicaOptions, setTecnicaOptions] = useState<CatalogOption[]>([]);
  const [instrumentoOptions, setInstrumentoOptions] = useState<CatalogOption[]>([]);
  const [estrategiaOptions, setEstrategiaOptions] = useState<CatalogOption[]>([]);
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
  const gradeOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; order: number }>();
    allAssignments.forEach(a => {
      const grade = a.periodGradeSubject?.periodGrade?.grade;
      if (grade) map.set(grade.id, grade);
    });
    return Array.from(map.values()).sort((x, y) => x.order - y.order || x.id - y.id);
  }, [allAssignments]);

  const teacherOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    allAssignments.forEach(a => {
      if (a.teacher?.id) map.set(a.teacher.id, { id: a.teacher.id, name: `${a.teacher.firstName} ${a.teacher.lastName}` });
    });
    return Array.from(map.values());
  }, [allAssignments]);

  const subjectOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    allAssignments.forEach(a => {
      const s = a.periodGradeSubject?.subject;
      if (s?.id) map.set(s.id, { id: s.id, name: s.name });
    });
    return Array.from(map.values());
  }, [allAssignments]);

  const filteredAssignments = useMemo(() => {
    return allAssignments.filter(a => {
      const grade = a.periodGradeSubject?.periodGrade?.grade;
      if (selectedGrades.length > 0 && grade && !selectedGrades.includes(grade.id)) return false;
      if (selectedTeacher != null && a.teacher?.id !== selectedTeacher) return false;
      const subject = a.periodGradeSubject?.subject;
      if (selectedSubjects.length > 0 && subject && !selectedSubjects.includes(subject.id)) return false;
      return true;
    });
  }, [allAssignments, selectedGrades, selectedTeacher, selectedSubjects]);

  const groupedAssignments = useMemo(() => {
    const groups = new Map<number, { gradeName: string; assignments: Assignment[] }>();
    filteredAssignments.forEach(a => {
      const pg = a.periodGradeSubject?.periodGrade;
      const grade = pg?.grade;
      if (!grade) return;
      if (!groups.has(grade.id)) {
        groups.set(grade.id, { gradeName: grade.name, assignments: [] });
      }
      groups.get(grade.id)!.assignments.push(a);
    });
    return Array.from(groups.values());
  }, [filteredAssignments]);

  useEffect(() => {
    fetchAllAssignments();
    fetchTerms();
    fetchMaxGrade();
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
      const [planRes, studentsRes, thematicRes] = await Promise.all([
        api.get(`/evaluation/plan/${selectedAssignment.periodGradeSubjectId}?term=${selectedTerm}&sectionId=${selectedAssignment.sectionId}`),
        api.get(`/evaluation/students/${selectedAssignment.id}`),
        api.get('/thematic-components', {
          params: {
            pgsId: selectedAssignment.periodGradeSubjectId,
            sectionId: selectedAssignment.sectionId,
            termId: selectedTerm,
          },
        }).catch(() => ({ data: [] })),
      ]);
      setEvaluationPlan(planRes.data || []);
      setStudents(studentsRes.data || []);
      setThematicComponents(thematicRes.data || []);
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

  const handleSaveScoreInGrid = async (enrollment: StudentEnrollment, evalPlanId: number, score: number | null, comment?: string) => {
    if (isSelectedTermBlocked) {
      message.warning('Este lapso está bloqueado.');
      return;
    }
    const inscriptionSubjectId = enrollment.inscriptionSubjects?.[0]?.id;
    console.log('[save] score=', score, 'comment=', comment, 'insSub=', inscriptionSubjectId);
    try {
      const resp = await api.post('/evaluation/qualifications', {
        evaluationPlanId: evalPlanId,
        inscriptionSubjectId,
        inscriptionId: enrollment.id,
        score: score === null ? 0 : score,
        isAbsent: false,
        observations: '',
        comment: comment?.trim() || undefined,
      });
      console.log('[save] respuesta:', resp.status, 'id=', resp.data?.id, 'score=', resp.data?.score);
      fetchPlanAndStudents();
    } catch (err) {
      console.error('[save] error:', err);
      message.error('Error al guardar nota');
    }
  };

  const confirmCommentSave = async () => {
    const { enrollment, evalPlanId, value } = commentModal;
    console.log('[confirm] enrollment=', enrollment?.id, 'evalPlanId=', evalPlanId, 'value=', value, 'comment=', commentText);
    if (!enrollment || evalPlanId === undefined || value === undefined) {
      console.log('[confirm] ABORT: datos incompletos');
      return;
    }
    setCommentSaving(true);
    try {
      await handleSaveScoreInGrid(enrollment, evalPlanId, value, commentText);
      setCommentModal({ open: false });
      setCommentText('');
    } finally {
      setCommentSaving(false);
    }
  };

  const cancelCommentSave = () => {
    const { inputId, originalValue } = commentModal;
    if (inputId) {
      const el = document.getElementById(inputId) as HTMLInputElement | null;
      if (el) el.value = originalValue != null ? String(originalValue) : '';
    }
    setCommentModal({ open: false });
    setCommentText('');
  };

  const openAuditHistory = async (q: Qualification | undefined, studentName: string, itemLabel: string) => {
    if (!selectedAssignment) return;
    if (!q || !q.id) {
      message.info('Esta nota aún no tiene historial (no hay calificación registrada)');
      return;
    }
    setAuditModal({ open: true, studentName, itemLabel });
    setAuditLoading(true);
    setAuditHistory([]);
    try {
      const res = await api.get(`/evaluation/qualification-audits/${selectedAssignment.id}`);
      const all = res.data as any[];
      const filtered = all.filter((a: any) => a.qualificationId === q.id);
      console.log('[audit] q.id=', q.id, 'assignmentId=', selectedAssignment.id, 'total=', all.length, 'filtered=', filtered.length);
      setAuditHistory(filtered);
    } catch (e) {
      console.error('[audit] error:', e);
      message.error('Error al cargar el historial de la nota');
    } finally {
      setAuditLoading(false);
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
        params: { filled: filled ? 'true' : 'false', term: selectedTerm ?? undefined },
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

  const downloadPlanningExcel = async () => {
    if (!selectedAssignment?.id || !selectedTerm) return;
    try {
      const res = await api.get(`/evaluation/export-planning/${selectedAssignment.id}`, {
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

  const downloadExcelOficial = async () => {
    if (!selectedAssignment?.id) return;
    try {
      const res = await api.get(`/evaluation/export-grades-oficial/${selectedAssignment.id}`, {
        params: { filled: 'true', term: selectedTerm ?? undefined },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'planilla-calificaciones.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Error al descargar Excel');
    }
  };

  const planColumns = [
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
        if (!r.thematicContents || r.thematicContents.length === 0) return <span style={{ color: '#999' }}>—</span>;
        return (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
            {r.thematicContents.map((content, index) => (
              <li key={content.id}>
                <span style={{ fontWeight: 500 }}>{(() => {
                  const componentIndex = thematicComponents.findIndex(component => component.id === content.thematicComponent?.id);
                  const component = thematicComponents.find(component => component.id === content.thematicComponent?.id);
                  const contentIndex = component?.contents?.findIndex(item => item.id === content.id) ?? -1;
                  return componentIndex >= 0 && contentIndex >= 0 ? `${componentIndex + 1}.${contentIndex + 1}` : `${index + 1}`;
                })()} {content.title}</span>
                {content.thematicComponent && <span style={{ color: '#999', fontSize: 10 }}> ({content.thematicComponent.title})</span>}
              </li>
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
                    {c.indicators.map(ind => <li key={ind.id}>{ind.name} ({ind.points} pts)</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        );
      }
    },
    { title: 'Porcentaje', dataIndex: 'percentage', key: 'percentage', render: (v: number) => `${v}%`, width: 90 },
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
    { title: 'Fecha', dataIndex: 'date', key: 'date', render: (v: string) => dayjs(v).format('DD/MM/YYYY'), width: 100 },
    {
      title: 'Acciones',
      key: 'actions',
      width: 90,
      render: (_: unknown, record: EvaluationPlanItem) => (
        <Space>
          {!isSelectedTermBlocked && (
            <>
              <Button icon={<EditOutlined />} size="small" onClick={() => { setEditingItem(record); setShowPlanModal(true); }} />
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
      `}</style>
      {!selectedAssignment ? (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-black" style={{ color: 'var(--color-text-main)' }}>Calificaciones por Sección</h1>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Selecciona una sección para ver y editar sus calificaciones
            </p>
          </div>

          <Card size="small" style={{ marginBottom: 16, backgroundColor: 'var(--color-content-bg)' }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <Text strong>Años:</Text>
                <Space size={[6, 6]} wrap>
                  {gradeOptions.map(g => (
                    <Tag.CheckableTag
                      key={g.id}
                      checked={selectedGrades.includes(g.id)}
                      onChange={(checked) => {
                        setSelectedGrades(prev => checked ? [...prev, g.id] : prev.filter(id => id !== g.id));
                      }}
                      style={{ fontSize: 13, padding: '2px 12px' }}
                    >
                      {g.name}
                    </Tag.CheckableTag>
                  ))}
                </Space>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Text strong>Profesor:</Text>
                <Select
                  allowClear
                  showSearch
                  placeholder="Filtrar por profesor"
                  style={{ width: 260 }}
                  options={teacherOptions.map(t => ({ label: t.name, value: t.id }))}
                  value={selectedTeacher}
                  onChange={(val: number | null) => setSelectedTeacher(val)}
                  filterOption={(input, option) => normalizeText(String(option?.label ?? '')).includes(normalizeText(input))}
                />
                <Text strong>Materia:</Text>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Filtrar por materia"
                  style={{ minWidth: 260 }}
                  options={subjectOptions.map(s => ({ label: s.name, value: s.id }))}
                  value={selectedSubjects}
                  onChange={(vals) => setSelectedSubjects(vals as number[])}
                  maxTagCount="responsive"
                  filterOption={(input, option) => normalizeText(String(option?.label ?? '')).includes(normalizeText(input))}
                />
              </div>
            </Space>
          </Card>

          <Spin spinning={loading}>
            {groupedAssignments.length === 0 ? (
              <Card style={{ backgroundColor: 'var(--color-content-bg)' }}>
                <Empty description={allAssignments.length === 0 ? 'No hay secciones configuradas en el período activo' : 'No hay asignaciones que coincidan con los filtros seleccionados'} />
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
            tabBarExtraContent={activeTab === '1' ? (
              <Button icon={<DownloadOutlined />} size="small" onClick={downloadPlanningExcel} disabled={!selectedTerm}>Excel de planificación</Button>
            ) : null}
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
                        <Button icon={<DownloadOutlined />} size="small" type="primary" onClick={downloadExcelOficial} disabled={students.length === 0}>Acta de notas</Button>
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
                                      <td key={`${item.id}-a`} className="grading-cell" style={{ padding: '2px', border: '1px solid var(--color-text-muted)', textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-input-bg)' : '#f9fafb', width: '50px', cursor: 'context-menu' }}
                                        title="Click derecho: opciones de la nota"
                                      >
                                        <Dropdown
                                          trigger={['contextMenu']}
                                          menu={{
                                            items: [
                                              {
                                                key: 'details',
                                                icon: <HistoryOutlined />,
                                                label: 'Ver detalles',
                                                onClick: () => openAuditHistory(q, `${enrollment.student?.lastName}, ${enrollment.student?.firstName}`, item.identificador || item.description || ''),
                                              },
                                            ],
                                          }}
                                        >
                                          <div
                                            style={{ display: 'flex', justifyContent: 'center' }}
                                            onMouseDown={(e) => { if (e.button === 2) isRightClickRef.current = true; }}
                                            onMouseUp={() => { isRightClickRef.current = false; }}
                                            onMouseLeave={() => { isRightClickRef.current = false; }}
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
                                          title={q?.editedByOther
                                            ? `Editada el ${new Date(q.lastEditDate || '').toLocaleString('es-VE')} por ${q.lastEditUser || 'usuario desconocido'}`
                                            : undefined}
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
                                            const rt = e.relatedTarget as HTMLElement | null;
                                            if (isRightClickRef.current || (rt && rt.closest('.ant-dropdown'))) {
                                              isRightClickRef.current = false;
                                              return;
                                            }
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
                                              setCommentModal({
                                                open: true,
                                                enrollment,
                                                evalPlanId: item.id,
                                                value: val,
                                                inputId: (e.target as HTMLInputElement).id,
                                                originalValue: currentScore ?? undefined,
                                              });
                                              setCommentText('');
                                            }
                                          }}
                                        />
                                          </div>
                                        </Dropdown>
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
          thematicComponents={thematicComponents}
          tecnicaOptions={tecnicaOptions}
          instrumentoOptions={instrumentoOptions}
          estrategiaOptions={estrategiaOptions}
          maxGrade={maxGrade}
        />
      )}

      <Modal
        title="Historial de cambios de la nota"
        open={auditModal.open}
        onCancel={() => setAuditModal(prev => ({ ...prev, open: false }))}
        footer={[
          <Button key="close" onClick={() => setAuditModal(prev => ({ ...prev, open: false }))}>Cerrar</Button>,
        ]}
        width={700}
      >
        <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Estudiante">{auditModal.studentName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Evaluación">{auditModal.itemLabel || '—'}</Descriptions.Item>
        </Descriptions>
        {auditLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : auditHistory.length === 0 ? (
          <Empty description="No hay cambios registrados para esta nota" />
        ) : (
          <Table
            dataSource={auditHistory}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              {
                title: 'Fecha',
                dataIndex: 'editedAt',
                width: 170,
                render: (v: string) => (v ? new Date(v).toLocaleString('es-VE') : '—'),
              },
              {
                title: 'Usuario',
                dataIndex: 'editor',
                render: (e: { person?: { firstName?: string; lastName?: string }; username?: string }) =>
                  e?.person
                    ? `${e.person.firstName || ''} ${e.person.lastName || ''}`.trim() || e.username || '—'
                    : e?.username || '—',
              },
              {
                title: 'Nota anterior',
                dataIndex: 'previousScore',
                align: 'center',
                render: (v: number | null) => (v != null ? v : '—'),
              },
              {
                title: 'Nota nueva',
                dataIndex: 'newScore',
                align: 'center',
              },
              {
                title: 'Comentario',
                dataIndex: 'comment',
                render: (v: string | null) => (v && v.trim() !== '' ? v : <Text type="secondary" style={{ fontStyle: 'italic' }}>Sin comentario</Text>),
              },
            ]}
          />
        )}
      </Modal>

      <Modal
        title="Comentario de la nota"
        open={commentModal.open}
        onCancel={cancelCommentSave}
        onOk={confirmCommentSave}
        confirmLoading={commentSaving}
        okText="Guardar"
        cancelText="Cancelar"
        okButtonProps={{ disabled: commentSaving }}
      >
        <p style={{ marginBottom: 8 }}>
          Estás modificando la nota a{' '}
          <strong>{commentModal.enrollment?.student?.lastName}, {commentModal.enrollment?.student?.firstName}</strong>
          {' '}a <strong>{commentModal.value}</strong>. Escribe la razón de la modificación (opcional):
        </p>
        <Input.TextArea
          autoFocus
          rows={3}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Escribe el motivo del cambio (puede quedar vacío)..."
          maxLength={500}
          showCount
        />
      </Modal>
    </div>
  );
};

export default ManageGrades;