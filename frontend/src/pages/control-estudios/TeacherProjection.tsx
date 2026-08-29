import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Card, Button, Space, Tag, Modal, Form, Select, message, Alert, Tabs, Row, Col, Spin, Empty, Typography, Popover } from 'antd';
import { UserOutlined, BookOutlined, PlusOutlined, TeamOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Option } = Select;
const { Text } = Typography;

const normalizeText = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const isMpSection = (name?: string) => normalizeText(name) === 'materia pendiente';

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

  // MP teacher assignment tab state
  const [mpStructure, setMpStructure] = useState<any[]>([]);
  const [mpSectionId, setMpSectionId] = useState<number | null>(null);
  const [mpShowModal, setMpShowModal] = useState(false);
  const [mpSelectedTeacher, setMpSelectedTeacher] = useState<any>(null);
  const [mpForm] = Form.useForm();
  const [mpSubmitting, setMpSubmitting] = useState(false);
  const [mpSelectedSubjectId, setMpSelectedSubjectId] = useState<number | null>(null);
  const [mpSelectedGradeIds, setMpSelectedGradeIds] = useState<number[]>([]);

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
        setAvailableStructure((structRes.data as any[]).slice().sort((a, b) => {
          const orderA = a.grade?.order ?? 0;
          const orderB = b.grade?.order ?? 0;
          if (orderA !== orderB) return orderA - orderB;
          return (a.grade?.name || '').localeCompare(b.grade?.name || '', 'es');
        }));

        // Fetch MP structure
        try {
          const mpRes = await api.get('/pending-subjects/structure');
          const mpGrades = (mpRes.data?.grades || []).slice().sort((a: any, b: any) => {
            const orderA = a.grade?.order ?? 0;
            const orderB = b.grade?.order ?? 0;
            if (orderA !== orderB) return orderA - orderB;
            return (a.grade?.name || '').localeCompare(b.grade?.name || '', 'es');
          });
          setMpStructure(mpGrades);
          setMpSectionId(mpRes.data?.grades?.[0]?.mpSection?.id ?? null);
        } catch (mpErr) {
          console.error('[fetchData] MP structure error:', mpErr);
        }
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

  // --- MP teacher assignment handlers ---
  const handleOpenMpModal = (teacher: any) => {
    setMpSelectedTeacher(teacher);
    setMpShowModal(true);
    mpForm.resetFields();
    setMpSelectedSubjectId(null);
    setMpSelectedGradeIds([]);
  };

  const handleMpAssign = async () => {
    if (!mpSectionId) {
      message.error('No se encontró la sección de Materia Pendiente');
      return;
    }
    if (!mpSelectedSubjectId) {
      message.warning('Seleccione una materia');
      return;
    }
    if (mpSelectedGradeIds.length === 0) {
      message.warning('Seleccione al menos un año');
      return;
    }
    setMpSubmitting(true);
    try {
      // For each selected grade, find the periodGradeSubjectId for this subject
      const results = await Promise.allSettled(
        mpSelectedGradeIds.map(gradeId => {
          const gradeStruct = mpStructure.find(gs => gs.grade?.id === gradeId);
          const subjectObj = gradeStruct?.subjects.find((s: any) => s.id === mpSelectedSubjectId);
          const periodGradeSubjectId = subjectObj?.periodGradeSubjectId || subjectObj?.PeriodGradeSubject?.id;
          if (!periodGradeSubjectId) {
            return Promise.reject(new Error('PeriodGradeSubject no encontrado'));
          }
          return api.post('/teachers/assign', {
            teacherId: mpSelectedTeacher.id,
            periodGradeSubjectId,
            sectionId: mpSectionId,
          });
        })
      );

      const fulfilled = results.filter(r => r.status === 'fulfilled').length;
      const rejected = results.filter(r => r.status === 'rejected').length;

      if (fulfilled > 0 && rejected === 0) {
        message.success(`Materia pendiente asignada a ${fulfilled} año${fulfilled > 1 ? 's' : ''} correctamente`);
      } else if (fulfilled > 0 && rejected > 0) {
        message.warning(`Asignada en ${fulfilled} año${fulfilled > 1 ? 's' : ''}, falló en ${rejected}`);
      } else {
        message.error('Error al asignar la materia pendiente');
      }

      setMpShowModal(false);
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al asignar materia pendiente');
    } finally {
      setMpSubmitting(false);
    }
  };

  const handleMpRemove = async (assignmentId: number) => {
    try {
      await api.delete(`/teachers/assign/${assignmentId}`);
      message.success('Asignación removida');
      fetchData();
    } catch (error) {
      message.error('Error al remover asignación');
    }
  };

  // Calculate subjects without assigned teachers across all grades/sections.
  // Each "slot" is a (periodGradeSubjectId, sectionId) pair that should have a teacher.
  const unassignedSubjects = useMemo(() => {
    if (!availableStructure.length) return [];

    // Build a set of all assigned (periodGradeSubjectId, sectionId) pairs
    const assigned = new Set<string>();
    teachers.forEach((t: any) => {
      (t.teachingAssignments || []).forEach((as: any) => {
        const pgsId = as.periodGradeSubject?.id;
        const secId = as.section?.id;
        if (pgsId != null && secId != null) {
          assigned.add(`${pgsId}-${secId}`);
        }
      });
    });

    const result: { gradeName: string; subjectName: string; sections: string[] }[] = [];

    availableStructure.forEach((gs: any) => {
      const gradeName = gs.grade?.name || '—';
      // Exclude the "MATERIA PENDIENTE" auxiliary section — it's managed separately
      const sections: any[] = (gs.sections || []).filter(
        (sec: any) => (sec.name || '').toUpperCase() !== 'MATERIA PENDIENTE'
      );
      const subjects: any[] = gs.subjects || [];

      subjects.forEach((sub: any) => {
        const pgsId = sub.PeriodGradeSubject?.id;
        if (pgsId == null) return;

        const missingSections: string[] = [];
        sections.forEach((sec: any) => {
          if (!assigned.has(`${pgsId}-${sec.id}`)) {
            missingSections.push(sec.name || '—');
          }
        });

        if (missingSections.length > 0) {
          result.push({
            gradeName,
            subjectName: sub.name || '—',
            sections: missingSections.sort((a, b) => a.localeCompare(b, 'es')),
          });
        }
      });
    });

    return result;
  }, [availableStructure, teachers]);

  const unassignedCount = unassignedSubjects.length;

  // Build unique subject list from MP structure, and map which grades have each subject
  const mpUniqueSubjects = useMemo(() => {
    const map = new Map<number, { id: number; name: string; grades: { gradeId: number; gradeName: string }[] }>();
    mpStructure.forEach((gs: any) => {
      const gradeId = gs.grade?.id;
      const gradeName = gs.grade?.name;
      (gs.subjects || []).forEach((sub: any) => {
        if (!map.has(sub.id)) {
          map.set(sub.id, { id: sub.id, name: sub.name, grades: [] });
        }
        if (gradeId) {
          map.get(sub.id)!.grades.push({ gradeId, gradeName });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [mpStructure]);

  // Grades available for the currently selected subject
  const mpGradesForSubject = useMemo(() => {
    if (!mpSelectedSubjectId) return [];
    const subj = mpUniqueSubjects.find(s => s.id === mpSelectedSubjectId);
    return subj?.grades || [];
  }, [mpSelectedSubjectId, mpUniqueSubjects]);

  // Build a sort key map from availableStructure so teachingAssignments can be
  // displayed in canonical order (grade.order, then subject order within grade).
  const subjectSortKey = useMemo(() => {
    const map = new Map<string, { gradeOrder: number; subjectOrder: number }>();
    availableStructure.forEach((gs: any, gradeIndex: number) => {
      const gradeOrder = gs.grade?.order ?? gradeIndex;
      (gs.subjects || []).forEach((sub: any, subIndex: number) => {
        const pgsId = sub.PeriodGradeSubject?.id;
        if (pgsId != null) {
          map.set(`${pgsId}`, {
            gradeOrder,
            subjectOrder: sub.PeriodGradeSubject?.order ?? subIndex,
          });
        }
      });
    });
    return map;
  }, [availableStructure]);

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
      render: (_: any, record: any) => {
        // Exclude MP assignments — those are shown in the MP tab
        const regularAssignments = (record.teachingAssignments || []).filter(
          (as: any) => !isMpSection(as.section?.name)
        );
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {regularAssignments.length > 0 ? (
              [...regularAssignments]
                .sort((a: any, b: any) => {
                  const nameA = normalizeText(a.periodGradeSubject?.subject?.name || '');
                  const nameB = normalizeText(b.periodGradeSubject?.subject?.name || '');
                  const isOrientA = nameA === 'orientacion y convivencia';
                  const isOrientB = nameB === 'orientacion y convivencia';
                  if (isOrientA !== isOrientB) return isOrientA ? 1 : -1;

                  const keyA = `${a.periodGradeSubject?.id}`;
                  const keyB = `${b.periodGradeSubject?.id}`;
                  const ordA = subjectSortKey.get(keyA) ?? { gradeOrder: 999, subjectOrder: 999 };
                  const ordB = subjectSortKey.get(keyB) ?? { gradeOrder: 999, subjectOrder: 999 };
                  if (ordA.gradeOrder !== ordB.gradeOrder) return ordA.gradeOrder - ordB.gradeOrder;
                  if (ordA.subjectOrder !== ordB.subjectOrder) return ordA.subjectOrder - ordB.subjectOrder;
                  return (a.section?.name || '').localeCompare(b.section?.name || '', 'es');
                })
                .map((as: any) => (
                  <Tag key={as.id} color="blue" closable onClose={(e) => { e.preventDefault(); handleRemove(as.id); }}>
                    {as.periodGradeSubject?.subject?.name} - {as.periodGradeSubject?.periodGrade?.grade?.name} ({as.section?.name})
                  </Tag>
                ))
            ) : (
              <span style={{ color: '#999', fontSize: '0.85rem' }}>Sin materias asignadas</span>
            )}
          </div>
        );
      }
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
                              showSearch
                              filterOption={(input, option) =>
                                normalizeText(String(option?.label ?? '')).includes(normalizeText(input))
                              }
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

  // --- MP teacher assignment tab ---
  // Filter teaching assignments to only show MP section ones
  const mpColumns = [
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
      title: 'Materias Pendientes Asignadas',
      key: 'assignments',
      render: (_: any, record: any) => {
        const mpAssignments = (record.teachingAssignments || []).filter((as: any) =>
          isMpSection(as.section?.name)
        );
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {mpAssignments.length > 0 ? (
              [...mpAssignments]
                .sort((a: any, b: any) => {
                  const nameA = normalizeText(a.periodGradeSubject?.subject?.name || '');
                  const nameB = normalizeText(b.periodGradeSubject?.subject?.name || '');
                  return nameA.localeCompare(nameB, 'es');
                })
                .map((as: any) => (
                  <Tag key={as.id} color="purple" closable onClose={(e) => { e.preventDefault(); handleMpRemove(as.id); }}>
                    {as.periodGradeSubject?.subject?.name} - {as.periodGradeSubject?.periodGrade?.grade?.name}
                  </Tag>
                ))
            ) : (
              <span style={{ color: '#999', fontSize: '0.85rem' }}>Sin materias pendientes asignadas</span>
            )}
          </div>
        );
      }
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
          onClick={() => handleOpenMpModal(record)}
        >
          Asignar Materia
        </Button>
      )
    }
  ];

  const mpTab = (
    <>
      {(!activePeriod && !loading) ? (
        <Alert message="Periodo Inactivo" description="No hay un periodo escolar activo." type="warning" showIcon style={{ margin: 24 }} />
      ) : !mpSectionId ? (
        <Alert message="Sección MP no encontrada" description="No se pudo obtener la sección de Materia Pendiente." type="error" showIcon style={{ margin: 24 }} />
      ) : (
        <Table
          loading={loading}
          dataSource={teachers}
          columns={mpColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      )}
    </>
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
          tabBarExtraContent={
            <Popover
              trigger="click"
              placement="bottomRight"
              title={unassignedCount > 0 ? 'Materias sin profesor asignado' : 'Cobertura completa'}
              content={
                unassignedCount === 0 ? (
                  <div style={{ maxWidth: 320, padding: '4px 0' }}>
                    <Space>
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      <Text>Todas las materias tienen profesor asignado en todas las secciones.</Text>
                    </Space>
                  </div>
                ) : (
                  <div style={{ maxWidth: 420, maxHeight: 360, overflowY: 'auto', padding: '4px 0' }}>
                    {unassignedSubjects.map((item, idx) => (
                      <div
                        key={`${item.gradeName}-${item.subjectName}-${idx}`}
                        style={{
                          padding: '6px 0',
                          borderBottom: idx < unassignedSubjects.length - 1 ? '1px solid #f0f0f0' : 'none',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                          {item.gradeName} — {item.subjectName}
                        </div>
                        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>
                          Secciones sin profesor: {item.sections.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            >
              <Tag
                color={unassignedCount > 0 ? 'volcano' : 'success'}
                style={{
                  cursor: 'pointer',
                  fontWeight: 700,
                  borderRadius: 6,
                  padding: '2px 12px',
                  fontSize: 12,
                  border: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {unassignedCount > 0 ? (
                  <Space size={4}>
                    <WarningOutlined />
                    {unassignedCount} {unassignedCount === 1 ? 'materia sin profesor' : 'materias sin profesores'}
                  </Space>
                ) : (
                  <Space size={4}>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <span style={{ color: '#389e0d' }}>Cobertura completa</span>
                  </Space>
                )}
              </Tag>
            </Popover>
          }
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
            {
              key: 'mp-teacher',
              label: (
                <span>
                  <BookOutlined style={{ marginRight: 6 }} />
                  Materia Pendiente
                </span>
              ),
              children: mpTab,
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
              {[...(availableStructure.find(gs => gs.id === selectedGradeId)?.sections || [])]
                .filter((sec: any) => (sec.name || '').toUpperCase() !== 'MATERIA PENDIENTE')
                .sort((a: any, b: any) => a.name.localeCompare(b.name, 'es')).map((sec: any) => {
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
            <Select
              placeholder="Seleccione Materia"
              disabled={!selectedGradeId}
              showSearch
              filterOption={(input, option) =>
                normalizeText(String(option?.children ?? '')).includes(normalizeText(input))
              }
            >
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

      {/* MP Assignment Modal — one subject + multiple years (no section, single MP section) */}
      <Modal
        title={`Asignar Materia Pendiente a: ${mpSelectedTeacher?.firstName} ${mpSelectedTeacher?.lastName}`}
        open={mpShowModal}
        onCancel={() => setMpShowModal(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={mpForm} layout="vertical" onFinish={handleMpAssign}>
          <Form.Item label="Materia" required>
            <Select
              placeholder="Seleccione Materia"
              showSearch
              filterOption={(input, option) =>
                normalizeText(String(option?.children ?? '')).includes(normalizeText(input))
              }
              value={mpSelectedSubjectId ?? undefined}
              onChange={(val: number) => {
                setMpSelectedSubjectId(val);
                setMpSelectedGradeIds([]);
              }}
            >
              {mpUniqueSubjects.map(sub => (
                <Option key={sub.id} value={sub.id}>{sub.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Años" required>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {mpGradesForSubject.length > 0 ? (
                mpGradesForSubject.map(g => {
                  const selected = mpSelectedGradeIds.includes(g.gradeId);
                  return (
                    <Button
                      key={g.gradeId}
                      type={selected ? 'primary' : 'default'}
                      disabled={!mpSelectedSubjectId}
                      onClick={() => {
                        setMpSelectedGradeIds(prev =>
                          prev.includes(g.gradeId)
                            ? prev.filter(id => id !== g.gradeId)
                            : [...prev, g.gradeId]
                        );
                      }}
                    >
                      {g.gradeName}
                    </Button>
                  );
                })
              ) : (
                <span style={{ color: '#999' }}>Seleccione una materia primero</span>
              )}
            </div>
          </Form.Item>

          <Form.Item style={{ marginTop: 24, marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setMpShowModal(false)}>Cancelar</Button>
              <Button type="primary" htmlType="submit" loading={mpSubmitting}>Asignar</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TeacherProjection;
