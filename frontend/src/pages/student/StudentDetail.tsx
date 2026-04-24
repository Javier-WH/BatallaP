import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button, Card, Typography, Space, Tabs, Descriptions, List, Spin, Empty, Tag, Row, Col, Drawer, message } from 'antd';
import { ArrowLeftOutlined, FileTextOutlined, SolutionOutlined, EditOutlined, PrinterOutlined } from '@ant-design/icons';
import { getPersonReports, type EnrollmentReportSummary } from '@/services/enrollmentReportService';
import EnrollmentReportModal from '@/components/pdf/EnrollmentReportModal';
import StudentAcademicRecord from '@/components/shared/StudentAcademicRecord';
import api from '@/services/api';
import dayjs from 'dayjs';
import { getEnrollmentQuestionsForPerson, type EnrollmentQuestionResponse } from '@/services/enrollmentQuestions';
import { useAuth } from '@/context/AuthContext';

const { Title, Text } = Typography;

interface GuardianProfile {
  firstName: string;
  lastName: string;
  documentType: string;
  document: string;
  phone?: string;
  email?: string;
  address?: string;
  residenceState?: string;
  residenceMunicipality?: string;
}

interface StudentGuardian {
  relationship: string;
  isRepresentative: boolean;
  profile: GuardianProfile;
}

interface StudentData {
  firstName: string;
  lastName: string;
  document: string;
  documentType: string;
  birthdate: string;
  gender: 'M' | 'F';
  residence?: {
    birthMunicipality?: string;
    birthState?: string;
    residenceParish?: string;
    residenceMunicipality?: string;
    residenceState?: string;
  };
  contact?: {
    phone1?: string;
    phone2?: string;
    email?: string;
    address?: string;
  };
  guardians?: StudentGuardian[];
  inscription?: {
    period?: { name: string };
    grade?: { name: string };
    section?: { name: string };
    createdAt: string;
  };
}

interface StudentDetailProps {
  personId?: number;
}

