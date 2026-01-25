import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Table, InputNumber, Space, Typography, Row, Col, Tag, Input, Empty, Spin, message, Tooltip, Alert, Breadcrumb } from 'antd';
import {
  LeftOutlined,
  SaveOutlined,
  FilterOutlined,
  CalendarOutlined,
  UserOutlined
} from '@ant-design/icons';
import api from '@/services/api';

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
  }[];
}

const CourseCouncil: React.FC = () => {
  const [step, setStep] = useState(0); // 0: Term, 1: Section, 2: Data
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [terms, setTerms] = useState<Term[]>([]);
  const [structure, setStructure] = useState<PeriodGradeStructure[]>([]);
  const [activePeriod, setActivePeriod] = useState<any>(null);

  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const [selectedSection, setSelectedSection] = useState<{ section: Section, grade: Grade } | null>(null);
  const [studentsData, setStudentsData] = useState<CouncilStudent[]>([]);
  const [pointsLimit, setPointsLimit] = useState<number>(2);

  const [filterYear, setFilterYear] = useState<string>('');

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
      const res = await api.get(`/council/data?sectionId=${sectionId}&termId=${termId}&gradeId=${gradeId}`);
      setStudentsData(res.data);
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

    const columns = [
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
                  USADO: {usedPoints} / {pointsLimit}
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: average < 10 ? '#fff1f0' : '#f0f5ff', padding: '4px', borderRadius: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: 900, color: average < 10 ? '#cf1322' : '#096dd9' }}>
                {average.toFixed(2)}
              </Text>
              <Text style={{ fontSize: 9, fontWeight: 800, color: average < 10 ? '#cf1322' : '#096dd9', textTransform: 'uppercase' }}>Final</Text>
            </div>
          );
        }
      },
      ...columnDefinitions.map(colDef => ({
        title: (
          <Tooltip title={colDef.title}>
            <div style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 160,
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              color: '#595959'
            }}>
              {colDef.title}
            </div>
          </Tooltip>
        ),
        key: colDef.key,
        width: 180,
        align: 'center' as const,
        render: (_: any, record: CouncilStudent) => {
          const subjectData = colDef.groupId
            ? record.subjects.find(s => s.groupId === colDef.groupId)
            : record.subjects.find(s => s.id === colDef.subjectId);

          if (!subjectData) return <Text type="secondary">-</Text>;

          const prevPointsTotal = subjectData.otherTermsInfo?.reduce((sum, info) => sum + info.points, 0) || 0;
          const currentPoints = subjectData.points || 0;
          const baseGrade = subjectData.grade || 0;
          const totalGrade = Math.round((baseGrade + currentPoints) * 100) / 100;

          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Tooltip
                title={
                  <div style={{ padding: 4 }}>
                    {colDef.groupId && <div style={{ marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 4 }}><strong>Materia:</strong> {subjectData.name}</div>}
                    {prevPointsTotal > 0 ? (
                      <>
                        <div style={{ marginBottom: 4 }}><strong>Desglose de puntos previos:</strong></div>
                        {subjectData.otherTermsInfo?.map((info: any, idx: number) => (
                          <div key={idx} style={{ fontSize: 11, opacity: 0.9 }}>
                            • {info.termName}: <strong>+{info.points}</strong>
                          </div>
                        ))}
                      </>
                    ) : (
                      "No hay puntos previos"
                    )}
                  </div>
                }
              >
                <Tag
                  color={prevPointsTotal > 0 ? "orange" : "default"}
                  style={{ fontSize: 10, padding: 0, margin: 0, lineHeight: '20px', width: 28, height: 20, textAlign: 'center', fontWeight: 700, borderRadius: 6, border: 'none' }}
                >
                  {prevPointsTotal > 0 ? `+${prevPointsTotal}` : '0'}
                </Tag>
              </Tooltip>

              <Tooltip title="Nota Base">
                <Text style={{ fontSize: 14, color: baseGrade < 10 ? '#cf1322' : '#262626', width: 35, textAlign: 'center', fontWeight: 600 }}>
                  {baseGrade}
                </Text>
              </Tooltip>

              <InputNumber
                min={0}
                max={pointsLimit}
                size="middle"
                value={subjectData.points}
                onChange={(val) => handlePointChange(record.id, subjectData.inscriptionSubjectId, val)}
                disabled={!selectedTerm?.isBlocked}
                className="premium-input-number"
                style={{ width: 50, fontWeight: 700, borderRadius: 8 }}
              />

              <Tooltip title="Nota Final">
                <div style={{
                  width: 38,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: totalGrade < 10 ? '#fff1f0' : '#f6ffed',
                  borderRadius: 6,
                  border: `1px solid ${totalGrade < 10 ? '#ffa39e' : '#b7eb8f'}`
                }}>
                  <Text style={{ fontSize: 14, fontWeight: 800, color: totalGrade < 10 ? '#cf1322' : '#389e0d' }}>
                    {totalGrade}
                  </Text>
                </div>
              </Tooltip>
            </div>
          );
        }
      }))
    ];

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
          <Space size="large">
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
          </Space>
        </div>

        <Card
          className="premium-table-card"
          styles={{ body: { padding: 0 } }}
          style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)' }}
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
          `}</style>
          <Table
            dataSource={studentsData}
            columns={columns}
            rowKey="id"
            pagination={false}
            scroll={{ x: 'max-content', y: 'calc(100vh - 420px)' }}
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
    <div style={{ width: '100%', padding: '0 24px 40px' }}>
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
          { title: <Text style={{ fontWeight: 600, fontSize: 12, color: '#8c8c8c' }}>CONTROL DE ESTUDIOS</Text> },
          { title: <Text style={{ fontWeight: 800, fontSize: 12, color: '#262626' }}>CONSEJOS DE CURSO</Text> },
          ...(step >= 1 ? [{ title: <Tag color="blue" style={{ borderRadius: 6, fontWeight: 700, margin: 0 }}>{selectedTerm?.name}</Tag> }] : []),
          ...(step >= 2 ? [{ title: <Tag color="gold" style={{ borderRadius: 6, fontWeight: 700, margin: 0 }}>{selectedSection?.grade.name} {selectedSection?.section.name.replace(/sección/gi, '').trim()}</Tag> }] : []),
        ]}
      />

      {step === 0 && renderTermSelector()}
      {step === 1 && renderSectionSelector()}
      {step === 2 && renderDataTable()}
    </div>
  );
};

export default CourseCouncil;
