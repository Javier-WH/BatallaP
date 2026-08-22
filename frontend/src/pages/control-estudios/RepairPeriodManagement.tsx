import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Tag, Space, Typography, Spin, message, Alert, Statistic, Row, Col } from 'antd';
import { PlayCircleOutlined, StopOutlined, ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, PrinterOutlined } from '@ant-design/icons';
import api from '@/services/api';

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
  status: 'pending' | 'open' | 'closed';
  maxOpportunities: number;
  passingGrade: number;
  openedAt: string | null;
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
  grade: string;
  section: string;
  subjects: StudentSubject[];
}

const RepairPeriodManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [students, setStudents] = useState<StudentRevision[]>([]);
  const [isPreview, setIsPreview] = useState(false);
  const [activePeriodId, setActivePeriodId] = useState<number | null>(null);

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
      setStudents(studentsRes.data.students || []);
      setIsPreview(studentsRes.data.isPreview || false);
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

  const handleClose = async () => {
    if (!activePeriodId) return;
    setActing(true);
    try {
      const res = await api.post(`/revision-periods/${activePeriodId}/close`);
      message.success(res.data.message || 'Período de reparación cerrado');
      await fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al cerrar');
    } finally {
      setActing(false);
    }
  };

  const statusColor: Record<string, string> = {
    pending: 'default',
    open: 'processing',
    closed: 'error',
  };
  const statusLabel: Record<string, string> = {
    pending: 'Pendiente',
    open: 'Abierto',
    closed: 'Cerrado',
  };

  // Group students by grade and build subject list per grade (in configured order)
  const gradeGroups = useMemo(() => {
    const groups = new Map<string, { grade: string; students: StudentRevision[]; subjects: StudentSubject[] }>();
    for (const s of students) {
      const gradeKey = s.grade;
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
    // Sort students within each grade by document
    for (const g of groups.values()) {
      g.students.sort((a, b) => (a.document || '').localeCompare(b.document || '', undefined, { numeric: true }));
    }
    return Array.from(groups.values()).sort((a, b) => a.grade.localeCompare(b.grade));
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
                    valueStyle={{ color: summary.revisionPeriod?.status === 'open' ? '#1677ff' : summary.revisionPeriod?.status === 'closed' ? '#ff4d4f' : '#666' }}
                    prefix={summary.revisionPeriod?.status === 'open' ? <CheckCircleOutlined /> : summary.revisionPeriod?.status === 'closed' ? <CloseCircleOutlined /> : <ClockCircleOutlined />}
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
              <Alert
                type="success"
                message="Período de reparación abierto"
                description="Los profesores pueden calificar las reparaciones. Cuando todos los estudiantes estén calificados, cierre el período para proceder al cierre escolar."
                showIcon
                action={
                  <Space>
                    <Button type="primary" icon={<ReloadOutlined />} onClick={fetchData}>Actualizar</Button>
                    <Button danger icon={<StopOutlined />} onClick={handleClose} loading={acting}>Cerrar período</Button>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              />
            )}

            {summary.revisionPeriod?.status === 'closed' && (
              <Alert
                type="error"
                message="Período de reparación cerrado"
                description={`Cerrado el ${summary.revisionPeriod.closedAt ? new Date(summary.revisionPeriod.closedAt).toLocaleDateString() : '—'}. Las notas de reparación serán aplicadas al ejecutar el cierre de período.`}
                showIcon
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
                  gradeGroups.map((group) => (
                    <div key={group.grade} className="repair-grade-section">
                      <div className="repair-grade-title">{group.grade}</div>
                      <table className="repair-sheet">
                        <thead>
                          <tr>
                            <th className="repair-col-idx">#</th>
                            <th className="repair-col-doc">Cédula</th>
                            <th className="repair-col-name">Apellidos y Nombres</th>
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
                              {group.subjects.map((subj) => {
                                const studentSubj = student.subjects.find(
                                  (sub) => sub.abbreviation === subj.abbreviation
                                );
                                // No revision in this subject → filled cell
                                if (!studentSubj) {
                                  return <td key={subj.abbreviation} className="repair-cell-filled" />;
                                }
                                // Has revision → blank cell (for writing or showing score)
                                if (isPreview) {
                                  return <td key={subj.abbreviation} className="repair-cell-blank" />;
                                }
                                const approved = studentSubj.revisions.some((r) => r.status === 'approved');
                                const pending = studentSubj.revisions.some((r) => r.status === 'pending');
                                const hasFailed = studentSubj.revisions.some((r) => r.status === 'failed');
                                return (
                                  <td key={subj.abbreviation} className="repair-cell-blank">
                                    {approved && <span className="repair-pass">✓</span>}
                                    {pending && (
                                      <span className="repair-score-list">
                                        {studentSubj.revisions.map((r) => (
                                          <span key={r.id} className={`repair-score-tag ${r.status}`}>
                                            {r.score != null ? r.score.toFixed(1) : '—'}
                                          </span>
                                        ))}
                                      </span>
                                    )}
                                    {hasFailed && !pending && <span className="repair-fail">✕</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
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
        .repair-col-subj { width: 42px; min-width: 38px; max-width: 50px; }
        .repair-cell-idx { font-weight: 600; color: #666; height: 28px; }
        .repair-cell-name { text-align: left !important; padding: 4px 8px 4px 25px !important; font-weight: 500; }
        .repair-cell-doc { font-size: 10px; color: #666; }
        .repair-cell-filled {
          background: #e8e8e8;
          height: 28px;
        }
        .repair-cell-blank {
          background: #fff;
          height: 28px;
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
