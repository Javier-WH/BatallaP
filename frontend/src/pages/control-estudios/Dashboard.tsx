import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Tag, Button, Empty, Progress, List, Space, Typography, message } from 'antd';
import api from '@/services/api';

const { Text } = Typography;

interface ControlPanelData {
  period: { id: number; name: string; period: string };
  students: { total: number; matriculated: number; pending: number };
  lapses: {
    total: number;
    blocked: number;
    terms: { id: number; name: string; order: number; isBlocked: boolean; openDate?: string; closeDate?: string }[];
  };
  council: {
    checklist: { total: number; done: number };
    blockedTerms: number;
    totalTerms: number;
  };
  teachers: {
    totalAssignments: number;
    withoutPlans: number;
    withoutGrades: number;
    sampleWithoutPlans: AssignmentInsight[];
    sampleWithoutGrades: AssignmentInsight[];
  };
}

interface AssignmentInsight {
  teacher: string;
  subject: string;
  grade: string;
  section: string;
}

const ControlEstudiosDashboard: React.FC = () => {
  const [data, setData] = useState<ControlPanelData | null>(null);
  const [loading, setLoading] = useState(false);

  const checklistProgress = useMemo(() => {
    if (!data) return 0;
    const { total, done } = data.council.checklist;
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  }, [data]);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const res = await api.get<ControlPanelData>('/dashboard/control');
        setData(res.data);
      } catch (error) {
        console.error(error);
        message.error('No se pudo cargar el panel de control.');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading && !data) {
    return <Card loading />;
  }

  if (!data) {
    return (
      <Card>
        <Empty description="No hay información disponible para el período activo." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">Panel Control de Estudios</h1>
        <p className="text-slate-500 font-medium">
          Seguimiento en tiempo real del período {data.period.period} — {data.period.name}
        </p>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <Card className="glass-card summary-card">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Total Estudiantes</p>
            <h2 className="text-5xl font-black text-slate-900">{data.students.total}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {data.students.matriculated} matriculados · {data.students.pending} pendientes
            </p>
            <div className="flex gap-4 mt-4 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Tag color="blue">En sección</Tag>
                <span>{data.council.blockedTerms} lapsos bloqueados</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag color="purple">Plan</Tag>
                <span>{data.teachers.withoutPlans} materias sin plan</span>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Space direction="vertical" size={2}>
              <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Matriculados</span>
              <Text style={{ fontSize: 32, fontWeight: 800 }}>{data.students.matriculated}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>Estudiantes con inscripción confirmada</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Space direction="vertical" size={2}>
              <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Inscritos pendientes</span>
              <Text style={{ fontSize: 32, fontWeight: 800 }}>{data.students.pending}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>Listos para completar matrícula</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="Estado de Lapsos">
            {data.lapses.terms.length === 0 ? (
              <Empty description="No hay lapsos configurados." />
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={data.lapses.terms}
                renderItem={term => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <strong>{term.order}. {term.name}</strong>
                          <Tag color={term.isBlocked ? 'green' : 'orange'}>
                            {term.isBlocked ? 'Cerrado' : 'Abierto'}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {term.openDate ? `Apertura: ${new Date(term.openDate).toLocaleDateString()}` : 'Sin fecha'}
                          {' · '}
                          {term.closeDate ? `Cierre: ${new Date(term.closeDate).toLocaleDateString()}` : 'Sin fecha'}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Consejos de Curso">
            <Space direction="vertical" className="w-full">
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Avance checklist</Text>
                <Progress percent={checklistProgress} status={checklistProgress === 100 ? 'success' : 'active'} />
              </div>
              <div className="flex justify-between text-sm">
                <span>{data.council.checklist.done} completados de {data.council.checklist.total}</span>
                <span>{data.council.blockedTerms}/{data.council.totalTerms} lapsos bloqueados</span>
              </div>
              <Button type="link" href="/control-estudios/consejos-curso">
                Ir a Consejos de Curso
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card
            title="Profesores sin plan de evaluación"
            extra={<Tag color="red">{data.teachers.withoutPlans}</Tag>}
          >
            {data.teachers.sampleWithoutPlans.length === 0 ? (
              <Empty description="Todos los docentes tienen plan." />
            ) : (
              <List
                dataSource={data.teachers.sampleWithoutPlans}
                renderItem={(item, idx) => (
                  <List.Item key={idx}>
                    <div>
                      <Text strong>{item.teacher}</Text>
                      <div className="text-sm text-slate-500">
                        {item.subject} · {item.grade} / {item.section}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="Profesores sin registros de notas"
            extra={<Tag color="orange">{data.teachers.withoutGrades}</Tag>}
          >
            {data.teachers.sampleWithoutGrades.length === 0 ? (
              <Empty description="Todos los docentes ya cargaron notas." />
            ) : (
              <List
                dataSource={data.teachers.sampleWithoutGrades}
                renderItem={(item, idx) => (
                  <List.Item key={idx}>
                    <div>
                      <Text strong>{item.teacher}</Text>
                      <div className="text-sm text-slate-500">
                        {item.subject} · {item.grade} / {item.section}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ControlEstudiosDashboard;
