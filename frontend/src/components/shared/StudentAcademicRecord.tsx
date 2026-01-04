import React, { useState, useEffect } from 'react';
import { Table, Typography, Collapse, Tag, Space, Spin, Empty } from 'antd';
import { FileTextOutlined, CalendarOutlined, BookOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface StudentAcademicRecordProps {
  personId: number;
}

interface SubjectGroup {
  name: string;
}

interface SubjectInfo {
  name: string;
  subjectGroup?: SubjectGroup | null;
}

interface EvaluationPlan {
  term?: number;
  percentage?: number;
}

interface Qualification {
  id: number;
  score: number | string;
  evaluationPlan?: EvaluationPlan | null;
}

interface InscriptionSubject {
  id: number;
  subject?: SubjectInfo | null;
  qualifications?: Qualification[];
}

interface AcademicRecord {
  id: number;
  period?: { name: string } | null;
  grade?: { name: string } | null;
  section?: { name: string } | null;
  inscriptionSubjects: InscriptionSubject[];
}

const StudentAcademicRecord: React.FC<StudentAcademicRecordProps> = ({ personId }) => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AcademicRecord[]>([]);
  const [maxGrade, setMaxGrade] = useState<number>(20);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings/max_grade');
        if (res.data?.value) setMaxGrade(Number(res.data.value));
      } catch (error) {
        console.error('Error fetching max_grade', error);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/evaluation/student-record/${personId}`);
        setRecords(res.data);
      } catch (error) {
        console.error('Error fetching academic record', error);
      } finally {
        setLoading(false);
      }
    };
    if (personId) fetchRecord();
  }, [personId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" tip="Cargando historial académico..." /></div>;
  if (records.length === 0) return (
    <div style={{ padding: '40px 0' }}>
      <Empty description="No se encontraron registros académicos para este estudiante." />
    </div>
  );

  return (
    <div className="animate-card delay-1" style={{ padding: '8px 0' }}>
      <style>{`
        .academic-collapse .ant-collapse-item {
          border: none !important;
          margin-bottom: 20px !important;
          background: transparent !important;
        }
        .academic-collapse .ant-collapse-header {
          padding: 20px 24px !important;
          background: #fff !important;
          border: 1px solid #f0f0f0 !important;
          border-radius: 16px !important;
          transition: all 0.3s ease !important;
          align-items: center !important;
        }
        .academic-collapse .ant-collapse-header:hover {
          border-color: #1890ff !important;
          box-shadow: 0 4px 15px rgba(0,0,0,0.04) !important;
        }
        .academic-collapse .ant-collapse-item-active > .ant-collapse-header {
          border-color: #1890ff !important;
          border-bottom-left-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
          box-shadow: 0 4px 15px rgba(24,144,255,0.05) !important;
        }
        .academic-collapse .ant-collapse-content {
          border: 1px solid #f0f0f0 !important;
          border-top: none !important;
          border-bottom-left-radius: 16px !important;
          border-bottom-right-radius: 16px !important;
          background: #fff !important;
        }

        .record-table .ant-table-thead > tr > th {
          background: #fafafa !important;
          font-weight: 700 !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          color: #8c8c8c !important;
          padding: 16px !important;
        }
        .record-table .ant-table-tbody > tr > td {
          padding: 16px !important;
        }

        .term-box {
          background: #fdfdfd;
          border: 1px solid #f5f5f5;
          border-radius: 8px;
          padding: 8px 12px;
          min-width: 85px;
          text-align: center;
        }
        .term-label {
          font-size: 10px;
          font-weight: 800;
          color: #bfbfbf;
          text-transform: uppercase;
          display: block;
          margin-bottom: 4px;
        }
      `}</style>

      <Title level={4} style={{ marginBottom: 24, paddingLeft: 8, fontWeight: 800 }}>
        <FileTextOutlined style={{ color: '#1890ff', marginRight: 12 }} />
        Historial de Calificaciones
      </Title>

      <Collapse defaultActiveKey={[records[0]?.id]} className="academic-collapse" accordion expandIconPosition="end">
        {records.map(record => (
          <Panel
            key={record.id}
            header={
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '95%', alignItems: 'center' }}>
                <Space size="middle">
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: '#e6f7ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid #91d5ff'
                  }}>
                    <CalendarOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                  </div>
                  <Space direction="vertical" size={0}>
                    <Text strong style={{ fontSize: 15, color: '#262626' }}>{record.period?.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>Año Escolar Legislado</Text>
                  </Space>
                </Space>
                <Space size="small">
                  <Tag color="blue" style={{ borderRadius: 6, fontWeight: 700, margin: 0, padding: '2px 10px', fontSize: 11 }}>{record.grade?.name.toUpperCase()}</Tag>
                  <Tag color="processing" style={{ borderRadius: 6, fontWeight: 700, margin: 0, padding: '2px 10px', fontSize: 11 }}>SECCIÓN {record.section?.name}</Tag>
                </Space>
              </div>
            }
          >
            <div style={{ padding: '8px 4px' }}>
              <Table<InscriptionSubject>
                dataSource={record.inscriptionSubjects}
                rowKey="id"
                pagination={false}
                className="record-table"
                columns={[
                  {
                    title: 'Materia y Contenido',
                    key: 'subject',
                    width: '35%',
                    render: (_: string, recordItem) => {
                      const groupName = recordItem.subject?.subjectGroup?.name;
                      const displayName = groupName ?? recordItem.subject?.name;

                      return (
                        <Space size="middle">
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BookOutlined style={{ color: '#8c8c8c' }} />
                          </div>
                          <Space direction="vertical" size={0}>
                            <Text strong style={{ color: '#262626', fontSize: 14 }}>{displayName}</Text>
                            {groupName && groupName !== recordItem.subject?.name && (
                              <Text type="secondary" style={{ fontSize: 11 }}>{recordItem.subject?.name}</Text>
                            )}
                          </Space>
                        </Space>
                      );
                    }
                  },
                  {
                    title: 'Rendimiento por Lapso',
                    key: 'terms',
                    render: (_: unknown, subject: InscriptionSubject) => {
                      const terms = [1, 2, 3];
                      return (
                        <Space size="middle">
                          {terms.map(t => {
                            const quals = subject.qualifications?.filter(q => q.evaluationPlan?.term === t) || [];
                            const totalScore = quals.reduce((acc: number, q) => acc + (Number(q.score) * (Number(q.evaluationPlan?.percentage) / 100)), 0);
                            const hasNotes = quals.length > 0;

                            return (
                              <div key={t} className="term-box">
                                <span className="term-label">Lapso {t}</span>
                                {hasNotes ? (
                                  <Text strong style={{
                                    color: totalScore >= (maxGrade / 2) ? '#52c41a' : '#f5222d',
                                    fontSize: 14
                                  }}>
                                    {totalScore % 1 === 0 ? totalScore.toFixed(0) : totalScore.toFixed(2)}
                                  </Text>
                                ) : (
                                  <Text style={{ color: '#d9d9d9' }}>—</Text>
                                )}
                              </div>
                            );
                          })}
                        </Space>
                      );
                    }
                  },
                  {
                    title: 'Definitiva',
                    key: 'final',
                    align: 'center',
                    width: 120,
                    render: (_: unknown, subject: InscriptionSubject) => {
                      const quals = subject.qualifications || [];
                      const termScores = [1, 2, 3].map(t => {
                        const qL = quals.filter(q => q.evaluationPlan?.term === t);
                        if (qL.length === 0) return null;
                        return qL.reduce((acc: number, q: Qualification) => acc + (Number(q.score) * (Number(q.evaluationPlan?.percentage) / 100)), 0);
                      }).filter(s => s !== null);

                      if (termScores.length === 0) return <Text type="secondary">—</Text>;
                      const avg = termScores.reduce((a, b) => a + b, 0) / termScores.length;

                      return (
                        <div style={{
                          background: avg >= (maxGrade / 2) ? '#e6f7ff' : '#fff1f0',
                          padding: '6px 0',
                          borderRadius: 8,
                          border: `1px solid ${avg >= (maxGrade / 2) ? '#91d5ff' : '#ffa39e'}`,
                          width: 60,
                          margin: '0 auto'
                        }}>
                          <Text strong style={{ color: avg >= (maxGrade / 2) ? '#1890ff' : '#f5222d', fontSize: 15 }}>
                            {avg % 1 === 0 ? avg.toFixed(0) : avg.toFixed(1)}
                          </Text>
                        </div>
                      );
                    }
                  }
                ]}
              />
            </div>
          </Panel>
        ))}
      </Collapse>
    </div>
  );
};

export default StudentAcademicRecord;
