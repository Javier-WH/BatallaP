import { useState, useEffect, useCallback } from 'react';
import { Card, Select, Table, Input, Button, message, Space, Tag, Spin, Empty, Typography, Alert } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, SaveOutlined, CommentOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '@/services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface TermStatus {
  termId: number;
  termName: string;
  councilDone: boolean;
}
interface GuideSection {
  gradeId: number;
  gradeName: string;
  sectionId: number;
  sectionName: string;
  termStatuses: TermStatus[];
}
interface MyGuideSectionsResponse {
  sections: GuideSection[];
  terms: { id: number; name: string; order: number }[];
}
interface ObservationStudent {
  inscriptionId: number;
  firstName: string;
  lastName: string;
  document: string;
  finalAverage: number | null;
  rankPosition: number | null;
  rankTotal: number;
  rankTrend: 'up' | 'down' | 'same' | null;
  observation: string;
}

export default function Observations() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [sections, setSections] = useState<GuideSection[]>([]);
  const [, setTerms] = useState<{ id: number; name: string; order: number }[]>([]);
  const [selectedSectionIdx, setSelectedSectionIdx] = useState<number | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
  const [students, setStudents] = useState<ObservationStudent[]>([]);
  const [observationsDraft, setObservationsDraft] = useState<Map<number, string>>(new Map());
  const [isLocked, setIsLocked] = useState(false);

  // Load guide sections
  useEffect(() => {
    setLoading(true);
    api.get('/section-guides/my-sections')
      .then((res) => {
        const data = res.data as MyGuideSectionsResponse;
        setSections(data.sections);
        setTerms(data.terms);
        if (data.sections.length > 0) {
          setSelectedSectionIdx(0);
          // Auto-select the first term where council is NOT done (editable).
          // If all terms are done, select the last one (read-only).
          const firstSection = data.sections[0];
          const openTerms = firstSection.termStatuses.filter(t => !t.councilDone);
          if (openTerms.length > 0) {
            setSelectedTermId(openTerms[0].termId);
          } else if (firstSection.termStatuses.length > 0) {
            setSelectedTermId(firstSection.termStatuses[firstSection.termStatuses.length - 1].termId);
          }
        }
      })
      .catch((err) => {
        console.error('Error loading guide sections:', err);
        message.error('Error al cargar secciones guía');
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedSection = selectedSectionIdx != null ? sections[selectedSectionIdx] : null;
  const allTerms = selectedSection?.termStatuses || [];

  // Load observations when section or term changes
  const fetchObservations = useCallback(async () => {
    if (!selectedSection || !selectedTermId) {
      setStudents([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/observations', {
        params: {
          termId: selectedTermId,
          gradeId: selectedSection.gradeId,
          sectionId: selectedSection.sectionId,
        },
      });
      const data = res.data.students as ObservationStudent[];
      setStudents(data);
      setIsLocked(res.data.isLocked === true);
      const draftMap = new Map<number, string>();
      data.forEach((s) => draftMap.set(s.inscriptionId, s.observation));
      setObservationsDraft(draftMap);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al cargar observaciones';
      message.error(msg);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSection, selectedTermId]);

  useEffect(() => {
    fetchObservations();
  }, [fetchObservations]);

  const handleSave = async (inscriptionId: number) => {
    if (!selectedTermId) return;
    setSaving(inscriptionId);
    try {
      const text = observationsDraft.get(inscriptionId) || '';
      await api.put('/observations', {
        inscriptionId,
        termId: selectedTermId,
        text,
      });
      message.success('Observación guardada');
      // Update the student's observation in state
      setStudents(prev => prev.map(s =>
        s.inscriptionId === inscriptionId ? { ...s, observation: text } : s
      ));
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al guardar';
      message.error(msg);
    } finally {
      setSaving(null);
    }
  };

  const handleObservationChange = (inscriptionId: number, text: string) => {
    setObservationsDraft(prev => {
      const next = new Map(prev);
      next.set(inscriptionId, text);
      return next;
    });
  };

  const trendIcon = (trend: 'up' | 'down' | 'same' | null) => {
    if (!trend) return null;
    if (trend === 'up') return <ArrowUpOutlined style={{ color: '#389e0d' }} />;
    if (trend === 'down') return <ArrowDownOutlined style={{ color: '#cf1322' }} />;
    return <MinusOutlined style={{ color: '#8c8c8c' }} />;
  };

  const columns: ColumnsType<ObservationStudent> = [
    {
      title: '#',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, r, index) => (
        <Space>
          <Text strong>{index + 1}</Text>
          {trendIcon(r.rankTrend)}
        </Space>
      ),
    },
    {
      title: 'Estudiante',
      key: 'student',
      width: 200,
      render: (_, r) => (
        <div>
          <Text strong>{r.lastName}, {r.firstName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.document}</Text>
        </div>
      ),
    },
    {
      title: 'Promedio',
      key: 'average',
      width: 80,
      align: 'center',
      render: (_, r) => (
        <Text strong style={{ fontSize: 16 }}>
          {r.finalAverage != null ? r.finalAverage.toFixed(2) : '—'}
        </Text>
      ),
    },
    {
      title: 'Observaciones',
      key: 'observation',
      render: (_, r) => isLocked ? (
        <Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
          {observationsDraft.get(r.inscriptionId) || 'Sin observaciones.'}
        </Text>
      ) : (
        <div>
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={observationsDraft.get(r.inscriptionId) ?? ''}
              onChange={(e) => handleObservationChange(r.inscriptionId, e.target.value)}
              autoSize={{ minRows: 1, maxRows: 4 }}
              maxLength={230}
              showCount
              placeholder="Escriba las observaciones para este estudiante..."
              style={{ borderRadius: '6px 0 0 6px' }}
            />
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving === r.inscriptionId}
              onClick={() => handleSave(r.inscriptionId)}
              style={{ borderRadius: '0 6px 6px 0' }}
            />
          </Space.Compact>
        </div>
      ),
    },
  ];

  if (loading && sections.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <Card style={{ margin: 24 }}>
        <Empty
          description="No tiene secciones asignadas como profesor guía en el período activo."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            <CommentOutlined style={{ marginRight: 8 }} />
            Observaciones del Profesor Guía
          </Title>

          <Space wrap>
            {sections.length > 1 && (
              <Select
                value={selectedSectionIdx ?? undefined}
                onChange={(v) => {
                  setSelectedSectionIdx(v);
                  const sec = sections[v];
                  // Auto-select the first open term (council not done)
                  const open = sec.termStatuses.filter(t => !t.councilDone);
                  if (open.length > 0) {
                    setSelectedTermId(open[0].termId);
                  } else if (sec.termStatuses.length > 0) {
                    setSelectedTermId(sec.termStatuses[sec.termStatuses.length - 1].termId);
                  } else {
                    setSelectedTermId(null);
                  }
                }}
                style={{ width: 200 }}
                placeholder="Sección"
              >
                {sections.map((s, idx) => (
                  <Select.Option key={idx} value={idx}>
                    {s.gradeName} — {s.sectionName}
                  </Select.Option>
                ))}
              </Select>
            )}
            {selectedSection && (
              <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                {selectedSection.gradeName} — Sección {selectedSection.sectionName}
              </Tag>
            )}
            <Select
              value={selectedTermId ?? undefined}
              onChange={setSelectedTermId}
              style={{ width: 180 }}
              placeholder="Lapso"
            >
              {allTerms.map((t) => (
                <Select.Option key={t.termId} value={t.termId}>
                  {t.termName} {t.councilDone ? '(bloqueado)' : ''}
                </Select.Option>
              ))}
            </Select>
          </Space>

          {isLocked && (
            <Alert
              type="warning"
              message="El consejo de curso de este lapso ya fue completado. Las observaciones están bloqueadas y son de solo lectura."
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
        </Space>

        {selectedTermId && allTerms.length > 0 && (
          <Table
            columns={columns}
            dataSource={students}
            rowKey="inscriptionId"
            loading={loading}
            pagination={false}
            size="middle"
            bordered
          />
        )}
      </Card>
    </div>
  );
}