const StudentDetail: React.FC<StudentDetailProps> = ({ personId: propId }) => {
  const params = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Resolve personId from prop (if provided) or URL params
  const personId = propId ? String(propId) : params.personId;

  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [enrollmentQuestions, setEnrollmentQuestions] = useState<EnrollmentQuestionResponse[]>([]);
  const [reportsDrawerOpen, setReportsDrawerOpen] = useState(false);
  const [reports, setReports] = useState<EnrollmentReportSummary[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReportUuid, setSelectedReportUuid] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const canEdit = user?.roles?.some(role => ['Master', 'Administrador', 'Control de Estudios'].includes(role));

  const loadReports = useCallback(async () => {
    if (!personId) return;
    setReportsLoading(true);
    try {
      const data = await getPersonReports(Number(personId));
      setReports(data);
    } catch (error) {
      console.error('Error loading enrollment reports:', error);
      message.error('Error al cargar planillas de inscripción');
    } finally {
      setReportsLoading(false);
    }
  }, [personId]);

  const handleOpenReportsDrawer = () => {
    setReportsDrawerOpen(true);
    loadReports();
  };

  const handleViewReport = (uuid: string) => {
    setSelectedReportUuid(uuid);
    setReportModalOpen(true);
  };

  const handleEdit = () => {
    let prefix = '/admin';
    if (user?.roles?.includes('Master')) {
      prefix = '/master';
    } else if (user?.roles?.includes('Control de Estudios')) {
      prefix = '/control-estudios';
    }
    navigate(`${prefix}/edit/${personId}`, { state: { from: location.pathname } });
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!personId) return;
      setLoading(true);
      try {
        const [userRes, questionsRes] = await Promise.all([
          api.get(`/users/${personId}`),
          getEnrollmentQuestionsForPerson(Number(personId))
        ]);
        setStudentData(userRes.data);
        setEnrollmentQuestions(questionsRes);
      } catch (error) {
        console.error('Error fetching student details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [personId]);

  const renderDossier = () => {
    if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;
    if (!studentData) return <Empty description="No se encontraron datos del estudiante" />;

    const { guardians } = studentData;

    // Helper to find guardian by relationship
    const getGuardian = (rel: string) => {
      return guardians?.find((g: StudentGuardian) => g.relationship === rel);
    };

    const motherAssignment = getGuardian('mother');
    const fatherAssignment = getGuardian('father');
    const repAssignment = getGuardian('representative');

    const renderGuardianSection = (assignment: StudentGuardian | undefined, title: string, icon: React.ReactNode, accentColor: string) => {
      if (!assignment || !assignment.profile) return null;
      const { profile } = assignment;
      const isRep = assignment.isRepresentative;

      return (
        <Card
          size="small"
          className="inner-premium-card"
          title={
            <Space>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icon}
              </div>
              <Text strong style={{ color: '#0f172a', fontSize: 13, fontWeight: 700 }}>{title}</Text>
            </Space>
          }
          extra={isRep && <Tag color="warning" style={{ borderRadius: 6, fontWeight: 800, fontSize: 10, margin: 0 }}>REPRESENTANTE LEGAL</Tag>}
          style={{ marginBottom: 16 }}
          headStyle={{ borderBottom: '1px solid #f1f5f9', padding: '12px 20px' }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <Descriptions column={2} size="small" layout="vertical" className="dossier-descriptions">
            <Descriptions.Item label="Nombre Completo">{profile.firstName} {profile.lastName}</Descriptions.Item>
            <Descriptions.Item label="Identificación">{profile.documentType}-{profile.document}</Descriptions.Item>
            <Descriptions.Item label="Teléfono / Email">
              <Space direction="vertical" size={0}>
                <Text style={{ fontSize: 13, color: '#0f172a' }}>{profile.phone || 'N/A'}</Text>
                <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>{profile.email || 'Sin correo'}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Dirección">
              <Text style={{ fontSize: 13, color: '#0f172a' }}>{profile.address}</Text>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{profile.residenceMunicipality}, {profile.residenceState}</div>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      );
    };

    return (
      <div className="animate-card delay-1" style={{ padding: '0 4px' }}>
        <Row gutter={24}>
          <Col span={24} lg={12}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div className="section-title-bar" />
              <Title level={5} style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: 15 }}>Identidad Estudiantil</Title>
            </div>
            <Card className="inner-premium-card" style={{ marginBottom: 24 }} bodyStyle={{ padding: '20px 24px' }}>
              <Descriptions column={2} size="small" layout="vertical" className="dossier-descriptions">
                <Descriptions.Item label="Nombre">{studentData.firstName} {studentData.lastName}</Descriptions.Item>
                <Descriptions.Item label="Documento">{studentData.documentType}-{studentData.document || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Nacimiento">{studentData.birthdate ? dayjs(studentData.birthdate).format('DD MMMM, YYYY') : 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Género">{studentData.gender === 'M' ? 'Masculino' : 'Femenino'}</Descriptions.Item>
                <Descriptions.Item label="Lugar de Nacimiento" span={2}>
                  <Text style={{ fontSize: 13, color: '#0f172a' }}>{studentData.residence?.birthMunicipality}, {studentData.residence?.birthState}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div className="section-title-bar" />
              <Title level={5} style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: 15 }}>Contacto y Ubicación</Title>
            </div>
            <Card className="inner-premium-card" style={{ marginBottom: 24 }} bodyStyle={{ padding: '20px 24px' }}>
              <Descriptions column={2} size="small" layout="vertical" className="dossier-descriptions">
                <Descriptions.Item label="Teléfonos">{studentData.contact?.phone1 || 'N/A'} {studentData.contact?.phone2 ? ' / ' + studentData.contact?.phone2 : ''}</Descriptions.Item>
                <Descriptions.Item label="Email">{studentData.contact?.email || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Residencia" span={2}>
                  <Text style={{ fontSize: 13, color: '#0f172a' }}>{studentData.contact?.address}</Text>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{studentData.residence?.residenceParish}, {studentData.residence?.residenceMunicipality}, {studentData.residence?.residenceState}</div>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col span={24} lg={12}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div className="section-title-bar" />
              <Title level={5} style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: 15 }}>Grupo Familiar</Title>
            </div>
            {renderGuardianSection(motherAssignment, "Madre", <SolutionOutlined style={{ color: '#ffffff' }} />, '#fce7f3')}
            {renderGuardianSection(fatherAssignment, "Padre", <SolutionOutlined style={{ color: '#ffffff' }} />, '#dbeafe')}
            {repAssignment && repAssignment.relationship === 'representative' &&
              renderGuardianSection(repAssignment, "Representante (Detalle)", <SolutionOutlined style={{ color: '#ffffff' }} />, '#fef3c7')}

            {enrollmentQuestions.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 16 }}>
                  <div className="section-title-bar" />
                  <Title level={5} style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: 15 }}>Información Socio-Educativa</Title>
                </div>
                <Card className="inner-premium-card" styles={{ body: { padding: 0 } }}>
                  <List
                    size="small"
                    dataSource={enrollmentQuestions}
                    renderItem={(item) => (
                      <List.Item style={{ padding: '14px 24px', borderBottom: '1px solid #f1f5f9' }}>
                        <List.Item.Meta
                          title={<Text style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>{item.prompt}</Text>}
                          description={<Text strong style={{ color: '#0f172a', fontSize: 13 }}>{Array.isArray(item.answer) ? item.answer.join(', ') : (item.answer || '-')}</Text>}
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </>
            )}
          </Col>
        </Row>
      </div>
    );
  };

  const tabsItems = [
    {
      key: 'grades',
      label: (
        <span className="premium-tab-label">
          <FileTextOutlined /> Calificaciones
        </span>
      ),
      children: <StudentAcademicRecord personId={Number(personId)} />
    },
    {
      key: 'dossier',
      label: (
        <span className="premium-tab-label">
          <SolutionOutlined /> Expediente Digital
        </span>
      ),
      children: renderDossier()
    }
  ];

  return (
    <div style={{ padding: '24px 32px 48px' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-card {
          animation: fadeUp 0.6s cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        .delay-1 { animation-delay: 0.1s; }
        
        .premium-detail-card {
          border-radius: 20px !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 10px 40px rgba(15, 23, 42, 0.04) !important;
          overflow: hidden;
          background: #ffffff !important;
        }

        .inner-premium-card {
          border-radius: 14px !important;
          border: 1px solid #e2e8f0 !important;
          transition: all 0.3s ease;
          background: #ffffff !important;
        }
        .inner-premium-card:hover {
          border-color: #cbd5e1 !important;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04) !important;
        }

        .icon-wrapper-mini {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: #f0f5ff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }

        .premium-tabs .ant-tabs-nav::before {
          border-bottom: 1.5px solid #e2e8f0 !important;
        }
        .premium-tabs .ant-tabs-tab {
          padding: 16px 28px !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          transition: all 0.3s ease !important;
          color: #64748b !important;
          letter-spacing: 0.01em;
        }
        .premium-tabs .ant-tabs-tab:hover {
          color: #1e40af !important;
        }
        .premium-tabs .ant-tabs-tab-active {
          background: linear-gradient(180deg, transparent 95%, #1e40af 95%) !important;
        }
        .premium-tabs .ant-tabs-tab-active .premium-tab-label {
          color: #1e40af !important;
          font-weight: 700 !important;
        }
        .premium-tabs .ant-tabs-ink-bar {
          background: #1e40af !important;
          height: 2.5px !important;
          border-radius: 2px !important;
        }
        
        .dossier-descriptions .ant-descriptions-item-label {
          color: #94a3b8 !important;
          font-size: 10px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
          font-weight: 700 !important;
          padding-bottom: 6px !important;
        }
        .dossier-descriptions .ant-descriptions-item-content {
          font-weight: 600 !important;
          color: #0f172a !important;
          padding-bottom: 14px !important;
          font-size: 13px !important;
        }
        .section-title-bar {
          width: 3px;
          height: 16px;
          border-radius: 2px;
          background: #1e40af;
          flex-shrink: 0;
        }
      `}</style>

      {/* Header Section */}
      <div style={{ marginBottom: 32 }} className="animate-card">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Space size="middle" align="center">
              <Button
                shape="circle"
                size="large"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(-1)}
                style={{
                  boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#ffffff'
                }}
              />
              <div>
                <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a', fontSize: 28 }}>
                  Detalle del Estudiante
                </Title>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <Text style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>
                    {studentData ? `${studentData.firstName} ${studentData.lastName}` : 'Cargando...'}
                  </Text>
                  {studentData?.inscription && (
                    <>
                      <span style={{ color: '#cbd5e1', fontSize: 12 }}>|</span>
                      <Tag style={{ borderRadius: 8, fontWeight: 700, border: 'none', background: '#e0e7ff', color: '#1e40af', fontSize: 12, padding: '2px 10px' }}>
                        {studentData.inscription.grade?.name}
                      </Tag>
                      <Tag style={{ borderRadius: 8, fontWeight: 700, border: 'none', background: '#f1f5f9', color: '#475569', fontSize: 12, padding: '2px 10px' }}>
                        Sección {studentData.inscription.section?.name}
                      </Tag>
                    </>
                  )}
                </div>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                size="large"
                icon={<PrinterOutlined />}
                onClick={handleOpenReportsDrawer}
                style={{ borderRadius: 10, fontWeight: 700, padding: '0 20px', border: '1px solid #e2e8f0', background: '#ffffff', color: '#475569' }}
              >
                Planillas
              </Button>
              {canEdit && (
                <Button
                  size="large"
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={handleEdit}
                  style={{ borderRadius: 10, fontWeight: 700, padding: '0 20px', background: '#1e40af', boxShadow: '0 4px 14px rgba(30,64,175,0.25)' }}
                >
                  Editar
                </Button>
              )}
              <Button
                size="large"
                onClick={() => navigate(-1)}
                style={{ borderRadius: 10, fontWeight: 700, padding: '0 20px', border: '1px solid #e2e8f0', background: '#ffffff', color: '#475569' }}
              >
                Cerrar Vista
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Card className="premium-detail-card animate-card delay-1" styles={{ body: { padding: '8px 24px 24px' } }}>
        <Tabs
          defaultActiveKey="grades"
          items={tabsItems}
          className="premium-tabs"
        />
      </Card>

      <Drawer
        title="Planillas de Inscripción"
        open={reportsDrawerOpen}
        onClose={() => setReportsDrawerOpen(false)}
        width={420}
      >
        {reportsLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : reports.length === 0 ? (
          <Empty description="No hay planillas de inscripción generadas" />
        ) : (
          <List
            dataSource={reports}
            renderItem={(report) => {
              const snap = report.snapshotData;
              return (
                <List.Item
                  actions={[
                    <Button
                      key="view"
                      type="primary"
                      size="small"
                      icon={<PrinterOutlined />}
                      onClick={() => handleViewReport(report.uuid)}
                    >
                      Ver PDF
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color="blue" style={{ borderRadius: 6, fontWeight: 700 }}>
                          {snap?.period?.name}
                        </Tag>
                        <Tag color="processing" style={{ borderRadius: 6, fontWeight: 700 }}>
                          {snap?.grade?.name}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Generado: {new Date(report.createdAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 10 }}>
                          ID: {report.uuid.slice(0, 8)}...
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Drawer>

      <EnrollmentReportModal
        open={reportModalOpen}
        uuid={selectedReportUuid}
        onClose={() => { setReportModalOpen(false); setSelectedReportUuid(null); }}
      />
    </div>
  );
};

export default StudentDetail;
