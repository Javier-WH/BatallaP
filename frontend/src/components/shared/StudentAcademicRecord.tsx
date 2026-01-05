import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Typography,
  Collapse,
  Tag,
  Space,
  Spin,
  Empty,
  Card,
  Progress,
  Alert,
  Row,
  Col,
  Statistic,
  Tooltip,
  Badge
} from 'antd';
import {
  FileTextOutlined,
  CalendarOutlined,
  BookOutlined,
  UsergroupAddOutlined,
  TeamOutlined,
  SolutionOutlined,
  AlertOutlined,
  DeploymentUnitOutlined
} from '@ant-design/icons';
import api from '@/services/api';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface StudentAcademicRecordProps {
  personId?: number;
  mode?: 'student' | 'admin';
}

interface SubjectGroup {
  name: string;
}

interface SubjectInfo {
  name: string;
  subjectGroup?: SubjectGroup | null;
}

interface EvaluationPlan {
  termId?: number;
  percentage?: number;
}

interface Qualification {
  id: number;
  score: number | string;
  evaluationPlan?: EvaluationPlan | null;
}

interface InscriptionSubject {
  id: number;
  subject?: SubjectInfo | null;
  qualifications?: Qualification[];
}

interface AcademicRecord {
  id: number;
  period?: { name: string } | null;
  grade?: { name: string } | null;
  section?: { name: string } | null;
  inscriptionSubjects: InscriptionSubject[];
}

interface ActiveSchoolPeriod {
  id: number;
  name: string;
  period?: string;
  startYear?: number;
  endYear?: number;
}

interface GradeCatalogItem {
  id: number;
  name: string;
}

interface PeriodStructureEntry {
  id: number;
  grade?: { id: number; name: string } | null;
  sections?: { id: number; name: string }[];
  subjects?: { id: number; name: string; subjectGroupId?: number | null }[];
}

interface TeacherRecordLite {
  id: number;
  teachingAssignments?: { id: number }[];
}

interface StudentGuardianLite {
  isRepresentative?: boolean;
  profile?: { id?: number; document?: string } | null;
}

interface InscriptionRecordLite {
  id: number;
  section?: { id: number; name: string } | null;
  subjects?: { id: number }[] | null;
  student?: {
    guardians?: StudentGuardianLite[];
  };
}

interface MatriculationRecordLite {
  id: number;
  status?: 'pending' | 'completed' | string;
}

interface AdminOverviewData {
  period: ActiveSchoolPeriod;
  counts: {
    representatives: number;
    totalTeachers: number;
    teachersWithoutAssignments: number;
    studentsWithoutSection: number;
    studentsWithoutSubjects: number;
  };
  students: {
    total: number;
    matriculated: number;
    pending: number;
  };
  coverage: {
    percentage: number;
    configuredGrades: number;
    totalGrades: number;
    missingGrades: string[];
    gradesWithoutSections: string[];
    gradesWithoutSubjects: string[];
  };
  alerts: string[];
}

