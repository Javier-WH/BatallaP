import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { Card, Button, Table, Space, Typography, Row, Col, Tag, Input, Empty, Spin, message, Tooltip, Alert, Breadcrumb, Checkbox, Modal } from 'antd';
import {
  LeftOutlined,
  SaveOutlined,
  FilterOutlined,
  CalendarOutlined,
  UserOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  FileExcelOutlined
} from '@ant-design/icons';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import api from '@/services/api';
import { useGradeRounding } from '@/context/GradeRoundingContext';
import { useSchool } from '@/context/SchoolContext';
import { formatGrade, isPassingGrade } from '@/utils/gradeFormat';

const { Title, Text } = Typography;

interface Term {
  id: number;
  name: string;
  isBlocked: boolean;
  order: number;
}

interface Section {
  id: number;
  name: string;
}

interface Grade {
  id: number;
  name: string;
  isDiversified: boolean;
  order: number;
}

interface PeriodGradeStructure {
  id: number;
  grade: Grade;
  sections: Section[];
}

interface CouncilStudent {
  id: number;
  studentName: string;
  studentDni: string;
  documentType: string;
  subjects: {
    id: number;
    name: string;
    groupId?: number | null;
    groupName?: string | null;
    inscriptionSubjectId: number;
    points: number;
    councilPointId?: number;
    grade: number;
    hasOtherTermsPoints: boolean;
    otherTermsInfo?: { termName: string, points: number }[];
    previousTermsData?: {
      termId: number;
      termName: string;
      baseGrade: number;
      councilPoints: number;
      finalGrade: number;
    }[];
  }[];
}

