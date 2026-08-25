import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Button, Space, Typography, Spin, message, Tag, Empty,
  InputNumber, Alert, Tabs, Input, Modal, DatePicker,
} from 'antd';
import {
  SaveOutlined, ReloadOutlined,
  PlusOutlined, DeleteOutlined, CalendarOutlined,
  FileTextOutlined, PrinterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';
import { getSubjectVisual, withAlpha } from '@/utils/subjectVisuals';
import { useDragScroll } from '@/utils/useDragScroll';

const gradeOrder = (name: string): number => {
  const GRADE_ORDINALS: Record<string, number> = {
    primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3,
    cuarto: 4, quinto: 5, sexto: 6, septimo: 7, octavo: 8, noveno: 9, decimo: 10,
  };
  const lower = name.toLowerCase().trim();
  const firstWord = lower.split(/\s+/)[0];
  return GRADE_ORDINALS[firstWord] ?? 99;
};

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
  gradeName?: string;
}

interface EncounterStudent {
  inscriptionId: number;
  pendingSubjectId: number | null;
  personId: number;
  studentName: string;
  studentDni: string;
  documentType: string;
  status: string;
  encounters: {
    id: number;
    encounterNumber: number;
    date: string | null;
    score: number | null;
    isAbsent: boolean;
  }[];
}

