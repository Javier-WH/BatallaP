import React, { useEffect, useState } from 'react';
import { Modal, List, Button, Tag, Typography, message, Space, Divider, Spin, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined, BookOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Text, Title } = Typography;

interface Subject {
  id: number;
  name: string;
  subjectGroupId?: number | null;
  subjectGroup?: {
    id: number;
    name: string;
  };
}



interface Props {
  visible: boolean;
  onClose: () => void;
  inscriptionId: number | null;
  studentName: string;
  gradeId: number;
  schoolPeriodId: number;
}

const StudentSubjectsModal: React.FC<Props> = ({
  visible,
  onClose,
  inscriptionId,
  studentName,
  gradeId,
  schoolPeriodId,
}) => {
  const [loading, setLoading] = useState(false);
  const [enrolledSubjects, setEnrolledSubjects] = useState<Subject[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);

  const fetchData = async () => {
    if (!inscriptionId) return;

    setLoading(true);
    try {
      // 1. Get current inscription details (with subjects)
      const inscriptionRes = await api.get(`/inscriptions/${inscriptionId}`);
      const currentSubjects = inscriptionRes.data.subjects || [];
      setEnrolledSubjects(currentSubjects);

      // 2. Get grade structure to find all possible subjects
      const structureRes = await api.get(`/academic/structure/${schoolPeriodId}`);
      // Find the specific periodGrade for this grade
      const periodGrade = structureRes.data.find((pg: any) => pg.gradeId === gradeId);

      if (periodGrade && periodGrade.subjects) {
        const allSubjects = periodGrade.subjects;
        // Filter out subjects that are already enrolled
        const currentSubjectIds = new Set(currentSubjects.map((s: Subject) => s.id));
        const available = allSubjects.filter((s: Subject) => !currentSubjectIds.has(s.id));
        setAvailableSubjects(available);
      } else {
        setAvailableSubjects([]);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      message.error('Error al cargar las materias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && inscriptionId) {
      fetchData();
    }
  }, [visible, inscriptionId]);

  const handleAddSubject = async (subjectId: number) => {
    if (!inscriptionId) return;
    try {
      await api.post(`/inscriptions/${inscriptionId}/subjects`, { subjectId });
      message.success('Materia agregada');
      fetchData(); // Refresh lists
    } catch (error) {
      console.error('Error adding subject:', error);
      message.error('Error al agregar la materia');
    }
  };

  const handleRemoveSubject = async (subjectId: number) => {
    if (!inscriptionId) return;
    try {
      await api.delete(`/inscriptions/${inscriptionId}/subjects/${subjectId}`);
      message.success('Materia eliminada');
      fetchData(); // Refresh lists
    } catch (error) {
      console.error('Error removing subject:', error);
      message.error('Error al eliminar la materia');
    }
  };

  const renderSubjectItem = (subject: Subject, isEnrolled: boolean) => (
    <List.Item
      actions={[
        isEnrolled ? (
          <Button
            danger
            type="text"
            icon={<DeleteOutlined />}
            onClick={() => handleRemoveSubject(subject.id)}
          >
            Remover
          </Button>
        ) : (
          <Button
            type="link"
            icon={<PlusOutlined />}
            onClick={() => handleAddSubject(subject.id)}
          >
            Agregar
          </Button>
        )
      ]}
    >
      <List.Item.Meta
        avatar={<BookOutlined style={{ color: isEnrolled ? '#1890ff' : '#8c8c8c' }} />}
        title={
          <Space>
            <Text delete={!isEnrolled && false}>{subject.name}</Text>
            {subject.subjectGroup && (
              <Tag color="orange">{subject.subjectGroup.name}</Tag>
            )}
          </Space>
        }
      />
    </List.Item>
  );

  return (
    <Modal
      title={`Materias de ${studentName}`}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Cerrar
        </Button>
      ]}
      width={700}
    >
      <Spin spinning={loading}>
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <Title level={5}>Materias Inscritas</Title>
          {enrolledSubjects.length > 0 ? (
            <List
              size="small"
              dataSource={enrolledSubjects}
              renderItem={(item) => renderSubjectItem(item, true)}
            />
          ) : (
            <Empty description="No tiene materias inscritas" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}

          <Divider />

          <Title level={5}>Materias Disponibles (del Grado)</Title>
          {availableSubjects.length > 0 ? (
            <List
              size="small"
              dataSource={availableSubjects}
              renderItem={(item) => renderSubjectItem(item, false)}
            />
          ) : (
            <Empty description="No hay materias adicionales disponibles" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      </Spin>
    </Modal>
  );
};

export default StudentSubjectsModal;
