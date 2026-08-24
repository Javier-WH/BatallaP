import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, Tabs, Table, Button, message, Tag, Typography, Alert, Empty, Spin, Space, Dropdown, Modal, Descriptions, Input, Select, Tooltip, Checkbox } from 'antd';
import { BookOutlined, ArrowLeftOutlined, DownloadOutlined, FilePdfOutlined, EditOutlined, DeleteOutlined, PlusOutlined, HistoryOutlined, CopyOutlined } from '@ant-design/icons';
import api from '@/services/api';
import dayjs from 'dayjs';
import { compareNominaStudents } from '@/utils/studentSort';
import { useGradeRounding } from '@/context/GradeRoundingContext';
import { formatGrade } from '@/utils/gradeFormat';
import EvaluationPlanPDFModal from '@/components/pdf/EvaluationPlanPDFModal';
import type { EvaluationPlanHeaderData } from '@/components/pdf/EvaluationPlanPDF';
import EvaluationPlanItemModal, { type CatalogOption } from '@/components/EvaluationPlanItemModal';
import { getSubjectVisual, withAlpha } from '@/utils/subjectVisuals';

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

/** Graduation cap. Inlined because @ant-design/icons has no equivalent. */
const GraduationCapIcon: React.FC = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--color-brand-primary)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 9 12 4 2 9l10 5 10-5Z" />
    <path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
    <path d="M22 9v5" />
  </svg>
);

const TITLE_CONNECTORS = new Set(['y', 'o', 'de', 'del', 'la', 'las', 'el', 'los', 'en', 'a', 'para', 'por', 'con', 'sin', 'e', 'u', 'ni']);

