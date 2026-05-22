import { useEffect, useState } from 'react';
import { Row, Col, Card, Button, Tag, Empty, List, Typography, Space, message } from 'antd';
import {
  GlobalOutlined,
  ArrowRightOutlined,
  TeamOutlined
} from '@ant-design/icons';
import api from '@/services/api';

const { Text } = Typography;

interface MasterDashboardData {
  academic:
    | { period: null }
    | {
        period: { id: number; name: string; period: string };
        students: { total: number; matriculated: number; pending: number };
        lapses: {
          total: number;
          blocked: number;
          terms: { id: number; name: string; order: number; isBlocked: boolean }[];
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
      };
  users: { total: number };
  institution: {
    name: string;
    logoUrl: string;
    logoShape: 'circle' | 'square';
    motto: string;
    code: string;
  };
}

interface AssignmentInsight {
  teacher: string;
  subject: string;
  grade: string;
  section: string;
}

const MasterDashboard: React.FC = () => {
  const [data, setData] = useState<MasterDashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get<MasterDashboardData>('/dashboard/master');
        setData(res.data);
      } catch (error) {
        console.error(error);
        message.error('No se pudo cargar el panel maestro.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading && !data) return <Card loading />;

  if (!data) {
    return (
      <Card>
        <Empty description="No hay información disponible" />
      </Card>
    );
  }

  const { academic, institution, users } = data;

  return (
    <div className="h-full overflow-y-auto pr-4">
      <div className="space-y-8 pb-8">
        <div className="relative overflow-hidden rounded-2xl theme-panel-header p-8 md:p-10 text-header-text" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="relative z-10 space-y-4 max-w-3xl">
            <Tag color="gold" className="border-none font-bold uppercase tracking-widest text-[10px] px-3 py-1 rounded-full">
              Acceso de Súper Usuario
            </Tag>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">{institution.name}</h1>
            {institution.motto && <p className="text-header-text/80 text-lg font-medium">“{institution.motto}”</p>}
            <div className="pt-2 flex flex-wrap gap-4 text-sm text-header-text/70">
              <span>Código institucional: {institution.code || 'N/D'}</span>
              <span>Total usuarios: {users.total}</span>
            </div>
            <div className="pt-4 flex flex-wrap gap-4">
              <Button
                size="large"
                className="font-semibold rounded-xl h-11 px-6 flex items-center gap-2 group border-none"
                style={{ backgroundColor: 'var(--color-content-bg)', color: 'var(--color-text-main)' }}
              >
                Configurar Institución <ArrowRightOutlined className="group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                ghost
                size="large"
                className="font-semibold rounded-xl h-11 px-6"
                style={{ borderColor: 'rgba(255,255,255,0.25)', color: 'var(--color-header-text)' }}
              >
                Ver Reportes Globales
              </Button>
            </div>
          </div>
          {/* subtle highlight, no heavy gradients */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none opacity-20" style={{ background: 'radial-gradient(closest-side, var(--color-accent), transparent)' }} />
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <Card title="Resumen Académico">
              {academic.period === null ? (
                <Empty description="No hay período activo" />
              ) : (
                <Space direction="vertical" size="middle" className="w-full">
                  <div>
                    <Text type="secondary">Período activo</Text>
                    <div className="text-2xl font-bold">{academic.period.name}</div>
                    <div className="text-slate-500">{academic.period.period}</div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Estudiantes matriculados</span>
                    <span className="font-bold">{academic.students.matriculated}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Estudiantes por matricular</span>
                    <span className="font-bold">{academic.students.pending}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total estudiantes</span>
                    <span className="font-bold">{academic.students.total}</span>
                  </div>
                </Space>
              )}
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title={<span className="flex items-center gap-2"><TeamOutlined /> KPIs Docentes</span>}>
              {academic.period === null ? (
                <Empty description="Sin datos docentes" />
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest">Sin plan de evaluación</p>
                    <p className="text-3xl font-black text-[var(--color-text-main)]">{academic.teachers.withoutPlans}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest">Sin cargado de notas</p>
                    <p className="text-3xl font-black text-[var(--color-text-main)]">{academic.teachers.withoutGrades}</p>
                  </div>
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {academic.period !== null && (
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <Card title="Lapsos académicos">
                {academic.lapses.terms.length === 0 ? (
                  <Empty description="Sin lapsos configurados" />
                ) : (
                  <List
                    dataSource={academic.lapses.terms}
                    renderItem={term => (
                      <List.Item>
                        <Space>
                          <strong>{term.order}. {term.name}</strong>
                          <Tag color={term.isBlocked ? 'green' : 'orange'}>
                            {term.isBlocked ? 'Cerrado' : 'Abierto'}
                          </Tag>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card
                title={<span className="flex items-center gap-2"><GlobalOutlined /> Estado de cierre</span>}
                extra={<Button type="link" href="/master/settings">Gestionar checklist</Button>}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span>Checklist completado</span>
                    <span>{academic.council.checklist.done}/{academic.council.checklist.total}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Lapsos bloqueados</span>
                    <span>{academic.council.blockedTerms}/{academic.council.totalTerms}</span>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        )}

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <Card title="Materias sin plan" extra={<Tag color="red">{academic.period === null ? 0 : academic.teachers.withoutPlans}</Tag>}>
              {academic.period === null || academic.teachers.sampleWithoutPlans.length === 0 ? (
                <Empty description="Sin materias pendientes" />
              ) : (
                <List
                  dataSource={academic.teachers.sampleWithoutPlans}
                  renderItem={(item, idx) => (
                    <List.Item key={idx}>
                      <div>
                        <Text strong>{item.teacher}</Text>
                        <div className="text-sm text-slate-500">{item.subject} · {item.grade} / {item.section}</div>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Materias sin notas" extra={<Tag color="orange">{academic.period === null ? 0 : academic.teachers.withoutGrades}</Tag>}>
              {academic.period === null || academic.teachers.sampleWithoutGrades.length === 0 ? (
                <Empty description="Todos los docentes han cargado notas" />
              ) : (
                <List
                  dataSource={academic.teachers.sampleWithoutGrades}
                  renderItem={(item, idx) => (
                    <List.Item key={idx}>
                      <div>
                        <Text strong>{item.teacher}</Text>
                        <div className="text-sm text-slate-500">{item.subject} · {item.grade} / {item.section}</div>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
        </Row>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <Card title="Acciones rápidas">
              <Space direction="vertical" className="w-full">
                <Button block type="primary" className="h-12 rounded-2xl">
                  Configurar identidad institucional
                </Button>
                <Button block className="h-12 rounded-2xl">
                  Administrar usuarios ({users.total})
                </Button>
                <Button block className="h-12 rounded-2xl">
                  Revisar estructura académica
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default MasterDashboard;
