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
  subjects: {
    id: number;
    name: string;
    inscriptionSubjectId: number;
    points: number;
    councilPointId?: number;
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

  const [filterYear, setFilterYear] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const activeRes = await api.get('/academic/active');
      const period = activeRes.data;
      setActivePeriod(period);

      if (period) {
        const [termsRes, structureRes] = await Promise.all([
          api.get(`/terms?schoolPeriodId=${period.id}`),
          api.get(`/academic/structure/${period.id}`)
        ]);
        setTerms(termsRes.data.sort((a: Term, b: Term) => a.order - b.order));
        setStructure(structureRes.data);
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
    setStudentsData(prev => prev.map(student => {
      if (student.id === studentId) {
        return {
          ...student,
          subjects: student.subjects.map(s =>
            s.inscriptionSubjectId === inscriptionSubjectId ? { ...s, points: value || 0 } : s
          )
        };
      }
      return student;
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
    const filteredSections: { section: Section, grade: Grade }[] = [];
    structure.forEach(pg => {
      pg.sections.forEach(sec => {
        if (!filterYear || pg.grade.name.toLowerCase().includes(filterYear.toLowerCase())) {
          filteredSections.push({ section: sec, grade: pg.grade });
        }
      });
    });

    return (
      <div style={{ padding: '20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <Space>
            <Button icon={<LeftOutlined />} onClick={() => setStep(0)}>Volver</Button>
            <Title level={4} style={{ margin: 0 }}>Seleccione la Sección</Title>
          </Space>
          <Input
            prefix={<FilterOutlined />}
            placeholder="Filtrar por año/grado..."
            style={{ width: 250 }}
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
          />
        </div>
        <Row gutter={[16, 16]}>
          {filteredSections.map((item, idx) => (
            <Col key={idx} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                size="small"
                style={{
                  borderRadius: 12,
                  border: '1px solid #f0f0f0'
                }}
                onClick={() => {
                  setSelectedSection(item);
                  if (selectedTerm) fetchCouncilData(item.section.id, selectedTerm.id, item.grade.id);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: item.grade.isDiversified ? '#fff2e8' : '#e6f7ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: item.grade.isDiversified ? '#fa541c' : '#1890ff'
                  }}>
                    {item.section.name}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.grade.name}</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      {item.grade.isDiversified ? 'Diversificada' : 'Educación Media'}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
          {filteredSections.length === 0 && <Col span={24}><Empty description="No se encontraron secciones" /></Col>}
        </Row>
      </div>
    );
  };

  const renderDataTable = () => {
    if (studentsData.length === 0) return <Empty description="No hay estudiantes en esta sección" />;

    const subjects = studentsData[0].subjects;

    const columns = [
      {
        title: 'Estudiante',
        dataIndex: 'studentName',
        key: 'studentName',
        fixed: 'left' as const,
        width: 250,
        render: (text: string) => (
          <Space>
            <UserOutlined style={{ color: '#8c8c8c' }} />
            <Text strong>{text}</Text>
          </Space>
        )
      },
      ...subjects.map(sub => ({
        title: (
          <Tooltip title={sub.name}>
            <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', padding: '10px 0', maxHeight: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sub.name}
            </div>
          </Tooltip>
        ),
        key: sub.id,
        width: 80,
        align: 'center' as const,
        render: (_: any, record: CouncilStudent) => {
          const subjectData = record.subjects.find(s => s.id === sub.id);
          return (
            <InputNumber
              min={0}
              max={2}
              size="small"
              value={subjectData?.points}
              onChange={(val) => handlePointChange(record.id, subjectData!.inscriptionSubjectId, val)}
              disabled={selectedTerm?.isBlocked}
              style={{ width: 50 }}
            />
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
              <Title level={4} style={{ margin: 0 }}>{selectedSection?.grade.name} - Sección {selectedSection?.section.name}</Title>
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

        <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: 12, overflow: 'hidden' }}>
          <Table
            dataSource={studentsData}
            columns={columns}
            rowKey="id"
            pagination={false}
            scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
            size="small"
            bordered
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
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
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
