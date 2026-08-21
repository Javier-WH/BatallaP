import React, { useState, useEffect } from 'react';
import {
  Table,
  Typography,
  Collapse,
  Tag,
  Space,
  Spin,
  Empty,
} from 'antd';
import {
  FileTextOutlined,
  CalendarOutlined,
  BookOutlined,
} from '@ant-design/icons';
import api from '@/services/api';
import { useGradeRounding } from '@/context/GradeRoundingContext';
import { formatGrade, formatGradePadded } from '@/utils/gradeFormat';
import { fetchLetterGrades, numericToLetter } from '@/utils/letterGradeFormat';
import type { LetterGrade } from '@/utils/letterGradeFormat';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface StudentAcademicRecordProps {
  personId?: number;
}

interface SubjectGroup {
  name: string;
}

interface SubjectInfo {
  name: string;
  subjectGroup?: SubjectGroup | null;
  usesLiteralGrades?: boolean;
}

interface EvaluationPlan {
  termId?: number;
  percentage?: number;
}

interface Qualification {
  id: number;
  score: number | string;
  evaluationPlan?: EvaluationPlan | null;
}

interface CouncilPoint {
  id: number;
  termId: number;
  points: number;
}

interface InscriptionSubject {
  id: number;
  subject?: SubjectInfo | null;
  qualifications?: Qualification[];
  councilPoints?: CouncilPoint[];
  termGrades?: { termId: number; score: number }[];
  finalGrade?: { finalScore: number | null; status: string; gradeType?: string | null } | null;
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
  const [letterGrades, setLetterGrades] = useState<LetterGrade[]>([]);
  const { enableRounding } = useGradeRounding();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings/max_grade');
        if (res.data?.value) setMaxGrade(Number(res.data.value));
      } catch {
        // Silently use default max_grade of 20 if endpoint doesn't exist
        setMaxGrade(20);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const fetchLetterGradeConfig = async () => {
      const grades = await fetchLetterGrades();
      setLetterGrades(grades);
    };
    fetchLetterGradeConfig();
  }, []);

  useEffect(() => {
    if (!personId) {
      setRecords([]);
      return;
    }
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
    fetchRecord();
  }, [personId]);

  const renderStudentRecord = () => {
    if (loading) {
      return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }
    if (!personId) {
      return (
        <div style={{ padding: '40px 0' }}>
          <Empty description="Selecciona un estudiante para ver su historial académico." />
        </div>
      );
    }
    if (records.length === 0) {
      return (
        <div style={{ padding: '40px 0' }}>
          <Empty description="No se encontraron registros académicos para este estudiante." />
        </div>
      );
    }

    return (
      <div className="animate-card delay-1" style={{ padding: '8px 0' }}>
        <style>{`
        .academic-collapse.ant-collapse {
          border: none !important;
        }
        .academic-collapse .ant-collapse-item {
          border: none !important;
          margin-bottom: 24px !important;
          background: transparent !important;
        }
        .academic-collapse .ant-collapse-header {
          padding: 22px 28px !important;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 18px !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          align-items: center !important;
        }
        .academic-collapse .ant-collapse-header:hover {
          border-color: #94a3b8 !important;
          box-shadow: 0 8px 25px rgba(15, 23, 42, 0.06) !important;
        }
        .academic-collapse .ant-collapse-item-active > .ant-collapse-header {
          border-color: #1e40af !important;
          border-bottom-left-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
          box-shadow: 0 8px 25px rgba(30, 64, 175, 0.08) !important;
        }
        .academic-collapse .ant-collapse-content {
          border: 1px solid #e2e8f0 !important;
          border-top: none !important;
          border-bottom-left-radius: 18px !important;
          border-bottom-right-radius: 18px !important;
          background: #ffffff !important;
          overflow: hidden !important;
        }
        .academic-collapse .ant-collapse-item-active > .ant-collapse-content {
          border-color: #1e40af !important;
        }
        .record-table .ant-table-wrapper,
        .record-table .ant-table,
        .record-table .ant-table-container {
          border: none !important;
        }

        .record-table .ant-table-thead > tr > th {
          background: #f1f5f9 !important;
          font-weight: 700 !important;
          font-size: 10px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
          color: #64748b !important;
          padding: 14px 16px !important;
          border-bottom: 2px solid #e2e8f0 !important;
          white-space: nowrap !important;
        }
        .record-table .ant-table-tbody > tr > td {
          padding: 18px 16px !important;
          border-bottom: 1px solid #f1f5f9 !important;
          vertical-align: middle !important;
        }
        .record-table .ant-table-tbody > tr:hover > td {
          background: #f8fafc !important;
        }
        .record-table .ant-table-tbody > tr:last-child > td {
          border-bottom: none !important;
        }

        .lapso-badge {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 78px;
          padding: 8px 12px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          text-align: center;
        }
        .lapso-badge.approved {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }
        .lapso-badge.failed {
          background: #fef2f2;
          border-color: #fecaca;
        }
        .lapso-label {
          font-size: 9px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .lapso-value {
          font-size: 15px;
          font-weight: 700;
          line-height: 1.2;
        }
        .lapso-points {
          font-size: 9px;
          font-weight: 700;
          margin-top: 2px;
        }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, paddingLeft: 4 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(30, 64, 175, 0.25)'
          }}>
            <FileTextOutlined style={{ color: '#ffffff', fontSize: 18 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Historial de Calificaciones
            </Title>
            <Text type="secondary" style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
              Registro académico oficial del estudiante por período lectivo
            </Text>
          </div>
        </div>

        <Collapse defaultActiveKey={[records[0]?.id]} className="academic-collapse" accordion expandIcon={() => null}>
          {records.map(record => (
            <Panel
              key={record.id}
              header={
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <Space size="middle">
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: '#1e40af',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 14px rgba(30, 64, 175, 0.25)'
                    }}>
                      <CalendarOutlined style={{ fontSize: 20, color: '#ffffff' }} />
                    </div>
                    <Space direction="vertical" size={2}>
                      <Text strong style={{ fontSize: 16, color: '#0f172a', letterSpacing: '-0.01em' }}>{record.period?.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Año Escolar · {record.inscriptionSubjects.length} materias</Text>
                    </Space>
                  </Space>
                  <Space size="small">
                    <Tag style={{ borderRadius: 8, fontWeight: 700, margin: 0, padding: '4px 12px', fontSize: 11, border: 'none', background: '#e0e7ff', color: '#1e40af' }}>{record.grade?.name?.toUpperCase()}</Tag>
                    <Tag style={{ borderRadius: 8, fontWeight: 700, margin: 0, padding: '4px 12px', fontSize: 11, border: 'none', background: '#f1f5f9', color: '#475569' }}>SECCIÓN {record.section?.name}</Tag>
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
                      title: 'Materia',
                      key: 'subject',
                      width: '32%',
                      render: (_: string, recordItem) => {
                        const groupName = recordItem.subject?.subjectGroup?.name;
                        const displayName = groupName ?? recordItem.subject?.name;
                        const isPending = (recordItem as { isPending?: boolean }).isPending;

                        return (
                          <Space size="middle" align="start">
                            <div style={{
                              width: 36, height: 36, borderRadius: 10,
                              background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <BookOutlined style={{ color: '#1e40af', fontSize: 16 }} />
                            </div>
                            <Space direction="vertical" size={0}>
                              <Space>
                                <Text strong style={{ color: '#0f172a', fontSize: 14, fontWeight: 700 }}>{displayName}</Text>
                                {isPending && <Tag color="warning" style={{ fontSize: 10, fontWeight: 700, borderRadius: 6, margin: 0 }}>PENDIENTE</Tag>}
                              </Space>
                              {groupName && groupName !== recordItem.subject?.name && (
                                <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>{recordItem.subject?.name}</Text>
                              )}
                            </Space>
                          </Space>
                        );
                      }
                    },
                    {
                      title: 'I Lapso',
                      key: 'lapso1',
                      align: 'center',
                      width: 110,
                      render: (_: unknown, subject: InscriptionSubject) => {
                        const t = 1;
                        // Use SubjectTermGrade from backend (accumulated score) if available
                        const tg = subject.termGrades?.find(tg => tg.termId === t);
                        const councilPoint = subject.councilPoints?.find(cp => cp.termId === t);
                        const points = councilPoint ? Number(councilPoint.points) : 0;
                        const finalTermScore = tg ? Math.max(1, Number(tg.score)) : 0;
                        const hasNotes = (tg && Number(tg.score) > 0) || points > 0 ||
                          (subject.qualifications?.filter(q => q.evaluationPlan?.termId === t).length || 0) > 0;
                        const approved = finalTermScore >= (maxGrade / 2);
                        if (!hasNotes) return <Text style={{ color: '#cbd5e1', fontWeight: 600, fontSize: 13 }}>—</Text>;
                        return (
                          <div className={`lapso-badge ${approved ? 'approved' : 'failed'}`}>
                            {points > 0 && <span className="lapso-points" style={{ color: '#1e40af' }}>+{points} pts</span>}
                            <Text strong className="lapso-value" style={{ color: approved ? '#15803d' : '#b91c1c' }}>
                              {(() => {
                                const usesLiteral = subject.subject?.usesLiteralGrades;
                                if (usesLiteral) return numericToLetter(finalTermScore, letterGrades);
                                return formatGradePadded(finalTermScore, maxGrade);
                              })()}
                            </Text>
                          </div>
                        );
                      }
                    },
                    {
                      title: 'II Lapso',
                      key: 'lapso2',
                      align: 'center',
                      width: 110,
                      render: (_: unknown, subject: InscriptionSubject) => {
                        const t = 2;
                        const tg = subject.termGrades?.find(tg => tg.termId === t);
                        const councilPoint = subject.councilPoints?.find(cp => cp.termId === t);
                        const points = councilPoint ? Number(councilPoint.points) : 0;
                        const finalTermScore = tg ? Math.max(1, Number(tg.score)) : 0;
                        const hasNotes = (tg && Number(tg.score) > 0) || points > 0 ||
                          (subject.qualifications?.filter(q => q.evaluationPlan?.termId === t).length || 0) > 0;
                        const approved = finalTermScore >= (maxGrade / 2);
                        if (!hasNotes) return <Text style={{ color: '#cbd5e1', fontWeight: 600, fontSize: 13 }}>—</Text>;
                        return (
                          <div className={`lapso-badge ${approved ? 'approved' : 'failed'}`}>
                            {points > 0 && <span className="lapso-points" style={{ color: '#1e40af' }}>+{points} pts</span>}
                            <Text strong className="lapso-value" style={{ color: approved ? '#15803d' : '#b91c1c' }}>
                              {(() => {
                                const usesLiteral = subject.subject?.usesLiteralGrades;
                                if (usesLiteral) return numericToLetter(finalTermScore, letterGrades);
                                return formatGradePadded(finalTermScore, maxGrade);
                              })()}
                            </Text>
                          </div>
                        );
                      }
                    },
                    {
                      title: 'III Lapso',
                      key: 'lapso3',
                      align: 'center',
                      width: 110,
                      render: (_: unknown, subject: InscriptionSubject) => {
                        const t = 3;
                        const tg = subject.termGrades?.find(tg => tg.termId === t);
                        const councilPoint = subject.councilPoints?.find(cp => cp.termId === t);
                        const points = councilPoint ? Number(councilPoint.points) : 0;
                        const finalTermScore = tg ? Math.max(1, Number(tg.score)) : 0;
                        const hasNotes = (tg && Number(tg.score) > 0) || points > 0 ||
                          (subject.qualifications?.filter(q => q.evaluationPlan?.termId === t).length || 0) > 0;
                        const approved = finalTermScore >= (maxGrade / 2);
                        if (!hasNotes) return <Text style={{ color: '#cbd5e1', fontWeight: 600, fontSize: 13 }}>—</Text>;
                        return (
                          <div className={`lapso-badge ${approved ? 'approved' : 'failed'}`}>
                            {points > 0 && <span className="lapso-points" style={{ color: '#1e40af' }}>+{points} pts</span>}
                            <Text strong className="lapso-value" style={{ color: approved ? '#15803d' : '#b91c1c' }}>
                              {(() => {
                                const usesLiteral = subject.subject?.usesLiteralGrades;
                                if (usesLiteral) return numericToLetter(finalTermScore, letterGrades);
                                return formatGradePadded(finalTermScore, maxGrade);
                              })()}
                            </Text>
                          </div>
                        );
                      }
                    },
                    {
                      title: 'Definitiva',
                      key: 'final',
                      align: 'center',
                      width: 120,
                      render: (_: unknown, subject: InscriptionSubject) => {
                        // Use SubjectFinalGrade from backend if available (accumulated score)
                        // Otherwise calculate from SubjectTermGrade (accumulated, not final)
                        let avg: number | null = null;

                        if (subject.finalGrade?.finalScore != null) {
                          avg = Math.max(1, Number(subject.finalGrade.finalScore));
                        } else if (subject.termGrades && subject.termGrades.length > 0) {
                          const scores = subject.termGrades
                            .map(tg => Math.max(1, Number(tg.score)))
                            .filter(s => s > 0);
                          if (scores.length > 0) {
                            avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                          }
                        }

                        if (avg === null) return <Text style={{ color: '#cbd5e1', fontWeight: 600, fontSize: 13 }}>—</Text>;
                        const approved = avg >= (maxGrade / 2);

                        return (
                          <div style={{
                            display: 'inline-flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            minWidth: 72,
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: approved
                              ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                              : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                            border: `1.5px solid ${approved ? '#bbf7d0' : '#fecaca'}`,
                          }}>
                            <Text strong style={{
                              color: approved ? '#15803d' : '#b91c1c',
                              fontSize: 18,
                              lineHeight: 1,
                              letterSpacing: '-0.02em'
                            }}>
                              {(() => {
                                const usesLiteral = subject.subject?.usesLiteralGrades;
                                if (usesLiteral) return numericToLetter(avg, letterGrades);
                                return formatGradePadded(avg, maxGrade);
                              })()}
                            </Text>
                            <span style={{
                              fontSize: 9,
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              color: approved ? '#86efac' : '#fca5a5',
                              lineHeight: 1
                            }}>{approved ? 'Aprobada' : 'Reprobada'}</span>
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

  return renderStudentRecord();
};

export default StudentAcademicRecord;
