import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Collapse, Tag, Space, Spin, Alert } from 'antd';
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
  if (records.length === 0) return <Alert message="No se encontraron registros académicos para este estudiante." type="info" showIcon />;

  return (
    <div style={{ padding: '20px 0' }}>
      <Title level={3}><FileTextOutlined /> Historial Académico</Title>

      <Collapse defaultActiveKey={[records[0]?.id]} ghost accordion expandIconPosition="end">
        {records.map(record => (
          <Panel
            key={record.id}
            header={
              <Space size="large">
                <Text
                  strong
                  style={{
                    fontSize: 16,
                    color: '#f5f7ff',
                    letterSpacing: 0.5,
                  }}
                >
                  <CalendarOutlined /> {record.period?.name}
                </Text>
                <Tag color="cyan">{record.grade?.name}</Tag>
                <Tag color="blue">{record.section?.name}</Tag>
              </Space>
            }
          >
            <Card bordered={false} className="inner-table-card">
              <Table<InscriptionSubject>
                dataSource={record.inscriptionSubjects}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: 'Materia / Grupo',
                    dataIndex: ['subject', 'name'],
                    key: 'subject',
                    width: '30%',
                    render: (_: string, recordItem) => {
                      const groupName = recordItem.subject?.subjectGroup?.name;
                      const displayName = groupName ?? recordItem.subject?.name;

                      return (
                        <Space direction="vertical" size={0}>
                          <Space>
                            <BookOutlined /> {displayName}
                          </Space>
                          {groupName && groupName !== recordItem.subject?.name && (
                            <Tag color="geekblue" style={{ marginLeft: 22 }}>
                              {recordItem.subject?.name}
                            </Tag>
                          )}
                        </Space>
                      );
                    }
                  },
                  {
                    title: 'Lapsos / Notas',
                    key: 'terms',
                    render: (_: unknown, subject: InscriptionSubject) => {
                      // Group qualifications by term
                      const terms = [1, 2, 3];
                      return (
                        <div style={{ display: 'flex', gap: 20 }}>
                          {terms.map(t => {
                            const quals = subject.qualifications?.filter(q => q.evaluationPlan?.term === t) || [];
                            const totalScore = quals.reduce((acc: number, q) => acc + (Number(q.score) * (Number(q.evaluationPlan?.percentage) / 100)), 0);
                            const hasNotes = quals.length > 0;

                            return (
                              <div key={t} style={{ flex: 1, minWidth: 100 }}>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>L{t}</Text>
                                {hasNotes ? (
                                  <Tag color={totalScore >= (maxGrade / 2) ? 'green' : 'red'} style={{ fontWeight: 'bold' }}>
                                    {totalScore.toFixed(2)} pts
                                  </Tag>
                                ) : (
                                  <Text type="secondary">-</Text>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                  },
                  {
                    title: 'Definitiva',
                    key: 'final',
                    align: 'center',
                    render: (_: unknown, subject: InscriptionSubject) => {
                      const quals = subject.qualifications || [];
                      // Calc average of terms where there is at least one note
                      const termScores = [1, 2, 3].map(t => {
                        const qL = quals.filter(q => q.evaluationPlan?.term === t);
                        if (qL.length === 0) return null;
                        return qL.reduce((acc: number, q: Qualification) => acc + (Number(q.score) * (Number(q.evaluationPlan?.percentage) / 100)), 0);
                      }).filter(s => s !== null);

                      if (termScores.length === 0) return '-';
                      const avg = termScores.reduce((a, b) => a + b, 0) / termScores.length;

                      return <Tag color={avg >= (maxGrade / 2) ? 'blue' : 'volcano'}>{avg.toFixed(2)}</Tag>;
                    }
                  }
                ]}
              />
            </Card>
          </Panel>
        ))}
      </Collapse>
    </div>
  );
};

export default StudentAcademicRecord;
