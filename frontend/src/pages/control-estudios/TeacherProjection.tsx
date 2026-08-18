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
  const [selectedSectionIds, setSelectedSectionIds] = useState<number[]>([]);

  // guide teacher tab state
  const [allPeriods, setAllPeriods] = useState<SchoolPeriod[]>([]);
  const [guidePeriodId, setGuidePeriodId] = useState<number | null>(null);
  const [guideData, setGuideData] = useState<{ gradeId: number; gradeName: string; sections: { sectionId: number; sectionName: string; teachers: any[]; guideTeacherId: number | null }[] }[]>([]);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideSavingId, setGuideSavingId] = useState<string | null>(null);

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

  // --- guide teacher handlers ---
  const fetchAllGuides = useCallback(async () => {
    if (!guidePeriodId) {
      setGuideData([]);
      return;
    }
    setGuideLoading(true);
    try {
      const res = await api.get('/section-guides/all', {
        params: { schoolPeriodId: guidePeriodId },
      });
      setGuideData(res.data || []);
    } catch (error) {
      console.error('[fetchAllGuides] Error:', error);
      message.error('Error al cargar profesores guías');
      setGuideData([]);
    } finally {
      setGuideLoading(false);
    }
  }, [guidePeriodId]);

  useEffect(() => {
    fetchAllGuides();
  }, [fetchAllGuides]);

  const handleSetGuide = useCallback(async (gradeId: number, sectionId: number, teacherId: number, gradeName: string, sectionName: string) => {
    if (!guidePeriodId) return;
    const key = `${gradeId}-${sectionId}`;
    setGuideSavingId(key);
    try {
      await api.post('/section-guides', {
        teacherId,
        gradeId,
        sectionId,
        schoolPeriodId: guidePeriodId,
      });
      setGuideData(prev => prev.map(g =>
        g.gradeId === gradeId
          ? { ...g, sections: g.sections.map(s =>
              s.sectionId === sectionId
                ? { ...s, guideTeacherId: teacherId }
                : s
            ) }
          : g
      ));
      message.success(`Profesor guía asignado a ${gradeName} - Sección ${sectionName}`);
    } catch (error: any) {
      const apiErr = error as { response?: { data?: { message?: string } } };
      message.error(apiErr?.response?.data?.message || 'Error al asignar profesor guía');
    } finally {
      setGuideSavingId(null);
    }
  }, [guidePeriodId]);

  const handleOpenModal = (teacher: any) => {
    setSelectedTeacher(teacher);
    setShowModal(true);
    form.resetFields();
    setSelectedSectionIds([]);
  };

  const handleAssign = async (values: any) => {
    if (selectedSectionIds.length === 0) {
      message.warning('Seleccione al menos una sección');
      return;
    }
    setSubmitting(true);
    try {
      const gradeStruct = availableStructure.find(gs => gs.id === values.gradeStructureId);
      const subjectObj = gradeStruct.subjects.find((s: any) => s.id === values.subjectId);
      const periodGradeSubjectId = subjectObj.PeriodGradeSubject.id;

      const results = await Promise.allSettled(
        selectedSectionIds.map(sectionId =>
          api.post('/teachers/assign', {
            teacherId: selectedTeacher.id,
            periodGradeSubjectId,
            sectionId,
          })
        )
      );

      const fulfilled = results.filter(r => r.status === 'fulfilled').length;
      const rejected = results.filter(r => r.status === 'rejected').length;

      if (fulfilled > 0 && rejected === 0) {
        message.success(`Materia asignada a ${fulfilled} sección${fulfilled > 1 ? 'es' : ''} correctamente`);
      } else if (fulfilled > 0 && rejected > 0) {
        message.warning(`Asignada en ${fulfilled} sección${fulfilled > 1 ? 'es' : ''}, falló en ${rejected}`);
      } else {
        message.error('Error al asignar materia en todas las secciones');
      }

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
        description="Seleccione el período para ver todas las secciones de todos los grados. Use el selector de cada sección para elegir su profesor guía."
        type="info"
        style={{ marginBottom: 20, borderRadius: 8 }}
      />
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Período</label>
        <Select
          placeholder="Período"
          style={{ width: '100%' }}
          value={guidePeriodId}
          onChange={(v: number) => setGuidePeriodId(v)}
          options={allPeriods.map(p => ({ label: `${p.name}${p.status === 'activo' ? ' (activo)' : ''}`, value: p.id }))}
        />
      </div>

      {guideLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin tip="Cargando secciones..." /></div>
      ) : !guidePeriodId ? (
        <Empty description="Seleccione un período" />
      ) : guideData.length === 0 ? (
        <Empty description="No hay secciones configuradas para este período" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {guideData.map(grade => (
            <div key={grade.gradeId}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: 4 }}>
                {grade.gradeName}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {grade.sections.map(sec => {
                  const key = `${grade.gradeId}-${sec.sectionId}`;
                  return (
                    <Card
                      key={sec.sectionId}
                      size="small"
                      style={{ borderRadius: 10, border: sec.guideTeacherId ? '1px solid #86efac' : '1px solid #e2e8f0' }}
                      styles={{ body: { padding: '10px 14px' } }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 70 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>Sección {sec.sectionName}</span>
                          {sec.guideTeacherId && (
                            <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>Asignado</Tag>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 250 }}>
                          {sec.teachers.length === 0 ? (
                            <Text type="secondary" style={{ fontSize: 13 }}>Sin profesores asignados</Text>
                          ) : (
                            <Select
                              style={{ width: '100%' }}
                              placeholder="Seleccionar profesor guía"
                              value={sec.guideTeacherId}
                              loading={guideSavingId === key}
                              onChange={(teacherId: number) => handleSetGuide(grade.gradeId, sec.sectionId, teacherId, grade.gradeName, sec.sectionName)}
                              options={sec.teachers.map(t => ({
                                label: `${t.lastName} ${t.firstName} — ${t.subjects.join(', ')}`,
                                value: t.id,
                              }))}
                              allowClear
                            />
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
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
                setSelectedSectionIds([]);
                form.setFieldsValue({ subjectId: undefined });
              }}
            >
              {availableStructure.map(gs => (
                <Option key={gs.id} value={gs.id}>{gs.grade?.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Sección" required>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[...(availableStructure.find(gs => gs.id === selectedGradeId)?.sections || [])].sort((a: any, b: any) => a.name.localeCompare(b.name, 'es')).map((sec: any) => {
                const selected = selectedSectionIds.includes(sec.id);
                return (
                  <Button
                    key={sec.id}
                    type={selected ? 'primary' : 'default'}
                    disabled={!selectedGradeId}
                    onClick={() => {
                      setSelectedSectionIds(prev =>
                        prev.includes(sec.id)
                          ? prev.filter(id => id !== sec.id)
                          : [...prev, sec.id]
                      );
                    }}
                  >
                    {sec.name}
                  </Button>
                );
              }) || <span style={{ color: '#999' }}>Seleccione un grado primero</span>}
            </div>
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