const CourseCouncil: React.FC = () => {
  const [step, setStep] = useState(0); // 0: Term, 1: Section, 2: Data
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const [terms, setTerms] = useState<Term[]>([]);
  const [structure, setStructure] = useState<PeriodGradeStructure[]>([]);
  const [activePeriod, setActivePeriod] = useState<any>(null);

  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const [selectedSection, setSelectedSection] = useState<{ section: Section, grade: Grade } | null>(null);
  const [studentsData, setStudentsData] = useState<CouncilStudent[]>([]);
  const [pointsLimit, setPointsLimit] = useState<number>(2);
  const [pointsPerSubjectLimit, setPointsPerSubjectLimit] = useState<number>(2);
  const [passingGrade, setPassingGrade] = useState<number>(10);
  const [maxGrade, setMaxGrade] = useState<number>(20);

  const [councilDone, setCouncilDone] = useState(false);
  const [councilCompletedAt, setCouncilCompletedAt] = useState<Date | null>(null);
  const [guideTeacherName, setGuideTeacherName] = useState<string>('');
  const [missingPointsStudents, setMissingPointsStudents] = useState<CouncilStudent[]>([]);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [bulkMarking, setBulkMarking] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const [filterYear, setFilterYear] = useState<string>('');
  const [showPreviousTerms, setShowPreviousTerms] = useState<boolean>(true);
  const [showPrevCouncilPoints, setShowPrevCouncilPoints] = useState<boolean>(false);
  const [tableScrollHeight, setTableScrollHeight] = useState(300);
  const tableCardRef = useRef<HTMLDivElement>(null);
  const { enableRounding } = useGradeRounding();
  const { settings } = useSchool();

  const updateTableScrollHeight = useCallback(() => {
    const card = tableCardRef.current;
    if (!card) return;

    const cardTop = card.getBoundingClientRect().top;
    const header = card.querySelector('.ant-table-thead') as HTMLElement | null;
    const stickyScrollbar = card.querySelector('.ant-table-sticky-scroll-bar') as HTMLElement | null;
    const headerHeight = header?.getBoundingClientRect().height ?? 72;
    const scrollbarHeight = stickyScrollbar?.getBoundingClientRect().height ?? 16;
    const availableHeight = window.innerHeight - cardTop;
    const nextHeight = Math.floor(availableHeight - headerHeight - scrollbarHeight - 2);

    setTableScrollHeight(Math.max(120, nextHeight));
  }, []);

  useLayoutEffect(() => {
    if (step !== 2) return;

    const frame = requestAnimationFrame(updateTableScrollHeight);
    const observer = new ResizeObserver(updateTableScrollHeight);
    if (tableCardRef.current) observer.observe(tableCardRef.current);
    window.addEventListener('resize', updateTableScrollHeight);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', updateTableScrollHeight);
    };
  }, [step, studentsData.length, showPreviousTerms, councilDone, updateTableScrollHeight]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const activeRes = await api.get('/academic/active');
      const period = activeRes.data;
      setActivePeriod(period);

      const [termsRes, structureRes, settingsRes] = await Promise.all([
        period ? api.get(`/terms?schoolPeriodId=${period.id}`) : Promise.resolve({ data: [] }),
        period ? api.get(`/academic/structure/${period.id}`) : Promise.resolve({ data: [] }),
        api.get('/settings')
      ]);

      if (period) {
        setTerms(termsRes.data.sort((a: Term, b: Term) => a.order - b.order));
        setStructure(structureRes.data.sort((a: PeriodGradeStructure, b: PeriodGradeStructure) =>
          (a.grade.order || 0) - (b.grade.order || 0)
        ));
      }

      if (settingsRes.data.council_points_limit) {
        setPointsLimit(Number(settingsRes.data.council_points_limit));
      }
      if (settingsRes.data.council_points_per_subject_limit) {
        setPointsPerSubjectLimit(Number(settingsRes.data.council_points_per_subject_limit));
      }
      if (settingsRes.data.passing_grade != null) {
        setPassingGrade(Number(settingsRes.data.passing_grade));
      }
      if (settingsRes.data.max_grade != null) {
        setMaxGrade(Number(settingsRes.data.max_grade));
      }
    } catch (error) {
      console.error('Error fetching data', error);
      message.error('Error al cargar la información inicial');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchCouncilData = async (sectionId: number, termId: number, gradeId: number) => {
    setLoading(true);
    try {
      const [res, checklistRes, guideRes] = await Promise.all([
        api.get(`/council/data?sectionId=${sectionId}&termId=${termId}&gradeId=${gradeId}`),
        activePeriod
          ? api.get(`/period-closure/${activePeriod.id}/checklist?gradeId=${gradeId}&sectionId=${sectionId}&termId=${termId}`)
          : Promise.resolve({ data: null }),
        activePeriod
          ? api.get(`/section-guides?schoolPeriodId=${activePeriod.id}&gradeId=${gradeId}&sectionId=${sectionId}`)
          : Promise.resolve({ data: null })
      ]);
      setStudentsData((res.data as CouncilStudent[]).slice().sort((a, b) => {
        const parseDoc = (doc: string) => parseInt((doc || '').replace(/\D/g, ''), 10) || 0;
        return parseDoc(a.studentDni) - parseDoc(b.studentDni);
      }));
      setCouncilDone(checklistRes.data?.status === 'done');
      setCouncilCompletedAt(checklistRes.data?.completedAt ? new Date(checklistRes.data.completedAt) : null);
      const gt = guideRes.data?.guideTeacher;
      setGuideTeacherName(gt ? `${gt.lastName} ${gt.firstName}` : '');
      setStep(2);
    } catch (error) {
      console.error('Error fetching council data', error);
      message.error('Error al cargar los estudiantes');
    } finally {
      setLoading(false);
    }
  };

  const handlePointChange = (studentId: number, inscriptionSubjectId: number, value: number | null) => {
    const student = studentsData.find(s => s.id === studentId);
    if (!student) return;

    const newValue = value || 0;

    // Validate per-subject limit
    if (newValue > pointsPerSubjectLimit) {
      message.warning(`El límite de puntos por materia es de ${pointsPerSubjectLimit}.`);
      return;
    }

    // Validate total limit
    const currentTotal = student.subjects.reduce((sum, s) => {
      if (s.inscriptionSubjectId === inscriptionSubjectId) return sum;
      return sum + (s.points || 0);
    }, 0);

    if (currentTotal + newValue > pointsLimit) {
      message.warning(`El límite total de puntos por alumno es de ${pointsLimit}.`);
      return;
    }

    setStudentsData(prev => prev.map(sData => {
      if (sData.id === studentId) {
        return {
          ...sData,
          subjects: sData.subjects.map(s =>
            s.inscriptionSubjectId === inscriptionSubjectId ? { ...s, points: newValue } : s
          )
        };
      }
      return sData;
    }));
  };

  const handleSave = async () => {
    if (!selectedTerm) return;
    setSaving(true);
    try {
      const updates: any[] = [];
      studentsData.forEach(student => {
        student.subjects.forEach(subject => {
          updates.push({
            inscriptionSubjectId: subject.inscriptionSubjectId,
            termId: selectedTerm.id,
            points: subject.points
          });
        });
      });

      await api.post('/council/bulk-save', { updates });
      message.success('Puntos guardados correctamente');
    } catch (error) {
      console.error('Error saving points', error);
      message.error('Error al guardar los puntos');
    } finally {
      setSaving(false);
    }
  };

  const validateMissingPoints = (): CouncilStudent[] => {
    return studentsData.filter(student => {
      const hasFailingGrade = student.subjects.some(s => !isPassingGrade(s.grade || 0, passingGrade));
      const totalPoints = student.subjects.reduce((sum, s) => sum + (s.points || 0), 0);
      return hasFailingGrade && totalPoints === 0;
    });
  };

  const confirmMarkDone = async () => {
    if (!activePeriod || !selectedTerm || !selectedSection) return;
    setMarkingDone(true);
    try {
      await api.post(`/period-closure/${activePeriod.id}/checklist`, {
        gradeId: selectedSection.grade.id,
        sectionId: selectedSection.section.id,
        termId: selectedTerm.id,
        status: 'done'
      });
      setCouncilDone(true);
      setCouncilCompletedAt(new Date());
      message.success('Consejo de curso marcado como completado');
    } catch (error) {
      console.error('Error marking council as done', error);
      message.error('Error al marcar como completado');
    } finally {
      setMarkingDone(false);
    }
  };

  const handleMarkDone = async (checked: boolean) => {
    if (!activePeriod || !selectedTerm || !selectedSection) return;

    if (!checked) {
      setMarkingDone(true);
      try {
        await api.post(`/period-closure/${activePeriod.id}/checklist`, {
          gradeId: selectedSection.grade.id,
          sectionId: selectedSection.section.id,
          termId: selectedTerm.id,
          status: 'open'
        });
        setCouncilDone(false);
        setCouncilCompletedAt(null);
        message.success('Consejo de curso reabierto');
      } catch (error) {
        console.error('Error reopening council', error);
        message.error('Error al actualizar el estado del consejo');
      } finally {
        setMarkingDone(false);
      }
      return;
    }

    const missing = validateMissingPoints();
    if (missing.length > 0) {
      Modal.confirm({
        title: 'Estudiantes sin puntos asignados',
        content: `Hay ${missing.length} estudiante(s) con materias reprobadas que no tienen puntos de consejo. ¿Desea marcar el consejo como completado de todas formas?`,
        okText: 'Sí, marcar como completado',
        cancelText: 'No, revisar primero',
        okButtonProps: { danger: true },
        onOk: () => confirmMarkDone(),
      });
      return;
    }

    confirmMarkDone();
  };

  const handleBulkMarkAllDone = async () => {
    if (!activePeriod || terms.length === 0 || structure.length === 0) return;

    const blockedTerms = terms.filter(t => t.isBlocked);
    if (blockedTerms.length === 0) {
      message.warning('No hay lapsos bloqueados. Debe bloquear los lapsos primero.');
      return;
    }

    const combinations: Array<{ gradeId: number; sectionId: number; termId: number }> = [];
    structure.forEach(pg => {
      pg.sections.forEach(sec => {
        if (sec.name.toLowerCase().includes('materia pendiente')) return;
        blockedTerms.forEach(term => {
          combinations.push({ gradeId: pg.grade.id, sectionId: sec.id, termId: term.id });
        });
      });
    });

    if (combinations.length === 0) {
      message.warning('No hay combinaciones de grado/sección para marcar.');
      return;
    }

    Modal.confirm({
      title: 'Marcar todos los consejos como completados',
      content: `Se marcarán ${combinations.length} consejos de curso (${blockedTerms.length} lapsos × grados/secciones) como completados. ¿Desea continuar?`,
      okText: 'Sí, marcar todos',
      cancelText: 'Cancelar',
      onOk: async () => {
        setBulkMarking(true);
        setBulkProgress({ done: 0, total: combinations.length });
        let successCount = 0;
        let failCount = 0;
        for (let i = 0; i < combinations.length; i++) {
          const { gradeId, sectionId, termId } = combinations[i];
          try {
            await api.post(`/period-closure/${activePeriod.id}/checklist`, {
              gradeId, sectionId, termId, status: 'done'
            });
            successCount++;
          } catch {
            failCount++;
          }
          setBulkProgress({ done: i + 1, total: combinations.length });
        }
        setBulkMarking(false);
        if (failCount === 0) {
          message.success(`${successCount} consejos de curso marcados como completados`);
        } else {
          message.warning(`${successCount} marcados, ${failCount} fallaron`);
        }
      }
    });
  };

  const handleTermClick = (term: Term) => {
    if (!term.isBlocked) {
      message.warning('El lapso debe estar cerrado para realizar el consejo de curso.');
      return;
    }
    setSelectedTerm(term);
    setStep(1);
  };

  const renderTermSelector = () => (
    <div style={{ padding: '0px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 60 }} className="animate-card">
        <Title level={1} style={{ margin: 0, fontWeight: 900, letterSpacing: '-0.04em' }}>Seleccione el Lapso</Title>
        <Text type="secondary" style={{ fontSize: 16, fontWeight: 500 }}>Identifique el periodo académico para el procesamiento de puntos</Text>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Button
          type="primary"
          size="large"
          icon={<CheckCircleOutlined />}
          onClick={handleBulkMarkAllDone}
          loading={bulkMarking}
          disabled={terms.length === 0 || structure.length === 0 || !terms.some(t => t.isBlocked)}
          style={{
            borderRadius: 14,
            fontWeight: 800,
            height: 48,
            padding: '0 32px',
            background: '#52c41a',
            border: 'none',
            boxShadow: '0 8px 20px rgba(82,196,77,0.25)'
          }}
        >
          {bulkMarking
            ? `Marcando... ${bulkProgress.done}/${bulkProgress.total}`
            : 'Marcar todos los consejos como completados'}
        </Button>
      </div>

      <Row gutter={[32, 32]} justify="center">
        {terms.map((term, idx) => (
          <Col key={term.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable={term.isBlocked}
              className={`premium-card animate-card delay-${(idx % 3) + 1}`}
              styles={{ body: { padding: '40px 24px' } }}
              style={{
                textAlign: 'center',
                transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                cursor: term.isBlocked ? 'pointer' : 'not-allowed',
                opacity: term.isBlocked ? 1 : 0.6
              }}
              onClick={() => handleTermClick(term)}
            >
              <div style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                background: term.isBlocked ? 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)' : '#f5f5f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                boxShadow: term.isBlocked ? '0 12px 24px rgba(24,144,255,0.25)' : 'none',
                transition: 'all 0.3s ease'
              }} className="icon-wrapper">
                <CalendarOutlined style={{ fontSize: 36, color: term.isBlocked ? '#fff' : '#bfbfbf' }} />
              </div>

              <Title level={3} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>{term.name}</Title>

              <div style={{ marginTop: 16 }}>
                {term.isBlocked ? (
                  <Tag color="blue" style={{ borderRadius: 20, padding: '2px 16px', fontWeight: 700, border: 'none', textTransform: 'uppercase', fontSize: 10 }}>
                    Lapso cerrado · Consejo habilitado
                  </Tag>
                ) : (
                  <Tag color="warning" style={{ borderRadius: 20, padding: '2px 16px', fontWeight: 700, border: 'none', textTransform: 'uppercase', fontSize: 10 }}>
                    Lapso activo · Cierre pendiente
                  </Tag>
                )}
              </div>

              <div style={{
                position: 'absolute',
                top: 20,
                right: 20,
                opacity: 0.1,
                fontSize: 40,
                fontWeight: 900,
                fontFamily: 'system-ui'
              }}>
                0{term.order || idx + 1}
              </div>
            </Card>
          </Col>
        ))}
        {terms.length === 0 && (
          <Col span={24}>
            <Empty description="No hay lapsos configurados para este período escolar" />
          </Col>
        )}
      </Row>
    </div>
  );

  const renderSectionSelector = () => {
    // Agrupar secciones por grado
    const sectionsByGrade: { grade: Grade, sections: Section[] }[] = [];
    structure.forEach(pg => {
      const matchFilter = !filterYear || pg.grade.name.toLowerCase().includes(filterYear.toLowerCase());
      if (matchFilter) {
        const sortedSections = [...pg.sections]
          .filter(s => !s.name.toLowerCase().includes('materia pendiente'))
          .sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          );
        if (sortedSections.length > 0) {
          sectionsByGrade.push({ grade: pg.grade, sections: sortedSections });
        }
      }
    });

    return (
      <div style={{ padding: '0px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
          <Space size="large" className="animate-card">
            <Button
              icon={<LeftOutlined />}
              onClick={() => setStep(0)}
              style={{
                borderRadius: '50%',
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                border: 'none',
                background: '#fff'
              }}
            />
            <div>
              <Title level={2} style={{ margin: 0, fontWeight: 900, letterSpacing: '-0.03em' }}>Estructura Académica</Title>
              <Text type="secondary" style={{ fontWeight: 500 }}>Elija la sección para gestionar los puntos del consejo en el {selectedTerm?.name}</Text>
            </div>
          </Space>
          <Input
            prefix={<FilterOutlined style={{ color: '#1890ff' }} />}
            placeholder="Buscar por año o grado..."
            size="large"
            className="premium-search animate-card"
            style={{ width: 320, borderRadius: 14, height: 48, animationDelay: '0.1s' }}
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
          />
        </div>

        {sectionsByGrade.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Text type="secondary" strong>No se encontraron resultados para su búsqueda</Text>}
          />
        ) : (
          sectionsByGrade.map((group, groupIdx) => (
            <div
              key={group.grade.id}
              className="section-group animate-card"
              style={{
                marginBottom: 56,
                animationDelay: `${groupIdx * 0.1}s`
              }}
            >
              <div className="grade-header-premium">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: group.grade.isDiversified ? '#fa541c' : '#1890ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: group.grade.isDiversified ? '0 8px 16px rgba(250,84,28,0.2)' : '0 8px 16px rgba(24,144,255,0.2)'
                  }}>
                    <Title level={4} style={{ color: '#fff', margin: 0, fontWeight: 900 }}>{group.grade.order || '?'}</Title>
                  </div>
                  <div>
                    <Title level={3} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: '#1f1f1f' }}>
                      {group.grade.name}
                    </Title>
                    <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>
                      {group.grade.isDiversified ? 'Ciclo Diversificado' : 'Educación Media General'}
                    </Text>
                  </div>
                </div>
              </div>

              <Row gutter={[24, 24]}>
                {group.sections.map((sec, secIdx) => (
                  <Col key={sec.id} xs={24} sm={12} md={8} lg={6}>
                    <Card
                      hoverable
                      className="section-card-premium"
                      styles={{ body: { padding: '24px' } }}
                      style={{
                        borderRadius: 20,
                        border: '1px solid rgba(0,0,0,0.05)',
                        animationDelay: `${(groupIdx * 0.1) + (secIdx * 0.05)}s`
                      }}
                      onClick={() => {
                        setSelectedSection({ section: sec, grade: group.grade });
                        if (selectedTerm) fetchCouncilData(sec.id, selectedTerm.id, group.grade.id);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div
                          className="section-letter-wrapper"
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 18,
                            background: group.grade.isDiversified ? '#fff2e8' : '#f0f5ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 28,
                            fontWeight: 900,
                            color: group.grade.isDiversified ? '#fa541c' : '#1890ff',
                            flexShrink: 0,
                            transition: 'all 0.3s ease'
                          }}
                        >
                          {sec.name.replace(/sección/gi, '').trim().charAt(0)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 20, color: '#1f1f1f', lineHeight: 1.2, marginBottom: 4 }}>
                            Sección {sec.name.replace(/sección/gi, '').trim()}
                          </div>
                          <Space size={4}>
                            <Tag color={group.grade.isDiversified ? 'volcano' : 'blue'} style={{ border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, margin: 0 }}>
                              {activePeriod?.name}
                            </Tag>
                          </Space>
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderDataTable = () => {
    if (studentsData.length === 0) return (
      <div style={{ padding: '80px 0', textAlign: 'center' }}>
        <Empty
          description={
            <div style={{ marginTop: 16 }}>
              <Title level={4}>No se encontraron estudiantes</Title>
              <Text type="secondary">Esta sección no cuenta con alumnos inscritos para procesar.</Text>
            </div>
          }
        />
        <Button icon={<LeftOutlined />} onClick={() => setStep(1)} style={{ marginTop: 24 }}>Volver a Secciones</Button>
      </div>
    );

    const missingPoints = validateMissingPoints();

    // Generate dynamic columns based on subjects or subject groups
    const columnDefinitions: { title: string, key: string, groupId?: number, subjectId?: number }[] = [];
    const seenGroups = new Set<number>();
    const seenSubjects = new Set<number>();

    // Collect all unique subjects/groups across ALL students to ensure we don't miss any
    studentsData.forEach(student => {
      student.subjects.forEach(sub => {
        if (sub.groupId && sub.groupName) {
          if (!seenGroups.has(sub.groupId)) {
            columnDefinitions.push({
              title: sub.groupName,
              key: `group-${sub.groupId}`,
              groupId: sub.groupId
            });
            seenGroups.add(sub.groupId);
          }
        } else {
          if (!seenSubjects.has(sub.id)) {
            columnDefinitions.push({
              title: sub.name,
              key: `subject-${sub.id}`,
              subjectId: sub.id
            });
            seenSubjects.add(sub.id);
          }
        }
      });
    });

    // Collect previous term names from the first student's first subject
    const prevTermNames: { termId: number, termName: string }[] = [];
    if (studentsData.length > 0 && studentsData[0].subjects.length > 0) {
      const firstSubPrevTerms = studentsData[0].subjects[0].previousTermsData || [];
      firstSubPrevTerms.forEach(pt => prevTermNames.push({ termId: pt.termId, termName: pt.termName }));
    }

    const handleExportExcel = async () => {
      if (studentsData.length === 0) return;
      setExportingExcel(true);

      try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'BatallaProject';
        workbook.created = new Date();
        const worksheet = workbook.addWorksheet('Consejo de Curso', {
          pageSetup: {
            orientation: 'landscape',
            paperSize: 9,
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            horizontalCentered: true,
            margins: {
              left: 0.25,
              right: 0.25,
              top: 0.4,
              bottom: 0.4,
              header: 0.2,
              footer: 0.2
            }
          }
        });
        // Repeat the grouped/leaf header rows on every printed page.
        worksheet.pageSetup.printTitlesRow = '6:7';

        const fixedHeaders = ['#', 'Documento', 'Estudiante', 'Pos', 'Promedio', 'Rep'];
        const leafHeaders: string[] = [...fixedHeaders];
        const groupRanges: { title: string; start: number; end: number }[] = [
          { title: 'Información del estudiante', start: 1, end: fixedHeaders.length }
        ];

        const currentLapNum = (selectedTerm?.name?.match(/\d+/)?.[0])
          || String(selectedTerm?.order ?? 1);

        // Map termId → lapso number, using term.order from the terms state
        const termOrderMap = new Map<number, string>();
        terms.forEach(t => {
          const num = t.name.match(/\d+/)?.[0] || String(t.order);
          termOrderMap.set(t.id, num);
        });

        columnDefinitions.forEach(colDef => {
          const start = leafHeaders.length + 1;
          if (showPreviousTerms) {
            prevTermNames.forEach(pt => {
              const lapNum = termOrderMap.get(pt.termId) || '?';
              leafHeaders.push(`L${lapNum}`);
            });
          }
          leafHeaders.push(`L${currentLapNum}`, 'PC', 'NF');
          groupRanges.push({ title: colDef.title, start, end: leafHeaders.length });
        });

        // Set column widths early so we can compute the table's total width
        // and split the header rows into three roughly-equal visual thirds.
        // Excel width → pixels: px = round(width * 7 + 5) for width >= 1.
        // ExcelJS can truncate decimal widths, so we convert to the exact width
        // that produces the target pixel value and set it with full precision.
        const widthFromPx = (px: number): number => (px - 5) / 7;
        worksheet.getColumn(1).width = 2.86;
        worksheet.getColumn(2).width = 12.86;
        worksheet.getColumn(3).width = 42;
        worksheet.getColumn(4).width = widthFromPx(29);  // Pos  (29px)
        worksheet.getColumn(5).width = widthFromPx(57);  // Promedio (57px)
        worksheet.getColumn(6).width = widthFromPx(29);  // Rep  (29px)
        for (let i = 7; i <= leafHeaders.length; i++) {
          worksheet.getColumn(i).width = 4;
        }

        // Compute the accumulated width per column to find the 1/3 and 2/3 cut points.
        const colWidths: number[] = [];
        let totalWidth = 0;
        for (let i = 1; i <= leafHeaders.length; i++) {
          const w = worksheet.getColumn(i).width || 0;
          colWidths.push(w);
          totalWidth += w;
        }
        const third = totalWidth / 3;
        let cut1 = 1;
        let cut2 = 1;
        let acc = 0;
        for (let i = 0; i < colWidths.length; i++) {
          acc += colWidths[i];
          if (cut1 === 1 && acc >= third) {
            cut1 = i + 1; // column index (1-based) where the first third ends
          }
          if (cut2 === 1 && acc >= third * 2) {
            cut2 = i + 1; // column index where the second third ends
          }
        }
        // Ensure the cuts are within bounds and leave room for the right section.
        cut1 = Math.max(2, Math.min(cut1, leafHeaders.length - 2));
        cut2 = Math.max(cut1 + 1, Math.min(cut2, leafHeaders.length - 1));
        const lastCol = leafHeaders.length;

        // Row 1: three merged sections. Center section holds the institution name.
        worksheet.addRow([]);
        worksheet.addRow([]);
        worksheet.addRow([]);
        worksheet.addRow([]);
        worksheet.addRow([]);

        // Merge row 1 into three parts: left (1..cut1), center (cut1+1..cut2), right (cut2+1..lastCol)
        worksheet.mergeCells(1, 1, 1, cut1);
        worksheet.mergeCells(1, cut1 + 1, 1, cut2);
        worksheet.mergeCells(1, cut2 + 1, 1, lastCol);

        const nameCell = worksheet.getCell(1, cut1 + 1);
        nameCell.value = settings.name;
        nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
        nameCell.font = { bold: true, size: 20, color: { argb: '17324D' } };

        worksheet.getRow(1).height = 48;

        // Row 3: merge the right third and show the school period (Año Escolar).
        worksheet.mergeCells(3, cut2 + 1, 3, lastCol);
        const periodCell = worksheet.getCell(3, cut2 + 1);
        periodCell.value = activePeriod?.name || '';
        periodCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
        periodCell.font = { bold: true, size: 14, color: { argb: '17324D' } };

        // Row 4: left side has "Profesor:" (A+B merged) and teacher name (C).
        // Center third holds the report title, right third holds the closure date.
        worksheet.mergeCells(4, 1, 4, 2);
        const profesorLabelCell = worksheet.getCell(4, 1);
        profesorLabelCell.value = 'Profesor:';
        profesorLabelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        profesorLabelCell.font = { size: 14, color: { argb: '17324D' } };

        const profesorNameCell = worksheet.getCell(4, 3);
        const titleCaseName = guideTeacherName
          ? guideTeacherName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
          : '';
        profesorNameCell.value = titleCaseName;
        profesorNameCell.alignment = { horizontal: 'left', vertical: 'middle' };
        profesorNameCell.font = { bold: true, size: 14, color: { argb: '17324D' } };

        worksheet.mergeCells(4, cut1 + 1, 4, cut2);
        const titleCell = worksheet.getCell(4, cut1 + 1);
        titleCell.value = 'Acta Final - Consejos de Curso';
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.font = { bold: true, size: 14, color: { argb: '17324D' } };

        worksheet.mergeCells(4, cut2 + 1, 4, lastCol);
        const dateCell = worksheet.getCell(4, cut2 + 1);
        const formattedDate = councilCompletedAt
          ? `Fecha: ${councilCompletedAt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
          : 'Fecha: __/__/____';
        dateCell.value = formattedDate;
        dateCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
        dateCell.font = { size: 14, color: { argb: '17324D' } };

        // Row 5: left side has "Curso:" (A+B merged) and grade+section name (C).
        // Center third holds the term (lapso) name.
        worksheet.mergeCells(5, 1, 5, 2);
        const cursoLabelCell = worksheet.getCell(5, 1);
        cursoLabelCell.value = 'Curso:';
        cursoLabelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cursoLabelCell.font = { size: 14, color: { argb: '17324D' } };

        const cursoNameCell = worksheet.getCell(5, 3);
        const cursoGradeName = selectedSection?.grade.name || '';
        const cursoSectionName = selectedSection?.section.name?.replace(/sección/gi, '').trim() || '';
        cursoNameCell.value = `${cursoGradeName}, Sección ${cursoSectionName}`.trim();
        cursoNameCell.alignment = { horizontal: 'left', vertical: 'middle' };
        cursoNameCell.font = { bold: true, size: 14, color: { argb: '17324D' } };

        worksheet.mergeCells(5, cut1 + 1, 5, cut2);
        const lapsoCell = worksheet.getCell(5, cut1 + 1);
        lapsoCell.value = selectedTerm?.name || '';
        lapsoCell.alignment = { horizontal: 'center', vertical: 'middle' };
        lapsoCell.font = { bold: true, size: 14, color: { argb: '17324D' } };

        worksheet.getRow(2).height = 24.75;
        worksheet.getRow(3).height = 24.75;
        worksheet.getRow(4).height = 24.75;
        worksheet.getRow(5).height = 24.75;

        // Institutional logo: top-left corner, 1.28" tall, preserving aspect ratio.
        // Offsets: ~5px from top, ~28px from left.
        // ExcelJS tl.col is a fractional column index. To convert pixels to column
        // units we must accumulate each column's pixel width until we reach the target.
        // Excel width → pixels: pixels = round(width * 7 + 5) for width >= 1.
        const pxToColUnits = (px: number): number => {
          let remaining = px;
          for (let c = 1; c <= leafHeaders.length; c++) {
            const w = worksheet.getColumn(c).width || 0;
            const colPx = Math.round(w >= 1 ? w * 7 + 5 : w * 7);
            if (remaining <= colPx) {
              return (c - 1) + remaining / colPx;
            }
            remaining -= colPx;
          }
          return leafHeaders.length;
        };
        try {
          const logoResponse = await api.get('/upload/logo', { responseType: 'arraybuffer' });
          // Decode the PNG to read its native dimensions for aspect-ratio preservation.
          const logoBuffer = logoResponse.data as ArrayBuffer;
          const view = new DataView(logoBuffer);
          // PNG: width at bytes 16-19, height at bytes 20-23 (big-endian uint32).
          const pngWidth = view.getUint32(16, false);
          const pngHeight = view.getUint32(20, false);
          const targetHeightPx = Math.round(1.28 * 96); // 1.28" at 96 DPI ≈ 123px
          const targetWidthPx = pngHeight > 0 ? Math.round((pngWidth / pngHeight) * targetHeightPx) : targetHeightPx;

          const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
          worksheet.addImage(logoId, {
            tl: { col: pxToColUnits(28), row: 5 / 48 }, // ~28px left, ~5px top (row 1 = 48px)
            ext: { width: targetWidthPx, height: targetHeightPx }
          });
        } catch (error) {
          console.warn('No se pudo incluir el logo institucional en el Excel:', error);
        }

        const topRow = worksheet.addRow([]);
        const headerRow = worksheet.addRow(leafHeaders);

        groupRanges.forEach(range => {
          topRow.getCell(range.start).value = range.title;
          worksheet.mergeCells(6, range.start, 6, range.end);
        });

        const getSubject = (student: CouncilStudent, colDef: typeof columnDefinitions[number]) => (
          colDef.groupId
            ? student.subjects.find(subject => subject.groupId === colDef.groupId)
            : student.subjects.find(subject => subject.id === colDef.subjectId)
        );
        const averageOf = (student: CouncilStudent) => {
          const total = student.subjects.reduce((sum, subject) => sum + (subject.grade || 0) + (subject.points || 0), 0);
          return student.subjects.length > 0 ? total / student.subjects.length : 0;
        };

        // Pre-compute positions: sort students by average descending, assign rank.
        const sortedByAvg = [...studentsData].sort((a, b) => averageOf(b) - averageOf(a));
        const positionMap = new Map<number, number>();
        sortedByAvg.forEach((s, idx) => {
          positionMap.set(s.id, idx + 1);
        });

        // Count failing subjects per student (NF < passingGrade).
        const failedCount = (student: CouncilStudent) => {
          return student.subjects.filter(subject => {
            const nf = (subject.grade || 0) + (subject.points || 0);
            return !isPassingGrade(nf, passingGrade);
          }).length;
        };

        const zebraFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F7FAFC' } };
        studentsData.forEach((student, studentIndex) => {
          const studentKey = student.id;
          const row: (string | number)[] = [
            studentIndex + 1,
            `${student.documentType === 'Venezolano' ? 'V' : student.documentType === 'Extranjero' ? 'E' : student.documentType === 'Pasaporte' ? 'P' : 'CE'}-${student.studentDni}`,
            student.studentName,
            positionMap.get(studentKey) ?? studentIndex + 1,
            Number(averageOf(student).toFixed(2)),
            failedCount(student),
          ];

          columnDefinitions.forEach(colDef => {
            const subject = getSubject(student, colDef);
            if (showPreviousTerms) {
              prevTermNames.forEach(pt => {
                const previous = subject?.previousTermsData?.find(item => item.termId === pt.termId);
                row.push(previous ? Number(formatGrade(previous.finalGrade, enableRounding)) : '-');
              });
            }

            const baseGrade = subject?.grade ?? 0;
            const points = subject?.points ?? 0;
            row.push(
              subject ? Number(formatGrade(baseGrade, enableRounding)) : '-',
              points,
              subject ? Number(formatGrade(Math.round((baseGrade + points) * 100) / 100, enableRounding)) : '-',
            );
          });
          const dataRow = worksheet.addRow(row);
          const isZebraRow = studentIndex % 2 === 1;

          // Apply superscript council points on previous-term L cells
          if (showPreviousTerms && showPrevCouncilPoints) {
            let colOffset = 6; // after #, Documento, Estudiante, Pos, Promedio, Rep
            columnDefinitions.forEach(colDef => {
              const subject = getSubject(student, colDef);
              if (showPreviousTerms) {
                prevTermNames.forEach(pt => {
                  const previous = subject?.previousTermsData?.find(item => item.termId === pt.termId);
                  if (previous && previous.councilPoints > 0) {
                    const cell = dataRow.getCell(colOffset + 1);
                    const gradeStr = String(formatGrade(previous.finalGrade, enableRounding)).padStart(String(maxGrade).length, '0');
                    cell.value = {
                      richText: [
                        { text: gradeStr, font: { size: 10 } },
                        { text: `+${previous.councilPoints}`, font: { size: 10, bold: true, vertAlign: 'superscript', color: { argb: 'FF3366FF' } } },
                      ],
                    };
                  }
                  colOffset += 1;
                });
              }
              // Skip L (current), PC, NF
              colOffset += 3;
            });
          }
          dataRow.eachCell(cell => {
            cell.font = { size: 10 };
            if (isZebraRow) {
              cell.fill = zebraFill;
            }
            cell.border = {
              top: { style: 'thin', color: { argb: 'D6DEE5' } },
              left: { style: 'thin', color: { argb: 'D6DEE5' } },
              bottom: { style: 'thin', color: { argb: 'D6DEE5' } },
              right: { style: 'thin', color: { argb: 'D6DEE5' } }
            };
          });
          dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
          dataRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
          dataRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
          for (let columnIndex = 4; columnIndex <= leafHeaders.length; columnIndex += 1) {
            dataRow.getCell(columnIndex).alignment = { horizontal: 'center', vertical: 'middle' };
          }
          // Promedio column (5th column): show 2 decimals, no rounding
          dataRow.getCell(5).numFmt = '0.00';

          // Rep column (6th column): red font if student has failing subjects
          const repCell = dataRow.getCell(6);
          const repCount = failedCount(student);
          if (repCount > 0) {
            repCell.font = { size: 10, color: { argb: 'FF0000' }, bold: true };
          }

          // Apply zero-padded number format to grade columns based on maxGrade digits
          const maxDigits = String(maxGrade).length;
          const gradeNumFmt = '0'.repeat(maxDigits); // e.g. '00' for max=20, '000' for max=100
          let colIdx = 7; // first subject column (after #, Documento, Estudiante, Pos, Promedio, Rep)
          columnDefinitions.forEach(() => {
            if (showPreviousTerms) {
              prevTermNames.forEach(() => {
                dataRow.getCell(colIdx).numFmt = gradeNumFmt; // L (previous term)
                colIdx += 1;
              });
            }
            dataRow.getCell(colIdx).numFmt = gradeNumFmt; // L (current term)
            colIdx += 1;
            // PC column: single digit, no padding
            colIdx += 1;
            // NF column: grade format
            dataRow.getCell(colIdx).numFmt = gradeNumFmt;
            colIdx += 1;
          });
        });

        const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'D9EAF7' } };
        const subHeaderFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F3F6F9' } };
        const headerBorder = {
          top: { style: 'thin' as const, color: { argb: 'B8C7D3' } },
          left: { style: 'thin' as const, color: { argb: 'B8C7D3' } },
          bottom: { style: 'thin' as const, color: { argb: 'B8C7D3' } },
          right: { style: 'thin' as const, color: { argb: 'B8C7D3' } }
        };
        for (let columnIndex = 1; columnIndex <= leafHeaders.length; columnIndex += 1) {
          const groupCell = topRow.getCell(columnIndex);
          groupCell.fill = headerFill;
          groupCell.font = { bold: true, size: 10, color: { argb: '17324D' } };
          groupCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          groupCell.border = headerBorder;

          const leafCell = headerRow.getCell(columnIndex);
          leafCell.fill = subHeaderFill;
          leafCell.font = { bold: true, size: 9, color: { argb: '40566B' } };
          leafCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          leafCell.border = headerBorder;
        }
        topRow.height = 24;
        headerRow.height = 32;

        // Thick separator between subjects so each block is easy to spot.
        const thickEdge = { style: 'medium' as const, color: { argb: '5A7085' } };
        const lastColumn = leafHeaders.length;
        const lastRow = worksheet.rowCount;
        groupRanges.forEach(range => {
          // Row 6 holds the merged group titles. Merged cells share a single style
          // object in ExcelJS, so both lateral borders must be written at once or
          // the second assignment discards the first one.
          const mergedCell = worksheet.getCell(6, range.start);
          mergedCell.border = { ...mergedCell.border, left: thickEdge, right: thickEdge };

          for (let rowNumber = 7; rowNumber <= lastRow; rowNumber += 1) {
            const startCell = worksheet.getCell(rowNumber, range.start);
            startCell.border = { ...startCell.border, left: thickEdge };

            // Apply thick right border to every group's end cell (not just the last)
            const endCell = worksheet.getCell(rowNumber, range.end);
            endCell.border = { ...endCell.border, right: thickEdge };
          }
        });

        // Thick outline around the whole table (top + bottom edges; left/right already set above).
        for (let columnIndex = 1; columnIndex <= lastColumn; columnIndex += 1) {
          const topCell = worksheet.getCell(6, columnIndex);
          topCell.border = { ...topCell.border, top: thickEdge };

          const bottomCell = worksheet.getCell(lastRow, columnIndex);
          bottomCell.border = { ...bottomCell.border, bottom: thickEdge };
        }

        // Double-line border separating previous terms from the current term (L actual).
        // The current-term L column is the one right after all previous-term L columns.
        if (showPreviousTerms && prevTermNames.length > 0) {
          const doubleEdge = { style: 'double' as const, color: { argb: '5A7085' } };
          const prevColsPerSubject = prevTermNames.length; // one L per previous term
          groupRanges.forEach(range => {
            // Skip the "Información del estudiante" group (only subject groups have previous terms)
            if (range.title === 'Información del estudiante') return;
            // Current-term L column index within this subject group. Start at row 9:
            // this column sits inside row 6's merged title cell, and writing to a
            // non-master cell of a merge would overwrite the group's lateral borders.
            const currentLCol = range.start + prevColsPerSubject;
            for (let rowNumber = 7; rowNumber <= lastRow; rowNumber += 1) {
              const cell = worksheet.getCell(rowNumber, currentLCol);
              cell.border = { ...cell.border, left: doubleEdge };
            }
          });
        }

        // Constrain the printable area so the table is not cut off.
        worksheet.pageSetup.printArea = `A1:${worksheet.getColumn(leafHeaders.length).letter}${worksheet.rowCount}`;

        const buffer = await workbook.xlsx.writeBuffer();
        const gradeName = selectedSection?.grade.name?.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, '_') || 'grado';
        const sectionName = selectedSection?.section.name?.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, '_') || 'seccion';
        saveAs(new Blob([buffer]), `consejo_curso_${gradeName}_${sectionName}.xlsx`);
        message.success('Reporte de consejo de curso generado correctamente');
      } catch (error) {
        console.error('Error generando reporte de consejo de curso:', error);
        message.error('No se pudo generar el reporte de consejo de curso');
      } finally {
        setExportingExcel(false);
      }
    };

    const columns = [
      {
        title: '#',
        key: 'rowIndex',
        width: 50,
        fixed: 'left' as const,
        align: 'center' as const,
        render: (_: any, __: CouncilStudent, index: number) => (
          <Text style={{ fontWeight: 700, fontSize: 12, color: '#8c8c8c' }}>{index + 1}</Text>
        )
      },
      {
        title: 'Estudiante',
        dataIndex: 'studentName',
        key: 'studentName',
        fixed: 'left' as const,
        width: 250,
        render: (text: string, record: CouncilStudent) => {
          const usedPoints = record.subjects.reduce((sum, s) => sum + (s.points || 0), 0);

          let docTypeLetter = '';
          switch (record.documentType) {
            case 'Venezolano': docTypeLetter = 'V'; break;
            case 'Extranjero': docTypeLetter = 'E'; break;
            case 'Pasaporte': docTypeLetter = 'P'; break;
            case 'Cedula Escolar': docTypeLetter = 'CE'; break;
            default: docTypeLetter = '';
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Space direction="vertical" size={0}>
                <Space>
                  <UserOutlined style={{ color: '#1890ff', fontSize: 13 }} />
                  <Text style={{ fontWeight: 700, fontSize: 14, color: '#262626' }}>{text}</Text>
                </Space>
                <div style={{ paddingLeft: 20 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <strong>{docTypeLetter}</strong>-{record.studentDni}
                  </Text>
                </div>
              </Space>
              <div style={{ paddingLeft: 20 }}>
                <Tag
                  color={usedPoints >= pointsLimit ? 'volcano' : 'blue'}
                  style={{ fontWeight: 700, border: 'none', borderRadius: 4, height: 20, lineHeight: '18px', fontSize: 10, textTransform: 'uppercase' }}
                >
                  TOTAL: {usedPoints} / {pointsLimit} · MÁX/MATERIA: {pointsPerSubjectLimit}
                </Tag>
              </div>
            </div>
          );
        }
      },
      {
        title: 'PROM.',
        key: 'average',
        width: 100,
        fixed: 'left' as const,
        align: 'center' as const,
        render: (_: any, record: CouncilStudent) => {
          const totalGrades = record.subjects.reduce((sum, s) => sum + (s.grade || 0) + (s.points || 0), 0);
          const average = record.subjects.length > 0 ? totalGrades / record.subjects.length : 0;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: !isPassingGrade(average, passingGrade) ? '#fff1f0' : '#f0f5ff', padding: '4px', borderRadius: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: 900, color: !isPassingGrade(average, passingGrade) ? '#cf1322' : '#096dd9' }}>
                {average.toFixed(2)}
              </Text>
              <Text style={{ fontSize: 9, fontWeight: 800, color: !isPassingGrade(average, passingGrade) ? '#cf1322' : '#096dd9', textTransform: 'uppercase' }}>Final</Text>
            </div>
          );
        }
      },
      ...columnDefinitions.map(colDef => {
        // Build children: one subcolumn per previous term + current term columns
        const children: any[] = [];

        // Previous term subcolumns (only if showPreviousTerms is enabled)
        if (showPreviousTerms) {
          prevTermNames.forEach((ptn, ptnIdx) => {
          children.push({
            title: (
              <div style={{ fontSize: 9, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase' }}>
                {ptn.termName}
              </div>
            ),
            key: `${colDef.key}-prev-${ptn.termId}`,
            width: 55,
            align: 'center' as const,
            onCell: ptnIdx === 0 ? () => ({ style: { borderLeft: '3px solid #d9d9d9' } }) : undefined,
            onHeaderCell: ptnIdx === 0 ? () => ({ style: { borderLeft: '3px solid #d9d9d9' } }) : undefined,
            render: (_: any, record: CouncilStudent) => {
              const subjectData = colDef.groupId
                ? record.subjects.find(s => s.groupId === colDef.groupId)
                : record.subjects.find(s => s.id === colDef.subjectId);

              if (!subjectData) return <Text type="secondary">-</Text>;

              const pt = (subjectData.previousTermsData || []).find(p => p.termId === ptn.termId);
              if (!pt) return <Text type="secondary">-</Text>;

              return (
                <Tooltip
                  title={
                    <div style={{ padding: 4 }}>
                      <div style={{ marginBottom: 4, fontWeight: 700 }}>{pt.termName}</div>
                      <div>Nota base: <strong>{formatGrade(pt.baseGrade, enableRounding)}</strong></div>
                      <div>Puntos de consejo: <strong>+{pt.councilPoints}</strong></div>
                      <div>Nota final: <strong>{formatGrade(pt.finalGrade, enableRounding)}</strong></div>
                    </div>
                  }
                >
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '2px 0',
                  }}>
                    <Text style={{ fontSize: 9, fontWeight: 700, color: pt.councilPoints > 0 ? '#fa8c16' : '#bfbfbf', lineHeight: '11px' }}>
                      +{pt.councilPoints}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: 800, color: !isPassingGrade(pt.finalGrade, passingGrade) ? '#cf1322' : '#389e0d' }}>
                      {formatGrade(pt.finalGrade, enableRounding)}
                    </Text>
                  </div>
                </Tooltip>
              );
            }
          });
        });
        }

        // Current term subcolumns: Base (named as current term), Pts, Final
        children.push(
          {
            title: <div style={{ fontSize: 9, fontWeight: 700, color: '#1890ff', textTransform: 'uppercase' }}>{selectedTerm?.name}</div>,
            key: `${colDef.key}-base`,
            width: 55,
            align: 'center' as const,
            onCell: (prevTermNames.length === 0 || !showPreviousTerms) ? () => ({ style: { borderLeft: '3px solid #d9d9d9' } }) : undefined,
            onHeaderCell: (prevTermNames.length === 0 || !showPreviousTerms) ? () => ({ style: { borderLeft: '3px solid #d9d9d9' } }) : undefined,
            render: (_: any, record: CouncilStudent) => {
              const subjectData = colDef.groupId
                ? record.subjects.find(s => s.groupId === colDef.groupId)
                : record.subjects.find(s => s.id === colDef.subjectId);
              if (!subjectData) return <Text type="secondary">-</Text>;
              const baseGrade = subjectData.grade || 0;
              return (
                <Tooltip title="Nota Base del lapso actual">
                  <Text style={{ fontSize: 14, color: !isPassingGrade(baseGrade, passingGrade) ? '#cf1322' : '#262626', fontWeight: 600 }}>
                    {formatGrade(baseGrade, enableRounding)}
                  </Text>
                </Tooltip>
              );
            }
          },
          {
            title: <div style={{ fontSize: 9, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase' }}>Pts</div>,
            key: `${colDef.key}-pts`,
            width: 50,
            align: 'center' as const,
            className: 'council-points-column',
            render: (_: any, record: CouncilStudent) => {
              const subjectData = colDef.groupId
                ? record.subjects.find(s => s.groupId === colDef.groupId)
                : record.subjects.find(s => s.id === colDef.subjectId);
              if (!subjectData) return <Text type="secondary">-</Text>;
              return (
                <Input
                  value={subjectData.points}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (isNaN(val)) {
                      handlePointChange(record.id, subjectData.inscriptionSubjectId, 0);
                    } else {
                      handlePointChange(record.id, subjectData.inscriptionSubjectId, Math.min(Math.max(val, 0), pointsPerSubjectLimit));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) return;
                    e.preventDefault();
                    const target = e.target as HTMLInputElement;
                    const currentTd = target.closest('td');
                    const currentTr = currentTd?.closest('tr');
                    if (!currentTd || !currentTr) return;
                    const tds = Array.from(currentTr.querySelectorAll('td'));
                    const colIndex = tds.indexOf(currentTd);
                    const focusInput = (td: Element | null | undefined) => {
                      const input = td?.querySelector('input');
                      if (input) { input.focus(); input.select(); }
                    };
                    if (e.key === 'ArrowDown' || e.key === 'Enter') {
                      const nextTr = currentTr.nextElementSibling as HTMLTableRowElement | null;
                      if (nextTr) focusInput(nextTr.querySelectorAll('td')[colIndex]);
                    } else if (e.key === 'ArrowUp') {
                      const prevTr = currentTr.previousElementSibling as HTMLTableRowElement | null;
                      if (prevTr) focusInput(prevTr.querySelectorAll('td')[colIndex]);
                    } else if (e.key === 'ArrowRight') {
                      for (let i = colIndex + 1; i < tds.length; i++) {
                        if (tds[i].querySelector('input')) { focusInput(tds[i]); break; }
                      }
                    } else if (e.key === 'ArrowLeft') {
                      for (let i = colIndex - 1; i >= 0; i--) {
                        if (tds[i].querySelector('input')) { focusInput(tds[i]); break; }
                      }
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  disabled={!selectedTerm?.isBlocked}
                  className="premium-input-number"
                  style={{ width: 42, fontWeight: 700, borderRadius: 6, textAlign: 'center', padding: '0 2px' }}
                />
              );
            }
          },
          {
            title: <div style={{ fontSize: 9, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase' }}>Final</div>,
            key: `${colDef.key}-final`,
            width: 48,
            align: 'center' as const,
            render: (_: any, record: CouncilStudent) => {
              const subjectData = colDef.groupId
                ? record.subjects.find(s => s.groupId === colDef.groupId)
                : record.subjects.find(s => s.id === colDef.subjectId);
              if (!subjectData) return <Text type="secondary">-</Text>;
              const baseGrade = subjectData.grade || 0;
              const currentPoints = subjectData.points || 0;
              const totalGrade = Math.round((baseGrade + currentPoints) * 100) / 100;
              return (
                <Tooltip title="Nota Final del lapso">
                  <div style={{
                    width: 34,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: !isPassingGrade(totalGrade, passingGrade) ? '#fff1f0' : '#f6ffed',
                    borderRadius: 5,
                    border: `1px solid ${!isPassingGrade(totalGrade, passingGrade) ? '#ffa39e' : '#b7eb8f'}`
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: 800, color: !isPassingGrade(totalGrade, passingGrade) ? '#cf1322' : '#389e0d' }}>
                      {formatGrade(totalGrade, enableRounding)}
                    </Text>
                  </div>
                </Tooltip>
              );
            }
          }
        );

        return {
          title: (
            <Tooltip title={colDef.title}>
              <div style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
                fontSize: 12,
                fontWeight: 800,
                textTransform: 'uppercase',
                color: '#595959',
                textAlign: 'center',
                lineHeight: '1.2',
              }}>
                {colDef.title}
              </div>
            </Tooltip>
          ),
          key: colDef.key,
          align: 'center' as const,
          width: children.reduce((sum, c) => sum + (c.width || 0), 0),
          onHeaderCell: () => ({ style: { borderLeft: '3px solid #d9d9d9' } }),
          children,
        };
      })
    ];

    const tableWidth = columns.reduce((sum, column) => sum + (column.width || 0), 0);

    return (
      <div style={{ padding: '0px 0' }} className="animate-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Space size="middle">
            <Button
              icon={<LeftOutlined />}
              onClick={() => setStep(1)}
              style={{ borderRadius: 12, height: 40, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            />
            <div>
              <Title level={3} style={{ margin: 0, fontWeight: 900, letterSpacing: '-0.03em' }}>
                {selectedSection?.grade.name} <span style={{ color: '#bfbfbf', fontWeight: 400 }}>/</span> Sección {selectedSection?.section.name.replace(/sección/gi, '').trim()}
              </Title>
              <Space split={<Text type="secondary" style={{ opacity: 0.5 }}>•</Text>}>
                <Text type="secondary" style={{ fontWeight: 600 }}>{selectedTerm?.name}</Text>
                <Tag color="processing" style={{ border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{activePeriod?.name}</Tag>
              </Space>
            </div>
          </Space>
          <Space size="large" align="center">
            {prevTermNames.length > 0 && (
              <Checkbox
                checked={showPreviousTerms}
                onChange={(e) => setShowPreviousTerms(e.target.checked)}
                style={{ fontWeight: 600 }}
              >
                Mostrar lapsos anteriores
              </Checkbox>
            )}
            {prevTermNames.length > 0 && showPreviousTerms && (
              <Checkbox
                checked={showPrevCouncilPoints}
                onChange={(e) => setShowPrevCouncilPoints(e.target.checked)}
                style={{ fontWeight: 600 }}
              >
                Incluir puntos de consejos anteriores
              </Checkbox>
            )}
            {!selectedTerm?.isBlocked && (
              <Alert
                message="Lapso activo"
                description="Debe cerrar el lapso para modificar puntos del consejo."
                type="warning"
                showIcon
                style={{ borderRadius: 14, padding: '4px 16px' }}
              />
            )}
            <Button
              type="default"
              size="large"
              icon={<FileExcelOutlined />}
              onClick={handleExportExcel}
              loading={exportingExcel}
              disabled={studentsData.length === 0}
              style={{
                borderRadius: 14,
                fontWeight: 800,
                height: 52,
                padding: '0 24px',
                color: '#217346',
                borderColor: '#b7d7c0'
              }}
            >
              Acta Final
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={!selectedTerm?.isBlocked}
              style={{
                borderRadius: 14,
                fontWeight: 800,
                height: 52,
                padding: '0 32px',
                background: '#001529',
                border: 'none',
                boxShadow: '0 8px 20px rgba(0,21,41,0.2)'
              }}
            >
              Guardar Calificaciones
            </Button>
            <Checkbox
              checked={councilDone}
              onChange={(e) => handleMarkDone(e.target.checked)}
              disabled={markingDone || !selectedTerm?.isBlocked}
              style={{
                fontWeight: 800,
                fontSize: 14,
                padding: '10px 20px',
                borderRadius: 14,
                height: 52,
                display: 'flex',
                alignItems: 'center',
                background: councilDone ? '#f6ffed' : '#fff',
                border: `2px solid ${councilDone ? '#52c41a' : '#d9d9d9'}`,
                transition: 'all 0.3s ease',
              }}
            >
              {councilDone ? (
                <span style={{ color: '#389e0d', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircleOutlined /> Consejo completado
                </span>
              ) : (
                'Marcar como completado'
              )}
            </Checkbox>
          </Space>
        </div>

        {missingPoints.length > 0 && !councilDone && (
          <Alert
            message={`${missingPoints.length} estudiante(s) con materias reprobadas sin puntos de consejo`}
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            style={{ marginBottom: 16, borderRadius: 14 }}
            action={
              <Button
                size="small"
                type="primary"
                ghost
                onClick={() => {
                  setMissingPointsStudents(missingPoints);
                  setShowMissingModal(true);
                }}
              >
                Ver estudiantes
              </Button>
            }
          />
        )}

        {councilDone && (
          <Alert
            message="Consejo de curso completado"
            description="Este consejo de curso ha sido marcado como completado. Puede desmarcarlo si necesita realizar cambios."
            type="success"
            showIcon
            style={{ marginBottom: 16, borderRadius: 14 }}
          />
        )}

        <Card
          ref={tableCardRef}
          className="premium-table-card"
          styles={{ body: { padding: 0 } }}
          style={{ width: '100%', minWidth: 0, borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)' }}
        >
          <style>{`
            .council-table-premium .ant-table-thead > tr > th {
              background-color: #fafafa !important;
              color: #595959 !important;
              font-weight: 800 !important;
              text-transform: uppercase;
              font-size: 11px;
              letter-spacing: 0.5px;
              padding: 16px 8px !important;
              border-bottom: 2px solid #f0f0f0 !important;
            }
            .council-table-premium .ant-table-row {
              transition: all 0.2s ease;
            }
            .council-table-premium .row-odd {
              background-color: #ffffff;
            }
            .council-table-premium .row-even {
              background-color: #fafbfc;
            }
            .council-table-premium .ant-table-row:hover > td {
              background-color: #f0f7ff !important;
            }
            .council-table-premium .ant-table-cell {
              padding: 14px 12px !important;
              border-bottom: 1px solid #f0f0f0 !important;
            }
            .premium-input-number:hover, .premium-input-number-focused {
              border-color: #1890ff !important;
              box-shadow: 0 0 0 2px rgba(24,144,255,0.1) !important;
            }
            .council-table-premium .council-points-column {
              padding-left: 2px !important;
              padding-right: 2px !important;
            }
            /* Fixed columns: solid background + high z-index so scrollable
               columns behind stay hidden when row is hovered.
               Use !important and high-specificity selectors to override
               Ant Design's built-in fixed cell background. */
            .council-table-premium .ant-table-tbody .ant-table-cell-fix {
              z-index: 3 !important;
              background-color: #ffffff !important;
            }
            .council-table-premium .ant-table-tbody tr.row-even .ant-table-cell-fix {
              background-color: #fafbfc !important;
            }
            .council-table-premium .ant-table-tbody tr.row-odd .ant-table-cell-fix {
              background-color: #ffffff !important;
            }
            .council-table-premium .ant-table-tbody tr:hover .ant-table-cell-fix {
              background-color: #f0f7ff !important;
            }
            .council-table-premium .ant-table-thead .ant-table-cell-fix {
              z-index: 5 !important;
              background-color: #fafafa !important;
            }
          `}</style>
          <Table
            dataSource={studentsData}
            columns={columns}
            rowKey="id"
            pagination={false}
            scroll={{ x: tableWidth + 1, y: tableScrollHeight }}
            size="middle"
            bordered
            className="council-table-premium"
            rowClassName={(_, index) => index % 2 === 0 ? 'row-odd' : 'row-even'}
          />
        </Card>
      </div>
    );
  };

  if (loading && step < 2) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 20 }}>
        <Spin size="large" />
        <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 11, fontWeight: 800 }}>Preparando Mesa de Trabajo...</Text>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minWidth: 0, padding: '0 24px' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-card {
          animation: fadeUp 0.6s cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        
        .premium-card {
          border-radius: 24px !important;
          border: 1px solid rgba(0,0,0,0.05) !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.03) !important;
        }
        .premium-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 48px rgba(0,0,0,0.08) !important;
          border-color: #1890ff !important;
        }
        .premium-card:hover .icon-wrapper {
          transform: scale(1.1) rotate(-5deg);
        }
        
        .grade-header-premium {
          position: sticky;
          top: 0;
          z-index: 10;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(12px);
          padding: 16px 0;
          margin-bottom: 32px;
          border-bottom: 2px solid #f0f0f0;
        }
        
        .section-card-premium {
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        }
        .section-card-premium:hover {
          transform: translateY(-6px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.08) !important;
          border-color: transparent !important;
          background: #fff !important;
        }
        .section-card-premium:hover .section-letter-wrapper {
          transform: scale(1.1) rotate(-8deg);
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
        }
      `}</style>

      <Breadcrumb
        style={{ marginBottom: 32 }}
        className="animate-card"
        items={[
          { title: <Text style={{ fontWeight: 600, fontSize: 12, color: '#8c8c8c', cursor: 'pointer' }} onClick={() => window.location.href = '/control-estudios'}>CONTROL DE ESTUDIOS</Text> },
          { title: <Text style={{ fontWeight: 800, fontSize: 12, color: '#262626', cursor: 'pointer' }} onClick={() => { setStep(0); setSelectedTerm(null); setSelectedSection(null); }}>CONSEJOS DE CURSO</Text> },
          ...(step >= 1 ? [{ title: <Tag color="blue" style={{ borderRadius: 6, fontWeight: 700, margin: 0, cursor: 'pointer' }} onClick={() => setStep(0)}>{selectedTerm?.name}</Tag> }] : []),
          ...(step >= 2 ? [{ title: <Tag color="gold" style={{ borderRadius: 6, fontWeight: 700, margin: 0, cursor: 'pointer' }} onClick={() => setStep(1)}>{selectedSection?.grade.name} {selectedSection?.section.name.replace(/sección/gi, '').trim()}</Tag> }] : []),
        ]}
      />

      {step === 0 && renderTermSelector()}
      {step === 1 && renderSectionSelector()}
      {step === 2 && renderDataTable()}

      <Modal
        title="Estudiantes sin puntos de consejo"
        open={showMissingModal}
        onCancel={() => setShowMissingModal(false)}
        footer={<Button onClick={() => setShowMissingModal(false)}>Cerrar</Button>}
        width={600}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Los siguientes estudiantes tienen materias reprobadas pero no se les han asignado puntos de consejo de curso:
        </Text>
        <Table
          dataSource={missingPointsStudents}
          columns={[
            { title: 'Estudiante', dataIndex: 'studentName', key: 'studentName' },
            {
              title: 'Cédula',
              key: 'studentDni',
              render: (_: unknown, record: CouncilStudent) => {
                let prefix = '';
                switch (record.documentType) {
                  case 'Venezolano': prefix = 'V'; break;
                  case 'Extranjero': prefix = 'E'; break;
                  case 'Pasaporte': prefix = 'P'; break;
                  case 'Cedula Escolar': prefix = 'CE'; break;
                }
                return `${prefix}-${record.studentDni}`;
              }
            },
            {
              title: 'Materias reprobadas',
              key: 'failingSubjects',
              render: (_: unknown, record: CouncilStudent) => {
                const failing = record.subjects.filter(s => !isPassingGrade(s.grade || 0, passingGrade));
                return (
                  <Space wrap>
                    {failing.map(s => (
                      <Tag key={s.id} color="red">{s.name}: {formatGrade(s.grade, enableRounding)}</Tag>
                    ))}
                  </Space>
                );
              }
            },
          ]}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Modal>
    </div>
  );
};

export default CourseCouncil;
