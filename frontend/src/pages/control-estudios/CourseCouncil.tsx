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

  const renderTermSelector = () => (
    <div style={{ padding: '20px 0' }}>
      <Title level={4} style={{ marginBottom: 32, textAlign: 'center' }}>Seleccione el Lapso</Title>
      <Row gutter={[24, 24]} justify="center">
        {terms.map(term => (
          <Col key={term.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{
                borderRadius: 16,
                textAlign: 'center',
                border: selectedTerm?.id === term.id ? '2px solid #1890ff' : '1px solid #f0f0f0',
                transition: 'all 0.3s'
              }}
              onClick={() => {
                setSelectedTerm(term);
                setStep(1);
              }}
            >
              <CalendarOutlined style={{ fontSize: 48, color: term.isBlocked ? '#bfbfbf' : '#1890ff', marginBottom: 16 }} />
              <Title level={4} style={{ margin: 0 }}>{term.name}</Title>
              {term.isBlocked && <Tag color="error" style={{ marginTop: 8 }}>Bloqueado</Tag>}
              {!term.isBlocked && <Tag color="success" style={{ marginTop: 8 }}>Activo</Tag>}
            </Card>
          </Col>
        ))}
        {terms.length === 0 && <Empty description="No hay lapsos configurados para este período" />}
      </Row>
    </div>
  );

  const renderSectionSelector = () => {
    // Agrupar secciones por grado
    const sectionsByGrade: { grade: Grade, sections: Section[] }[] = [];
    structure.forEach(pg => {
      const matchFilter = !filterYear || pg.grade.name.toLowerCase().includes(filterYear.toLowerCase());
      if (matchFilter) {
        sectionsByGrade.push({ grade: pg.grade, sections: pg.sections });
      }
    });

    return (
      <div style={{ padding: '0px 0' }}>
        <style>{`
          @keyframes slideInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .section-group {
            animation: slideInUp 0.5s ease-out both;
          }
          .section-card {
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
            border: 1px solid #f0f0f0 !important;
          }
          .section-card:hover {
            transform: translateY(-5px) scale(1.02);
            box-shadow: 0 12px 24px rgba(0,0,0,0.08) !important;
            border-color: transparent !important;
          }
          .section-card:active {
            transform: translateY(-2px) scale(1.01);
          }
          .section-letter {
            transition: all 0.3s ease;
          }
          .section-card:hover .section-letter {
            transform: rotate(-10deg) scale(1.1);
          }
          .grade-header {
            position: sticky;
            top: 0;
            z-index: 10;
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(8px);
            padding: 12px 0;
            margin-bottom: 24px;
            border-bottom: 1px solid rgba(0,0,0,0.03);
          }
        `}</style>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
          <Space size="large">
            <Button
              icon={<LeftOutlined />}
              onClick={() => setStep(0)}
              style={{ borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            />
            <div>
              <Title level={2} style={{ margin: 0, fontWeight: 800 }}>Seleccione la Sección</Title>
              <Text type="secondary">Elija el grupo académico para gestionar los puntos del consejo</Text>
            </div>
          </Space>
          <Input
            prefix={<FilterOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Buscar grado o año..."
            size="large"
            style={{ width: 300, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
          />
        </div>

        {sectionsByGrade.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Text type="secondary">No se encontraron grados que coincidan</Text>}
          />
        ) : (
          sectionsByGrade.map((group, groupIdx) => (
            <div
              key={group.grade.id}
              className="section-group"
              style={{
                marginBottom: 48,
                animationDelay: `${groupIdx * 0.1}s`
              }}
            >
              <div className="grade-header">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16
                }}>
                  <div style={{
                    width: 6,
                    height: 32,
                    borderRadius: 3,
                    background: group.grade.isDiversified
                      ? 'linear-gradient(to bottom, #fa541c, #ffbb96)'
                      : 'linear-gradient(to bottom, #1890ff, #91d5ff)'
                  }} />
                  <div>
                    <Title level={4} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>
                      {group.grade.name}
                    </Title>
                    <Text style={{ fontSize: 12, color: '#8c8c8c', textTransform: 'uppercase', fontWeight: 600 }}>
                      {group.grade.isDiversified ? 'Ciclo Diversificado' : 'Educación Media General'}
                    </Text>
                  </div>
                </div>
              </div>

              <Row gutter={[20, 20]}>
                {group.sections.map((sec) => (
                  <Col key={sec.id} xs={24} sm={12} md={8} lg={6}>
                    <Card
                      hoverable
                      className="section-card"
                      styles={{ body: { padding: '16px' } }}
                      style={{
                        borderRadius: 16,
                        overflow: 'hidden'
                      }}
                      onClick={() => {
                        setSelectedSection({ section: sec, grade: group.grade });
                        if (selectedTerm) fetchCouncilData(sec.id, selectedTerm.id, group.grade.id);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div
                          className="section-letter"
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 12,
                            background: group.grade.isDiversified ? '#fff2e8' : '#f0f5ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24,
                            fontWeight: 900,
                            color: group.grade.isDiversified ? '#fa541c' : '#1d39c4',
                            flexShrink: 0,
                            border: `1px solid ${group.grade.isDiversified ? '#ffd591' : '#adc6ff'}`
                          }}
                        >
                          {sec.name.replace(/sección/gi, '').trim().charAt(0)}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{
                            fontWeight: 700,
                            fontSize: 17,
                            color: '#1f1f1f',
                            marginBottom: 2
                          }}>
                            {sec.name.toLowerCase().includes('sección') ? sec.name : `Sección ${sec.name}`}
                          </div>
                          <Space split={<div style={{ width: 4, height: 4, borderRadius: '50%', background: '#d9d9d9' }} />}>
                            <Text style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 500 }}>
                              {activePeriod?.name}
                            </Text>
                            <Tag color={group.grade.isDiversified ? 'orange' : 'processing'} style={{ border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                              PROCESAR
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
    if (studentsData.length === 0) return <Empty description="No hay estudiantes en esta sección" />;

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
                  <UserOutlined style={{ color: '#595959', fontSize: 13 }} />
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
                  style={{ fontWeight: 600, border: 'none', borderRadius: 4, height: 20, lineHeight: '18px', fontSize: 11 }}
                >
                  Pts: {usedPoints} / {pointsLimit}
                </Tag>
              </div>
            </div>
          );
        }
      },
      {
        title: 'Promedio',
        key: 'average',
        width: 100,
        fixed: 'left' as const,
        align: 'center' as const,
        render: (_: any, record: CouncilStudent) => {
          const totalGrades = record.subjects.reduce((sum, s) => sum + (s.grade || 0) + (s.points || 0), 0);
          const average = record.subjects.length > 0 ? totalGrades / record.subjects.length : 0;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: 600, color: average < 10 ? '#cf1322' : '#096dd9' }}>
                {average.toFixed(2)}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: 500, color: '#595959' }}>Promedio Final</Text>
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
              maxWidth: 160
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
                  <div>
                    {colDef.groupId && <div style={{ marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 2 }}><strong>Materia:</strong> {subjectData.name}</div>}
                    {prevPointsTotal > 0 ? (
                      <>
                        <strong>Desglose de puntos previos:</strong>
                        {subjectData.otherTermsInfo?.map((info: any, idx: number) => (
                          <div key={idx} style={{ fontSize: 11 }}>
                            {info.termName}: {info.points}
                          </div>
                        ))}
                      </>
                    ) : (
                      "No se asignaron puntos en lapsos anteriores"
                    )}
                  </div>
                }
              >
                <Tag
                  color={prevPointsTotal > 0 ? "orange" : "default"}
                  style={{ fontSize: 10, padding: 0, margin: 0, lineHeight: '18px', width: 24, textAlign: 'center', fontWeight: 'normal' }}
                >
                  {prevPointsTotal > 0 ? `+${prevPointsTotal}` : '0'}
                </Tag>
              </Tooltip>

              <Tooltip title="Nota Base">
                <Text style={{ fontSize: 13, color: baseGrade < 10 ? '#cf1322' : '#262626', width: 35, textAlign: 'center', fontWeight: 'normal' }}>
                  {baseGrade}
                </Text>
              </Tooltip>

              <InputNumber
                min={0}
                max={pointsLimit}
                size="middle"
                value={subjectData.points}
                onChange={(val) => handlePointChange(record.id, subjectData.inscriptionSubjectId, val)}
                disabled={selectedTerm?.isBlocked}
                style={{ width: 50, fontWeight: 'normal' }}
              />

              <Tooltip title="Nota Final">
                <Text style={{ fontSize: 13, fontWeight: 700, color: totalGrade < 10 ? '#cf1322' : '#389e0d', width: 40, textAlign: 'center' }}>
                  {totalGrade}
                </Text>
              </Tooltip>
            </div>
          );
        }
      }))
    ];

    return (
      <div style={{ padding: '20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
          <Space direction="vertical">
            <Button icon={<LeftOutlined />} onClick={() => setStep(1)}>Cambiar Sección</Button>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {selectedSection?.grade.name} - {selectedSection?.section.name.toLowerCase().includes('sección') ? selectedSection?.section.name : `Sección ${selectedSection?.section.name}`}
              </Title>
              <Text type="secondary">{selectedTerm?.name} • {activePeriod?.name}</Text>
            </div>
          </Space>
          <Space>
            {selectedTerm?.isBlocked && (
              <Alert message="Este lapso está bloqueado" type="warning" showIcon style={{ padding: '4px 12px' }} />
            )}
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={selectedTerm?.isBlocked}
            >
              Guardar Puntos
            </Button>
          </Space>
        </div>

        <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <style>{`
            .council-table .ant-table-thead > tr > th {
              background-color: #f0f2f5 !important;
              color: #262626 !important;
              font-weight: 700 !important;
              border-bottom: 2px solid #d9d9d9 !important;
            }
            .council-table .row-odd {
              background-color: #ffffff;
            }
            .council-table .row-even {
              background-color: #f1f7ff;
            }
            .council-table .ant-table-row:hover > td {
              background-color: #e6f7ff !important;
            }
            .council-table .ant-table-cell {
              padding: 12px 8px !important;
            }
          `}</style>
          <Table
            dataSource={studentsData}
            columns={columns}
            rowKey="id"
            pagination={false}
            scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
            size="middle"
            bordered
            className="council-table"
            rowClassName={(_, index) => index % 2 === 0 ? 'row-odd' : 'row-even'}
          />
        </Card>
      </div>
    );
  };

  if (loading && step < 2) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="Cargando información..." />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', padding: '0 12px' }}>
      <Breadcrumb
        style={{ marginBottom: 24 }}
        items={[
          { title: 'Control de Estudios' },
          { title: 'Consejos de Curso' },
          ...(step >= 1 ? [{ title: selectedTerm?.name }] : []),
          ...(step >= 2 ? [{ title: `${selectedSection?.grade.name} ${selectedSection?.section.name}` }] : []),
        ]}
      />

      {step === 0 && renderTermSelector()}
      {step === 1 && renderSectionSelector()}
      {step === 2 && renderDataTable()}
    </div>
  );
};

export default CourseCouncil;
