import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Typography, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import StudentAcademicRecord from '@/components/shared/StudentAcademicRecord';

const { Title, Text } = Typography;

const StudentDetail: React.FC = () => {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();

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
              <Title level={4} style={{ margin: 0 }}>Expediente del Estudiante</Title>
            </Space>
            <Text type="secondary" style={{ marginLeft: 40 }}>
              Vista detallada de calificaciones por periodos y lapsos
            </Text>
          </Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
      </Card>

      <StudentAcademicRecord personId={Number(personId)} />
    </div>
  );
};

export default StudentDetail;
