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
  isPendingSubject?: boolean;
  actualInscriptionId?: number;
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
      let currentSubjects: Subject[] = (inscriptionRes.data.subjects || []).map((s: any) => ({
        ...s,
        actualInscriptionId: inscriptionId
      }));

      const personId = inscriptionRes.data.personId;
      // 2. Check for OTHER inscriptions (e.g. Materia Pendiente) for the same student/period
      if (personId && schoolPeriodId) {
        try {
          const otherInscriptionsRes = await api.get('/inscriptions', {
            params: { personId, schoolPeriodId }
          });
          const otherInscriptions = otherInscriptionsRes.data;

          // Start Whitelist Logic: Filter against trusted Student Record to remove bloat
          const validPendingSubjects = new Set<string>();
          try {
            const recordRes = await api.get(`/evaluation/student-record/${personId}`);
            const records = recordRes.data || [];
            records.forEach((r: any) => {
              // If record matches an 'other' inscription AND is not the current main inscription
              if (r.id !== inscriptionId && otherInscriptions.some((oi: any) => oi.id === r.id)) {
                r.inscriptionSubjects?.forEach((is: any) => {
                  if (is.subject?.name) validPendingSubjects.add(is.subject.name);
                });
              }
            });
          } catch (e) {
            console.error("Error fetching academic record for filter", e);
          }

          const subjectMap = new Map<number, Subject>();
          // Index existing regular subjects
          currentSubjects.forEach(s => subjectMap.set(s.id, s));

          otherInscriptions.forEach((ins: any) => {
            if (ins.id !== inscriptionId && ins.subjects) { // It's another inscription
              ins.subjects.forEach((s: any) => {
                // FILTER: Strict whitelist to hide bloat.
                if (!validPendingSubjects.has(s.name)) {
                  return;
                }

                if (subjectMap.has(s.id)) {
                  // Subject already exists (maybe in Regular). Mark it as also Pending
                  const existing = subjectMap.get(s.id)!;
                  existing.isPendingSubject = true;
                } else {
                  // New Pending Subject
                  const newSub = {
                    ...s,
                    isPendingSubject: true,
                    actualInscriptionId: ins.id
                  };
                  subjectMap.set(s.id, newSub);
                  currentSubjects.push(newSub);
                }
              });
            }
          });
        } catch (e) {
          console.error("Error fetching related inscriptions", e);
        }
      }

      setEnrolledSubjects(currentSubjects);

      // 3. Get grade structure to find all possible subjects
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

  const handleRemoveSubject = async (subjectId: number, targetInscriptionId?: number) => {
    const targetId = targetInscriptionId || inscriptionId;
    if (!targetId) return;

    try {
      await api.delete(`/inscriptions/${targetId}/subjects/${subjectId}`);
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
            onClick={() => handleRemoveSubject(subject.id, subject.actualInscriptionId)}
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
            {subject.isPendingSubject && (
              <Tag color="red">Materia Pendiente</Tag>
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
