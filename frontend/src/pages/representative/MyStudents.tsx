import React, { useEffect, useState } from 'react';
import { Card, Typography, List, Avatar, Tag, Button, Empty, Spin } from 'antd';
import { UserOutlined, ArrowRightOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

const { Title, Text } = Typography;

interface StudentSummary {
  id: number;
  firstName: string;
  lastName: string;
  documentType: string;
  document: string;
  gender: 'M' | 'F';
  birthdate: string;
  relationship: string;
  inscription: {
    grade: string;
    section: string;
    period: string;
    status: string;
  } | null;
}

const MyStudents: React.FC = () => {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await api.get('/guardians/my-students');
        setStudents(response.data);
      } catch (error) {
        console.error('Error fetching students:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <Title level={2} className="!mb-2 flex items-center gap-3">
          <TeamOutlined className="text-brand-primary" />
          Mis Representados
        </Title>
        <Text type="secondary" className="text-lg">
          Gestiona y visualiza la información académica de tus representados
        </Text>
      </div>

      {students.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div className="flex flex-col items-center gap-2">
              <Text strong>No tienes estudiantes asociados</Text>
              <Text type="secondary">Si crees que esto es un error, contacta a la administración.</Text>
            </div>
          }
        />
      ) : (
        <List
          grid={{ gutter: 24, xs: 1, sm: 1, md: 2, lg: 3, xl: 3, xxl: 4 }}
          dataSource={students}
          renderItem={(student) => (
            <List.Item>
              <Card
                hoverable
                className="w-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg border-slate-200"
                actions={[
                  <Button 
                    type="link" 
                    block 
                    icon={<ArrowRightOutlined />}
                    onClick={() => navigate(`/student/${student.id}`)}
                  >
                    Ver Expediente
                  </Button>
                ]}
              >
                <div className="flex flex-col items-center text-center mb-4">
                  <Avatar
                    size={80}
                    icon={<UserOutlined />}
                    className={`mb-4 flex items-center justify-center border-4 ${
                      student.gender === 'F' ? 'bg-pink-50 text-pink-500 border-pink-100' : 'bg-blue-50 text-blue-500 border-blue-100'
                    }`}
                  />
                  <Title level={4} className="!mb-1">
                    {student.firstName} {student.lastName}
                  </Title>
                  <Text type="secondary" className="mb-3 block">
                    {student.documentType}-{student.document}
                  </Text>
                  
                  {student.inscription ? (
                    <div className="bg-slate-50 rounded-lg p-3 w-full border border-slate-100">
                      <div className="flex flex-col gap-1">
                        <Tag color="blue" className="m-0 text-center font-bold">
                          {student.inscription.grade}
                        </Tag>
                        <Text className="text-xs text-slate-500 mt-1">
                          Sección "{student.inscription.section}"
                        </Text>
                        <Text className="text-[10px] uppercase tracking-wider text-slate-400">
                          {student.inscription.period}
                        </Text>
                      </div>
                    </div>
                  ) : (
                    <Tag color="default" className="w-full text-center py-1">
                      Sin inscripción activa
                    </Tag>
                  )}
                </div>
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  );
};

export default MyStudents;
