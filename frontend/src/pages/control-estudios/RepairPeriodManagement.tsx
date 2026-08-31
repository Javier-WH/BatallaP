import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, Tag, Space, Typography, Spin, message, Alert, Statistic, Row, Col, Popconfirm, Checkbox, Tabs, InputNumber, Segmented } from 'antd';
import { PlayCircleOutlined, StopOutlined, ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, PrinterOutlined, RetweetOutlined, UndoOutlined, LockOutlined, UnlockOutlined, EditOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';
import { compareStudents } from '@/utils/studentSort';
import { useAuth } from '@/context/AuthContext';

const { Title, Text } = Typography;

interface CouncilStatus {
  totalChecklists: number;
  doneChecklists: number;
  allDone: boolean;
}

interface TermsStatus {
  totalTerms: number;
  blockedTerms: number;
  allBlocked: boolean;
}

interface RevisionStats {
  totalStudents: number;
  totalSubjects: number;
  approvedCount: number;
  failedCount: number;
  pendingCount: number;
}

interface RevisionPeriodData {
  id: number;
  schoolPeriodId: number;
  status: 'pending' | 'open' | 'completed' | 'closed';
  maxOpportunities: number;
  passingGrade: number;
  currentOpportunity: number;
  openedAt: string | null;
  completedAt: string | null;
  completedBy: number | null;
  closedAt: string | null;
  gradesFinalized?: boolean;
  gradesFinalizedAt?: string | null;
  gradesFinalizedBy?: number | null;
}

interface Summary {
  revisionPeriod: RevisionPeriodData | null;
  councilStatus: CouncilStatus;
  termsStatus: TermsStatus;
  stats?: RevisionStats;
}

interface RevisionItem {
  id: number;
  opportunity: number;
  score: number | null;
  status: string;
  isAbsent?: boolean;
  gradedBy?: number | null;
  graderName?: string | null;
  gradedAt?: string | null;
}

interface StudentSubject {
  inscriptionSubjectId: number;
  subjectName: string;
  abbreviation: string;
  originalScore: number | null;
  originalStatus: string | null;
  maxOpportunities: number;
  revisions: RevisionItem[];
  passed: boolean;
  subjectOrder?: number;
}

interface StudentRevision {
  studentId: number;
  inscriptionId: number;
  studentName: string;
  document: string;
  documentType?: string;
  grade: string;
  gradeId?: number;
  gradeOrder?: number;
  section: string;
  subjects: StudentSubject[];
}

interface GradeSubjectColumn {
  subjectId: number;
  subjectName: string;
  abbreviation: string;
  subjectOrder: number;
}

const RepairPeriodManagement: React.FC = () => {
  const { user } = useAuth();
  const isMaster = user?.roles.includes('Master');
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [students, setStudents] = useState<StudentRevision[]>([]);
  const [isPreview, setIsPreview] = useState(false);
  const [gradeSubjects, setGradeSubjects] = useState<Record<number, GradeSubjectColumn[]>>({});
  const [activePeriodId, setActivePeriodId] = useState<number | null>(null);
  const [maxOppInput, setMaxOppInput] = useState<number>(3);
  const [maxOppSaving, setMaxOppSaving] = useState(false);
  const [pendingOpp, setPendingOpp] = useState<number | null>(null);

  // View state: 'opportunity' shows a single opportunity, 'final' shows definitive
  const [nominaView, setNominaView] = useState<'opportunity' | 'final'>('opportunity');
  const [selectedOpp, setSelectedOpp] = useState<number>(1);

  // Inline edit state: keyed by revisionId
  const [editValues, setEditValues] = useState<Record<number, number | null>>({});
  const [editAbsent, setEditAbsent] = useState<Record<number, boolean>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  // Opportunity dates map: keyed by `${periodGradeSubjectId}-${sectionId}` → [{opportunity, date}]
  const [oppDatesMap, setOppDatesMap] = useState<Record<string, { opportunity: number; date: string | null }[]>>({});

  const canOverride = user?.roles.includes('Control de Estudios') || isMaster;

  const fetchData = async () => {
    setLoading(true);
    try {
      const periodsRes = await api.get('/academic/periods');
      const activePeriod = (periodsRes.data as any[]).find((p: any) => p.status === 'activo');
      if (!activePeriod) {
        message.warning('No hay un período activo');
        setLoading(false);
        return;
      }
      setActivePeriodId(activePeriod.id);

      const [summaryRes, studentsRes] = await Promise.all([
        api.get(`/revision-periods/${activePeriod.id}`),
        api.get(`/revision-periods/${activePeriod.id}/students`),
      ]);
      setSummary(summaryRes.data);
      setSelectedOpp((previous) => {
        const current = summaryRes.data.revisionPeriod?.currentOpportunity ?? 1;
        return previous <= current ? previous : current;
      });
      setStudents(studentsRes.data.students || []);
      setIsPreview(studentsRes.data.isPreview || false);
      setGradeSubjects(studentsRes.data.gradeSubjects || {});
      setMaxOppInput(summaryRes.data.revisionPeriod?.maxOpportunities ?? 3);
    } catch (error: any) {
      console.error('[RepairPeriodManagement] Error:', error);
      message.error(error?.response?.data?.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Fetch opportunity dates for all subjects+sections in the current view
  const fetchOppDates = useCallback(async () => {
    if (!students.length || !summary?.revisionPeriod) return;
    const pgsSectionPairs = new Set<string>();
    // We need periodGradeSubjectId for each subject. The students endpoint
    // doesn't return it, so we fetch from the revision-grades endpoint
    // which returns opportunity dates per pgsId+sectionId.
    // For simplicity, fetch all opportunity dates for the active period
    // by querying per unique grade+section combination.
    // Actually, the API needs pgsId + sectionId. We don't have pgsId here.
    // Let's fetch from the revision-grades opportunity-dates endpoint
    // which accepts pgsId + sectionId as query params.
    // Since we don't have pgsId in the student data, we'll skip dates
    // for now and rely on gradedAt from the revision items.
    // TODO: if opportunity dates are needed in headers, the students
    // endpoint should include them.
  }, [students, summary]);

  useEffect(() => { fetchOppDates(); }, [fetchOppDates]);

  const handleOpen = async () => {
    if (!activePeriodId) return;
    setActing(true);
    try {
      const res = await api.post(`/revision-periods/${activePeriodId}/open`);
      message.success(res.data.message || 'Período de revisión abierto');
      await fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al abrir');
    } finally {
      setActing(false);
    }
  };

  const handleComplete = async () => {
    if (!activePeriodId) return;
    setActing(true);
    try {
      const res = await api.post(`/revision-periods/${activePeriodId}/complete`);
      message.success(res.data.message || 'Período de revisión completado');
      await fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al completar');
    } finally {
      setActing(false);
    }
  };

  const handleLock = async () => {
    if (!activePeriodId) return;
    setActing(true);
    try {
      const res = await api.post(`/revision-periods/${activePeriodId}/lock`);
      message.success(res.data.message || 'Período de revisión bloqueado');
      await fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al bloquear');
    } finally {
      setActing(false);
    }
  };

  const handleRecalculate = async () => {
    if (!activePeriodId) return;
    setActing(true);
    try {
      const res = await api.post(`/revision-periods/${activePeriodId}/recalculate`);
      message.success(res.data.message || 'Recálculo completado');
      await fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al recalcular');
    } finally {
      setActing(false);
    }
  };

  const handleReset = async () => {
    if (!activePeriodId) return;
    setActing(true);
    try {
      const res = await api.post(`/revision-periods/${activePeriodId}/reset`);
      message.success(res.data.message || 'Período reiniciado');
      await fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al reiniciar');
    } finally {
      setActing(false);
    }
  };

  const handleReopen = async () => {
    if (!activePeriodId) return;
    setActing(true);
    try {
      const res = await api.post(`/revision-periods/${activePeriodId}/reopen`);
      message.success(res.data.message || 'Período de revisión reabierto');
      await fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al reabrir');
    } finally {
      setActing(false);
    }
  };

  const handleSaveMaxOpp = async () => {
    if (!activePeriodId) return;
    setMaxOppSaving(true);
    try {
      const res = await api.put(`/revision-periods/${activePeriodId}/max-opportunities`, {
        maxOpportunities: maxOppInput,
      });
      message.success(res.data.message || 'Número de intentos actualizado');
      await fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al actualizar intentos');
    } finally {
      setMaxOppSaving(false);
    }
  };

  const handleSetOpportunity = async (opp: number) => {
    if (!activePeriodId) return;
    setPendingOpp(opp);
    setActing(true);
    try {
      const res = await api.post(`/revision-periods/${activePeriodId}/advance-opportunity`, { opportunity: opp });
      message.success(res.data.message || `Oportunidad ${opp} habilitada`);
      await fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al habilitar oportunidad');
    } finally {
      setActing(false);
      setPendingOpp(null);
    }
  };

  const handleExportExcel = async () => {
    if (!activePeriodId) return;
    try {
      const res = await api.get(`/revision-periods/${activePeriodId}/export-nomina`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const disposition = res.headers['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
      link.setAttribute('download', filenameMatch ? filenameMatch[1] : 'revision-nomina.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al generar Excel de revisión');
    }
  };

  const [finalizing, setFinalizing] = useState(false);
  const handleFinalizeRevisionGrades = async (checked: boolean) => {
    if (!activePeriodId) return;
    setFinalizing(true);
    try {
      if (checked) {
        const res = await api.post(`/revision-periods/${activePeriodId}/finalize-revision-grades`);
        message.success(res.data.message || 'Notas de revisión finalizadas');
      } else {
        const res = await api.post(`/revision-periods/${activePeriodId}/unfinalize-revision-grades`);
        message.success(res.data.message || 'Revisión marcada como no completada');
      }
      await fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al actualizar estado de revisión');
    } finally {
      setFinalizing(false);
    }
  };

  // Inline save for a revision grade (used by Control de Estudios)
  const handleSaveInline = async (revisionId: number, score: number | null, isAbsent: boolean) => {
    if (!activePeriodId) return;
    setSavingIds(prev => new Set(prev).add(revisionId));
    try {
      await api.put(
        `/revision-periods/${activePeriodId}/revisions/${revisionId}/override`,
        {
          score: isAbsent ? 0 : score,
          isAbsent,
        }
      );
      message.success('Nota guardada');
      setEditValues(prev => { const n = { ...prev }; delete n[revisionId]; return n; });
      setEditAbsent(prev => { const n = { ...prev }; delete n[revisionId]; return n; });
      await fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al guardar nota');
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(revisionId); return n; });
    }
  };

  const statusColor: Record<string, string> = {
    pending: 'default',
    open: 'processing',
    completed: 'success',
    closed: 'error',
  };
  const statusLabel: Record<string, string> = {
    pending: 'Pendiente',
    open: 'Abierto',
    completed: 'Completado',
    closed: 'Bloqueado',
  };

  // Group students by grade and build subject columns per grade from the
  // full grade subject list returned by the backend (all active subjects of
  // the grade in canonical order). Each student only has data in the
  // subjects they need to review; the rest are rendered as disabled cells.
  const gradeGroups = useMemo(() => {
    const groups = new Map<string, { grade: string; students: StudentRevision[]; subjects: StudentSubject[] }>();
    for (const s of students) {
      const gradeKey = s.grade || 'Sin grado';
      if (!groups.has(gradeKey)) {
        // Use the full grade subject list as columns
        const gid = s.gradeId ?? 0;
        const gradeCols = gradeSubjects[gid] || [];
        const subjects: StudentSubject[] = gradeCols.map((col) => ({
          inscriptionSubjectId: 0,
          subjectName: col.subjectName,
          abbreviation: col.abbreviation,
          originalScore: null,
          originalStatus: null,
          maxOpportunities: s.subjects[0]?.maxOpportunities ?? 3,
          revisions: [],
          passed: true,
          subjectOrder: col.subjectOrder,
        }));
        groups.set(gradeKey, { grade: gradeKey, students: [], subjects });
      }
      const g = groups.get(gradeKey)!;
      g.students.push(s);
    }
    // Sort students within each grade canonically (document type → document number → lastName → firstName)
    for (const g of groups.values()) {
      g.students.sort((a, b) => compareStudents(
        { document: a.document, documentType: a.documentType, lastName: a.studentName, firstName: '' },
        { document: b.document, documentType: b.documentType, lastName: b.studentName, firstName: '' }
      ));
    }
    return Array.from(groups.values()).sort((a, b) => {
      const orderA = a.students[0]?.gradeOrder ?? 999;
      const orderB = b.students[0]?.gradeOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.grade.localeCompare(b.grade, 'es', { numeric: true });
    });
  }, [students, gradeSubjects]);

  // Helper: determine if a revision's NP is "real" (should display NP)
  const isRealAbsent = (rev: RevisionItem | undefined, currentOpp: number): boolean => {
    if (!rev) return false;
    const isExplicitlyGradedZero = rev.score !== null && rev.score !== undefined && Number(rev.score) === 0 && rev.gradedBy != null;
    const isAutoAbsentPassed = rev.isAbsent === true && rev.gradedBy == null && rev.opportunity < currentOpp;
    return isExplicitlyGradedZero || isAutoAbsentPassed;
  };

  // Helper: find the "meaningful" revision for the final view
  const findFinalRevision = (revisions: RevisionItem[], currentOpp: number): RevisionItem | undefined => {
    return [...revisions].reverse().find((rev) => {
      if (rev.score !== null && rev.score !== undefined) return true;
      if (rev.isAbsent === true && rev.gradedBy == null && rev.opportunity < currentOpp) return true;
      return false;
    });
  };

  const currentOpp = summary?.revisionPeriod?.currentOpportunity ?? 1;
  const periodEditable = summary?.revisionPeriod && (summary.revisionPeriod.status === 'open' || summary.revisionPeriod.status === 'completed');

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Período de Revisión</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Actualizar</Button>
      </div>

      <Spin spinning={loading}>
        {summary && (
          <>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Estado"
                    value={statusLabel[summary.revisionPeriod?.status || 'pending']}
                    valueStyle={{ color: summary.revisionPeriod?.status === 'open' ? '#1677ff' : summary.revisionPeriod?.status === 'completed' ? '#52c41a' : summary.revisionPeriod?.status === 'closed' ? '#ff4d4f' : '#666' }}
                    prefix={summary.revisionPeriod?.status === 'open' ? <CheckCircleOutlined /> : summary.revisionPeriod?.status === 'completed' ? <CheckCircleOutlined /> : summary.revisionPeriod?.status === 'closed' ? <CloseCircleOutlined /> : <ClockCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="Consejos completos" value={`${summary.councilStatus.doneChecklists}/${summary.councilStatus.totalChecklists}`}
                    valueStyle={{ color: summary.councilStatus.allDone ? '#52c41a' : '#faad14' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="Lapsos bloqueados" value={`${summary.termsStatus?.blockedTerms ?? 0}/${summary.termsStatus?.totalTerms ?? 0}`}
                    valueStyle={{ color: summary.termsStatus?.allBlocked ? '#52c41a' : '#faad14' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="Estudiantes en revisión" value={summary.stats?.totalStudents || 0} />
                </Card>
              </Col>
            </Row>

            {summary.revisionPeriod && summary.revisionPeriod.status !== 'pending' && summary.revisionPeriod.status !== 'closed' && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Space>
                  <Text strong>Número de intentos:</Text>
                  <InputNumber
                    min={1}
                    max={10}
                    value={maxOppInput}
                    onChange={(v) => setMaxOppInput(v ?? 3)}
                    style={{ width: 80 }}
                  />
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={handleSaveMaxOpp}
                    loading={maxOppSaving}
                    size="small"
                  >
                    Guardar
                  </Button>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    (Aplica a todas las materias en revisión)
                  </Text>
                </Space>
              </Card>
            )}

            {(!summary.revisionPeriod || summary.revisionPeriod.status === 'pending') && (
              <Alert
                type="info"
                message="El período de revisión aún no ha sido abierto"
                description="Asegúrese de que todos los lapsos estén bloqueados y todos los consejos de curso estén completos antes de abrirlo."
                showIcon
                action={
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleOpen} loading={acting}
                    disabled={!summary.councilStatus.allDone || !summary.termsStatus?.allBlocked}>
                    Abrir período de revisión
                  </Button>
                }
                style={{ marginBottom: 16 }}
              />
            )}

            {summary.revisionPeriod?.status === 'open' && (
              <>
              <Alert
                type="success"
                message="Período de revisión abierto"
                description="Los profesores pueden calificar las reparaciones. Cuando todos los estudiantes estén calificados, marque el período como completado para que las notas estén disponibles."
                showIcon
                action={
                  <Space wrap>
                    <Button type="primary" icon={<ReloadOutlined />} onClick={fetchData}>Actualizar</Button>
                    <Button icon={<RetweetOutlined />} onClick={handleRecalculate} loading={acting}>Recalcular</Button>
                    <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleComplete} loading={acting}>Completar período</Button>
                    <Popconfirm
                      title="¿Bloquear el período de revisión?"
                      description="El período se bloqueará y no se podrán editar las notas. Podrá reabrirlo posteriormente."
                      okText="Sí, bloquear"
                      cancelText="Cancelar"
                      onConfirm={handleLock}
                    >
                      <Button danger icon={<LockOutlined />} loading={acting}>Bloquear</Button>
                    </Popconfirm>
                    {isMaster && (
                      <Popconfirm
                        title="¿Reiniciar el período de revisión?"
                        description="Se eliminarán TODOS los registros de revisión y el período volverá a estado pendiente. Esta acción no se puede deshacer."
                        okText="Sí, reiniciar"
                        cancelText="Cancelar"
                        okButtonProps={{ danger: true }}
                        onConfirm={handleReset}
                      >
                        <Button danger type="dashed" icon={<UndoOutlined />} loading={acting}>Reiniciar (Master)</Button>
                      </Popconfirm>
                    )}
                  </Space>
                }
                style={{ marginBottom: 16 }}
              />

              </>
            )}

            {summary.revisionPeriod?.status === 'completed' && (
              <Alert
                type="success"
                message="Período de revisión completado"
                description={`Completado el ${summary.revisionPeriod.completedAt ? new Date(summary.revisionPeriod.completedAt).toLocaleDateString() : '—'}. Las notas de revisión están disponibles para boletines y cálculos. Puede bloquear el período para evitar ediciones.`}
                showIcon
                action={
                  <Space wrap>
                    <Button danger icon={<StopOutlined />} onClick={handleLock} loading={acting}>Bloquear período</Button>
                    <Button type="primary" icon={<UnlockOutlined />} onClick={handleReopen} loading={acting}>Reabrir</Button>
                    {isMaster && (
                      <Popconfirm
                        title="¿Reiniciar el período de revisión?"
                        description="Se eliminarán TODOS los registros de revisión y el período volverá a estado pendiente. Esta acción no se puede deshacer."
                        okText="Sí, reiniciar"
                        cancelText="Cancelar"
                        okButtonProps={{ danger: true }}
                        onConfirm={handleReset}
                      >
                        <Button danger type="dashed" icon={<UndoOutlined />} loading={acting}>Reiniciar (Master)</Button>
                      </Popconfirm>
                    )}
                  </Space>
                }
                style={{ marginBottom: 16 }}
              />
            )}

            {summary.revisionPeriod?.status === 'closed' && (
              <Alert
                type="error"
                message="Período de revisión bloqueado"
                description={`Bloqueado el ${summary.revisionPeriod.closedAt ? new Date(summary.revisionPeriod.closedAt).toLocaleDateString() : '—'}. El período de revisión está bloqueado y no admite más ediciones.`}
                showIcon
                action={
                  <Space wrap>
                    <Button type="primary" icon={<UnlockOutlined />} onClick={handleReopen} loading={acting}>Reabrir</Button>
                    {isMaster ? (
                    <Popconfirm
                      title="¿Reiniciar el período de revisión?"
                      description="Se eliminarán TODOS los registros de revisión y el período volverá a estado pendiente. Esta acción no se puede deshacer."
                      okText="Sí, reiniciar"
                      cancelText="Cancelar"
                      okButtonProps={{ danger: true }}
                      onConfirm={handleReset}
                    >
                      <Button danger type="dashed" icon={<UndoOutlined />} loading={acting}>Reiniciar (Master)</Button>
                    </Popconfirm>
                  ) : undefined
                }
                  </Space>
                }
                style={{ marginBottom: 16 }}
              />
            )}

            <Card title={
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Space>
                    <span>Estudiantes en revisión</span>
                    {isPreview && <Tag color="orange">Vista previa</Tag>}
                    {canOverride && !isPreview && periodEditable && nominaView === 'opportunity' && selectedOpp <= currentOpp && (
                      <Tag color="gold" icon={<EditOutlined />}>Editable</Tag>
                    )}
                  </Space>
                  <Space>
                    <Button icon={<PrinterOutlined />} onClick={handleExportExcel} loading={loading} style={{ marginTop: 15 }}>
                      Imprimir
                    </Button>
                    <Checkbox
                      checked={summary?.revisionPeriod?.gradesFinalized === true}
                      disabled={isPreview || !canOverride || finalizing}
                      onChange={(e) => handleFinalizeRevisionGrades(e.target.checked)}
                      style={{
                        marginTop: 15,
                        fontWeight: 800,
                        fontSize: 13,
                        padding: '6px 14px',
                        borderRadius: 10,
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        background: summary?.revisionPeriod?.gradesFinalized ? '#f6ffed' : '#fff',
                        border: `2px solid ${summary?.revisionPeriod?.gradesFinalized ? '#52c41a' : '#d9d9d9'}`,
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {summary?.revisionPeriod?.gradesFinalized ? (
                        <span style={{ color: '#389e0d', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircleOutlined /> Revisión completada
                        </span>
                      ) : (
                        'Marcar como completada'
                      )}
                    </Checkbox>
                  </Space>
                </Space>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Segmented
                    value={nominaView}
                    onChange={(v) => setNominaView(v as 'opportunity' | 'final')}
                    options={[
                      { label: 'Por Oportunidad', value: 'opportunity' },
                      { label: 'Nota Final', value: 'final' },
                    ]}
                    size="small"
                  />
                  {nominaView === 'opportunity' && (
                    <Space wrap size={[4, 4]} className="repair-opportunity-row">
                      <Text strong style={{ fontSize: 12 }}>Oportunidad:</Text>
                      {Array.from({ length: summary.revisionPeriod?.maxOpportunities || 1 }, (_, i) => i + 1).map(opp => {
                        const isSelected = selectedOpp === opp;
                        const isActive = currentOpp === opp;
                        const isFuture = opp > currentOpp;
                        const canActivate = summary.revisionPeriod?.status === 'open' && !isActive;
                        return (
                          <div
                            key={opp}
                            className={`repair-opportunity-chip${isSelected ? ' selected' : ''}${isActive ? ' active' : ''}${isFuture ? ' future' : ''}`}
                            onClick={() => setSelectedOpp(opp)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedOpp(opp);
                              }
                            }}
                            aria-label={`Ver Oportunidad ${opp}${isActive ? ' (activa)' : ''}`}
                          >
                            <span className="repair-opportunity-number">{opp}°</span>
                            {isActive && <span className="repair-opportunity-active-dot" />}
                            <Popconfirm
                              title={`¿Desea habilitar la Oportunidad ${opp}?`}
                              description={opp < currentOpp
                                ? 'Esta oportunidad ya pasó. Los profesores ya no podrán editar las oportunidades anteriores.'
                                : 'Solo los profesores podrán calificar la nueva oportunidad activa.'}
                              okText="Sí, habilitar"
                              cancelText="Cancelar"
                              onConfirm={() => handleSetOpportunity(opp)}
                              disabled={!canActivate}
                            >
                              <Button
                                type="text"
                                size="small"
                                className="repair-opportunity-lock"
                                icon={isActive ? <UnlockOutlined /> : <LockOutlined />}
                                loading={acting && pendingOpp === opp}
                                disabled={!canActivate}
                                onClick={(event) => event.stopPropagation()}
                                aria-label={isActive ? `Oportunidad ${opp} activa` : `Activar Oportunidad ${opp}`}
                              />
                            </Popconfirm>
                          </div>
                        );
                      })}
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Activa: <Text strong style={{ fontSize: 11, color: '#52c41a' }}>Oportunidad {currentOpp}</Text>
                        {selectedOpp !== currentOpp && (
                          <> — Viendo: <Text strong style={{ fontSize: 11 }}>Oportunidad {selectedOpp}</Text></>
                        )}
                        <span style={{ marginLeft: 8, color: '#999' }}>Candado: activar oportunidad</span>
                      </Text>
                    </Space>
                  )}
                  {nominaView === 'final' && (
                    <div className="repair-opportunity-row repair-opportunity-row-placeholder" />
                  )}
                </Space>
              </Space>
            } style={{ marginTop: 16 }} styles={{ body: { padding: 0 } }}>
              <div className="repair-sheet-container">
                {gradeGroups.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                    No hay estudiantes en revisión
                  </div>
                ) : (
                  <Tabs
                    defaultActiveKey={gradeGroups[0]?.grade}
                    tabPosition="top"
                    size="small"
                    tabBarGutter={0}
                    items={gradeGroups.map((group) => ({
                      key: group.grade,
                      label: (
                        <Space>
                          <span style={{ fontWeight: 700, fontSize: 12 }}>{group.grade}</span>
                          <Tag>{group.students.length} estudiantes</Tag>
                        </Space>
                      ),
                      children: (
                        <div className="repair-grade-section">
                          <table className="repair-sheet">
                            <thead>
                              <tr>
                                <th className="repair-col-idx">#</th>
                                <th className="repair-col-doc">Cédula</th>
                                <th className="repair-col-name">Apellidos y Nombres</th>
                                <th className="repair-col-section">Sección</th>
                                {group.subjects.map((subj) => (
                                  <th key={subj.abbreviation} className="repair-col-subj" title={subj.subjectName}>
                                    <div>{subj.abbreviation}</div>
                                    {/* Reserve space for date + opportunity line */}
                                    <div className="repair-col-meta">
                                      <span className="repair-col-date">&nbsp;</span>
                                      {nominaView === 'final' && <span className="repair-col-opp">&nbsp;</span>}
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {group.students.map((student, idx) => (
                                <tr key={student.studentId}>
                                  <td className="repair-cell-idx">{idx + 1}</td>
                                  <td className="repair-cell-doc">{student.document}</td>
                                  <td className="repair-cell-name">{student.studentName}</td>
                                  <td className="repair-cell-section">{student.section || '—'}</td>
                                  {group.subjects.map((subj) => {
                                    const studentSubj = student.subjects.find(
                                      (sub) => sub.subjectName === subj.subjectName
                                    );
                                    if (!studentSubj || isPreview) {
                                      return <td key={subj.abbreviation} className="repair-cell-filled" />;
                                    }

                                    const revisions = [...studentSubj.revisions].sort((a, b) => a.opportunity - b.opportunity);
                                    const approvedBefore = nominaView === 'opportunity' && revisions.some(
                                      (rev) => rev.opportunity < selectedOpp && rev.status === 'approved'
                                    );

                                    // Find the revision to display
                                    const selectedRevision = nominaView === 'final'
                                      ? findFinalRevision(revisions, currentOpp)
                                      : revisions.find((rev) => rev.opportunity === selectedOpp);

                                    const absent = isRealAbsent(selectedRevision, currentOpp);

                                    if (approvedBefore) {
                                      return <td key={subj.abbreviation} className="repair-cell-closed" />;
                                    }

                                    // Determine if this cell is editable
                                    const cellEditable = canOverride
                                      && !isPreview
                                      && periodEditable
                                      && nominaView === 'opportunity'
                                      && selectedOpp <= currentOpp
                                      && !!selectedRevision;

                                    // Display value
                                    const editKey = selectedRevision?.id;
                                    const editValue = editKey != null ? editValues[editKey] : undefined;
                                    const editAbs = editKey != null ? editAbsent[editKey] : undefined;
                                    const displayScore = editValue !== undefined ? editValue : (selectedRevision?.score != null ? Number(selectedRevision.score) : null);
                                    const displayAbsent = editAbs !== undefined ? editAbs : absent;
                                    const isSaving = editKey != null && savingIds.has(editKey);

                                    // Date and opportunity for the meta line
                                    const gradedDate = selectedRevision?.gradedAt
                                      ? dayjs(selectedRevision.gradedAt).format('DD/MM/YY')
                                      : '';
                                    const gradedOpp = selectedRevision?.opportunity;

                                    const graderTooltip = selectedRevision?.graderName
                                      ? `Calificado por: ${selectedRevision.graderName}${selectedRevision.gradedAt ? ` — ${new Date(selectedRevision.gradedAt).toLocaleString()}` : ''}`
                                      : null;

                                    if (cellEditable && editKey != null) {
                                      // Editable cell with inline input
                                      return (
                                        <td
                                          key={subj.abbreviation}
                                          className="repair-cell-editable"
                                          title={graderTooltip || 'Editable'}
                                        >
                                          <div className="repair-cell-content">
                                            {displayAbsent ? (
                                              <span
                                                className="repair-np"
                                                onClick={() => {
                                                  // Click NP to clear it
                                                  setEditAbsent(prev => ({ ...prev, [editKey]: false }));
                                                  setEditValues(prev => ({ ...prev, [editKey]: null }));
                                                }}
                                                title="Click para quitar NP"
                                              >
                                                NP
                                              </span>
                                            ) : (
                                              <input
                                                type="number"
                                                min={0}
                                                max={20}
                                                step={1}
                                                inputMode="numeric"
                                                className="repair-input"
                                                value={displayScore ?? ''}
                                                disabled={isSaving}
                                                onChange={e => {
                                                  const v = e.target.value === '' ? null : Number(e.target.value);
                                                  setEditValues(prev => ({ ...prev, [editKey]: v }));
                                                  if (v === 0) {
                                                    setEditAbsent(prev => ({ ...prev, [editKey]: true }));
                                                  } else if (v !== null) {
                                                    setEditAbsent(prev => ({ ...prev, [editKey]: false }));
                                                  }
                                                }}
                                                onBlur={() => {
                                                  if (editValue !== undefined) {
                                                    if (editValue === null && !displayAbsent) {
                                                      // Clearing — skip
                                                    } else if (editValue !== null || displayAbsent) {
                                                      handleSaveInline(editKey, editValue, displayAbsent);
                                                    }
                                                  }
                                                }}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    (e.target as HTMLInputElement).blur();
                                                  }
                                                }}
                                              />
                                            )}
                                          </div>
                                          <div className="repair-cell-meta">
                                            <span className="repair-col-date">{gradedDate}</span>
                                            {nominaView === 'final' && <span className="repair-col-opp">{gradedOpp ? `O${gradedOpp}` : ''}</span>}
                                          </div>
                                        </td>
                                      );
                                    }

                                    // Read-only cell
                                    const displayText = !selectedRevision
                                      ? ''
                                      : (displayAbsent
                                        ? 'NP'
                                        : selectedRevision.score !== null && selectedRevision.score !== undefined
                                          ? String(Number(selectedRevision.score))
                                          : '—');

                                    return (
                                      <td
                                        key={subj.abbreviation}
                                        className="repair-cell-blank"
                                        title={graderTooltip || undefined}
                                      >
                                        <div className="repair-cell-content">
                                          <span className={displayAbsent ? 'repair-fail' : (selectedRevision && selectedRevision.score != null && Number(selectedRevision.score) >= (summary.revisionPeriod?.passingGrade ?? 10) ? 'repair-pass' : '')}>
                                            {displayText}
                                          </span>
                                        </div>
                                        <div className="repair-cell-meta">
                                          <span className="repair-col-date">{gradedDate}</span>
                                          {nominaView === 'final' && <span className="repair-col-opp">{gradedOpp ? `O${gradedOpp}` : ''}</span>}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ),
                    }))}
                  />
                )}

              </div>
            </Card>
          </>
        )}
      </Spin>

      <style>{`
        .repair-sheet-container {
          overflow-x: auto;
        }
        .repair-grade-section {
          margin-bottom: 24px;
        }
        .repair-sheet {
          border-collapse: collapse;
          width: 100%;
          font-size: 11px;
        }
        .repair-sheet th,
        .repair-sheet td {
          border: 1px solid #d9d9d9;
          padding: 0;
          text-align: center;
          vertical-align: middle;
        }
        .repair-sheet thead th {
          background: #fafafa;
          font-weight: 700;
          padding: 4px 2px;
          font-size: 10px;
          line-height: 1.2;
        }
        .repair-col-idx { width: 32px; min-width: 32px; }
        .repair-col-name { width: 200px; min-width: 160px; text-align: left !important; padding: 4px 8px 4px 25px !important; }
        .repair-col-doc { width: 80px; min-width: 70px; }
        .repair-col-section { width: 64px; min-width: 56px; }
        .repair-col-subj { width: 52px; min-width: 48px; max-width: 60px; }
        .repair-col-meta {
          display: flex;
          flex-direction: column;
          gap: 0;
          align-items: center;
          min-height: 22px;
        }
        .repair-col-date {
          font-size: 8px;
          font-weight: 400;
          color: #999;
          line-height: 1.2;
        }
        .repair-col-opp {
          font-size: 8px;
          font-weight: 600;
          color: #1677ff;
          line-height: 1.2;
        }
        .repair-cell-idx { font-weight: 600; color: #666; height: 22px; }
        .repair-cell-name { text-align: left !important; padding: 2px 8px 2px 25px !important; font-weight: 500; }
        .repair-cell-doc { font-size: 10px; color: #666; }
        .repair-cell-section { width: 64px; min-width: 56px; font-size: 10px; color: #666; }
        .repair-cell-filled,
        .repair-cell-closed {
          background: #e8e8e8;
          height: 22px;
        }
        .repair-cell-blank {
          background: #fff;
          font-weight: 600;
        }
        .repair-cell-content {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 22px;
        }
        .repair-cell-meta {
          display: flex;
          flex-direction: column;
          gap: 0;
          align-items: center;
          min-height: 22px;
          padding-bottom: 1px;
        }
        .repair-cell-meta .repair-col-date {
          font-size: 8px;
          font-weight: 400;
          color: #999;
          line-height: 1.2;
        }
        .repair-cell-meta .repair-col-opp {
          font-size: 8px;
          font-weight: 600;
          color: #1677ff;
          line-height: 1.2;
        }
        .repair-opportunity-row {
          width: 100%;
          padding: 2px 0;
          min-height: 32px;
        }
        .repair-opportunity-row-placeholder {
          visibility: hidden;
        }
        .repair-opportunity-chip {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          min-height: 28px;
          padding: 1px 3px 1px 9px;
          border: 1px solid #d9d9d9;
          border-radius: 6px;
          background: #fff;
          cursor: pointer;
          transition: all 0.15s;
          position: relative;
        }
        .repair-opportunity-chip:hover {
          border-color: #1677ff;
          background: #f0f7ff;
        }
        .repair-opportunity-chip.selected {
          border-color: #1677ff;
          background: #1677ff;
          color: #fff;
        }
        .repair-opportunity-chip.active {
          border-color: #52c41a;
          border-width: 2px;
          box-shadow: 0 0 0 2px rgba(82, 196, 26, 0.2);
        }
        .repair-opportunity-chip.active.selected {
          border-color: #52c41a;
          background: #1677ff;
        }
        .repair-opportunity-chip.future {
          opacity: 0.6;
        }
        .repair-opportunity-active-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #52c41a;
          display: inline-block;
          box-shadow: 0 0 4px rgba(82, 196, 26, 0.6);
        }
        .repair-opportunity-chip.selected .repair-opportunity-active-dot {
          background: #b7eb8f;
          box-shadow: 0 0 4px rgba(255, 255, 255, 0.6);
        }
        .repair-opportunity-number {
          min-width: 22px;
          text-align: center;
          font-size: 12px;
          font-weight: 700;
        }
        .repair-opportunity-lock {
          width: 22px;
          height: 22px;
          padding: 0 !important;
          color: #ff4d4f !important;
        }
        .repair-opportunity-chip.selected .repair-opportunity-lock {
          color: #fff !important;
        }
        .repair-opportunity-chip:not(.selected) .repair-opportunity-lock:disabled {
          color: #bfbfbf !important;
        }
        .repair-cell-editable {
          background: #fffbe6;
          font-weight: 600;
          transition: background 0.15s;
        }
        .repair-cell-editable:hover {
          background: #ffe58f;
        }
        .repair-input {
          width: 100%;
          height: 22px;
          border: none;
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          background: transparent;
          outline: none;
          padding: 0;
          -moz-appearance: textfield;
        }
        .repair-input::-webkit-outer-spin-button,
        .repair-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .repair-input:focus {
          background: #fff;
          box-shadow: inset 0 0 0 1px #1677ff;
        }
        .repair-np {
          color: #ff4d4f;
          font-weight: 900;
          font-size: 12px;
          cursor: pointer;
          padding: 0 4px;
        }
        .repair-pass {
          color: #52c41a;
          font-weight: 900;
          font-size: 12px;
        }
        .repair-fail {
          color: #ff4d4f;
          font-weight: 900;
          font-size: 12px;
        }

        @media print {
          .repair-sheet-container { overflow: visible; }
          .repair-grade-section { page-break-after: always; }
          .repair-grade-section:last-child { page-break-after: auto; }
          .repair-sheet { font-size: 10px; }
          .repair-sheet th, .repair-sheet td { border: 1px solid #999; }
          .repair-cell-filled, .repair-cell-closed { background: #e0e0e0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .repair-input { border: none !important; }
        }
      `}</style>
    </div>
  );
};

export default RepairPeriodManagement;
