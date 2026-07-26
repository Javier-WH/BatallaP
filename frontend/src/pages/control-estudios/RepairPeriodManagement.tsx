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
  originalScore: number | null;
  originalStatus: string | null;
  maxOpportunities: number;
  revisions: RevisionItem[];
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
      const activePeriod = (periodsRes.data as any[]).find((p: any) => p.isActive);
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

  const columns = [
    { title: 'Estudiante', dataIndex: 'studentName', key: 'studentName', sorter: (a: StudentRevision, b: StudentRevision) => a.studentName.localeCompare(b.studentName) },
    { title: 'Documento', dataIndex: 'document', key: 'document' },
    { title: 'Grado', dataIndex: 'grade', key: 'grade' },
    { title: 'Sección', dataIndex: 'section', key: 'section' },
    {
      title: 'Materias en reparación', dataIndex: 'subjects', key: 'subjects',
      render: (subjects: StudentSubject[]) => (
        <Space direction="vertical" size={2}>
          {subjects.map((s, i) => (
            <div key={i} style={{ fontSize: 12 }}>
              <Text strong>{s.subjectName}</Text>
              {' — '}
              <Text type="secondary">Original: {s.originalScore ?? '—'}</Text>
              {' | '}
              <Space size={4}>
                {s.revisions.map((r, j) => (
                  <Tag key={j} color={r.status === 'approved' ? 'success' : r.status === 'failed' ? 'error' : 'default'}>
                    Op{r.opportunity}: {r.score?.toFixed(2) ?? '—'}
                  </Tag>
                ))}
              </Space>
            </div>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 24 }}>Período de Reparación</Title>

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
                  <Statistic title="Estudiantes en reparación" value={summary.stats?.totalStudents || 0} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="Materias" value={`${summary.stats?.approvedCount || 0} aprobadas / ${summary.stats?.failedCount || 0} reprobadas / ${summary.stats?.pendingCount || 0} pendientes`}
                    valueStyle={{ fontSize: 16 }} />
                </Card>
              </Col>
            </Row>

            {summary.revisionPeriod?.status === 'pending' && (
              <Alert
                type="info"
                message="El período de reparación aún no ha sido abierto"
                description="Asegúrese de que todos los consejos de curso estén completos antes de abrirlo."
                showIcon
                action={
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleOpen} loading={acting}
                    disabled={!summary.councilStatus.allDone}>
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