interface AssignmentEncounters {
  subjectName: string;
  maxEncounters: number;
  students: EncounterStudent[];
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
const PendingSubjectTeacherPanel: React.FC = () => {
  const dragScroll = useDragScroll<HTMLDivElement>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lockedEncounters, setLockedEncounters] = useState<number[]>([]);
  const [assignments, setAssignments] = useState<MpAssignment[]>([]);
  const [selectedPgsId, setSelectedPgsId] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);

  // Encounter system
  const [encounterData, setEncounterData] = useState<AssignmentEncounters | null>(null);
  const [encounterLoading, setEncounterLoading] = useState(false);
  const [encounterEdits, setEncounterEdits] = useState<Record<string, number | null>>({});
  const [encounterAbsent, setEncounterAbsent] = useState<Record<string, boolean>>({});
  const [encDatesModalOpen, setEncDatesModalOpen] = useState(false);
  const [encDatesData, setEncDatesData] = useState<{ encounterNumber: number; date: string | null }[]>([]);
  const [encDatesSaving, setEncDatesSaving] = useState(false);

  // Content
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentTheme, setContentTheme] = useState('');
  const [contentItems, setContentItems] = useState<{ text: string; order: number }[]>([]);

  /* ------------------- Fetch assignments ------------------- */
  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ assignments: MpAssignment[] }>('/pending-subjects/teacher-assignments');
      const list = res.data.assignments || [];
      setAssignments(list);
      // Auto-select first subject + first grade if nothing selected
      if (list.length > 0 && !selectedPgsId) {
        const firstSubjectId = list[0].subjectId;
        setSelectedSubjectId(firstSubjectId);
        setSelectedGradeId(list[0].gradeId);
        setSelectedPgsId(list[0].periodGradeSubjectId);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al cargar asignaciones');
    } finally {
      setLoading(false);
    }
  }, [selectedPgsId]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  // Load locked encounters setting
  useEffect(() => {
    api.get('/settings').then(res => {
      const lockedStr = res.data.pending_subject_locked_encounters || '';
      const locked = lockedStr.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => Number.isFinite(n));
      setLockedEncounters(locked);
    }).catch(() => {});
  }, []);

  // Group assignments: unique subjects + grades per subject
  const uniqueSubjects = useMemo(() => {
    const map = new Map<number, { subjectId: number; subjectName: string }>();
    assignments.forEach(a => {
      if (!map.has(a.subjectId)) {
        map.set(a.subjectId, { subjectId: a.subjectId, subjectName: a.subjectName });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'es'));
  }, [assignments]);

  const gradesForSubject = useMemo(() => {
    if (!selectedSubjectId) return [];
    return assignments
      .filter(a => a.subjectId === selectedSubjectId)
      .map(a => ({ gradeId: a.gradeId, gradeName: a.gradeName || `Grado ${a.gradeId}`, pgsId: a.periodGradeSubjectId }))
      .sort((a, b) => gradeOrder(a.gradeName) - gradeOrder(b.gradeName));
  }, [assignments, selectedSubjectId]);

  // When subject or grade changes, update selectedPgsId
  useEffect(() => {
    if (selectedSubjectId && selectedGradeId) {
      const match = assignments.find(a => a.subjectId === selectedSubjectId && a.gradeId === selectedGradeId);
      if (match && match.periodGradeSubjectId !== selectedPgsId) {
        setSelectedPgsId(match.periodGradeSubjectId);
      }
    }
  }, [selectedSubjectId, selectedGradeId, assignments, selectedPgsId]);

  /* ------------------- Fetch encounters for assignment ------------------- */
  const fetchEncounters = useCallback(async (pgsId: number) => {
    setEncounterLoading(true);
    try {
      const res = await api.get<AssignmentEncounters>(`/pending-subjects/assignment/${pgsId}/encounters`);
      setEncounterData(res.data);
      setEncounterEdits({});
      setEncounterAbsent({});
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al cargar encuentros');
    } finally {
      setEncounterLoading(false);
    }
  }, []);

  useEffect(() => { if (selectedPgsId) fetchEncounters(selectedPgsId); }, [selectedPgsId, fetchEncounters]);

  /* ------------------- Save encounter score (inline) ------------------- */
  const handleSaveEncounterScore = async (student: EncounterStudent, encounterNumber: number, score: number | null, isAbsent: boolean) => {
    if (!student.pendingSubjectId) return;
    // score === null means "clear the note"
    if (score === null && !isAbsent) {
      // Clearing the score
      setSaving(true);
      try {
        await api.post(`/pending-subjects/${student.pendingSubjectId}/encounters/${encounterNumber}/score`, {
          score: null,
        });
        message.success(`${student.studentName} — Encuentro ${encounterNumber}: nota eliminada`);
        setEncounterEdits(prev => { const n = { ...prev }; delete n[`${student.pendingSubjectId}-${encounterNumber}`]; return n; });
        setEncounterAbsent(prev => { const n = { ...prev }; delete n[`${student.pendingSubjectId}-${encounterNumber}`]; return n; });
        if (selectedPgsId) fetchEncounters(selectedPgsId);
      } catch (error: any) {
        message.error(error?.response?.data?.message || 'Error al eliminar nota');
      } finally {
        setSaving(false);
      }
      return;
    }
    if (score == null) return;
    setSaving(true);
    try {
      const finalScore = isAbsent ? 0 : score;
      const res = await api.post(`/pending-subjects/${student.pendingSubjectId}/encounters/${encounterNumber}/score`, {
        score: finalScore,
        isAbsent,
      });
      const isNp = isAbsent || finalScore === 0;
      message.success(`${student.studentName} — Encuentro ${encounterNumber}: ${isNp ? 'NP' : finalScore}${res.data.approved ? ' (Aprobó)' : ''}`);
      setEncounterEdits(prev => { const n = { ...prev }; delete n[`${student.pendingSubjectId}-${encounterNumber}`]; return n; });
      setEncounterAbsent(prev => { const n = { ...prev }; delete n[`${student.pendingSubjectId}-${encounterNumber}`]; return n; });
      if (selectedPgsId) fetchEncounters(selectedPgsId);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al guardar nota');
    } finally {
      setSaving(false);
    }
  };

  /* ------------------- Open encounter dates modal (teacher) ------------------- */
  const openEncDatesModal = () => {
    if (!encounterData || encounterData.students.length === 0) {
      message.warning('No hay estudiantes para configurar encuentros');
      return;
    }
    // Use first student's encounters as template (dates are per-pendingSubject but we edit one)
    const first = encounterData.students[0];
    if (!first.pendingSubjectId || first.encounters.length === 0) {
      message.warning('No hay encuentros configurados');
      return;
    }
    setEncDatesData(first.encounters.map(e => ({ encounterNumber: e.encounterNumber, date: e.date })));
    setEncDatesModalOpen(true);
  };

  const handleSaveEncDates = async () => {
    if (!encounterData || encounterData.students.length === 0) return;
    const first = encounterData.students[0];
    if (!first.pendingSubjectId) return;
    setEncDatesSaving(true);
    try {
      await api.put(`/pending-subjects/${first.pendingSubjectId}/encounters`, {
        encounters: encDatesData.map(e => ({ encounterNumber: e.encounterNumber, date: e.date })),
      });
      message.success('Fechas actualizadas');
      setEncDatesModalOpen(false);
      if (selectedPgsId) fetchEncounters(selectedPgsId);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al guardar fechas');
    } finally {
      setEncDatesSaving(false);
    }
  };

  /* ------------------- Content modal (teacher) ------------------- */
  const openContentModal = async () => {
    if (!encounterData || encounterData.students.length === 0) {
      message.warning('No hay estudiantes para gestionar contenido');
      return;
    }
    const first = encounterData.students[0];
    if (!first.pendingSubjectId) return;
    setContentModalOpen(true);
    setContentLoading(true);
    setContentTheme('');
    setContentItems([]);
    try {
      const res = await api.get(`/pending-subjects/${first.pendingSubjectId}/content`);
      setContentTheme(res.data.themeTitle || '');
      setContentItems(res.data.items.map((it: any) => ({ text: it.text, order: it.order })));
    } catch {
      // No content yet — ok
    } finally {
      setContentLoading(false);
    }
  };

  const handleSaveContent = async () => {
    if (!encounterData || encounterData.students.length === 0) return;
    const first = encounterData.students[0];
    if (!first.pendingSubjectId) return;
    setContentSaving(true);
    try {
      await api.put(`/pending-subjects/${first.pendingSubjectId}/content`, {
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
    const subjName = encounterData?.subjectName || '';
    const itemsHtml = contentItems.map(it => `<li>${it.text}</li>`).join('');
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
          {/* Selector — materia → año (estilo TeacherPanel) */}
          <div className="app-card app-card-hover p-5 flex flex-col" style={{ marginBottom: 16 }}>
            <span className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Seleccionar Asignatura</span>

            {/* Nivel 1: Materia (tarjetas horizontales con icono+color) */}
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
              {uniqueSubjects.map(s => {
                const isSelected = s.subjectId === selectedSubjectId;
                const { Icon, color } = getSubjectVisual({ name: s.subjectName });
                return (
                  <div
                    key={s.subjectId}
                    onClick={() => {
                      setSelectedSubjectId(s.subjectId);
                      // Auto-select first grade for this subject
                      const first = assignments.find(a => a.subjectId === s.subjectId);
                      if (first) {
                        setSelectedGradeId(first.gradeId);
                        setSelectedPgsId(first.periodGradeSubjectId);
                      }
                    }}
                    className="cursor-pointer min-w-[180px] rounded-xl p-3 transition-all flex items-center gap-3 border-none"
                    style={{
                      backgroundColor: isSelected ? 'var(--color-accent)' : 'var(--color-inactive)',
                      color: isSelected ? 'var(--color-header-text)' : 'var(--color-text-main)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : withAlpha(color, 0.12) }}
                    >
                      <Icon style={{ color: isSelected ? '#fff' : color, fontSize: 18 }} />
                    </div>
                    <div className="font-bold text-sm leading-tight" style={{ color: 'inherit' }}>
                      {s.subjectName}
                    </div>
                  </div>
                );
              })}
              {uniqueSubjects.length === 0 && (
                <span className="text-xs self-center" style={{ color: 'var(--color-text-muted)' }}>Sin materias</span>
              )}
            </div>

            {/* Nivel 2: Año */}
            <div className="flex gap-2 mt-3 w-full" style={{ minHeight: 40 }}>
              {selectedSubjectId && gradesForSubject.map(g => {
                const isSelected = g.gradeId === selectedGradeId;
                return (
                  <button
                    key={g.gradeId}
                    onClick={() => {
                      setSelectedGradeId(g.gradeId);
                      setSelectedPgsId(g.pgsId);
                    }}
                    className="flex-1 py-2.5 text-sm font-bold rounded-lg transition-all border-none cursor-pointer"
                    style={{
                      backgroundColor: isSelected ? 'var(--color-accent)' : 'var(--color-inactive)',
                      color: isSelected ? 'var(--color-header-text)' : 'var(--color-text-main)',
                    }}
                  >
                    {g.gradeName}
                  </button>
                );
              })}
            </div>
          </div>

          <Spin spinning={loading}>
            {encounterData && (
              <Tabs
                items={[
                  {
                    key: 'encounters',
                    label: `Encuentros (${encounterData?.maxEncounters ?? 4})`,
                    children: (
                      <Card
                        title={
                          <Space>
                            <CalendarOutlined />
                            <span>{encounterData?.subjectName}</span>
                            <Tag>{encounterData?.students.length ?? 0} estudiantes</Tag>
                            <Button
                              size="small"
                              icon={<CalendarOutlined />}
                              onClick={openEncDatesModal}
                            >
                              Fechas
                            </Button>
                            <Button
                              size="small"
                              icon={<FileTextOutlined />}
                              onClick={openContentModal}
                            >
                              Contenido
                            </Button>
                          </Space>
                        }
                      >
                        <Spin spinning={encounterLoading}>
                          <Alert
                            type="info"
                            message="Sistema de Encuentros"
                            description="Si un estudiante aprueba en cualquier encuentro (nota ≥ 10), la materia queda aprobada y no aparece en encuentros posteriores. 0 = NP (Inasistente)."
                            showIcon
                            style={{ marginBottom: 16 }}
                          />
                          {lockedEncounters.length > 0 && (
                            <Alert
                              type="warning"
                              message={`Encuentros bloqueados: ${lockedEncounters.map(n => n + '°').join(', ')}`}
                              description="Control de Estudios ha bloqueado la edición de estos encuentros. Contacte al administrador si necesita realizar cambios."
                              showIcon
                              style={{ marginBottom: 16 }}
                            />
                          )}
                          {encounterData && encounterData.students.length > 0 ? (
                            <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid rgba(15, 23, 42, 0.08)' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                  <tr>
                                    <th style={{ padding: '4px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', backgroundColor: '#f5f7fa', fontWeight: 700, fontSize: 11, width: 36 }}>#</th>
                                    <th style={{ padding: '4px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', backgroundColor: '#f5f7fa', fontWeight: 700, fontSize: 11 }}>Cédula</th>
                                    <th style={{ padding: '4px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'left', backgroundColor: '#f5f7fa', fontWeight: 700, fontSize: 11 }}>Estudiante</th>
                                    {Array.from({ length: encounterData.maxEncounters }, (_, i) => i + 1).map(n => {
                                      const firstStudent = encounterData.students[0];
                                      const enc = firstStudent?.encounters.find(e => e.encounterNumber === n);
                                      return (
                                        <th key={n} style={{ padding: '3px 4px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', backgroundColor: '#f5f7fa', fontWeight: 700, fontSize: 11, minWidth: 60 }}>
                                          <div>Enc. {n}</div>
                                          {enc?.date && <div style={{ fontSize: 9, fontWeight: 400, color: '#999' }}>{dayjs(enc.date).format('DD/MM/YY')}</div>}
                                        </th>
                                      );
                                    })}
                                    <th style={{ padding: '4px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', backgroundColor: '#f5f7fa', fontWeight: 700, fontSize: 11 }}>Estado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {encounterData.students.map((student, idx) => {
                                    const isApproved = student.status === 'aprobada';
                                    return (
                                      <tr key={student.inscriptionId} style={isApproved ? { background: '#f6ffed' } : undefined}>
                                        <td style={{ padding: '2px 4px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#999' }}>{idx + 1}</td>
                                        <td style={{ padding: '2px 4px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', fontSize: 11 }}>{student.studentDni || '-'}</td>
                                        <td style={{ padding: '2px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'left', fontSize: 12 }}>{student.studentName}</td>
                                        {Array.from({ length: encounterData.maxEncounters }, (_, i) => i + 1).map(n => {
                                          const enc = student.encounters.find(e => e.encounterNumber === n);
                                          const editKey = `${student.pendingSubjectId}-${n}`;
                                          const editValue = encounterEdits[editKey];
                                          const editAbsent = encounterAbsent[editKey];
                                          const displayValue = editValue !== undefined ? editValue : (enc ? enc.score : null);
                                          const displayAbsent = editAbsent !== undefined ? editAbsent : (enc ? enc.isAbsent : false);
                                          const showNp = displayAbsent && editValue === undefined;
                                          // Find the encounter where the student approved (score >= 10)
                                          const approvedEncounter = student.encounters.find(e => e.score != null && e.score >= 10 && !e.isAbsent);
                                          const approvedEncounterNum = approvedEncounter?.encounterNumber;
                                          // Disable if: this encounter is locked by CE, OR student approved in a previous encounter
                                          const isAfterApproval = isApproved && approvedEncounterNum != null && n > approvedEncounterNum;
                                          const isEncounterLocked = lockedEncounters.includes(n);
                                          const isDisabled = isEncounterLocked || isAfterApproval;
                                          const hasScore = displayValue != null;
                                          return (
                                            <td key={n} style={{ padding: '2px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', position: 'relative', width: 50 }}>
                                              <input
                                                type="number"
                                                min={0}
                                                max={20}
                                                step={1}
                                                inputMode="numeric"
                                                className="no-spinners"
                                                value={isAfterApproval ? '' : (displayValue ?? '')}
                                                disabled={isDisabled}
                                                onChange={e => {
                                                  const v = e.target.value === '' ? null : Number(e.target.value);
                                                  setEncounterEdits(prev => ({ ...prev, [editKey]: v }));
                                                  if (v !== 0) setEncounterAbsent(prev => ({ ...prev, [editKey]: false }));
                                                }}
                                                onBlur={() => {
                                                  if (editValue !== undefined) {
                                                    if (editValue === null) {
                                                      // Clear the score
                                                      handleSaveEncounterScore(student, n, null, false);
                                                    } else if (editValue !== null) {
                                                      handleSaveEncounterScore(student, n, editValue, editAbsent ?? false);
                                                    }
                                                  }
                                                }}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (editValue !== undefined) {
                                                      if (editValue === null) {
                                                        handleSaveEncounterScore(student, n, null, false);
                                                      } else if (editValue !== null) {
                                                        handleSaveEncounterScore(student, n, editValue, editAbsent ?? false);
                                                      }
                                                    }
                                                  }
                                                }}
                                                style={{
                                                  width: 48,
                                                  textAlign: 'center',
                                                  border: 'none',
                                                  outline: 'none',
                                                  background: 'transparent',
                                                  fontSize: 12,
                                                  padding: 0,
                                                  color: displayValue != null && displayValue > 0 && displayValue < 10 ? '#dc2626' : undefined,
                                                  fontWeight: displayValue != null && displayValue > 0 && displayValue < 10 ? 700 : undefined,
                                                }}
                                              />
                                              {showNp && <span className="mp-np-overlay">NP</span>}
                                              {hasScore && !isDisabled && (
                                                <button
                                                  title="Borrar nota"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEncounterEdits(prev => ({ ...prev, [editKey]: null }));
                                                    handleSaveEncounterScore(student, n, null, false);
                                                  }}
                                                  style={{
                                                    position: 'absolute',
                                                    top: -4,
                                                    right: -4,
                                                    width: 14,
                                                    height: 14,
                                                    borderRadius: '50%',
                                                    border: 'none',
                                                    background: '#ff4d4f',
                                                    color: '#fff',
                                                    fontSize: 8,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: 0,
                                                    lineHeight: 1,
                                                  }}
                                                >
                                                  ×
                                                </button>
                                              )}
                                            </td>
                                          );
                                        })}
                                        <td style={{ padding: '2px 6px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>
                                          {isApproved ? (
                                            <Tag color="success">Aprobada</Tag>
                                          ) : (
                                            <Tag color="orange">Pendiente</Tag>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <Empty description="No hay estudiantes registrados" />
                          )}
                        </Spin>
                      </Card>
                    ),
                  },
                ]}
              />
            )}
          </Spin>
        </>
      )}

      {/* Encounter Dates Modal (teacher) */}
      <Modal
        open={encDatesModalOpen}
        title="Configurar Fechas de Encuentros"
        onCancel={() => setEncDatesModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setEncDatesModalOpen(false)}>Cancelar</Button>,
          <Button key="save" type="primary" icon={<SaveOutlined />} loading={encDatesSaving} onClick={handleSaveEncDates}>
            Guardar Fechas
          </Button>,
        ]}
      >
        <Alert
          type="info"
          message="Configure las fechas de los encuentros para esta materia pendiente."
          showIcon
          style={{ marginBottom: 16 }}
        />
        {encDatesData.map((enc, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
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
      </Modal>

      {/* Content Modal (teacher) */}
      <Modal
        open={contentModalOpen}
        title={`Contenido de Estudio — ${encounterData?.subjectName || ''}`}
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
            message="Tema General y lista de Contenidos para que los estudiantes sepan qué estudiar."
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
        .no-spinners::-webkit-outer-spin-button,
        .no-spinners::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinners[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
};

export default PendingSubjectTeacherPanel;
