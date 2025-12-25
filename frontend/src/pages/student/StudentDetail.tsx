import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Typography, Space, Tabs, Descriptions, Divider, List, Spin, Empty, Tag } from 'antd';
import { ArrowLeftOutlined, FileTextOutlined, SolutionOutlined } from '@ant-design/icons';
import StudentAcademicRecord from '@/components/shared/StudentAcademicRecord';
import api from '@/services/api';
import dayjs from 'dayjs';
import { getEnrollmentQuestionsForPerson, type EnrollmentQuestionResponse } from '@/services/enrollmentQuestions';

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

const StudentDetail: React.FC = () => {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [enrollmentQuestions, setEnrollmentQuestions] = useState<EnrollmentQuestionResponse[]>([]);

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

    const { guardians, inscription } = studentData;
    
    // Helper to find guardian by relationship
    const getGuardian = (rel: string) => {
      return guardians?.find((g: any) => g.relationship === rel);
    };

    const motherAssignment = getGuardian('mother');
    const fatherAssignment = getGuardian('father');
    const repAssignment = getGuardian('representative');

    // If representative is one of the parents, we might want to highlight that,
    // but typically we just show the Mother/Father sections and a Representative section if it's someone else ("other").
    // However, the data structure stores links. If mother is rep, repAssignment might refer to the same profile or be handled via flags.
    // Based on backend logic: assignments are created for mother, father, representative. 
    // If mother is rep, she has relationship='mother' and isRepresentative=true.
    // The previous logic in enrollment looked for relationship='representative' specifically for "other".
    
    // Let's render sections for Mother, Father, and "Legal Representative" if different or explicitly set.
    
    const renderGuardianSection = (assignment: any, title: string) => {
      if (!assignment || !assignment.profile) return null;
      const { profile } = assignment;
      const isRep = assignment.isRepresentative;

      const items = [
        { key: 'name', label: 'Nombre', children: `${profile.firstName} ${profile.lastName}` },
        { key: 'doc', label: 'Cédula', children: `${profile.documentType}-${profile.document}` },
        { key: 'phone', label: 'Teléfono', children: profile.phone || 'N/A' },
        { key: 'email', label: 'Email', children: profile.email || 'N/A' },
        { 
          key: 'address', 
          label: 'Dirección', 
          span: 2, 
          children: (
            <>
              {profile.address}<br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {profile.residenceMunicipality}, {profile.residenceState}
              </Text>
            </>
          ) 
        },
        { 
          key: 'role', 
          label: 'Rol', 
          children: isRep ? <Tag color="blue">Representante Legal</Tag> : 'Familiar' 
        }
      ];

      return (
        <>
          <Descriptions
            title={title}
            bordered
            column={2}
            size="small"
            style={{ marginTop: 16 }}
            items={items}
          />
        </>
      );
    };

    const personalItems = [
      { key: 'name', label: 'Nombre Completo', children: `${studentData.firstName} ${studentData.lastName}` },
      { key: 'doc', label: 'Cédula', children: studentData.document ? `${studentData.documentType}-${studentData.document}` : 'N/A' },
      { key: 'birth', label: 'Fecha Nacimiento', children: studentData.birthdate ? dayjs(studentData.birthdate).format('DD/MM/YYYY') : 'N/A' },
      { key: 'gender', label: 'Género', children: studentData.gender === 'M' ? 'Masculino' : 'Femenino' },
      { key: 'birthplace', label: 'Lugar Nacimiento', span: 2, children: `${studentData.residence?.birthMunicipality || ''}, ${studentData.residence?.birthState || ''}` }
    ];

    const contactItems = [
      { key: 'phones', label: 'Teléfonos', children: `${studentData.contact?.phone1 || ''} ${studentData.contact?.phone2 ? ' / ' + studentData.contact?.phone2 : ''}` },
      { key: 'email', label: 'Email', children: studentData.contact?.email || 'N/A' },
      { key: 'addr', label: 'Dirección', span: 2, children: studentData.contact?.address || 'N/A' },
      { key: 'loc', label: 'Ubicación', span: 2, children: `${studentData.residence?.residenceParish || ''}, ${studentData.residence?.residenceMunicipality || ''}, ${studentData.residence?.residenceState || ''}` }
    ];

    const academicItems = [
      { key: 'period', label: 'Periodo Actual', children: inscription?.period?.name || 'No inscrito' },
      { key: 'grade', label: 'Grado/Año', children: inscription?.grade?.name || '-' },
      { key: 'section', label: 'Sección', children: inscription?.section?.name || 'Sin asignar' },
      { key: 'date', label: 'Fecha Inscripción', children: inscription ? dayjs(inscription.createdAt).format('DD/MM/YYYY HH:mm') : '-' }
    ];

    return (
      <div style={{ padding: '0 8px 24px' }}>
        <Descriptions title="Información Personal" bordered column={2} size="small" items={personalItems} />

        <Divider>Datos de Contacto y Residencia</Divider>
        <Descriptions bordered column={2} size="small" items={contactItems} />

        <Divider>Información Académica</Divider>
        <Descriptions bordered column={2} size="small" items={academicItems} />

        <Divider>Representantes</Divider>
        {renderGuardianSection(motherAssignment, "Datos de la Madre")}
        {renderGuardianSection(fatherAssignment, "Datos del Padre")}
        {/* Only show 'Representative' section if it's explicitly an 'other' relationship, 
            otherwise mother/father sections already cover it with the tag */}
        {repAssignment && repAssignment.relationship === 'representative' && 
          renderGuardianSection(repAssignment, "Representante Legal (Otro)")}

        {enrollmentQuestions.length > 0 && (
          <>
            <Divider>Preguntas Adicionales</Divider>
            <List
              size="small"
              bordered
              dataSource={enrollmentQuestions}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.prompt}
                    description={
                      Array.isArray(item.answer) 
                        ? item.answer.join(', ') 
                        : (item.answer || 'Sin respuesta')
                    }
                  />
                </List.Item>
              )}
            />
          </>
        )}
      </div>
    );
  };

  const tabsItems = [
    {
      key: 'grades',
      label: (
        <span>
          <FileTextOutlined />
          Calificaciones
        </span>
      ),
      children: <StudentAcademicRecord personId={Number(personId)} />
    },
    {
      key: 'dossier',
      label: (
        <span>
          <SolutionOutlined />
          Expediente
        </span>
      ),
      children: renderDossier()
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card bordered={false} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space direction="vertical" size={0}>
            <Space>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(-1)}
              />
              <Title level={4} style={{ margin: 0 }}>Detalle del Estudiante</Title>
            </Space>
            <Text type="secondary" style={{ marginLeft: 40 }}>
              {studentData ? `${studentData.firstName} ${studentData.lastName}` : 'Cargando...'}
            </Text>
          </Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
      </Card>

      <Card bordered={false}>
        <Tabs defaultActiveKey="grades" items={tabsItems} />
      </Card>
    </div>
  );
};

export default StudentDetail;