const StudentAcademicRecord: React.FC<StudentAcademicRecordProps> = ({ personId, mode = 'student' }) => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AcademicRecord[]>([]);
  const [maxGrade, setMaxGrade] = useState<number>(20);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminData, setAdminData] = useState<AdminOverviewData | null>(null);

  useEffect(() => {
    if (mode !== 'student') return;
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings/max_grade');
        if (res.data?.value) setMaxGrade(Number(res.data.value));
      } catch {
        // Silently use default max_grade of 20 if endpoint doesn't exist
        setMaxGrade(20);
      }
    };
    fetchSettings();
  }, [mode]);

  useEffect(() => {
    if (mode !== 'student' || !personId) {
      setRecords([]);
      return;
    }
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/evaluation/student-record/${personId}`);
        setRecords(res.data);
      } catch (error) {
        console.error('Error fetching academic record', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [personId, mode]);

  const loadAdminSnapshot = useCallback(async () => {
    setAdminLoading(true);
    setAdminError(null);
    try {
      const periodRes = await api.get<ActiveSchoolPeriod | null>('/academic/periods/active');
      const activePeriod = periodRes.data;
      if (!activePeriod?.id) {
        setAdminData(null);
        return;
      }

      const [
        structureRes,
        gradesRes,
        inscriptionsRes,
        pendingMatriculationsRes,
        teachersRes
      ] = await Promise.all([
        api.get<PeriodStructureEntry[]>(`/academic/structure/${activePeriod.id}`),
        api.get<GradeCatalogItem[]>('/academic/grades'),
        api.get<InscriptionRecordLite[]>('/inscriptions', { params: { schoolPeriodId: activePeriod.id } }),
        api.get<MatriculationRecordLite[]>('/matriculations', { params: { schoolPeriodId: activePeriod.id, status: 'pending' } }),
        api.get<TeacherRecordLite[]>('/teachers', { params: { schoolPeriodId: activePeriod.id } })
      ]);

      const structure = structureRes.data ?? [];
      const gradeCatalog = gradesRes.data ?? [];
      const inscriptions = inscriptionsRes.data ?? [];
      const pendingMatriculationsList = pendingMatriculationsRes.data ?? [];
      const teachers = teachersRes.data ?? [];

      const matriculatedCount = inscriptions.length;
      const pendingMatriculations = pendingMatriculationsList.length;
      const totalStudents = matriculatedCount + pendingMatriculations;
      const teachersWithoutAssignments = teachers.filter(t => !t.teachingAssignments || t.teachingAssignments.length === 0).length;
      const representativeSet = new Set<string>();
      inscriptions.forEach(inscription => {
        inscription.student?.guardians?.forEach(guardian => {
          if (guardian.isRepresentative) {
            const uniqueId = guardian.profile?.id ? `profile-${guardian.profile.id}` : guardian.profile?.document || `ins-${inscription.id}`;
            representativeSet.add(uniqueId);
          }
        });
      });

      const studentsWithoutSection = inscriptions.filter(ins => !ins.section).length;
      const studentsWithoutSubjects = inscriptions.filter(ins => !ins.subjects || ins.subjects.length === 0).length;

      const configuredGradeIds = new Set(
        structure
          .map(entry => entry.grade?.id)
          .filter((id): id is number => typeof id === 'number')
      );
      const totalGrades = gradeCatalog.length;
      const missingGrades = gradeCatalog
        .filter(grade => !configuredGradeIds.has(grade.id))
        .map(grade => grade.name);
      const gradesWithoutSections = structure
        .filter(entry => entry.grade && (!entry.sections || entry.sections.length === 0))
        .map(entry => entry.grade?.name ?? `ID ${entry.id}`);
      const gradesWithoutSubjects = structure
        .filter(entry => entry.grade && (!entry.subjects || entry.subjects.length === 0))
        .map(entry => entry.grade?.name ?? `ID ${entry.id}`);

      const coveragePercentage = totalGrades === 0 ? 0 : (configuredGradeIds.size / totalGrades) * 100;

      const alerts: string[] = [];
      if (missingGrades.length) {
        alerts.push(`Faltan ${missingGrades.length} grados por configurar: ${missingGrades.join(', ')}`);
      }
      if (gradesWithoutSections.length) {
        alerts.push(`Hay ${gradesWithoutSections.length} grados sin secciones asignadas.`);
      }
      if (gradesWithoutSubjects.length) {
        alerts.push(`Hay ${gradesWithoutSubjects.length} grados sin materias configuradas.`);
      }
      if (studentsWithoutSection > 0) {
        alerts.push(`${studentsWithoutSection} alumnos inscritos no tienen sección definida.`);
      }
      if (studentsWithoutSubjects > 0) {
        alerts.push(`${studentsWithoutSubjects} alumnos están inscritos sin materias asociadas.`);
      }

      setAdminData({
        period: activePeriod,
        counts: {
          representatives: representativeSet.size,
          totalTeachers: teachers.length,
          teachersWithoutAssignments,
          studentsWithoutSection,
          studentsWithoutSubjects
        },
        students: {
          total: totalStudents,
          matriculated: matriculatedCount,
          pending: pendingMatriculations
        },
        coverage: {
          percentage: Number(coveragePercentage.toFixed(1)),
          configuredGrades: configuredGradeIds.size,
          totalGrades,
          missingGrades,
          gradesWithoutSections,
          gradesWithoutSubjects
        },
        alerts
      });
    } catch (error) {
      console.error('Error building admin snapshot', error);
      setAdminError('No se pudieron cargar las métricas administrativas.');
    } finally {
      setAdminLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'admin') {
      loadAdminSnapshot();
    }
  }, [mode, loadAdminSnapshot]);

  const renderStudentRecord = () => {
    if (loading) {
      return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }
    if (!personId) {
      return (
        <div style={{ padding: '40px 0' }}>
          <Empty description="Selecciona un estudiante para ver su historial académico." />
        </div>
      );
    }
    if (records.length === 0) {
      return (
        <div style={{ padding: '40px 0' }}>
          <Empty description="No se encontraron registros académicos para este estudiante." />
        </div>
      );
    }

    return (
      <div className="animate-card delay-1" style={{ padding: '8px 0' }}>
        <style>{`
        .academic-collapse .ant-collapse-item {
          border: none !important;
          margin-bottom: 20px !important;
          background: transparent !important;
        }
        .academic-collapse .ant-collapse-header {
          padding: 20px 24px !important;
          background: #fff !important;
          border: 1px solid #f0f0f0 !important;
          border-radius: 16px !important;
          transition: all 0.3s ease !important;
          align-items: center !important;
        }
        .academic-collapse .ant-collapse-header:hover {
          border-color: #1890ff !important;
          box-shadow: 0 4px 15px rgba(0,0,0,0.04) !important;
        }
        .academic-collapse .ant-collapse-item-active > .ant-collapse-header {
          border-color: #1890ff !important;
          border-bottom-left-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
          box-shadow: 0 4px 15px rgba(24,144,255,0.05) !important;
        }
        .academic-collapse .ant-collapse-content {
          border: 1px solid #f0f0f0 !important;
          border-top: none !important;
          border-bottom-left-radius: 16px !important;
          border-bottom-right-radius: 16px !important;
          background: #fff !important;
        }

        .record-table .ant-table-thead > tr > th {
          background: #fafafa !important;
          font-weight: 700 !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          color: #8c8c8c !important;
          padding: 16px !important;
        }
        .record-table .ant-table-tbody > tr > td {
          padding: 16px !important;
        }

        .term-box {
          background: #fdfdfd;
          border: 1px solid #f5f5f5;
          border-radius: 8px;
          padding: 8px 12px;
          min-width: 85px;
          text-align: center;
        }
        .term-label {
          font-size: 10px;
          font-weight: 800;
          color: #bfbfbf;
          text-transform: uppercase;
          display: block;
          margin-bottom: 4px;
        }
        `}</style>

        <Title level={4} style={{ marginBottom: 24, paddingLeft: 8, fontWeight: 800 }}>
          <FileTextOutlined style={{ color: '#1890ff', marginRight: 12 }} />
          Historial de Calificaciones
        </Title>

        <Collapse defaultActiveKey={[records[0]?.id]} className="academic-collapse" accordion expandIcon={() => null}>
          {records.map(record => (
            <Panel
              key={record.id}
              header={
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '95%', alignItems: 'center' }}>
                  <Space size="middle">
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, background: '#e6f7ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid #91d5ff'
                    }}>
                      <CalendarOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                    </div>
                    <Space direction="vertical" size={0}>
                      <Text strong style={{ fontSize: 15, color: '#262626' }}>{record.period?.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>Año Escolar Legislado</Text>
                    </Space>
                  </Space>
                  <Space size="small">
                    <Tag color="blue" style={{ borderRadius: 6, fontWeight: 700, margin: 0, padding: '2px 10px', fontSize: 11 }}>{record.grade?.name?.toUpperCase()}</Tag>
                    <Tag color="processing" style={{ borderRadius: 6, fontWeight: 700, margin: 0, padding: '2px 10px', fontSize: 11 }}>SECCIÓN {record.section?.name}</Tag>
                  </Space>
                </div>
              }
            >
              <div style={{ padding: '8px 4px' }}>
                <Table<InscriptionSubject>
                  dataSource={record.inscriptionSubjects}
                  rowKey="id"
                  pagination={false}
                  className="record-table"
                  columns={[
                    {
                      title: 'Materia y Contenido',
                      key: 'subject',
                      width: '35%',
                      render: (_: string, recordItem) => {
                        const groupName = recordItem.subject?.subjectGroup?.name;
                        const displayName = groupName ?? recordItem.subject?.name;

                        return (
                          <Space size="middle">
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <BookOutlined style={{ color: '#8c8c8c' }} />
                            </div>
                            <Space direction="vertical" size={0}>
                              <Text strong style={{ color: '#262626', fontSize: 14 }}>{displayName}</Text>
                              {groupName && groupName !== recordItem.subject?.name && (
                                <Text type="secondary" style={{ fontSize: 11 }}>{recordItem.subject?.name}</Text>
                              )}
                            </Space>
                          </Space>
                        );
                      }
                    },
                    {
                      title: 'Rendimiento por Lapso',
                      key: 'terms',
                      render: (_: unknown, subject: InscriptionSubject) => {
                        const terms = [1, 2, 3];
                        return (
                          <Space size="middle">
                            {terms.map(t => {
                              const quals = subject.qualifications?.filter(q => q.evaluationPlan?.termId === t) || [];
                              const totalScore = quals.reduce((acc: number, q) => acc + (Number(q.score) * (Number(q.evaluationPlan?.percentage) / 100)), 0);
                              const hasNotes = quals.length > 0;

                              return (
                                <div key={t} className="term-box">
                                  <span className="term-label">Lapso {t}</span>
                                  {hasNotes ? (
                                    <Text strong style={{
                                      color: totalScore >= (maxGrade / 2) ? '#52c41a' : '#f5222d',
                                      fontSize: 14
                                    }}>
                                      {totalScore % 1 === 0 ? totalScore.toFixed(0) : totalScore.toFixed(2)}
                                    </Text>
                                  ) : (
                                    <Text style={{ color: '#d9d9d9' }}>—</Text>
                                  )}
                                </div>
                              );
                            })}
                          </Space>
                        );
                      }
                    },
                    {
                      title: 'Definitiva',
                      key: 'final',
                      align: 'center',
                      width: 120,
                      render: (_: unknown, subject: InscriptionSubject) => {
                        const quals = subject.qualifications || [];
                        const termScores = [1, 2, 3].map(t => {
                          const qL = quals.filter(q => q.evaluationPlan?.termId === t);
                          if (qL.length === 0) return null;
                          return qL.reduce((acc: number, q: Qualification) => acc + (Number(q.score) * (Number(q.evaluationPlan?.percentage) / 100)), 0);
                        }).filter(s => s !== null) as number[];

                        if (termScores.length === 0) return <Text type="secondary">—</Text>;
                        const avg = termScores.reduce((a, b) => a + b, 0) / termScores.length;

                        return (
                          <div style={{
                            background: avg >= (maxGrade / 2) ? '#e6f7ff' : '#fff1f0',
                            padding: '6px 0',
                            borderRadius: 8,
                            border: `1px solid ${avg >= (maxGrade / 2) ? '#91d5ff' : '#ffa39e'}`,
                            width: 60,
                            margin: '0 auto'
                          }}>
                            <Text strong style={{ color: avg >= (maxGrade / 2) ? '#1890ff' : '#f5222d', fontSize: 15 }}>
                              {avg % 1 === 0 ? avg.toFixed(0) : avg.toFixed(1)}
                            </Text>
                          </div>
                        );
                      }
                    }
                  ]}
                />
              </div>
            </Panel>
          ))}
        </Collapse>
      </div>
    );
  };

  const renderAdminDashboard = () => {
    const teacherCoverage = adminData
      ? (adminData.counts.totalTeachers === 0
        ? 0
        : Math.round(((adminData.counts.totalTeachers - adminData.counts.teachersWithoutAssignments) / adminData.counts.totalTeachers) * 100))
      : 0;

    if (adminLoading) {
      return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
    }

    if (adminError) {
      return (
        <Alert
          type="error"
          message="Panel administrativo"
          description={adminError}
          showIcon
          style={{ marginTop: 24 }}
        />
      );
    }

    if (!adminData) {
      return (
        <Empty
          description="Configura un período escolar activo para ver el panel administrativo."
          style={{ padding: '60px 0' }}
        />
      );
    }

    const metricCards = [
      {
        key: 'teachers',
        label: 'Profesores sin asignación',
        value: adminData.counts.teachersWithoutAssignments,
        icon: <TeamOutlined />,
        emphasis: `Cobertura ${teacherCoverage}%`
      },
      {
        key: 'representatives',
        label: 'Representantes registrados',
        value: adminData.counts.representatives,
        icon: <DeploymentUnitOutlined />,
        emphasis: `${adminData.counts.studentsWithoutSection} alumnos sin sección`
      }
    ];

    return (
      <div className="admin-ops-dashboard">
        <style>{`
          .admin-ops-dashboard {
            padding: 24px 0 48px;
          }
          .admin-ops-header {
            background: radial-gradient(circle at top left, #111827, #0a0f1c);
            border-radius: 28px;
            padding: 36px;
            color: #f8fafc;
            position: relative;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.45);
            margin-bottom: 32px;
          }
          .admin-ops-header::after {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at 80% 20%, rgba(59,130,246,0.35), transparent 55%);
          }
          .admin-ops-header-content {
            position: relative;
            z-index: 1;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .admin-ops-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
          }
          .admin-metric-card {
            border-radius: 20px !important;
            border: 1px solid rgba(15, 23, 42, 0.06) !important;
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08) !important;
            padding: 20px;
            position: relative;
            overflow: hidden;
          }
          .admin-metric-icon {
            width: 48px;
            height: 48px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            color: #111827;
            background: #f8fafc;
            border: 1px solid rgba(15, 23, 42, 0.08);
          }
          .structure-board {
            margin-top: 32px;
            border-radius: 28px;
            background: #ffffff;
            border: 1px solid rgba(15, 23, 42, 0.06);
            padding: 32px;
            box-shadow: 0 10px 35px rgba(15, 23, 42, 0.06);
          }
          .structure-badge-list {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
          }
          .structure-badge-list .ant-badge {
            background: #f3f4f6;
            border-radius: 999px;
            padding: 6px 14px;
          }
        `}</style>

        <div className="admin-ops-header">
          <div className="admin-ops-header-content">
            <Text style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4em', fontSize: 11, fontWeight: 700 }}>
              Panel Administrativo
            </Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 24 }}>
              <div>
                <Title level={2} style={{ color: '#f8fafc', margin: 0, fontWeight: 800 }}>
                  Panel Administrativo · {adminData.period.name}
                </Title>
                <Text style={{ color: '#cbd5f5', fontSize: 15 }}>
                  Monitoreo de inscripciones, matrículas y estructura académica del período activo.
                </Text>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text style={{ color: '#94a3b8', fontSize: 12 }}>Cobertura de grados configurados</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
                  <Progress
                    type="circle"
                    width={90}
                    percent={Number(adminData.coverage.percentage.toFixed(0))}
                    strokeColor="#38bdf8"
                    trailColor="rgba(255,255,255,0.15)"
                    format={percent => `${percent}%`}
                  />
                  <div>
                    <Text strong style={{ color: '#f8fafc', fontSize: 24 }}>{adminData.coverage.configuredGrades}/{adminData.coverage.totalGrades}</Text>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>Grados con estructura completa</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="student-summary-grid">
          <Card className="student-total-card" bordered={false}>
            <Space direction="vertical" size={4}>
              <span className="summary-label">Total de Estudiantes</span>
              <Text style={{ fontSize: 42, fontWeight: 800, color: '#0f172a' }}>{adminData.students.total}</Text>
              <Text style={{ color: '#64748b', fontSize: 13 }}>
                {adminData.students.matriculated} matriculados / {adminData.students.pending} por matricular
              </Text>
            </Space>
            <div className="student-kpi-pills">
              <Badge count={`${adminData.counts.studentsWithoutSubjects} sin materias`} />
              <Badge count={`${adminData.counts.studentsWithoutSection} sin sección`} />
            </div>
          </Card>
          <Card className="student-split-card" bordered={false}>
            <div className="split-icon matriculated">
              <SolutionOutlined />
            </div>
            <Space direction="vertical" size={2}>
              <span className="summary-label">Matriculados</span>
              <Text style={{ fontSize: 32, fontWeight: 800, color: '#0f172a' }}>{adminData.students.matriculated}</Text>
              <Text style={{ color: '#8c8c8c', fontSize: 12 }}>Estudiantes con inscripción confirmada</Text>
            </Space>
          </Card>
          <Card className="student-split-card pending" bordered={false}>
            <div className="split-icon pending">
              <UsergroupAddOutlined />
            </div>
            <Space direction="vertical" size={2}>
              <span className="summary-label">Inscritos por Matricular</span>
              <Text style={{ fontSize: 32, fontWeight: 800, color: '#0f172a' }}>{adminData.students.pending}</Text>
              <Text style={{ color: '#8c8c8c', fontSize: 12 }}>Listos para completar matrícula</Text>
            </Space>
          </Card>
        </div>

        <div className="admin-ops-grid">
          {metricCards.map(card => (
            <Card key={card.key} className="admin-metric-card" bordered={false}>
              <Space size="large">
                <div className="admin-metric-icon">{card.icon}</div>
                <div>
                  <Text style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#94a3b8', fontWeight: 700 }}>
                    {card.label}
                  </Text>
                  <Statistic value={card.value} valueStyle={{ fontWeight: 800, fontSize: 32, color: '#0f172a' }} />
                  <Text style={{ color: '#64748b', fontSize: 12 }}>{card.emphasis}</Text>
                </div>
              </Space>
            </Card>
          ))}
        </div>

        <div className="structure-board">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <AlertOutlined style={{ fontSize: 24, color: '#f97316' }} />
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 800 }}>Alertas de estructura académica</Title>
              <Text style={{ color: '#64748b' }}>Detectamos inconsistencias que podrían afectar la asignación de estudiantes.</Text>
            </div>
          </div>

          {adminData.alerts.length === 0 ? (
            <Alert
              type="success"
              message="La estructura del período está completa."
              description="Todos los grados configurados cuentan con secciones y materias definidas."
              showIcon
            />
          ) : (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {adminData.alerts.map((alertMessage, index) => (
                <Alert
                  key={`${alertMessage}-${index}`}
                  type="warning"
                  message={alertMessage}
                  showIcon
                />
              ))}
            </Space>
          )}

          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col xs={24} md={12}>
              <Card bordered={false} style={{ borderRadius: 20, background: '#0f172a', color: '#e2e8f0' }}>
                <Text style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3em', fontSize: 11 }}>
                  Grados faltantes
                </Text>
                <div style={{ marginTop: 12 }}>
                  {adminData.coverage.missingGrades.length ? (
                    <div className="structure-badge-list">
                      {adminData.coverage.missingGrades.map(name => (
                        <Badge key={name} count={name} style={{ background: 'rgba(255,255,255,0.1)', color: '#e2e8f0' }} />
                      ))}
                    </div>
                  ) : (
                    <Text>Todos los grados están configurados.</Text>
                  )}
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card bordered={false} style={{ borderRadius: 20, background: '#f8fafc' }}>
                <Text style={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3em', fontSize: 11 }}>
                  Grados sin secciones / materias
                </Text>
                <div style={{ marginTop: 12 }}>
                  <Tooltip
                    title="Listado de grados que necesitan al menos una sección asignada."
                    color="#0f172a"
                  >
                    <Text strong style={{ color: '#0f172a', display: 'block' }}>
                      {adminData.coverage.gradesWithoutSections.length || 0} sin secciones
                    </Text>
                  </Tooltip>
                  <Tooltip
                    title="Grados configurados sin materias definidas en el plan."
                    color="#0f172a"
                  >
                    <Text strong style={{ color: '#0f172a', display: 'block' }}>
                      {adminData.coverage.gradesWithoutSubjects.length || 0} sin materias
                    </Text>
                  </Tooltip>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    );
  };

  if (mode === 'admin') {
    return renderAdminDashboard();
  }

  return renderStudentRecord();
};

export default StudentAcademicRecord;
