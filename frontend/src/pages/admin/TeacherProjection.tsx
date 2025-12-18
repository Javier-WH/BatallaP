import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, Button, Space, Tag, Modal, Form, Select, message, Alert } from 'antd';
import { UserOutlined, BookOutlined, PlusOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Option } = Select;

const TeacherProjection: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [availableStructure, setAvailableStructure] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const periodRes = await api.get('/academic/active');
      const active = periodRes.data;
      setActivePeriod(active);

      const teachersRes = await api.get('/teachers', {
        params: active ? { schoolPeriodId: active.id } : {}
      });
      setTeachers(teachersRes.data);

      if (active) {
        const structRes = await api.get(`/academic/structure/${active.id}`);
        setAvailableStructure(structRes.data);
      }
    } catch (error) {
      console.error(error);
      message.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (teacher: any) => {
    setSelectedTeacher(teacher);
    setShowModal(true);
    form.resetFields();
  };

  const handleAssign = async (values: any) => {
    setSubmitting(true);
    try {
      // We need to find the correct PeriodGradeSubjectId
      const gradeStruct = availableStructure.find(gs => gs.id === values.gradeStructureId);
      const subjectObj = gradeStruct.subjects.find((s: any) => s.id === values.subjectId);
      const periodGradeSubjectId = subjectObj.PeriodGradeSubject.id;

      await api.post('/teachers/assign', {
        teacherId: selectedTeacher.id,
        periodGradeSubjectId,
        sectionId: values.sectionId
      });

      message.success('Materia asignada correctamente');
      setShowModal(false);
      fetchData();
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.message || 'Error al asignar materia');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (assignmentId: number) => {
    try {
      await api.delete(`/teachers/assign/${assignmentId}`);
      message.success('Asignación removida');
      fetchData();
    } catch (error) {
      message.error('Error al remover asignación');
    }
  };

  const columns = [
    {
      title: 'Profesor',
      key: 'teacher',
      render: (_: any, record: any) => (
        <Space>
          <UserOutlined />
          <span style={{ fontWeight: 600 }}>{record.firstName} {record.lastName}</span>
        </Space>
      )
    },
    {
      title: 'Materias Asignadas',
      key: 'assignments',
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {record.teachingAssignments?.length > 0 ? (
            record.teachingAssignments.map((as: any) => (
              <Tag key={as.id} color="blue" closable onClose={(e) => { e.preventDefault(); handleRemove(as.id); }}>
                {as.periodGradeSubject?.subject?.name} - {as.periodGradeSubject?.periodGrade?.grade?.name} ({as.section?.name})
              </Tag>
            ))
          ) : (
            <span style={{ color: '#999', fontSize: '0.85rem' }}>Sin materias asignadas</span>
          )}
        </div>
      )
    },
    {
      title: 'Acciones',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: any) => (
        <Button
          type="primary"
          ghost
          icon={<PlusOutlined />}
          size="small"
          onClick={() => handleOpenModal(record)}
        >
          Asignar Materia
        </Button>
      )
    }
  ];

  if (!activePeriod && !loading) {
    return <Alert message="Periodo Inactivo" description="No hay un periodo escolar activo para realizar proyecciones." type="warning" showIcon style={{ margin: 24 }} />;
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Card
        title={
          <Space>
            <BookOutlined />
            <span>Proyección Académica - {activePeriod?.name}</span>
          </Space>
        }
      >
        <Table
          loading={loading}
          dataSource={teachers}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={`Asignar materia a: ${selectedTeacher?.firstName} ${selectedTeacher?.lastName}`}
        open={showModal}
        onCancel={() => setShowModal(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleAssign}>
          <Form.Item name="gradeStructureId" label="Grado" rules={[{ required: true }]}>
            <Select
              placeholder="Seleccione Grado"
              onChange={(val) => {
                setSelectedGradeId(val);
                form.setFieldsValue({ sectionId: undefined, subjectId: undefined });
              }}
            >
              {availableStructure.map(gs => (
                <Option key={gs.id} value={gs.id}>{gs.grade?.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="sectionId" label="Sección" rules={[{ required: true }]}>
            <Select placeholder="Seleccione Sección" disabled={!selectedGradeId}>
              {availableStructure.find(gs => gs.id === selectedGradeId)?.sections.map((sec: any) => (
                <Option key={sec.id} value={sec.id}>{sec.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="subjectId" label="Materia" rules={[{ required: true }]}>
            <Select placeholder="Seleccione Materia" disabled={!selectedGradeId}>
              {availableStructure.find(gs => gs.id === selectedGradeId)?.subjects.map((sub: any) => (
                <Option key={sub.id} value={sub.id}>{sub.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item style={{ marginTop: 24, marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>Asignar</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TeacherProjection;
