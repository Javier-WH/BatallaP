import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, Button, Space, Tag, Modal, Form, Select, message, Alert, Tabs, Row, Col, Spin, Empty, Typography } from 'antd';
import { UserOutlined, BookOutlined, PlusOutlined, TeamOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Option } = Select;
const { Text } = Typography;

interface Grade { id: number; name: string; isDiversified: boolean; order: number; }
interface Section { id: number; name: string; }
interface PeriodGradeStructure { id: number; grade: Grade; sections: Section[]; }
interface SchoolPeriod { id: number; period: string; name: string; status: 'preinscripcion' | 'activo' | 'historico' | 'externo'; isActive: boolean; }

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

  // guide teacher tab state
  const [allPeriods, setAllPeriods] = useState<SchoolPeriod[]>([]);
  const [guidePeriodId, setGuidePeriodId] = useState<number | null>(null);
  const [guideGradeId, setGuideGradeId] = useState<number | null>(null);
  const [guideSectionId, setGuideSectionId] = useState<number | null>(null);
  const [guideTeachers, setGuideTeachers] = useState<any[]>([]);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideSaving, setGuideSaving] = useState(false);
  const [guideStructure, setGuideStructure] = useState<PeriodGradeStructure[]>([]);

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

  // Load all periods for the guide tab
  useEffect(() => {
    api.get('/academic/periods').then(res => {
      const periods: SchoolPeriod[] = Array.isArray(res.data) ? res.data : [];
      setAllPeriods(periods);
      if (!guidePeriodId && periods.length > 0) {
        const active = periods.find(p => p.status === 'activo');
        setGuidePeriodId(active?.id ?? periods[0].id);
      }
    }).catch(() => setAllPeriods([]));
  }, []);

  // Load structure for the guide tab when period changes
  useEffect(() => {
    if (!guidePeriodId) { setGuideStructure([]); return; }
    api.get(`/academic/structure/${guidePeriodId}`).then(res => {
      const data = Array.isArray(res.data) ? res.data : [];
      setGuideStructure(data.sort((a: PeriodGradeStructure, b: PeriodGradeStructure) =>
        (a.grade.order || 0) - (b.grade.order || 0)
      ));
    }).catch(() => setGuideStructure([]));
  }, [guidePeriodId]);

  // --- guide teacher handlers ---
  const fetchGuideTeachers = useCallback(async () => {
    if (!guidePeriodId || !guideGradeId || !guideSectionId) {
      setGuideTeachers([]);
      return;
    }
    setGuideLoading(true);
    try {
      const res = await api.get('/section-guides/teachers', {
        params: { schoolPeriodId: guidePeriodId, gradeId: guideGradeId, sectionId: guideSectionId },
      });
      setGuideTeachers(res.data.teachers || []);
    } catch (error) {
      console.error('[fetchGuideTeachers] Error:', error);
      message.error('Error al cargar profesores de la sección');
      setGuideTeachers([]);
    } finally {
      setGuideLoading(false);
    }
  }, [guidePeriodId, guideGradeId, guideSectionId]);

  useEffect(() => {
    fetchGuideTeachers();
  }, [fetchGuideTeachers]);

  const handleSetGuide = useCallback(async (teacherId: number) => {
    if (!guidePeriodId || !guideGradeId || !guideSectionId) return;
    setGuideSaving(true);
    try {
      await api.post('/section-guides', {
        teacherId,
        gradeId: guideGradeId,
        sectionId: guideSectionId,
        schoolPeriodId: guidePeriodId,
      });
      setGuideTeachers(prev => prev.map(t => ({ ...t, isGuide: t.id === teacherId })).sort((a, b) => {
        if (a.isGuide !== b.isGuide) return a.isGuide ? -1 : 1;
        return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      }));
      message.success('Profesor guía asignado correctamente');
    } catch (error: any) {
      const apiErr = error as { response?: { data?: { message?: string } } };
      message.error(apiErr?.response?.data?.message || 'Error al asignar profesor guía');
    } finally {
      setGuideSaving(false);
    }
  }, [guidePeriodId, guideGradeId, guideSectionId]);

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

  const projectionTab = (
    <>
      {(!activePeriod && !loading) ? (
        <Alert message="Periodo Inactivo" description="No hay un periodo escolar activo para realizar proyecciones." type="warning" showIcon style={{ margin: 24 }} />
      ) : (
        <Table
          loading={loading}
          dataSource={teachers}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      )}
    </>
  );

  const guideTab = (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Alert
        message="Asignación de Profesor Guía"
        description="Seleccione el período, grado y sección para ver los profesores asignados. Marque uno como profesor guía. Solo puede haber un profesor guía por sección."
        type="info"
        style={{ marginBottom: 20, borderRadius: 8 }}
      />
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Período</label>
          <Select
            placeholder="Período"
            style={{ width: '100%' }}
            value={guidePeriodId}
            onChange={(v: number) => { setGuidePeriodId(v); setGuideGradeId(null); setGuideSectionId(null); }}
            options={allPeriods.map(p => ({ label: `${p.name}${p.status === 'activo' ? ' (activo)' : ''}`, value: p.id }))}
          />
        </Col>
        <Col xs={24} sm={8}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Grado</label>
          <Select
            placeholder="Grado"
            style={{ width: '100%' }}
            value={guideGradeId}
            onChange={(v: number) => { setGuideGradeId(v); setGuideSectionId(null); }}
            options={guideStructure.map(s => ({ label: s.grade.name, value: s.grade.id }))}
          />
        </Col>
        <Col xs={24} sm={8}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Sección</label>
          <Select
            placeholder="Sección"
            style={{ width: '100%' }}
            value={guideSectionId}
            disabled={!guideGradeId}
            onChange={(v: number) => setGuideSectionId(v)}
            options={guideStructure.find(s => s.grade.id === guideGradeId)?.sections.map(sec => ({ label: sec.name, value: sec.id })) || []}
          />
        </Col>
      </Row>

      {guideLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin tip="Cargando profesores..." /></div>
      ) : !guideGradeId || !guideSectionId ? (
        <Empty description="Seleccione un grado y sección para ver los profesores asignados" />
      ) : guideTeachers.length === 0 ? (
        <Empty description="No hay profesores asignados a esta sección" />
      ) : (
        <Table
          dataSource={guideTeachers}
          rowKey="id"
          pagination={false}
          size="middle"
          rowClassName={(record) => record.isGuide ? 'guide-row' : ''}
          columns={[
            {
              title: 'Profesor',
              key: 'name',
              render: (_, r) => (
                <Space>
                  <span style={{ fontWeight: r.isGuide ? 700 : 400 }}>
                    {r.lastName} {r.firstName}
                  </span>
                  {r.isGuide && <Tag icon={<CheckCircleOutlined />} color="success">Guía</Tag>}
                </Space>
              ),
            },
            {
              title: 'Cédula',
              key: 'doc',
              width: 120,
              render: (_, r) => `${r.documentType?.charAt(0) || 'V'}-${r.document}`,
            },
            {
              title: 'Materias',
              key: 'subjects',
              render: (_, r) => r.subjects.join(', '),
            },
            {
              title: 'Acción',
              key: 'action',
              width: 120,
              render: (_, r) => (
                <Button
                  type={r.isGuide ? 'default' : 'primary'}
                  size="small"
                  disabled={r.isGuide || guideSaving}
                  onClick={() => handleSetGuide(r.id)}
                >
                  {r.isGuide ? 'Asignado' : 'Marcar como guía'}
                </Button>
              ),
            },
          ]}
        />
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Card
        title={
          <Space>
            <BookOutlined />
            <span>Proyección Académica{activePeriod ? ` - ${activePeriod.name}` : ''}</span>
          </Space>
        }
      >
        <Tabs
          defaultActiveKey="projection"
          size="large"
          style={{ minHeight: '55vh' }}
          items={[
            {
              key: 'projection',
              label: (
                <span>
                  <BookOutlined style={{ marginRight: 6 }} />
                  Proyección Académica
                </span>
              ),
              children: projectionTab,
            },
            {
              key: 'guide-teacher',
              label: (
                <span>
                  <TeamOutlined style={{ marginRight: 6 }} />
                  Profesor Guía
                </span>
              ),
              children: guideTab,
            },
          ]}
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

      <style>{`
        .guide-row > td {
          background-color: #f0fdf4 !important;
        }
        .guide-row:hover > td {
          background-color: #dcfce7 !important;
        }
      `}</style>
    </div>
  );
};

export default TeacherProjection;
