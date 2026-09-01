import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Button, Tag, Space, Typography, Row, Col, Spin, message, Modal,
  Empty, Input, Checkbox, Table, InputNumber, Divider, Alert, DatePicker,
  Segmented,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined, UserAddOutlined, DeleteOutlined,
  CheckCircleOutlined, BookOutlined,
  LockOutlined, UnlockOutlined, SaveOutlined, CalendarOutlined,
  PrinterOutlined, PlusOutlined, FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';
import { generateMpNominaHTML } from '@/components/pdf/MpNominaHTML';
import type { MpNominaPrintData } from '@/components/pdf/MpNominaHTML';

const { Title, Text } = Typography;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface Grade {
  id: number;
  name: string;
  isDiversified: boolean;
  order: number;
}

interface MpSubject {
  id: number;
  name: string;
  studentCount: number;
  periodGradeSubjectId: number;
}

interface MpGradeGroup {
  grade: Grade;
  periodGrade: any;
  subjects: MpSubject[];
  mpSection: { id: number; name: string };
}

interface MpStructureResponse {
  period: { id: number; name: string } | null;
  grades: MpGradeGroup[];
}

interface StudentForRegistration {
  inscriptionId: number;
  personId: number;
  studentName: string;
  studentDni: string;
  documentType: string;
  escolaridad: string;
  sectionName: string;
  gradeName: string;
}

interface NominaSubject {
  id: number;
  name: string;
  periodGradeSubjectId: number;
}

interface NominaStudent {
  inscriptionId: number;
  personId: number;
  studentName: string;
  studentDni: string;
  documentType: string;
  subjects: {
    inscriptionSubjectId: number;
    subjectId: number;
    subjectName: string;
    finalGrade: {
      finalScore: number | null;
      status: string;
      gradeType: string;
      calculatedAt: string;
    } | null;
  }[];
}

interface MpPlanItem {
  id: number;
  description: string;
  percentage: number;
  date: string;
  termId: number;
  term?: { name: string };
}

interface MpAssignmentStudent {
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
    isAbsent: boolean;
    evaluationPlanId: number;
    percentage: number;
    termId: number;
    description: string;
  }[];
}

/* ---- Encounter system types ---- */
interface MpEncounter {
  id: number;
  encounterNumber: number;
  date: string | null;
  score: number | null;
  isAbsent: boolean;
}

interface NominaEncounterStudent {
  inscriptionId: number;
  personId: number;
  studentName: string;
  studentDni: string;
  documentType: string;
  subjects: {
    pendingSubjectId: number;
    subjectId: number;
    inscriptionSubjectId: number | null;
    encounterScore: number | null;
    encounterIsAbsent: boolean;
    encounterDate: string | null;
    status: string;
  }[];
}

interface NominaFinalStudent {
  inscriptionId: number;
  personId: number;
  studentName: string;
  studentDni: string;
  documentType: string;
  subjects: {
    pendingSubjectId: number;
    subjectId: number;
    status: string;
    finalScore: number | null;
    finalEncounterNumber: number | null;
    isAbsent: boolean;
    encounters: {
      encounterNumber: number;
      score: number | null;
      isAbsent: boolean;
      date: string | null;
    }[];
  }[];
}

interface MpContentItem {
  id: number;
  text: string;
  order: number;
}

interface MpContent {
  id: number;
  pendingSubjectId: number;
  themeTitle: string;
  items: MpContentItem[];
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
const PendingSubjectManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [structure, setStructure] = useState<MpStructureResponse | null>(null);
  const [expandedGradeId, setExpandedGradeId] = useState<number | null>(null);


  // Registration modal
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [regModalGrade, setRegModalGrade] = useState<MpGradeGroup | null>(null);
  const [regModalSubject, setRegModalSubject] = useState<MpSubject | null>(null);
  const [regStudents, setRegStudents] = useState<StudentForRegistration[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regSelected, setRegSelected] = useState<Set<number>>(new Set());
  const [regSearch, setRegSearch] = useState('');

  // Grade editing modal
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [gradeModalStudent] = useState<NominaStudent | null>(null);
  const [gradeModalSubject] = useState<NominaSubject | null>(null);
  const [gradeValue, setGradeValue] = useState<number | null>(null);
  const [gradeDate, setGradeDate] = useState<dayjs.Dayjs>(dayjs());
  const [gradeSaving, setGradeSaving] = useState(false);

  // Assignment detail (evaluation plan + students with qualifications)
  const [assignmentDetail, setAssignmentDetail] = useState<{
    students: MpAssignmentStudent[];
    evaluationPlans: MpPlanItem[];
  } | null>(null);
  const [assignmentLoading] = useState(false);
  const [qualEdits, setQualEdits] = useState<Record<string, number | null>>({});

  // ---- Encounter system state ----
  const [nominaView, setNominaView] = useState<'encounter' | 'final'>('encounter');
  const [selectedEncounter, setSelectedEncounter] = useState(1);
  const [maxEncounters, setMaxEncounters] = useState(4);
  const [nominaEncounter, setNominaEncounter] = useState<{ grade: Grade; subjects: NominaSubject[]; students: NominaEncounterStudent[]; encounterNumber: number } | null>(null);
  const [nominaEncounterLoading, setNominaEncounterLoading] = useState(false);
  const [nominaFinal, setNominaFinal] = useState<{ grade: Grade; subjects: NominaSubject[]; students: NominaFinalStudent[]; maxEncounters: number } | null>(null);
  const [nominaFinalLoading, setNominaFinalLoading] = useState(false);

  // Encounter score modal
  const [encScoreModalOpen, setEncScoreModalOpen] = useState(false);
  const [encScoreStudent, setEncScoreStudent] = useState<NominaEncounterStudent | null>(null);
  const [encScoreSubject, setEncScoreSubject] = useState<NominaSubject | null>(null);
  const [encScoreValue, setEncScoreValue] = useState<number | null>(null);
  const [encScoreIsAbsent, setEncScoreIsAbsent] = useState(false);
  const [encScoreSaving, setEncScoreSaving] = useState(false);

  // Encounter dates modal (per pendingSubject)
  const [encDatesModalOpen, setEncDatesModalOpen] = useState(false);
  const [encDatesSubject, setEncDatesSubject] = useState<NominaSubject | null>(null);
  const [encDatesData, setEncDatesData] = useState<MpEncounter[]>([]);
  const [encDatesLoading, setEncDatesLoading] = useState(false);
  const [encDatesSaving, setEncDatesSaving] = useState(false);

  // Encounter dates per subject (for display in headers) — keyed by periodGradeSubjectId
  const [encounterDatesMap, setEncounterDatesMap] = useState<Record<number, { encounterNumber: number; date: string | null }[]>>({});

