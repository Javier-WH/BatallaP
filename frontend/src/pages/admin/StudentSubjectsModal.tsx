import React, { useEffect, useState } from 'react';
import { Modal, List, Button, Tag, Typography, message, Space, Divider, Spin, Empty, Select, Alert } from 'antd';
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

  // Per-term group subject choices (backfill UI)
  const [groupChoices, setGroupChoices] = useState<{
    terms: { id: number; name: string; order: number; isActive: boolean }[];
    groups: { id: number; name: string; subjects: { id: number; name: string }[] }[];
    choices: { termId: number; subjectGroupId: number; subjectId: number }[];
  } | null>(null);
  const [choiceSaving, setChoiceSaving] = useState(false);

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

  const fetchGroupChoices = async () => {
    if (!inscriptionId) return;
    try {
      const res = await api.get(`/inscriptions/${inscriptionId}/group-choices`);
      setGroupChoices(res.data);
    } catch (e) {
      console.error('Error fetching group choices:', e);
      setGroupChoices(null);
    }
  };

  const handleSetGroupChoice = async (subjectGroupId: number, termId: number, subjectId: number) => {
    if (!inscriptionId) return;
    setChoiceSaving(true);
    try {
      await api.put(`/inscriptions/${inscriptionId}/group-choices`, { subjectGroupId, termId, subjectId });
      message.success('Materia de grupo actualizada para el lapso');
      await fetchGroupChoices();
    } catch (error: any) {
      const errMsg = error?.response?.data?.error || 'Error al guardar la elección';
      message.error(errMsg);
    } finally {
      setChoiceSaving(false);
    }
  };

  useEffect(() => {
    if (visible && inscriptionId) {
      fetchData();
      fetchGroupChoices();
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

          {groupChoices && groupChoices.groups.length > 0 && (
            <>
              <Divider />
              <Title level={5}>Materias de Grupo por Lapso</Title>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message="Asigne la materia de grupo que el estudiante cursó en cada lapso. Útil para registrar cambios o completar datos históricos."
              />
              <Spin spinning={choiceSaving}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {groupChoices.groups.map(group => (
                    <div key={group.id}>
                      <Text strong style={{ display: 'block', marginBottom: 6 }}>
                        <Tag color="orange">{group.name}</Tag>
                      </Text>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {groupChoices.terms.map(term => {
                          const current = groupChoices.choices.find(
                            c => c.subjectGroupId === group.id && c.termId === term.id
                          );
                          return (
                            <div key={term.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ flex: '0 0 90px', fontSize: 12, color: '#667085' }}>
                                {term.name}{term.isActive ? ' (activo)' : ''}
                              </span>
                              <Select
                                size="small"
                                style={{ flex: 1, minWidth: 180 }}
                                value={current?.subjectId}
                                placeholder="Seleccione…"
                                options={group.subjects.map(s => ({ label: s.name, value: s.id }))}
                                onChange={(subjectId) => handleSetGroupChoice(group.id, term.id, subjectId)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Spin>
            </>
          )}
        </div>
      </Spin>
    </Modal>
  );
};

export default StudentSubjectsModal;
