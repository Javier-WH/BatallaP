import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Collapse, Tag, Space, Spin, Alert, Divider } from 'antd';
import { FileTextOutlined, CalendarOutlined, BookOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface StudentAcademicRecordProps {
  personId: number;
}

const StudentAcademicRecord: React.FC<StudentAcademicRecordProps> = ({ personId }) => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);

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

      <Collapse defaultActiveKey={[records[0]?.id]} ghost accordion expandIconPosition="right">
        {records.map((record: any) => (
          <Panel
            key={record.id}
            header={
              <Space size="large">
                <Text strong style={{ fontSize: 16 }}><CalendarOutlined /> {record.period?.name}</Text>
                <Tag color="cyan">{record.grade?.name}</Tag>
                <Tag color="blue">{record.section?.name}</Tag>
              </Space>
            }
          >
            <Card bordered={false} className="inner-table-card">
              <Table
                dataSource={record.inscriptionSubjects}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: 'Materia',
                    dataIndex: ['subject', 'name'],
                    key: 'subject',
                    width: '30%',
                    render: (text: string) => <Space><BookOutlined /> {text}</Space>
                  },
                  {
                    title: 'Lapsos / Notas',
                    key: 'terms',
                    render: (_, subject: any) => {
                      // Group qualifications by term
                      const terms = [1, 2, 3];
                      return (
                        <div style={{ display: 'flex', gap: 20 }}>
                          {terms.map(t => {
                            const quals = subject.qualifications?.filter((q: any) => q.evaluationPlan?.term === t) || [];
                            const totalScore = quals.reduce((acc: number, q: any) => acc + (Number(q.score) * (Number(q.evaluationPlan?.percentage) / 100)), 0);
                            const hasNotes = quals.length > 0;

                            return (
                              <div key={t} style={{ flex: 1, minWidth: 100 }}>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>L{t}</Text>
                                {hasNotes ? (
                                  <Tag color={totalScore >= 10 ? 'green' : 'red'} style={{ fontWeight: 'bold' }}>
                                    {totalScore.toFixed(2)} pts
                                  </Tag>
                                ) : (
                                  <Text type="disabled">-</Text>
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
                    render: (_, subject: any) => {
                      const quals = subject.qualifications || [];
                      // Calc average of terms where there is at least one note
                      const termScores = [1, 2, 3].map(t => {
                        const qL = quals.filter((q: any) => q.evaluationPlan?.term === t);
                        if (qL.length === 0) return null;
                        return qL.reduce((acc: number, q: any) => acc + (Number(q.score) * (Number(q.evaluationPlan?.percentage) / 100)), 0);
                      }).filter(s => s !== null);

                      if (termScores.length === 0) return '-';
                      const avg = termScores.reduce((a, b) => a + b, 0) / termScores.length;

                      return <Tag color={avg >= 10 ? 'blue' : 'volcano'}>{avg.toFixed(2)}</Tag>;
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
