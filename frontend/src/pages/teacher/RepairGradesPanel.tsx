import React, { useState, useEffect } from 'react';
import { Card, Select, Table, InputNumber, Button, Space, Typography, Spin, message, Tag, Empty, Alert } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Title, Text } = Typography;

interface RevisionItem {
  id: number;
  opportunity: number;
  score: number | null;
  status: string;
}

interface StudentRevisionData {
  inscriptionSubjectId: number;
  studentId: number;
  studentName: string;
  document: string;
  originalScore: number | null;
  maxOpportunities: number;
  revisions: RevisionItem[];
}

interface AssignmentDetail {
  periodGradeSubjectId: number;
  subjectName: string;
  passingGrade: number;
  students: StudentRevisionData[];
}

const RepairGradesPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedPgsId, setSelectedPgsId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [grades, setGrades] = useState<Record<number, number | null>>({});

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/revision-grades/my-assignments');
      setAssignments(res.data.assignments || []);
      if ((res.data.assignments || []).length > 0 && !selectedPgsId) {
        setSelectedPgsId(res.data.assignments[0].periodGradeSubjectId);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAssignments(); }, []);

  useEffect(() => {
    if (!selectedPgsId) { setDetail(null); setGrades({}); return; }
    const loadDetail = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/revision-grades/my-assignments/${selectedPgsId}`);
        setDetail(res.data);
        const initial: Record<number, number | null> = {};
        (res.data.students || []).forEach((s: StudentRevisionData) => {
          (s.revisions || []).forEach((r: RevisionItem) => {
            initial[r.id] = r.score;
          });
        });
        setGrades(initial);
      } catch (error: any) {
        message.error(error?.response?.data?.message || 'Error al cargar detalle');
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [selectedPgsId]);

  const handleSave = async () => {
    if (!selectedPgsId) return;
    setSaving(true);
    try {
      const activePeriodRes = await api.get('/academic/periods');
      const activePeriod = (activePeriodRes.data as any[]).find((p: any) => p.isActive);
      if (!activePeriod) { message.error('No hay período activo'); setSaving(false); return; }

      const gradesList = Object.entries(grades)
        .filter(([, score]) => score != null)
        .map(([id, score]) => ({ revisionId: Number(id), score }));

      if (gradesList.length === 0) { message.warning('No hay notas para guardar'); setSaving(false); return; }

      const res = await api.put(`/revision-periods/${activePeriod.id}/revisions/bulk`, { grades: gradesList });
      message.success(res.data.message || 'Notas guardadas');
      // Reload detail
      const detailRes = await api.get(`/revision-grades/my-assignments/${selectedPgsId}`);
      setDetail(detailRes.data);
      const updated: Record<number, number | null> = {};
      (detailRes.data.students || []).forEach((s: StudentRevisionData) => {
        (s.revisions || []).forEach((r: RevisionItem) => {
          updated[r.id] = r.score;
        });
      });
      setGrades(updated);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const assignmentOptions = assignments.map((a: any) => ({
    value: a.periodGradeSubjectId,
    label: `${a.subjectName} — ${a.gradeName} ${a.sectionName}`,
  }));

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 24 }}>Reparación de Materias</Title>

      <Spin spinning={loading}>
        {assignments.length === 0 ? (
          <Empty description="No tienes materias con estudiantes pendientes de reparación" />
        ) : (
          <>
            <Space style={{ marginBottom: 16 }}>
              <Text strong>Materia:</Text>
              <Select style={{ width: 400 }} value={selectedPgsId} onChange={setSelectedPgsId} options={assignmentOptions} />
              <Button icon={<ReloadOutlined />} onClick={fetchAssignments}>Actualizar</Button>
            </Space>

            {detail && (
              <>
                <Alert type="info" message={`Nota de aprobación: ${detail.passingGrade}`}
                  style={{ marginBottom: 16 }} />

                {detail.students.map((student) => (
                  <Card key={student.inscriptionSubjectId} size="small" style={{ marginBottom: 12 }}
                    title={
                      <Space>
                        <Text strong>{student.studentName}</Text>
                        <Tag>{student.document}</Tag>
                        <Text type="secondary">Nota original reprobada: {student.originalScore ?? '—'}</Text>
                      </Space>
                    }>
                    <Space wrap>
                      {student.revisions.map((rev) => (
                        <div key={rev.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 12 }}>Oportunidad {rev.opportunity}:</Text>
                          <InputNumber
                            min={0}
                            max={detail.passingGrade > 0 ? detail.passingGrade * 2 : 20}
                            step={0.01}
                            value={grades[rev.id] ?? undefined}
                            onChange={(val) => setGrades(prev => ({ ...prev, [rev.id]: val }))}
                            style={{ width: 80 }}
                            disabled={rev.status === 'approved'}
                          />
                          <Tag color={rev.status === 'approved' ? 'success' : rev.status === 'failed' ? 'error' : 'default'}>
                            {rev.status === 'approved' ? 'Aprobado' : rev.status === 'failed' ? 'Reprobado' : 'Pendiente'}
                          </Tag>
                        </div>
                      ))}
                    </Space>
                  </Card>
                ))}

                <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} size="large" style={{ marginTop: 16 }}>
                  Guardar notas
                </Button>
              </>
            )}
          </>
        )}
      </Spin>
    </div>
  );
};

export default RepairGradesPanel;
