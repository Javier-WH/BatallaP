import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Tag, Space, Typography, Spin, message, Alert, Statistic, Row, Col, Popconfirm, Tabs, InputNumber } from 'antd';
import { PlayCircleOutlined, StopOutlined, ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, PrinterOutlined, RetweetOutlined, UndoOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
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
}

interface StudentRevision {
  studentId: number;
  inscriptionId: number;
  studentName: string;
  document: string;
  documentType?: string;
  grade: string;
  gradeOrder?: number;
  section: string;
  subjects: StudentSubject[];
}

const RepairPeriodManagement: React.FC = () => {
  const { user } = useAuth();
  const isMaster = user?.roles.includes('Master');
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [students, setStudents] = useState<StudentRevision[]>([]);
  const [isPreview, setIsPreview] = useState(false);
  const [activePeriodId, setActivePeriodId] = useState<number | null>(null);
  const [maxOppInput, setMaxOppInput] = useState<number>(3);
  const [maxOppSaving, setMaxOppSaving] = useState(false);
  const [pendingOpp, setPendingOpp] = useState<number | null>(null);
  const [selectedView, setSelectedView] = useState<number | 'final'>(1);

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
      setSelectedView((previous) => previous === 1
        ? (summaryRes.data.revisionPeriod?.currentOpportunity ?? 1)
        : previous);
      setStudents(studentsRes.data.students || []);
      setIsPreview(studentsRes.data.isPreview || false);
      setMaxOppInput(summaryRes.data.revisionPeriod?.maxOpportunities ?? 3);
    } catch (error: any) {
      console.error('[RepairPeriodManagement] Error:', error);
      message.error(error?.response?.data?.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpen = async () => {
    if (!activePeriodId) return;
    setActing(true);
    try {
      const res = await api.post(`/revision-periods/${activePeriodId}/open`);
      message.success(res.data.message || 'Período de reparación abierto');
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
      message.success(res.data.message || 'Período de reparación completado');
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
      message.success(res.data.message || 'Período de reparación bloqueado');
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
      message.success(res.data.message || 'Período de reparación reabierto');
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

  // Group students by grade and build subject list per grade (in configured order)
  const gradeGroups = useMemo(() => {
    const groups = new Map<string, { grade: string; students: StudentRevision[]; subjects: StudentSubject[] }>();
    for (const s of students) {
      const gradeKey = s.grade || 'Sin grado';
      if (!groups.has(gradeKey)) {
        groups.set(gradeKey, { grade: gradeKey, students: [], subjects: [] });
      }
      const g = groups.get(gradeKey)!;
      g.students.push(s);
      // Collect unique subjects by abbreviation (preserve first-seen order)
      for (const subj of s.subjects) {
        if (!g.subjects.find(x => x.abbreviation === subj.abbreviation)) {
          g.subjects.push(subj);
        }
      }
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
  }, [students]);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Período de Reparación</Title>
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
                  <Statistic title="Estudiantes en reparación" value={summary.stats?.totalStudents || 0} />
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
                    (Aplica a todas las materias en reparación)
                  </Text>
                </Space>
              </Card>
            )}

            {(!summary.revisionPeriod || summary.revisionPeriod.status === 'pending') && (
              <Alert
                type="info"
                message="El período de reparación aún no ha sido abierto"
                description="Asegúrese de que todos los lapsos estén bloqueados y todos los consejos de curso estén completos antes de abrirlo."
                showIcon
                action={
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleOpen} loading={acting}
                    disabled={!summary.councilStatus.allDone || !summary.termsStatus?.allBlocked}>
                    Abrir período de reparación
                  </Button>
                }
                style={{ marginBottom: 16 }}
              />
            )}

            {summary.revisionPeriod?.status === 'open' && (
              <>
              <Alert
                type="success"
                message="Período de reparación abierto"
                description="Los profesores pueden calificar las reparaciones. Cuando todos los estudiantes estén calificados, marque el período como completado para que las notas estén disponibles."
                showIcon
                action={
                  <Space wrap>
                    <Button type="primary" icon={<ReloadOutlined />} onClick={fetchData}>Actualizar</Button>
                    <Button icon={<RetweetOutlined />} onClick={handleRecalculate} loading={acting}>Recalcular</Button>
                    <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleComplete} loading={acting}>Completar período</Button>
                    <Popconfirm
                      title="¿Bloquear el período de reparación?"
                      description="El período se bloqueará y no se podrán editar las notas. Podrá reabrirlo posteriormente."
                      okText="Sí, bloquear"
                      cancelText="Cancelar"
                      onConfirm={handleLock}
                    >
                      <Button danger icon={<LockOutlined />} loading={acting}>Bloquear</Button>
                    </Popconfirm>
                    {isMaster && (
                      <Popconfirm
                        title="¿Reiniciar el período de reparación?"
                        description="Se eliminarán TODOS los registros de reparación y el período volverá a estado pendiente. Esta acción no se puede deshacer."
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

              {/* Opportunity selector — radio buttons styled as buttons */}
              <Card size="small" style={{ marginBottom: 16 }}>
                <Tabs
                  activeKey={String(selectedView)}
                  onChange={(key) => setSelectedView(key === 'final' ? 'final' : Number(key))}
                  size="small"
                  tabBarGutter={0}
                  items={[
                    ...Array.from({ length: summary.revisionPeriod?.maxOpportunities || 1 }, (_, i) => ({
                      key: String(i + 1),
                      label: `Oport. ${i + 1}`,
                    })),
                    { key: 'final', label: 'Nota definitiva' },
                  ]}
                  style={{ marginBottom: 8 }}
                />
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space>
                    <Text strong style={{ fontSize: 14 }}>Habilitar oportunidad:</Text>
                    <Tag color="blue" style={{ fontSize: 13, padding: '2px 10px' }}>
                      Activa: {summary.revisionPeriod.currentOpportunity} de {summary.revisionPeriod.maxOpportunities}
                    </Tag>
                  </Space>
                  <Space wrap>
                    {Array.from({ length: summary.revisionPeriod?.maxOpportunities || 1 }, (_, i) => i + 1).map(opp => {
                      const current = summary.revisionPeriod?.currentOpportunity ?? 1;
                      const isActive = opp === current;
                      const isPast = opp < current;
                      const isFuture = opp > current;
                      return (
                        <Popconfirm
                          key={opp}
                          title={`¿Desea habilitar la Oportunidad ${opp}?`}
                          description={isPast
                            ? 'Esta oportunidad ya pasó. Los profesores ya no podrán editar las oportunidades anteriores.'
                            : isFuture
                              ? 'Los profesores no podrán editar las oportunidades anteriores. Solo podrán calificar la nueva oportunidad activa.'
                              : 'Esta oportunidad ya está activa.'}
                          okText="Sí, habilitar"
                          cancelText="Cancelar"
                          onConfirm={() => handleSetOpportunity(opp)}
                          disabled={isActive}
                        >
                          <Button
                            type={isActive ? 'primary' : isPast ? 'default' : 'dashed'}
                            disabled={isActive}
                            loading={acting && pendingOpp === opp}
                            style={{
                              fontWeight: 700,
                              minWidth: 120,
                              ...(isActive ? {} : isPast ? { opacity: 0.6 } : {}),
                            }}
                            icon={isActive ? <CheckCircleOutlined /> : isPast ? <LockOutlined /> : <UnlockOutlined />}
                          >
                            Oportunidad {opp}
                            {isActive && ' (Activa)'}
                            {isPast && ' (Pasada)'}
                          </Button>
                        </Popconfirm>
                      );
                    })}
                  </Space>
                </Space>
              </Card>
              </>
            )}

            {summary.revisionPeriod?.status === 'completed' && (
              <Alert
                type="success"
                message="Período de reparación completado"
                description={`Completado el ${summary.revisionPeriod.completedAt ? new Date(summary.revisionPeriod.completedAt).toLocaleDateString() : '—'}. Las notas de reparación están disponibles para boletines y cálculos. Puede bloquear el período para evitar ediciones.`}
                showIcon
                action={
                  <Space wrap>
                    <Button danger icon={<StopOutlined />} onClick={handleLock} loading={acting}>Bloquear período</Button>
                    <Button type="primary" icon={<UnlockOutlined />} onClick={handleReopen} loading={acting}>Reabrir</Button>
                    {isMaster && (
                      <Popconfirm
                        title="¿Reiniciar el período de reparación?"
                        description="Se eliminarán TODOS los registros de reparación y el período volverá a estado pendiente. Esta acción no se puede deshacer."
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
                message="Período de reparación bloqueado"
                description={`Bloqueado el ${summary.revisionPeriod.closedAt ? new Date(summary.revisionPeriod.closedAt).toLocaleDateString() : '—'}. El período de reparación está bloqueado y no admite más ediciones.`}
                showIcon
                action={
                  <Space wrap>
                    <Button type="primary" icon={<UnlockOutlined />} onClick={handleReopen} loading={acting}>Reabrir</Button>
                    {isMaster ? (
                    <Popconfirm
                      title="¿Reiniciar el período de reparación?"
                      description="Se eliminarán TODOS los registros de reparación y el período volverá a estado pendiente. Esta acción no se puede deshacer."
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
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Space>
                  <span>Estudiantes en reparación</span>
                  {isPreview && <Tag color="orange">Vista previa</Tag>}
                </Space>
                <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                  Imprimir
                </Button>
              </Space>
            } style={{ marginTop: 16 }} styles={{ body: { padding: 0 } }}>
              <div className="repair-sheet-container">
                {gradeGroups.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                    No hay estudiantes en reparación
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
                                    {subj.abbreviation}
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
                                      (sub) => sub.abbreviation === subj.abbreviation
                                    );
                                    if (!studentSubj || isPreview) {
                                      return <td key={subj.abbreviation} className="repair-cell-filled" />;
                                    }

                                    const revisions = [...studentSubj.revisions].sort((a, b) => a.opportunity - b.opportunity);
                                    const approvedBefore = selectedView !== 'final' && revisions.some(
                                      (revision) => revision.opportunity < selectedView && revision.status === 'approved'
                                    );
                                    const selectedRevision = selectedView === 'final'
                                      ? [...revisions].reverse().find((revision) =>
                                        revision.isAbsent === true || (revision.score !== null && revision.score !== undefined)
                                      )
                                      : revisions.find((revision) => revision.opportunity === selectedView);
                                    const isAbsent = selectedRevision?.isAbsent === true || (
                                      selectedRevision?.score !== null &&
                                      selectedRevision?.score !== undefined &&
                                      Number(selectedRevision.score) === 0
                                    );

                                    if (approvedBefore) {
                                      return <td key={subj.abbreviation} className="repair-cell-closed" />;
                                    }
                                    return (
                                      <td key={subj.abbreviation} className="repair-cell-blank">
                                        {selectedRevision && (isAbsent
                                          ? 'NP'
                                          : selectedRevision.score !== null && selectedRevision.score !== undefined
                                            ? String(Number(selectedRevision.score))
                                            : '—')}
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
        .repair-grade-title {
          font-size: 14px;
          font-weight: 700;
          padding: 8px 12px;
          background: #f0f5ff;
          border: 1px solid #d6e4ff;
          border-bottom: none;
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
        .repair-col-subj { width: 42px; min-width: 38px; max-width: 50px; }
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
          height: 22px;
          font-weight: 600;
        }
        .repair-pass {
          color: #52c41a;
          font-weight: 900;
          font-size: 14px;
        }
        .repair-fail {
          color: #ff4d4f;
          font-weight: 900;
          font-size: 14px;
        }
        .repair-score-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
          align-items: center;
        }
        .repair-score-tag {
          font-size: 9px;
          font-weight: 600;
          padding: 0 3px;
          border-radius: 2px;
          line-height: 1.4;
        }
        .repair-score-tag.approved { color: #389e0d; background: #f6ffed; }
        .repair-score-tag.failed { color: #cf1322; background: #fff1f0; }
        .repair-score-tag.pending { color: #666; background: #f5f5f5; }

        @media print {
          .repair-sheet-container { overflow: visible; }
          .repair-grade-section { page-break-after: always; }
          .repair-grade-section:last-child { page-break-after: auto; }
          .repair-sheet { font-size: 10px; }
          .repair-sheet th, .repair-sheet td { border: 1px solid #999; }
          .repair-cell-filled { background: #e0e0e0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .repair-grade-title { background: #f0f5ff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
};

export default RepairPeriodManagement;