const formatSubjectName = (name: string) =>
  (name || '')
    .toLowerCase()
    .split(' ')
    .map((word, i) =>
      i > 0 && TITLE_CONNECTORS.has(normalizeText(word)) ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');

/** Renders a section label in uppercase, avoiding the duplicated "SECCIÓN" prefix
 *  when the section name already includes it. */
const formatSectionLabel = (name: string) => {
  const upper = (name || '').toUpperCase().trim();
  const alreadyHasPrefix = normalizeText(upper).includes('seccion');
  return alreadyHasPrefix ? upper : `SECCIÓN ${upper}`;
};

interface Term {
  id: number;
  name: string;
  isBlocked: boolean;
  isActive: boolean;
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
    order?: number | null;
    subject: { id: number; name: string; icon?: string | null; color?: string | null };
    periodGrade: {
      id: number;
      grade: { id: number; name: string; order: number };
      schoolPeriod: { id: number; name: string; status: 'preinscripcion' | 'activo' | 'historico' | 'externo' };
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
  const [remedialFailurePercentage, setRemedialFailurePercentage] = useState<number>(30);
  const [remedialMinGrade, setRemedialMinGrade] = useState<number>(1);
  const [remedialMaxGrade, setRemedialMaxGrade] = useState<number>(9);
  const [activeTab, setActiveTab] = useState('1');
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EvaluationPlanItem | null>(null);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyTargetSectionIds, setCopyTargetSectionIds] = useState<number[]>([]);
  const [copySubmitting, setCopySubmitting] = useState(false);
  const [auditModal, setAuditModal] = useState<{ open: boolean; studentName?: string; itemLabel?: string }>({ open: false });
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [commentModal, setCommentModal] = useState<{ open: boolean; enrollment?: StudentEnrollment; evalPlanId?: number; value?: number; inputId?: string; originalValue?: number; remedialClear?: boolean }>({ open: false });
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
    const groups = new Map<number, { gradeName: string; gradeOrder: number; assignments: Assignment[] }>();
    filteredAssignments.forEach(a => {
      const pg = a.periodGradeSubject?.periodGrade;
      const grade = pg?.grade;
      if (!grade) return;
      if (!groups.has(grade.id)) {
        groups.set(grade.id, { gradeName: grade.name, gradeOrder: grade.order, assignments: [] });
      }
      groups.get(grade.id)!.assignments.push(a);
    });
    return Array.from(groups.values())
      .sort((x, y) => x.gradeOrder - y.gradeOrder || x.gradeName.localeCompare(y.gradeName))
      .map(g => ({
        ...g,
        assignments: g.assignments.sort((a, b) => {
          const ao = a.periodGradeSubject?.order;
          const bo = b.periodGradeSubject?.order;
          if (ao != null && bo != null) return ao - bo;
          if (ao != null) return -1;
          if (bo != null) return 1;
          return a.periodGradeSubject.subject.name.localeCompare(b.periodGradeSubject.subject.name);
        }),
      }));
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
      if (res.data?.remedial_failure_percentage !== undefined) setRemedialFailurePercentage(Number(res.data.remedial_failure_percentage));
      if (res.data?.remedial_min_grade !== undefined) setRemedialMinGrade(Number(res.data.remedial_min_grade));
      if (res.data?.remedial_max_grade !== undefined) setRemedialMaxGrade(Number(res.data.remedial_max_grade));
    } catch { /* ignore */ }
  };

  const gradeDigits = Math.max(2, String(maxGrade).length);
  const padGrade = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    return String(Math.round(val)).padStart(gradeDigits, '0');
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

  const handleSaveScoreInGrid = async (enrollment: StudentEnrollment, evalPlanId: number, score: number | null, comment?: string, remedialClear?: boolean) => {
    if (isSelectedTermBlocked) {
      message.warning('Este lapso está bloqueado.');
      return;
    }
    const inscriptionSubjectId = enrollment.inscriptionSubjects?.[0]?.id;
    try {
      const resp = await api.post('/evaluation/qualifications', {
        evaluationPlanId: evalPlanId,
        inscriptionSubjectId,
        inscriptionId: enrollment.id,
        score: score === null ? 0 : score,
        isAbsent: false,
        observations: '',
        comment: comment?.trim() || undefined,
        ...(remedialClear ? { remedialScore: null } : {}),
      });
      fetchPlanAndStudents();
    } catch (err) {
      console.error('[save] error:', err);
      message.error('Error al guardar nota');
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
        observations: '',
      });
      fetchPlanAndStudents();
    } catch {
      message.error('Error al guardar nota remedial');
    }
  };

  // ── Paste handler: distribute clipboard values across grade cells ──
  const handleGradePaste = (e: React.ClipboardEvent<HTMLInputElement>, startRow: number, startCol: number) => {
    if (isSelectedTermBlocked) return;
    e.preventDefault();

    const raw = e.clipboardData.getData('text');
    if (!raw) return;

    // Parse clipboard into a 2D grid (rows separated by \n, columns by \t)
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

    // Use the same canonical sort as the nómina: document type → document number → lastName → firstName
    const sortedStudents = [...students].sort(compareNominaStudents);

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
    const parsed: { target: typeof targets[0]; score: number | null }[] = [];
    let skippedCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const valStr = values[i].replace(/[^0-9]/g, '');
      if (valStr === '') {
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

  const confirmCommentSave = async () => {
    const { enrollment, evalPlanId, value, remedialClear } = commentModal;
    if (!enrollment || evalPlanId === undefined || value === undefined) {
      return;
    }
    setCommentSaving(true);
    try {
      await handleSaveScoreInGrid(enrollment, evalPlanId, value, commentText, remedialClear);
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

  // Target sections for copy: same subject, excluding the current section.
  // Unlike TeacherPanel, Control de Estudios sees all assignments, so we don't
  // filter by teacher — any section with the same subject is a valid target.
  const copyTargetAssignments = useMemo(() => {
    if (!selectedAssignment) return [];
    return allAssignments.filter(a =>
      a.id !== selectedAssignment.id &&
      a.periodGradeSubjectId === selectedAssignment.periodGradeSubjectId
    );
  }, [allAssignments, selectedAssignment]);

  const handleCopyPlan = async () => {
    if (!selectedAssignment || copyTargetSectionIds.length === 0) return;
    setCopySubmitting(true);
    try {
      const res = await api.post('/evaluation/copy-plan', {
        sourcePeriodGradeSubjectId: selectedAssignment.periodGradeSubjectId,
        sourceSectionId: selectedAssignment.sectionId,
        targetPeriodGradeSubjectId: selectedAssignment.periodGradeSubjectId,
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

  const contentIndexLabel = useMemo(() => {
    const map = new Map<number, string>();
    thematicComponents.forEach((comp, compIdx) => {
      (comp.contents || []).forEach((content, contentIdx) => {
        map.set(content.id, `${compIdx + 1}.${contentIdx + 1}`);
      });
    });
    return map;
  }, [thematicComponents]);

  const planColumns = [
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
        if (!r.thematicContents || r.thematicContents.length === 0) return <span style={{ color: '#999' }}>—</span>;
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

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6" style={{ backgroundColor: 'var(--color-page-bg)' }}>
      <style>{`
        @keyframes flash-red {
          0%, 100% { outline: 3px solid #ef4444; }
          50% { outline: 3px solid transparent; }
        }
        .grade-invalid { animation: flash-red 0.5s ease-in-out 3; }
        .grading-row:hover td { background-color: color-mix(in srgb, var(--color-accent) 8%, transparent) !important; }
        .grading-row td { transition: background-color 0.2s; }
        .grading-cell .ant-input-number-input { text-align: center !important; padding: 0 !important; }
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
        .grading-table-container::-webkit-scrollbar { height: 8px; width: 8px; }
        .grading-table-container::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.18); border-radius: 4px; }
      `}</style>
      {!selectedAssignment ? (
        <>
          <div className="mb-6" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: 'color-mix(in srgb, var(--color-brand-primary) 10%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <GraduationCapIcon />
            </div>
            <div>
              <h1 className="text-2xl font-black" style={{ color: 'var(--color-text-main)', margin: 0, lineHeight: 1.2 }}>
                Calificaciones por Sección
              </h1>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)', margin: 0, marginTop: 2 }}>
                Selecciona una sección para ver y editar sus calificaciones
              </p>
            </div>
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
                  options={subjectOptions.map(s => ({ label: formatSubjectName(s.name), value: s.id }))}
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
                    <Title level={5} style={{ margin: 0, color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}>
                      {group.gradeName}
                    </Title>
                    <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(15, 23, 42, 0.08)' }} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {group.assignments.map((a) => {
                      const { Icon, color } = getSubjectVisual(a.periodGradeSubject.subject);
                      return (
                        <Card
                          key={a.id}
                          hoverable
                          size="small"
                          onClick={() => handleSelectAssignment(a)}
                          style={{
                            cursor: 'pointer',
                            backgroundColor: 'var(--color-content-bg)',
                            borderRadius: 12,
                            border: '1px solid rgba(15, 23, 42, 0.08)',
                          }}
                          styles={{ body: { padding: '12px 14px' } }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 10,
                                backgroundColor: withAlpha(color, 0.12),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Icon style={{ color, fontSize: 18 }} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                  color,
                                  backgroundColor: withAlpha(color, 0.1),
                                  display: 'inline-block',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  marginBottom: 4,
                                }}
                              >
                                {formatSectionLabel(a.section.name)}
                              </div>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  lineHeight: 1.25,
                                  color: 'var(--color-text-main)',
                                }}
                              >
                                {formatSubjectName(a.periodGradeSubject.subject.name)}
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  letterSpacing: '0.02em',
                                  textTransform: 'uppercase',
                                  color: 'var(--color-text-muted)',
                                  marginTop: 3,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={`${a.teacher?.firstName || ''} ${a.teacher?.lastName || ''}`.trim()}
                              >
                                {a.teacher
                                  ? `${a.teacher.firstName} ${a.teacher.lastName}`
                                  : 'Sin profesor asignado'}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
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
                {formatSubjectName(selectedAssignment.periodGradeSubject.subject.name)}
              </Title>
              <Text style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                {selectedAssignment.periodGradeSubject.periodGrade.grade.name} • {formatSectionLabel(selectedAssignment.section.name)} • Prof. {selectedAssignment.teacher?.firstName} {selectedAssignment.teacher?.lastName}
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
                label: <span className="font-bold text-[15px] px-4 py-1">Evaluaciones Programadas</span>,
                children: (
                  <div className="pt-4">
                    <Table
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
                        className={`mt-4 w-full h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer border-none shadow-sm ${isSelectedTermBlocked || !selectedAssignment ? 'opacity-50 pointer-events-none' : 'hover:scale-[1.01]'}`}
                        style={{ backgroundColor: isSelectedTermBlocked || !selectedAssignment ? 'var(--color-inactive)' : 'var(--color-accent)',
                          color: isSelectedTermBlocked || !selectedAssignment ? 'var(--color-text-main)' : 'var(--color-header-text)' }}
                        onClick={() => {
                          if(isSelectedTermBlocked || !selectedAssignment) return;
                          setEditingItem(null);
                          setShowPlanModal(true);
                        }}
                      >
                        <PlusOutlined className="text-3xl font-bold" />
                      </div>
                    )}

                    {totalPercentage === 100 && copyTargetAssignments.length > 0 && !isSelectedTermBlocked && (
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
                key: '2',
                label: <span className="font-bold text-[15px] px-4 py-1">Calificaciones</span>,
                children: evaluationPlan.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' }}>
                      <BookOutlined style={{ fontSize: 24, color: 'var(--color-accent)' }} />
                    </div>
                    <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-main)' }}>No hay Plan de Evaluación definido</h3>
                    <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>Para poder calificar este lapso, primero debe definir las actividades y sus porcentajes.</p>
                    <Button type="primary" size="large" onClick={() => setActiveTab('1')} className="rounded-xl">
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
                          onClick={downloadExcelOficial}
                          disabled={students.length === 0}
                        >
                          Acta de notas
                        </Button>
                        <Button
                          icon={<DownloadOutlined />}
                          size="small"
                          onClick={() => downloadExcel(false)}
                          disabled={!selectedAssignment}
                        >
                          Excel vacío
                        </Button>
                      </div>
                    </div>
                    <Card bodyStyle={{ padding: 0 }} style={{ overflow: 'hidden', backgroundColor: 'var(--color-content-bg)', border: '1px solid rgba(15, 23, 42, 0.08)' }}>
                    <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 350px)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid rgba(15, 23, 42, 0.08)' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                          <tr>
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
                            .sort(compareNominaStudents)
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
                                  <td style={{ padding: '2px 4px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-content-bg)' : 'color-mix(in srgb, var(--color-text-main) 2%, var(--color-content-bg))', fontSize: 11, fontWeight: 500 }}>
                                    {enrollment.student?.document || '-'}
                                  </td>
                                  <td style={{ padding: '2px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'left', background: rowIndex % 2 === 0 ? 'var(--color-content-bg)' : 'color-mix(in srgb, var(--color-text-main) 2%, var(--color-content-bg))', fontSize: 12 }}>
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
                                      <td key={`${item.id}-a`} className="grading-cell" style={{ padding: '2px', border: '1px solid rgba(15, 23, 42, 0.08)', borderLeft: colIndex > 0 ? '2px solid color-mix(in srgb, var(--color-text-main) 35%, transparent)' : undefined, textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-content-bg)' : 'color-mix(in srgb, var(--color-text-main) 2%, var(--color-content-bg))', width: '50px', cursor: 'context-menu' }}
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
                                                onClick: () => openAuditHistory(q, `${enrollment.student?.lastName}, ${enrollment.student?.firstName}`, item.shortDescription || item.identificador || item.description || ''),
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
                                          defaultValue={isAbsent ? '' : (currentScore !== null ? padGrade(currentScore) : '')}
                                          key={`${enrollment.id}-${item.id}${isAbsent ? '-a' : ''}`}
                                          onPaste={(e) => handleGradePaste(e, rowIndex, colIndex)}
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
                                          disabled={isSelectedTermBlocked || (q?.remedialScore != null && q.remedialScore > 0 && isRemedialEligible)}
                                          onKeyDown={(e) => {
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
                                                  targetType = prevHasRemedial ? 'remedial' : 'grade';
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
                                          onBlur={(e) => {
                                            const rt = e.relatedTarget as HTMLElement | null;
                                            if (isRightClickRef.current || (rt && rt.closest('.ant-dropdown'))) {
                                              isRightClickRef.current = false;
                                              return;
                                            }
                                            const raw = e.target.value.replace(/[^0-9]/g, '');
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
                                            (e.target as HTMLInputElement).value = padGrade(val);
                                            if (val !== currentScore) {
                                              const needsRemedialClear = val < remedialMinGrade || val > remedialMaxGrade;
                                              setCommentModal({
                                                open: true,
                                                enrollment,
                                                evalPlanId: item.id,
                                                value: val,
                                                inputId: (e.target as HTMLInputElement).id,
                                                originalValue: currentScore ?? undefined,
                                                remedialClear: needsRemedialClear,
                                              });
                                              setCommentText('');
                                            }
                                          }}
                                        />
                                          </div>
                                        </Dropdown>
                                      </td>
                                      {hasRemedial && (
                                        <td key={`${item.id}-b`} className="grading-cell remedial-cell" style={{ padding: '2px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', background: rowIndex % 2 === 0 ? 'var(--color-content-bg)' : 'color-mix(in srgb, var(--color-text-main) 2%, var(--color-content-bg))', width: '50px' }}
                                          onContextMenu={(e) => e.preventDefault()}
                                        >
                                          <Tooltip
                                            mouseEnterDelay={0}
                                            title={
                                              !isRemedialEligible && (currentScore !== null || isAbsent)
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
                                                  targetType = 'grade';
                                                }
                                                if (e.key === 'ArrowRight') {
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
            subjectName: formatSubjectName(selectedAssignment.periodGradeSubject?.subject?.name || '-'),
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
              {formatSectionLabel(a.section.name)}
            </Checkbox>
          ))}
        </Checkbox.Group>
        {copyTargetAssignments.length === 0 && (
          <Empty description="No hay otras secciones con esta materia" />
        )}
      </Modal>

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