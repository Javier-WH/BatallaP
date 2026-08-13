import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Tag, Space, Typography, Spin, message, Alert, Descriptions, Statistic, Row, Col } from 'antd';
import { PlayCircleOutlined, StopOutlined, ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
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

  // Build dynamic columns: one per unique subject abbreviation
  const allSubjects = Array.from(
    new Map(
      students.flatMap(s => s.subjects).map(s => [s.abbreviation, s])
    ).values()
  );

  const columns: any[] = [
    { title: 'N°', key: 'idx', width: 50, fixed: 'left' as const, render: (_: any, __: any, idx: number) => idx + 1 },
    { title: 'Apellidos y Nombres', key: 'studentName', width: 220, fixed: 'left' as const,
      render: (_: any, record: StudentRevision) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{record.studentName}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.document} — {record.grade} {record.section}</Text>
        </Space>
      ),
    },
    ...allSubjects.map(s => ({
      title: (
        <div style={{ textAlign: 'center', fontSize: 11, lineHeight: 1.3 }}>
          <div style={{ fontWeight: 700 }}>{s.abbreviation}</div>
          {!isPreview && s.revisions.length > 0 && (
            <div style={{ color: '#888', fontSize: 10 }}>
              {s.revisions.map(r => (
                <Tag key={r.id} color={r.status === 'approved' ? 'success' : r.status === 'failed' ? 'error' : 'default'}
                  style={{ fontSize: 9, padding: '0 4px', margin: '1px' }}>
                  {r.score?.toFixed(1) ?? '—'}
                </Tag>
              ))}
            </div>
          )}
        </div>
      ),
      key: `subj_${s.abbreviation}`,
      width: 70,
      align: 'center' as const,
      render: (_: any, record: StudentRevision) => {
        const subj = record.subjects.find(sub => sub.abbreviation === s.abbreviation);
        if (!subj) return null;
        if (isPreview) {
          return <Text type="danger" style={{ fontSize: 18, fontWeight: 900 }}>✕</Text>;
        }
        const approved = subj.revisions.some(r => r.status === 'approved');
        const hasFailed = subj.revisions.some(r => r.status === 'failed');
        const pending = subj.revisions.some(r => r.status === 'pending');
        if (approved) return <Tag color="success" style={{ fontSize: 11 }}>✓</Tag>;
        if (pending) return <Tag color="default" style={{ fontSize: 11 }}>—</Tag>;
        if (hasFailed) return <Text type="danger" style={{ fontSize: 18, fontWeight: 900 }}>✕</Text>;
        return null;
      },
    })),
  ];

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
              <Space>
                <span>Estudiantes en reparación</span>
                {isPreview && <Tag color="orange">Vista previa</Tag>}
              </Space>
            } style={{ marginTop: 16 }}>
              <Table
                dataSource={students}
                columns={columns}
                rowKey="studentId"
                size="small"
                scroll={{ x: Math.max(400, allSubjects.length * 75 + 280) }}
                sticky={{ offsetHeader: 0 }}
                pagination={{ pageSize: 20 }}
                locale={{ emptyText: 'No hay estudiantes en reparación' }}
              />
            </Card>
          </>
        )}
      </Spin>
    </div>
  );
};

export default RepairPeriodManagement;
