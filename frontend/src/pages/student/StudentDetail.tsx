import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button, Card, Typography, Space, Tabs, Descriptions, List, Spin, Empty, Tag, Row, Col } from 'antd';
import { ArrowLeftOutlined, FileTextOutlined, SolutionOutlined, EditOutlined } from '@ant-design/icons';
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

  const canEdit = user?.roles?.some(role => ['Master', 'Administrador', 'Control de Estudios'].includes(role));

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

    const renderGuardianSection = (assignment: StudentGuardian | undefined, title: string, icon: React.ReactNode) => {
      if (!assignment || !assignment.profile) return null;
      const { profile } = assignment;
      const isRep = assignment.isRepresentative;

      return (
        <Card
          size="small"
          className="inner-premium-card"
          title={<Space><div className="icon-wrapper-mini">{icon}</div><Text strong>{title}</Text></Space>}
          extra={isRep && <Tag color="gold" style={{ borderRadius: 6, fontWeight: 800 }}>REPRESENTANTE LEGAL</Tag>}
          style={{ marginBottom: 16 }}
        >
          <Descriptions column={2} size="small" layout="vertical" className="dossier-descriptions">
            <Descriptions.Item label="Nombre Completo">{profile.firstName} {profile.lastName}</Descriptions.Item>
            <Descriptions.Item label="Identificación">{profile.documentType}-{profile.document}</Descriptions.Item>
            <Descriptions.Item label="Teléfono / Email">
              <Space direction="vertical" size={0}>
                <Text style={{ fontSize: 13 }}>{profile.phone || 'N/A'}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{profile.email || 'Sin correo'}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Dirección">
              <Text style={{ fontSize: 12 }}>{profile.address}</Text>
              <div style={{ fontSize: 10, color: '#8c8c8c' }}>{profile.residenceMunicipality}, {profile.residenceState}</div>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      );
    };

    return (
      <div className="animate-card delay-1" style={{ padding: '0 4px' }}>
        <Row gutter={24}>
          <Col span={24} lg={12}>
            <Title level={5} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 4, height: 18, background: '#1890ff', borderRadius: 2 }} />
              Identidad Estudiantil
            </Title>
            <Card className="inner-premium-card" style={{ marginBottom: 24 }}>
              <Descriptions column={2} size="small" layout="vertical" className="dossier-descriptions">
                <Descriptions.Item label="Nombre">{studentData.firstName} {studentData.lastName}</Descriptions.Item>
                <Descriptions.Item label="Documento">{studentData.documentType}-{studentData.document || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Nacimiento">{studentData.birthdate ? dayjs(studentData.birthdate).format('DD MMMM, YYYY') : 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Género">{studentData.gender === 'M' ? 'Masculino' : 'Femenino'}</Descriptions.Item>
                <Descriptions.Item label="Lugar de Nacimiento" span={2}>
                  <Text style={{ fontSize: 13 }}>{studentData.residence?.birthMunicipality}, {studentData.residence?.birthState}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Title level={5} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 4, height: 18, background: '#1890ff', borderRadius: 2 }} />
              Contacto y Ubicación
            </Title>
            <Card className="inner-premium-card" style={{ marginBottom: 24 }}>
              <Descriptions column={2} size="small" layout="vertical" className="dossier-descriptions">
                <Descriptions.Item label="Teléfonos">{studentData.contact?.phone1 || 'N/A'} {studentData.contact?.phone2 ? ' / ' + studentData.contact?.phone2 : ''}</Descriptions.Item>
                <Descriptions.Item label="Email">{studentData.contact?.email || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Residencia" span={2}>
                  <Text style={{ fontSize: 13 }}>{studentData.contact?.address}</Text>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>{studentData.residence?.residenceParish}, {studentData.residence?.residenceMunicipality}, {studentData.residence?.residenceState}</div>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col span={24} lg={12}>
            <Title level={5} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 4, height: 18, background: '#722ed1', borderRadius: 2 }} />
              Grupo Familiar
            </Title>
            {renderGuardianSection(motherAssignment, "Madre", <SolutionOutlined style={{ color: '#eb2f96' }} />)}
            {renderGuardianSection(fatherAssignment, "Padre", <SolutionOutlined style={{ color: '#1890ff' }} />)}
            {repAssignment && repAssignment.relationship === 'representative' &&
              renderGuardianSection(repAssignment, "Representante (Detalle)", <SolutionOutlined style={{ color: '#faad14' }} />)}

            {enrollmentQuestions.length > 0 && (
              <>
                <Title level={5} style={{ marginTop: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 4, height: 18, background: '#52c41a', borderRadius: 2 }} />
                  Información Socio-Educativa
                </Title>
                <Card className="inner-premium-card" styles={{ body: { padding: 0 } }}>
                  <List
                    size="small"
                    dataSource={enrollmentQuestions}
                    renderItem={(item) => (
                      <List.Item style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0' }}>
                        <List.Item.Meta
                          title={<Text style={{ fontSize: 12, color: '#8c8c8c', textTransform: 'uppercase', fontWeight: 600 }}>{item.prompt}</Text>}
                          description={<Text strong style={{ color: '#262626' }}>{Array.isArray(item.answer) ? item.answer.join(', ') : (item.answer || '-')}</Text>}
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
          border-radius: 24px !important;
          border: 1px solid rgba(0,0,0,0.06) !important;
          box-shadow: 0 10px 40px rgba(0,0,0,0.04) !important;
          overflow: hidden;
        }

        .inner-premium-card {
          border-radius: 16px !important;
          border: 1px solid #f0f0f0 !important;
          transition: all 0.3s ease;
        }
        .inner-premium-card:hover {
          border-color: #d9d9d9 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02) !important;
        }

        .icon-wrapper-mini {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: #f0f5ff;
          display: flex;
          alignItems: center;
          justifyContent: center;
          font-size: 12px;
        }

        .premium-tabs .ant-tabs-nav::before {
          border-bottom: 2px solid #f0f0f0 !important;
        }
        .premium-tabs .ant-tabs-tab {
          padding: 16px 24px !important;
          font-weight: 700 !important;
          font-size: 14px !important;
          transition: all 0.3s ease !important;
        }
        .premium-tabs .ant-tabs-tab-active .premium-tab-label {
          color: #1890ff;
        }
        
        .dossier-descriptions .ant-descriptions-item-label {
          color: #8c8c8c !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          font-weight: 700 !important;
          padding-bottom: 4px !important;
        }
        .dossier-descriptions .ant-descriptions-item-content {
          font-weight: 600 !important;
          color: #262626 !important;
          padding-bottom: 12px !important;
        }
      `}</style>

      {/* Header Section */}
      <div style={{ marginBottom: 32 }} className="animate-card">
        <Row justify="space-between" align="middle">
          <Col>
            <Space size="middle">
              <Button
                shape="circle"
                size="large"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(-1)}
                style={{
                  boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              />
              <div>
                <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  Detalle del Estudiante
                </Title>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <Text style={{ fontSize: 16, fontWeight: 600, color: '#595959' }}>
                    {studentData ? `${studentData.firstName} ${studentData.lastName}` : 'Cargando...'}
                  </Text>
                  {studentData?.inscription && (
                    <Tag color="processing" style={{ borderRadius: 6, fontWeight: 700, border: 'none' }}>
                      {studentData.inscription.grade?.name} — {studentData.inscription.section?.name}
                    </Tag>
                  )}
                </div>
              </div>
            </Space>
          </Col>
          <Col>
            {canEdit && (
              <Button
                size="large"
                icon={<EditOutlined />}
                onClick={handleEdit}
                style={{ borderRadius: 12, fontWeight: 700, padding: '0 24px', marginRight: 12 }}
              >
                Editar
              </Button>
            )}
            <Button
              size="large"
              onClick={() => navigate(-1)}
              style={{ borderRadius: 12, fontWeight: 700, padding: '0 24px' }}
            >
              Cerrar Vista
            </Button>
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
    </div>
  );
};

export default StudentDetail;
