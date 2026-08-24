import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Select, Button, Space, Typography, Spin, message, Tag, Empty,
  InputNumber, Alert, Tabs, Input, Modal, DatePicker,
} from 'antd';
import {
  SaveOutlined, ReloadOutlined,
  PlusOutlined, DeleteOutlined, CalendarOutlined,
  FileTextOutlined, PrinterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';

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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState<MpAssignment[]>([]);
  const [selectedPgsId, setSelectedPgsId] = useState<number | null>(null);

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

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

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
    if (score == null && !isAbsent) return;
    if (!student.pendingSubjectId) return;
    setSaving(true);
    try {
      const finalScore = isAbsent ? 0 : (score ?? 0);
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
                                          const disabled = isApproved;
                                          return (
                                            <td key={n} style={{ padding: '2px', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', position: 'relative', width: 50 }}>
                                              <input
                                                type="number"
                                                min={0}
                                                max={20}
                                                step={1}
                                                inputMode="numeric"
                                                value={displayValue ?? ''}
                                                disabled={disabled}
                                                onChange={e => {
                                                  const v = e.target.value === '' ? null : Number(e.target.value);
                                                  setEncounterEdits(prev => ({ ...prev, [editKey]: v }));
                                                  if (v !== 0) setEncounterAbsent(prev => ({ ...prev, [editKey]: false }));
                                                }}
                                                onBlur={() => {
                                                  if (editValue !== undefined && editValue !== null) {
                                                    handleSaveEncounterScore(student, n, editValue, editAbsent ?? false);
                                                  }
                                                }}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (editValue !== undefined && editValue !== null) {
                                                      handleSaveEncounterScore(student, n, editValue, editAbsent ?? false);
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
      `}</style>
    </div>
  );
};

export default PendingSubjectTeacherPanel;