  // Institution data for printable nómina
  const [institutionData, setInstitutionData] = useState<{ name: string; period: string; code: string; principal: string } | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const printIframeRef = React.useRef<HTMLIFrameElement>(null);

  // Locked encounters (CE controls which encounters teachers can edit)
  const [lockedEncounters, setLockedEncounters] = useState<number[]>([]);
  const [lockSaving, setLockSaving] = useState(false);

  // Content modal
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [contentSubject, setContentSubject] = useState<NominaSubject | null>(null);
  const [, setContentData] = useState<MpContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentTheme, setContentTheme] = useState('');
  const [contentItems, setContentItems] = useState<{ text: string; order: number }[]>([]);

  /* ------------------- Fetch structure ------------------- */
  const fetchStructure = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<MpStructureResponse>('/pending-subjects/structure');
      setStructure(res.data);
      if (res.data.grades.length > 0 && !expandedGradeId) {
        setExpandedGradeId(res.data.grades[0].grade.id);
      }
    } catch (error: any) {
      console.error('[PendingSubject] Error:', error);
      message.error(error?.response?.data?.message || 'Error al cargar estructura');
    } finally {
      setLoading(false);
    }
  }, [expandedGradeId]);

  useEffect(() => { fetchStructure(); }, [fetchStructure]);

  // Fetch encounter dates for all subjects of the expanded grade
  useEffect(() => {
    if (!expandedGradeId || !structure) return;
    const gradeGroup = structure.grades.find(g => g.grade.id === expandedGradeId);
    if (!gradeGroup) return;
    // Load dates for each subject in parallel
    Promise.all(
      gradeGroup.subjects.map(subj =>
        api.get(`/pending-subjects/encounter-dates/${subj.periodGradeSubjectId}`)
          .then(res => ({ pgsId: subj.periodGradeSubjectId, encounters: res.data.encounters as { encounterNumber: number; date: string | null }[] }))
          .catch(() => ({ pgsId: subj.periodGradeSubjectId, encounters: [] as { encounterNumber: number; date: string | null }[] }))
      )
    ).then(results => {
      setEncounterDatesMap(prev => {
        const next = { ...prev };
        results.forEach(r => { next[r.pgsId] = r.encounters; });
        return next;
      });
    });
  }, [expandedGradeId, structure]);

  // Nomina general fetch removed — only encounter/final views remain.
  // The active view's useEffect (below) handles fetching.

  /* ------------------- Fetch settings (max encounters + locked encounters) ------------------- */
  useEffect(() => {
    api.get('/settings').then(res => {
      const n = Number(res.data.pending_subject_max_encounters);
      if (Number.isFinite(n) && n >= 1) setMaxEncounters(n);
      // Parse locked encounters from comma-separated string
      const lockedStr = res.data.pending_subject_locked_encounters || '';
      const locked = lockedStr.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => Number.isFinite(n));
      setLockedEncounters(locked);
    }).catch(() => {});
  }, []);

  const toggleEncounterLock = async (encounterNum: number) => {
    const newValue = lockedEncounters.includes(encounterNum)
      ? lockedEncounters.filter(n => n !== encounterNum)
      : [...lockedEncounters, encounterNum].sort((a, b) => a - b);
    setLockSaving(true);
    try {
      await api.put('/pending-subjects/locked-encounters', { lockedEncounters: newValue });
      setLockedEncounters(newValue);
      message.success(newValue.includes(encounterNum) ? `Encuentro ${encounterNum} bloqueado` : `Encuentro ${encounterNum} abierto`);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al cambiar bloqueo');
    } finally {
      setLockSaving(false);
    }
  };

  // Load institution data + logo for printable nómina
  useEffect(() => {
    api.get('/settings').then(res => {
      setInstitutionData({
        name: res.data.institution_name || '',
        period: res.data.active_period_name || '',
        code: res.data.institution_code || '',
        principal: res.data.principal_name || '',
      });
    }).catch(() => {});

    // Load logo as base64 (resized to 100x100)
    let cancelled = false;
    api.get('/upload/logo', { responseType: 'blob' })
      .then(res => {
        if (cancelled) return;
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          if (cancelled) return;
          const canvas = document.createElement('canvas');
          canvas.width = 100;
          canvas.height = 100;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, 100, 100);
          if (!cancelled) setLogoBase64(canvas.toDataURL('image/png'));
        };
        img.onerror = () => { URL.revokeObjectURL(url); };
        img.src = url;
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Get active period name from structure
  const activePeriodName = structure?.period?.name || institutionData?.period || '';

  const [printLoading, setPrintLoading] = useState(false);

  const handlePrintNominaFinal = useCallback(async () => {
    if (!structure || structure.grades.length === 0) {
      message.warning('No hay grados para imprimir');
      return;
    }
    setPrintLoading(true);
    try {
      // Fetch nómina final for ALL grades in parallel
      const results = await Promise.all(
        structure.grades.map(g =>
          api.get(`/pending-subjects/nomina-final/${g.grade.id}`)
            .then(res => ({ grade: g.grade, data: res.data }))
            .catch(() => ({ grade: g.grade, data: null }))
        )
      );
      // Build grade sections, filtering out empty ones
      const gradeSections = results
        .filter(r => r.data && r.data.students && r.data.students.length > 0)
        .map(r => ({
          grade: r.grade,
          subjects: r.data.subjects,
          students: r.data.students.map((s: any) => ({
            inscriptionId: s.inscriptionId,
            studentName: s.studentName,
            studentDni: s.studentDni,
            documentType: s.documentType,
            subjects: s.subjects.map((ss: any) => ({
              subjectId: ss.subjectId,
              status: ss.status,
              finalScore: ss.finalScore,
              encounters: ss.encounters,
            })),
          })),
          maxEncounters: r.data.maxEncounters || maxEncounters,
        }));
      if (gradeSections.length === 0) {
        message.warning('No hay estudiantes de materia pendiente en ningún grado');
        setPrintLoading(false);
        return;
      }
      const printData: MpNominaPrintData = {
        institution: {
          name: institutionData?.name || '',
          period: activePeriodName,
        },
        grades: gradeSections,
        logoBase64,
      };
      const html = generateMpNominaHTML(printData);
      const iframe = printIframeRef.current;
      if (iframe) {
        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          setTimeout(() => {
            if (iframe.contentWindow) {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
            }
          }, 600);
        }
      }
    } catch (error: any) {
      message.error('Error al generar el documento');
    } finally {
      setPrintLoading(false);
    }
  }, [structure, institutionData, activePeriodName, maxEncounters, logoBase64]);

  /* ------------------- Fetch nomina by encounter ------------------- */
  const fetchNominaEncounter = useCallback(async (gradeId: number, encounter: number) => {
    setNominaEncounterLoading(true);
    try {
      const res = await api.get(`/pending-subjects/nomina/${gradeId}/encounter`, { params: { encounter } });
      setNominaEncounter(res.data);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al cargar nómina por encuentro');
    } finally {
      setNominaEncounterLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expandedGradeId && nominaView === 'encounter') {
      fetchNominaEncounter(expandedGradeId, selectedEncounter);
    } else {
      setNominaEncounter(null);
    }
  }, [expandedGradeId, nominaView, selectedEncounter, fetchNominaEncounter]);

  /* ------------------- Fetch nomina final ------------------- */
  const fetchNominaFinal = useCallback(async (gradeId: number) => {
    setNominaFinalLoading(true);
    try {
      const res = await api.get(`/pending-subjects/nomina-final/${gradeId}`);
      setNominaFinal(res.data);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al cargar nómina final');
    } finally {
      setNominaFinalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expandedGradeId && nominaView === 'final') {
      fetchNominaFinal(expandedGradeId);
    } else {
      setNominaFinal(null);
    }
  }, [expandedGradeId, nominaView, fetchNominaFinal]);

  /* ------------------- Open encounter score modal ------------------- */
  const encScoreInputRef = React.useRef<any>(null);

  const openEncScoreModal = (student: NominaEncounterStudent, subject: NominaSubject) => {
    const subj = student.subjects.find(s => s.subjectId === subject.id);
    setEncScoreStudent(student);
    setEncScoreSubject(subject);
    setEncScoreValue(subj?.encounterScore ?? null);
    setEncScoreIsAbsent(subj?.encounterIsAbsent ?? false);
    setEncScoreModalOpen(true);
    // Focus the input after the modal renders
    setTimeout(() => {
      encScoreInputRef.current?.focus();
    }, 100);
  };

  const handleSaveEncounterScore = async () => {
    if (!encScoreStudent || !encScoreSubject || encScoreValue == null) return;
    const subj = encScoreStudent.subjects.find(s => s.subjectId === encScoreSubject.id);
    if (!subj) {
      message.error('Estudiante no registrado en esta materia');
      return;
    }
    setEncScoreSaving(true);
    try {
      await api.post(`/pending-subjects/${subj.pendingSubjectId}/encounters/${selectedEncounter}/score`, {
        score: encScoreValue,
        isAbsent: encScoreIsAbsent,
      });
      message.success('Nota del encuentro guardada');
      setEncScoreModalOpen(false);
      if (expandedGradeId) await fetchNominaEncounter(expandedGradeId, selectedEncounter);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al guardar nota');
    } finally {
      setEncScoreSaving(false);
    }
  };

  /* ------------------- Open encounter dates modal ------------------- */
  const openEncDatesModal = async (subject: NominaSubject) => {
    setEncDatesSubject(subject);
    setEncDatesModalOpen(true);
    setEncDatesLoading(true);
    setEncDatesData([]);
    try {
      const res = await api.get(`/pending-subjects/encounter-dates/${subject.periodGradeSubjectId}`);
      setEncDatesData(res.data.encounters);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al cargar encuentros');
    } finally {
      setEncDatesLoading(false);
    }
  };

  const handleSaveEncounterDates = async () => {
    if (!encDatesSubject || encDatesData.length === 0) return;
    setEncDatesSaving(true);
    try {
      await api.put(`/pending-subjects/encounter-dates/${encDatesSubject.periodGradeSubjectId}`, {
        encounters: encDatesData.map(e => ({ encounterNumber: e.encounterNumber, date: e.date })),
      });
      message.success('Fechas actualizadas');
      // Update the local map so headers refresh immediately
      setEncounterDatesMap(prev => ({
        ...prev,
        [encDatesSubject.periodGradeSubjectId]: encDatesData.map(e => ({ encounterNumber: e.encounterNumber, date: e.date })),
      }));
      setEncDatesModalOpen(false);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al guardar fechas');
    } finally {
      setEncDatesSaving(false);
    }
  };

  /* ------------------- Open content modal ------------------- */
  const openContentModal = async (subject: NominaSubject) => {
    setContentSubject(subject);
    setContentModalOpen(true);
    setContentLoading(true);
    setContentData(null);
    setContentTheme('');
    setContentItems([]);
    try {
      // Find pendingSubjectId
      const encRes = await api.get(`/pending-subjects/nomina/${expandedGradeId}/encounter`, { params: { encounter: 1 } });
      const encStudent = encRes.data.students.find((s: NominaEncounterStudent) => s.subjects.find(sb => sb.subjectId === subject.id));
      const pendingSubj = encStudent?.subjects.find((sb: any) => sb.subjectId === subject.id);
      if (!pendingSubj) {
        setContentLoading(false);
        return;
      }
      const res = await api.get<MpContent>(`/pending-subjects/${pendingSubj.pendingSubjectId}/content`);
      setContentData(res.data);
      setContentTheme(res.data.themeTitle || '');
      setContentItems(res.data.items.map(it => ({ text: it.text, order: it.order })));
    } catch {
      // Content doesn't exist yet — that's ok
    } finally {
      setContentLoading(false);
    }
  };

  const handleSaveContent = async () => {
    if (!contentSubject) return;
    setContentSaving(true);
    try {
      const encRes = await api.get(`/pending-subjects/nomina/${expandedGradeId}/encounter`, { params: { encounter: 1 } });
      const encStudent = encRes.data.students.find((s: NominaEncounterStudent) => s.subjects.find(sb => sb.subjectId === contentSubject.id));
      const pendingSubj = encStudent?.subjects.find((sb: any) => sb.subjectId === contentSubject.id);
      if (!pendingSubj) {
        message.error('No se encontró la materia pendiente');
        setContentSaving(false);
        return;
      }
      await api.put(`/pending-subjects/${pendingSubj.pendingSubjectId}/content`, {
        themeTitle: contentTheme,
        items: contentItems,
      });
      message.success('Contenido guardado');
      setContentModalOpen(false);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al guardar contenido');
    } finally {
      setContentSaving(false);
    }
  };

  const handlePrintContent = () => {
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) return;
    const subjName = contentSubject?.name || '';
    const itemsHtml = contentItems.map((it) => `<li>${it.text}</li>`).join('');
    printWin.document.write(`
      <html><head><title>Contenido - ${subjName}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;}h1{font-size:18px;}h2{font-size:14px;border-bottom:1px solid #ccc;padding-bottom:4px;}ol{font-size:13px;line-height:1.8;}</style>
      </head><body>
      <h1>Materia Pendiente: ${subjName}</h1>
      <h2>Tema General: ${contentTheme || '—'}</h2>
      <h2>Contenidos:</h2>
      <ol>${itemsHtml}</ol>
      </body></html>
    `);
    printWin.document.close();
    printWin.print();
  };

  /* ------------------- Open registration modal ------------------- */
  const openRegModal = async (group: MpGradeGroup, subject: MpSubject) => {
    setRegModalGrade(group);
    setRegModalSubject(subject);
    setRegModalOpen(true);
    setRegSelected(new Set());
    setRegSearch('');
    setRegLoading(true);
    try {
      const res = await api.get<{ students: StudentForRegistration[] }>(`/pending-subjects/students/${group.grade.id}`);
      setRegStudents(res.data.students || []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al cargar estudiantes');
    } finally {
      setRegLoading(false);
    }
  };

  /* ------------------- Register students ------------------- */
  const handleRegister = async () => {
    if (!regModalGrade || !regModalSubject || regSelected.size === 0) {
      message.warning('Seleccione al menos un estudiante');
      return;
    }
    setActing(true);
    try {
      const inscriptionIds = Array.from(regSelected);
      await api.post('/pending-subjects/register', {
        gradeId: regModalGrade.grade.id,
        subjectId: regModalSubject.id,
        inscriptionIds,
      });
      message.success(`${inscriptionIds.length} estudiante(s) registrado(s)`);
      setRegModalOpen(false);
      await fetchStructure();
      if (expandedGradeId) {
        if (nominaView === 'encounter') await fetchNominaEncounter(expandedGradeId, selectedEncounter);
        if (nominaView === 'final') await fetchNominaFinal(expandedGradeId);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al registrar');
    } finally {
      setActing(false);
    }
  };

  /* ------------------- Remove student from subject ------------------- */
  const handleRemove = async (inscriptionSubjectId: number, studentName: string) => {
    Modal.confirm({
      title: 'Remover estudiante',
      content: `¿Remover a ${studentName} de esta materia pendiente?`,
      okText: 'Sí, remover',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.delete(`/pending-subjects/remove/${inscriptionSubjectId}`);
          message.success('Estudiante removido');
          await fetchStructure();
          if (expandedGradeId) {
            if (nominaView === 'encounter') await fetchNominaEncounter(expandedGradeId, selectedEncounter);
            if (nominaView === 'final') await fetchNominaFinal(expandedGradeId);
          }
        } catch (error: any) {
          message.error(error?.response?.data?.message || 'Error al remover');
        }
      },
    });
  };

  /* ------------------- Save qualification for a plan item (from CE) ------------------- */
  const handleSaveQualification = async (student: MpAssignmentStudent, planItem: MpPlanItem, score: number | null) => {
    if (score == null) return;
    setGradeSaving(true);
    try {
      await api.post('/pending-subjects/qualification', {
        evaluationPlanId: planItem.id,
        inscriptionSubjectId: student.inscriptionSubjectId,
        score,
      });
      const isNp = score === 0;
      message.success(`Calificación guardada: ${student.studentName} — ${isNp ? 'NP' : score}`);
      setQualEdits(prev => { const n = { ...prev }; delete n[`${student.inscriptionSubjectId}-${planItem.id}`]; return n; });
      // Refresh assignment detail
      if (gradeModalSubject) {
        const res = await api.get(`/pending-subjects/assignment/${gradeModalSubject.periodGradeSubjectId}`);
        setAssignmentDetail({
          students: res.data.students || [],
          evaluationPlans: res.data.evaluationPlans || [],
        });
      }
      if (expandedGradeId) {
        if (nominaView === 'encounter') await fetchNominaEncounter(expandedGradeId, selectedEncounter);
        if (nominaView === 'final') await fetchNominaFinal(expandedGradeId);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al guardar calificación');
    } finally {
      setGradeSaving(false);
    }
  };

  /* ------------------- Save direct final grade (with date) ------------------- */
  const handleSaveGrade = async () => {
    if (!gradeModalStudent || !gradeModalSubject || gradeValue == null) return;
    const insSubj = gradeModalStudent.subjects.find(s => s.subjectId === gradeModalSubject.id);
    if (!insSubj) {
      message.error('El estudiante no está registrado en esta materia');
      return;
    }
    setGradeSaving(true);
    try {
      await api.post('/pending-subjects/final-grade', {
        inscriptionSubjectId: insSubj.inscriptionSubjectId,
        finalScore: gradeValue,
        date: gradeDate.format('YYYY-MM-DD'),
      });
      message.success('Nota guardada');
      setGradeModalOpen(false);
      if (expandedGradeId) {
        if (nominaView === 'encounter') await fetchNominaEncounter(expandedGradeId, selectedEncounter);
        if (nominaView === 'final') await fetchNominaFinal(expandedGradeId);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al guardar nota');
    } finally {
      setGradeSaving(false);
    }
  };

  /* ------------------- Filtered students for registration ------------------- */
  const filteredRegStudents = useMemo(() => {
    if (!regSearch) return regStudents;
    const q = regSearch.toLowerCase();
    return regStudents.filter(s =>
      s.studentName.toLowerCase().includes(q) ||
      s.studentDni.includes(q) ||
      s.sectionName?.toLowerCase().includes(q)
    );
  }, [regStudents, regSearch]);

  /* ------------------- Registration table columns ------------------- */
  const regColumns: ColumnsType<StudentForRegistration> = [
    {
      title: 'Estudiante',
      key: 'studentName',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.studentName}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.documentType === 'Venezolano' ? 'V' : r.documentType === 'Extranjero' ? 'E' : r.documentType === 'Pasaporte' ? 'P' : 'CE'}-{r.studentDni} · {r.sectionName}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Escolaridad',
      key: 'escolaridad',
      width: 140,
      render: (_, r) => (
        <Tag color={r.escolaridad === 'materia_pendiente' ? 'orange' : 'blue'}>
          {r.escolaridad === 'materia_pendiente' ? 'Materia Pendiente' :
           r.escolaridad === 'repitiente' ? 'Repitiente' :
           r.escolaridad === 'regular' ? 'Regular' : r.escolaridad}
        </Tag>
      ),
    },
  ];

  /* ------------------- Render ------------------- */
  if (loading && !structure) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  if (!structure?.period) {
    return (
      <div style={{ padding: 40 }}>
        <Alert type="warning" message="No hay un período escolar activo" showIcon />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Materia Pendiente</Title>
          <Text type="secondary">Período: {structure.period.name}</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchStructure} loading={loading}>Actualizar</Button>
      </div>

      <Alert
        type="info"
        message="Gestión de Materias Pendientes"
        description="Seleccione un año para ver las materias. Las materias deshabilitadas no tienen estudiantes registrados. Use «Registrar Estudiantes» para inscribir estudiantes del año siguiente."
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* Grade selector */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {structure.grades.map(group => {
          const isActive = expandedGradeId === group.grade.id;
          const totalStudents = group.subjects.reduce((sum, s) => sum + s.studentCount, 0);
          const activeSubjects = group.subjects.filter(s => s.studentCount > 0).length;
          return (
            <Col key={group.grade.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                onClick={() => setExpandedGradeId(group.grade.id)}
                style={{
                  borderRadius: 14,
                  border: isActive
                    ? `2px solid ${group.grade.isDiversified ? '#fa541c' : '#1890ff'}`
                    : '1px solid rgba(0,0,0,0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                styles={{ body: { padding: 16 } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: group.grade.isDiversified ? '#fa541c' : '#1890ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 900, fontSize: 18,
                  }}>
                    {group.grade.order || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 15, display: 'block' }}>{group.grade.name}</Text>
                    <Space size={4}>
                      <Tag color={activeSubjects > 0 ? 'green' : 'default'} style={{ fontSize: 10, margin: 0 }}>
                        {activeSubjects}/{group.subjects.length} activas
                      </Tag>
                      <Tag style={{ fontSize: 10, margin: 0 }}>{totalStudents} estudiantes</Tag>
                    </Space>
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Subjects list for selected grade */}
      {expandedGradeId && structure.grades.find(g => g.grade.id === expandedGradeId) && (
        <Card
          title={
            <Space>
              <BookOutlined />
              <span>Materias de {structure.grades.find(g => g.grade.id === expandedGradeId)?.grade.name}</span>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          <Row gutter={[16, 16]}>
            {structure.grades.find(g => g.grade.id === expandedGradeId)?.subjects.map(subject => {
              const isEnabled = subject.studentCount > 0;
              return (
                <Col key={subject.id} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    size="small"
                    style={{
                      borderRadius: 10,
                      opacity: isEnabled ? 1 : 0.6,
                      border: isEnabled ? '1px solid #d9f7be' : '1px solid #f0f0f0',
                      background: isEnabled ? '#f6ffed' : '#fafafa',
                    }}
                    styles={{ body: { padding: 12 } }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong ellipsis style={{ display: 'block', fontSize: 13 }}>
                          {subject.name}
                        </Text>
                        <Space size={4} style={{ marginTop: 4 }}>
                          {isEnabled ? (
                            <Tag color="success" style={{ fontSize: 10, margin: 0 }}>
                              <CheckCircleOutlined /> {subject.studentCount} est.
                            </Tag>
                          ) : (
                            <Tag color="default" style={{ fontSize: 10, margin: 0 }}>
                              <LockOutlined /> Sin estudiantes
                            </Tag>
                          )}
                        </Space>
                      </div>
                      <Button
                        type="primary"
                        size="small"
                        icon={<UserAddOutlined />}
                        onClick={() => {
                          const group = structure.grades.find(g => g.grade.id === expandedGradeId)!;
                          openRegModal(group, subject);
                        }}
                      >
                        Registrar
                      </Button>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                      <Button
                        size="small"
                        icon={<CalendarOutlined />}
                        onClick={() => openEncDatesModal(subject)}
                      >
                        Encuentros
                      </Button>
                      <Button
                        size="small"
                        icon={<FileTextOutlined />}
                        onClick={() => openContentModal(subject)}
                      >
                        Contenido
                      </Button>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>
      )}

      {/* Nómina — estilo revisión */}
      {expandedGradeId && (
        <Card
          title={
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Space>
                  <span>Nómina de Materia Pendiente</span>
                  {expandedGradeId && structure?.grades.find(g => g.grade.id === expandedGradeId) && (
                    <Tag color="blue">{structure.grades.find(g => g.grade.id === expandedGradeId)!.grade.name}</Tag>
                  )}
                </Space>
                <Button
                  icon={<PrinterOutlined />}
                  onClick={handlePrintNominaFinal}
                  loading={printLoading}
                  size="small"
                >
                  Imprimir / Guardar PDF (todos los grados)
                </Button>
              </Space>
              <Segmented
                value={nominaView}
                onChange={(v) => setNominaView(v as any)}
                options={[
                  { label: 'Nómina por Encuentro', value: 'encounter' },
                  { label: 'Nómina Final', value: 'final' },
                ]}
                size="small"
              />
            </Space>
          }
          styles={{ body: { padding: 0 } }}
        >
          {/* ---- Nómina por Encuentro ---- */}
          {nominaView === 'encounter' && (
          <Spin spinning={nominaEncounterLoading}>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Text strong>Encuentro:</Text>
              <Space>
                {Array.from({ length: maxEncounters }, (_, i) => i + 1).map(n => {
                  const isLocked = lockedEncounters.includes(n);
                  return (
                    <Button
                      key={n}
                      size="small"
                      type={selectedEncounter === n ? 'primary' : 'default'}
                      onClick={() => setSelectedEncounter(n)}
                    >
                      {n}°
                      <Button
                        type="text"
                        size="small"
                        icon={isLocked ? <LockOutlined /> : <UnlockOutlined />}
                        title={isLocked ? `Encuentro ${n} bloqueado (clic para abrir)` : `Encuentro ${n} abierto (clic para bloquear)`}
                        loading={lockSaving}
                        onClick={(e) => { e.stopPropagation(); toggleEncounterLock(n); }}
                        style={{ marginLeft: 4, padding: '0 2px', color: isLocked ? '#ff4d4f' : '#52c41a' }}
                      />
                    </Button>
                  );
                })}
              </Space>
              <Alert
                type="info"
                message="Haga clic en el candado para bloquear/desbloquear la edición del encuentro por parte de los profesores."
                showIcon
                style={{ flex: 1, minWidth: 200, fontSize: 12 }}
              />
            </div>
            {nominaEncounter && nominaEncounter.students.length > 0 ? (
              <div className="mp-nomina-container">
                <table className="mp-nomina-sheet">
                  <thead>
                    <tr>
                      <th className="mp-col-idx">#</th>
                      <th className="mp-col-doc">Cédula</th>
                      <th className="mp-col-name">Apellidos y Nombres</th>
                      {nominaEncounter.subjects.map(subj => {
                        const dates = encounterDatesMap[subj.periodGradeSubjectId] || [];
                        const encDate = dates.find(d => d.encounterNumber === selectedEncounter);
                        return (
                          <th key={subj.id} className="mp-col-subj" title={subj.name}>
                            <div>{subj.name.length > 15 ? subj.name.substring(0, 13) + '…' : subj.name}</div>
                            {encDate?.date && (
                              <div style={{ fontSize: 9, fontWeight: 400, color: '#999' }}>{dayjs(encDate.date).format('DD/MM/YY')}</div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {nominaEncounter.students.map((student, idx) => (
                      <tr key={student.inscriptionId}>
                        <td className="mp-cell-idx">{idx + 1}</td>
                        <td className="mp-cell-doc">
                          {student.documentType === 'Venezolano' ? 'V' : student.documentType === 'Extranjero' ? 'E' : student.documentType === 'Pasaporte' ? 'P' : 'CE'}-{student.studentDni}
                        </td>
                        <td className="mp-cell-name">{student.studentName}</td>
                        {nominaEncounter.subjects.map(subj => {
                          const studentSubj = student.subjects.find(s => s.subjectId === subj.id);
                          if (!studentSubj) {
                            return <td key={subj.id} className="mp-cell-filled" />;
                          }
                          return (
                            <td
                              key={subj.id}
                              className="mp-cell-blank mp-cell-registered"
                              onClick={() => openEncScoreModal(student, subj)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="mp-cell-content">
                                {studentSubj.encounterScore != null ? (
                                  <span className={studentSubj.encounterScore >= 10 ? 'mp-pass' : 'mp-fail'}>
                                    {studentSubj.encounterIsAbsent ? 'NP' : Number(studentSubj.encounterScore).toFixed(0)}
                                  </span>
                                ) : (
                                  <span className="mp-pending">—</span>
                                )}
                              </div>
                              {studentSubj.inscriptionSubjectId && (
                                <button
                                  className="mp-remove-btn"
                                  title={`Remover de ${subj.name}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemove(studentSubj.inscriptionSubjectId!, student.studentName);
                                  }}
                                >
                                  <DeleteOutlined />
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Empty description="No hay estudiantes pendientes para este encuentro" />
              </div>
            )}
          </Spin>
          )}

          {/* ---- Nómina Final ---- */}
          {nominaView === 'final' && (
          <Spin spinning={nominaFinalLoading}>
            {nominaFinal && nominaFinal.students.length > 0 ? (
              <>
              <div className="mp-nomina-container">
                <table className="mp-nomina-sheet">
                  <thead>
                    <tr>
                      <th className="mp-col-idx">#</th>
                      <th className="mp-col-doc">Cédula</th>
                      <th className="mp-col-name">Apellidos y Nombres</th>
                      {nominaFinal.subjects.map(subj => (
                        <th key={subj.id} className="mp-col-subj" title={subj.name}>
                          {subj.name.length > 15 ? subj.name.substring(0, 13) + '…' : subj.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {nominaFinal.students.map((student, idx) => (
                      <tr key={student.inscriptionId}>
                        <td className="mp-cell-idx">{idx + 1}</td>
                        <td className="mp-cell-doc">
                          {student.documentType === 'Venezolano' ? 'V' : student.documentType === 'Extranjero' ? 'E' : student.documentType === 'Pasaporte' ? 'P' : 'CE'}-{student.studentDni}
                        </td>
                        <td className="mp-cell-name">{student.studentName}</td>
                        {nominaFinal.subjects.map(subj => {
                          const studentSubj = student.subjects.find(s => s.subjectId === subj.id);
                          if (!studentSubj) {
                            return <td key={subj.id} className="mp-cell-filled" />;
                          }
                          const isApproved = studentSubj.status === 'aprobada';
                          return (
                            <td key={subj.id} className="mp-cell-blank" style={{ cursor: 'default' }}>
                              {studentSubj.finalScore != null ? (
                                <span className={isApproved ? 'mp-pass' : 'mp-fail'}>
                                  {studentSubj.isAbsent ? 'NP' : Number(studentSubj.finalScore).toFixed(0)}
                                </span>
                              ) : (
                                <span className="mp-pending">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            ) : (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Empty description="No hay estudiantes que cursaron materia pendiente para este grado" />
              </div>
            )}
          </Spin>
          )}
        </Card>
      )}

      {/* Registration Modal */}
      <Modal
        open={regModalOpen}
        title={
          <Space>
            <UserAddOutlined />
            <span>Registrar Estudiantes — {regModalSubject?.name}</span>
          </Space>
        }
        width={700}
        onCancel={() => setRegModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setRegModalOpen(false)}>Cancelar</Button>,
          <Button
            key="register"
            type="primary"
            icon={<SaveOutlined />}
            loading={acting}
            disabled={regSelected.size === 0}
            onClick={handleRegister}
          >
            Registrar {regSelected.size > 0 ? `(${regSelected.size})` : ''}
          </Button>,
        ]}
      >
        <Alert
          type="info"
          message={`Estudiantes de ${regModalGrade?.grade.name ? 'año siguiente' : ''} — se ordenan primero los de Materia Pendiente`}
          style={{ marginBottom: 16 }}
          showIcon
        />
        <Input.Search
          placeholder="Buscar por nombre, cédula o sección..."
          value={regSearch}
          onChange={e => setRegSearch(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <Spin spinning={regLoading}>
          <Table
            dataSource={filteredRegStudents}
            columns={regColumns}
            rowKey="inscriptionId"
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: false }}
            rowSelection={{
              selectedRowKeys: Array.from(regSelected),
              onChange: (keys) => setRegSelected(new Set(keys as number[])),
            }}
          />
        </Spin>
      </Modal>

      {/* Grade editing modal */}
      <Modal
        open={gradeModalOpen}
        title="Registrar Nota de Materia Pendiente"
        width={900}
        onCancel={() => setGradeModalOpen(false)}
        footer={null}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 15 }}>{gradeModalStudent?.studentName}</Text>
          <br />
          <Text type="secondary">{gradeModalSubject?.name}</Text>
        </div>
        <Divider style={{ margin: '12px 0' }} />

        <Spin spinning={assignmentLoading}>
          {assignmentDetail && assignmentDetail.evaluationPlans.length > 0 ? (
            /* ---- Plan de evaluación grid ---- */
            <div>
              <Alert
                type="info"
                message="Plan de Evaluación del Profesor"
                description="Si el estudiante aprueba en cualquier item (nota ≥ 10), la materia queda aprobada con la fecha del plan. Los lapsos NO se promedian. Nota 0 = NP (Inasistente)."
                showIcon
                style={{ marginBottom: 16 }}
              />
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid rgba(15, 23, 42, 0.08)' }}>
                  <thead style={{ position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '4px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'left', backgroundColor: '#f5f7fa', fontWeight: 700, fontSize: 11, color: '#475066' }}>Item</th>
                      <th style={{ padding: '4px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', backgroundColor: '#f5f7fa', fontWeight: 700, fontSize: 11, color: '#475066' }}>Lapso</th>
                      <th style={{ padding: '4px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', backgroundColor: '#f5f7fa', fontWeight: 700, fontSize: 11, color: '#475066' }}>Fecha</th>
                      <th style={{ padding: '4px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', backgroundColor: '#f5f7fa', fontWeight: 700, fontSize: 11, color: '#475066' }}>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const student = assignmentDetail.students.find(
                        s => s.inscriptionSubjectId === gradeModalStudent?.subjects.find(sb => sb.subjectId === gradeModalSubject?.id)?.inscriptionSubjectId
                      );
                      if (!student) return <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#999' }}>Estudiante no encontrado en la asignación</td></tr>;
                      const isApproved = student.finalGrade?.status === 'aprobada';
                      return assignmentDetail.evaluationPlans.map(planItem => {
                        const qual = student.qualifications.find(q => q.evaluationPlanId === planItem.id);
                        const editKey = `${student.inscriptionSubjectId}-${planItem.id}`;
                        const editValue = qualEdits[editKey];
                        const isAbsent = !!qual?.isAbsent;
                        const displayValue = editValue !== undefined ? editValue : (qual ? Number(qual.score) : null);
                        const showNp = isAbsent && editValue === undefined;
                        return (
                          <tr key={planItem.id}>
                            <td style={{ padding: '4px 8px', border: '1px solid rgba(15, 23, 42, 0.08)', fontSize: 12 }}>{planItem.description} <Text type="secondary" style={{ fontSize: 10 }}>({planItem.percentage}%)</Text></td>
                            <td style={{ padding: '4px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', fontSize: 11 }}>{planItem.term?.name || '—'}</td>
                            <td style={{ padding: '4px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', fontSize: 11 }}>{dayjs(planItem.date).format('DD/MM/YYYY')}</td>
                            <td style={{ padding: '2px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', position: 'relative' }}>
                              <input
                                type="number"
                                min={0}
                                max={20}
                                step={1}
                                inputMode="numeric"
                                value={displayValue ?? ''}
                                disabled={isApproved}
                                onChange={e => {
                                  const v = e.target.value === '' ? null : Number(e.target.value);
                                  setQualEdits(prev => ({ ...prev, [editKey]: v }));
                                }}
                                onBlur={() => {
                                  if (editValue !== undefined && editValue !== null) {
                                    handleSaveQualification(student, planItem, editValue);
                                  }
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (editValue !== undefined && editValue !== null) {
                                      handleSaveQualification(student, planItem, editValue);
                                    }
                                  }
                                }}
                                style={{
                                  width: 48,
                                  textAlign: 'center',
                                  border: 'none',
                                  outline: 'none',
                                  background: 'transparent',
                                  fontSize: 13,
                                  fontWeight: displayValue != null && displayValue > 0 && displayValue < 10 ? 700 : undefined,
                                  color: displayValue != null && displayValue > 0 && displayValue < 10 ? '#dc2626' : undefined,
                                }}
                              />
                              {showNp && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: 14, pointerEvents: 'none' }}>NP</span>}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
              {(() => {
                const student = assignmentDetail.students.find(
                  s => s.inscriptionSubjectId === gradeModalStudent?.subjects.find(sb => sb.subjectId === gradeModalSubject?.id)?.inscriptionSubjectId
                );
                if (!student) return null;
                const isApproved = student.finalGrade?.status === 'aprobada';
                const isAbsent = student.finalGrade?.finalScore === 0;
                return (
                  <div style={{ marginTop: 16, display: 'flex', gap: 24, alignItems: 'center' }}>
                    <Space>
                      <Text strong>Nota Final:</Text>
                      <Tag color={isApproved ? 'success' : student.finalGrade ? 'error' : 'default'} style={{ fontSize: 14, padding: '4px 12px' }}>
                        {student.finalGrade?.finalScore == null ? 'Sin nota' : isAbsent ? 'NP' : Number(student.finalGrade.finalScore).toFixed(0)}
                      </Tag>
                      {student.finalGrade && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Fecha: {dayjs(student.finalGrade.calculatedAt).format('DD/MM/YYYY')}
                        </Text>
                      )}
                    </Space>
                  </div>
                );
              })()}
            </div>
          ) : assignmentDetail && assignmentDetail.evaluationPlans.length === 0 ? (
            /* ---- No plan → direct grade with date ---- */
            <div>
              <Alert
                type="info"
                message="No hay plan de evaluación. Registre una nota final directa."
                showIcon
                style={{ marginBottom: 16 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <Space>
                  <Text>Nota final:</Text>
                  <InputNumber
                    min={0}
                    max={20}
                    step={1}
                    value={gradeValue}
                    onChange={v => setGradeValue(v)}
                    style={{ width: 120 }}
                    controls={false}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>(0=NP, 1-20, mínimo 10)</Text>
                  {gradeValue === 0 && <Tag color="red">NP (Inasistente)</Tag>}
                </Space>
                <Space>
                  <CalendarOutlined />
                  <Text>Fecha:</Text>
                  <DatePicker
                    value={gradeDate}
                    onChange={d => setGradeDate(d || dayjs())}
                    format="DD/MM/YYYY"
                    allowClear={false}
                  />
                </Space>
              </div>
              <div style={{ marginTop: 24, textAlign: 'right' }}>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={gradeSaving}
                  disabled={gradeValue == null}
                  onClick={handleSaveGrade}
                >
                  Guardar Nota
                </Button>
              </div>
            </div>
          ) : null}
        </Spin>
      </Modal>

      {/* Encounter Score Modal */}
      <Modal
        open={encScoreModalOpen}
        title={`Registrar Nota — Encuentro ${selectedEncounter}`}
        onCancel={() => setEncScoreModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setEncScoreModalOpen(false)}>Cancelar</Button>,
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            loading={encScoreSaving}
            disabled={encScoreValue == null && !encScoreIsAbsent}
            onClick={handleSaveEncounterScore}
          >
            Guardar
          </Button>,
          <Button
            danger
            icon={<DeleteOutlined />}
            loading={encScoreSaving}
            disabled={encScoreValue == null && !encScoreIsAbsent}
            onClick={async () => {
              if (!encScoreStudent || !encScoreSubject) return;
              const subj = encScoreStudent.subjects.find(s => s.subjectId === encScoreSubject.id);
              if (!subj) return;
              setEncScoreSaving(true);
              try {
                await api.post(`/pending-subjects/${subj.pendingSubjectId}/encounters/${selectedEncounter}/score`, {
                  score: null,
                });
                message.success('Nota eliminada');
                setEncScoreModalOpen(false);
                if (expandedGradeId) await fetchNominaEncounter(expandedGradeId, selectedEncounter);
              } catch (error: any) {
                message.error(error?.response?.data?.message || 'Error al eliminar nota');
              } finally {
                setEncScoreSaving(false);
              }
            }}
          >
            Eliminar
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 15 }}>{encScoreStudent?.studentName}</Text>
          <br />
          <Text type="secondary">{encScoreSubject?.name}</Text>
        </div>
        <Alert
          type="info"
          message="Si la nota es ≥ 10, el estudiante aprueba y no aparecerá en encuentros posteriores. 0 = NP (Inasistente)."
          showIcon
          style={{ marginBottom: 16 }}
        />
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Space>
            <Text>Nota:</Text>
            <InputNumber
              ref={encScoreInputRef}
              min={0}
              max={20}
              step={1}
              value={encScoreValue}
              onChange={v => { setEncScoreValue(v); if (v !== 0) setEncScoreIsAbsent(false); }}
              onPressEnter={() => handleSaveEncounterScore()}
              style={{ width: 120 }}
              disabled={encScoreIsAbsent}
              controls={false}
            />
          </Space>
          <Checkbox
            checked={encScoreIsAbsent}
            onChange={e => {
              setEncScoreIsAbsent(e.target.checked);
              if (e.target.checked) setEncScoreValue(0);
            }}
          >
            Inasistente (NP)
          </Checkbox>
        </div>
      </Modal>

      {/* Encounter Dates Modal */}
      <Modal
        open={encDatesModalOpen}
        title={`Configurar Encuentros — ${encDatesSubject?.name}`}
        onCancel={() => setEncDatesModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setEncDatesModalOpen(false)}>Cancelar</Button>,
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            loading={encDatesSaving}
            onClick={handleSaveEncounterDates}
          >
            Guardar Fechas
          </Button>,
        ]}
      >
        <Spin spinning={encDatesLoading}>
          <Alert
            type="info"
            message="Configure las fechas de los encuentros. El profesor también puede editar estas fechas."
            showIcon
            style={{ marginBottom: 16 }}
          />
          {encDatesData.map((enc, _idx) => (
            <div key={enc.id} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <Tag color="blue" style={{ minWidth: 80, textAlign: 'center' }}>Encuentro {enc.encounterNumber}</Tag>
              <DatePicker
                value={enc.date ? dayjs(enc.date) : null}
                onChange={d => {
                  setEncDatesData(prev => prev.map(e =>
                    e.encounterNumber === enc.encounterNumber
                      ? { ...e, date: d ? d.format('YYYY-MM-DD') : null }
                      : e
                  ));
                }}
                format="DD/MM/YYYY"
                allowClear
                style={{ flex: 1 }}
              />
            </div>
          ))}
        </Spin>
      </Modal>

      {/* Content Modal */}
      <Modal
        open={contentModalOpen}
        title={`Contenido de Estudio — ${contentSubject?.name}`}
        onCancel={() => setContentModalOpen(false)}
        width={600}
        footer={[
          <Button key="print" icon={<PrinterOutlined />} onClick={handlePrintContent} disabled={!contentTheme && contentItems.length === 0}>
            Imprimir
          </Button>,
          <Button key="cancel" onClick={() => setContentModalOpen(false)}>Cancelar</Button>,
          <Button key="save" type="primary" icon={<SaveOutlined />} loading={contentSaving} onClick={handleSaveContent}>
            Guardar
          </Button>,
        ]}
      >
        <Spin spinning={contentLoading}>
          <Alert
            type="info"
            message="Tema General y lista de Contenidos para que los estudiantes sepan qué estudiar. Sin ponderación."
            showIcon
            style={{ marginBottom: 16 }}
          />
          <div style={{ marginBottom: 16 }}>
            <Text strong>Tema General:</Text>
            <Input
              value={contentTheme}
              onChange={e => setContentTheme(e.target.value)}
              placeholder="Ej: Repaso general de la materia"
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>Contenidos:</Text>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setContentItems(prev => [...prev, { text: '', order: prev.length }])}
              >
                Añadir
              </Button>
            </div>
            {contentItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <Input
                  value={item.text}
                  onChange={e => setContentItems(prev => prev.map((it, i) => i === idx ? { ...it, text: e.target.value } : it))}
                  placeholder={`Contenido ${idx + 1}`}
                />
                <Button
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                  onClick={() => setContentItems(prev => prev.filter((_, i) => i !== idx))}
                />
              </div>
            ))}
            {contentItems.length === 0 && (
              <Empty description="Sin contenidos. Haga clic en «Añadir»" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        </Spin>
      </Modal>

      <style>{`
        .mp-nomina-container { overflow-x: auto; }
        .mp-nomina-sheet {
          width: 100%; border-collapse: collapse; font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .mp-nomina-sheet th {
          background: #f5f7fa; border: 1px solid #e8ecf0; padding: 8px 6px;
          text-align: center; font-weight: 700; color: #475066;
          position: sticky; top: 0; z-index: 1;
        }
        .mp-nomina-sheet td {
          border: 1px solid #e8ecf0; padding: 6px; text-align: center;
        }
        .mp-col-idx { width: 40px; }
        .mp-col-doc { width: 100px; }
        .mp-col-name { text-align: left; min-width: 200px; }
        .mp-col-subj { min-width: 60px; max-width: 100px; }
        .mp-cell-idx { background: #fafbfc; font-weight: 600; color: #8c8c8c; }
        .mp-cell-doc { font-size: 11px; color: #666; }
        .mp-cell-name { text-align: left; font-weight: 500; }
        .mp-cell-filled {
          background: #e8ecf0;
          border: 1px solid #c4cad3 !important;
        }
        .mp-cell-blank {
          background: #fff; cursor: pointer; transition: background 0.15s;
          border: 1px solid #d9dee5 !important;
        }
        .mp-cell-blank:hover { background: #f0f5ff; }
        .mp-cell-registered { position: relative; }
        .mp-cell-content { display: inline-block; }
        .mp-remove-btn {
          position: absolute;
          top: 2px;
          right: 2px;
          display: none;
          background: #fff;
          border: 1px solid #ffccc7;
          border-radius: 3px;
          padding: 0;
          width: 18px;
          height: 18px;
          line-height: 16px;
          font-size: 10px;
          color: #ff4d4f;
          cursor: pointer;
          align-items: center;
          justify-content: center;
        }
        .mp-cell-registered:hover .mp-remove-btn { display: flex; }
        .mp-remove-btn:hover {
          background: #ff4d4f;
          color: #fff;
          border-color: #ff4d4f;
        }
        .mp-pass { color: #52c41a; font-weight: 700; font-size: 14px; }
        .mp-fail { color: #ff4d4f; font-weight: 700; font-size: 14px; }
        .mp-pending { color: #d9d9d9; }
        /* Hide number input spinners */
        .no-spinners input::-webkit-outer-spin-button,
        .no-spinners input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinners input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Hidden iframe for printing */}
      <iframe
        ref={printIframeRef}
        style={{ position: 'absolute', width: 0, height: 0, border: 'none', left: -9999, top: -9999 }}
        title="print-frame"
      />
    </div>
  );
};

export default PendingSubjectManagement;
