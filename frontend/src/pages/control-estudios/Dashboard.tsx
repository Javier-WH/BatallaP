import { useEffect, useMemo, useState, useRef } from 'react';
import { Row, Col, Card, Tag, Empty, Progress, message } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
  ArrowRightOutlined,
  FileExcelOutlined,
  EditOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

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

/* ---------- Animated counter hook ---------- */
function useCountUp(target: number, duration = 900, deps: unknown[] = []) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, ...deps]);
  return value;
}

/* ---------- Donut chart (pure SVG) ---------- */
const DonutChart: React.FC<{
  segments: { value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}> = ({ segments, size = 160, thickness = 18, centerLabel, centerValue }) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(15,23,42,0.06)" strokeWidth={thickness} />
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circumference;
          const circle = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1), stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      {(centerValue || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="text-2xl font-black" style={{ color: 'var(--color-text-main)' }}>{centerValue}</span>}
          {centerLabel && <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{centerLabel}</span>}
        </div>
      )}
    </div>
  );
};

/* ---------- Animated bar ---------- */
const AnimatedBar: React.FC<{ value: number; max: number; color: string; delay?: number }> = ({ value, max, color, delay = 0 }) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setWidth(max > 0 ? (value / max) * 100 : 0), delay);
    return () => clearTimeout(timer);
  }, [value, max, delay]);
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(15,23,42,0.06)' }}>
      <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
    </div>
  );
};

/* ---------- Stat card ---------- */
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  subtitle?: string;
  delay?: number;
}> = ({ icon, label, value, color, subtitle, delay = 0 }) => {
  const animated = useCountUp(value, 1000, [value]);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  return (
    <div
      className="app-card app-card-hover p-5 flex items-center gap-4"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)', transition: 'opacity 0.5s ease, transform 0.5s ease' }}
    >
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
        <p className="text-2xl font-black" style={{ color: 'var(--color-text-main)' }}>{animated}</p>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
  );
};

/* ---------- Fade-in wrapper ---------- */
const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  return (
    <div className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
      {children}
    </div>
  );
};

/* ---------- Quick action button ---------- */
const QuickAction: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  onClick: () => void;
}> = ({ icon, title, subtitle, color, onClick }) => (
  <button
    onClick={onClick}
    className="w-full p-4 rounded-xl text-left app-card-hover group"
    style={{ border: '1px solid rgba(15,23,42,0.08)', backgroundColor: 'var(--color-content-bg)', cursor: 'pointer' }}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
          {icon}
        </div>
        <div>
          <p className="font-bold text-sm m-0" style={{ color: 'var(--color-text-main)' }}>{title}</p>
          <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>
        </div>
      </div>
      <ArrowRightOutlined className="group-hover:translate-x-1 transition-transform" style={{ color: 'var(--color-text-muted)' }} />
    </div>
  </button>
);

const ControlEstudiosDashboard: React.FC = () => {
  const [data, setData] = useState<ControlPanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

  if (loading && !data) return <Card loading />;

  if (!data) {
    return (
      <Card>
        <Empty description="No hay información disponible para el período activo." />
      </Card>
    );
  }

  const matriculationRate = data.students.total > 0 ? Math.round((data.students.matriculated / data.students.total) * 100) : 0;
  const plansRate = data.teachers.totalAssignments > 0 ? Math.round(((data.teachers.totalAssignments - data.teachers.withoutPlans) / data.teachers.totalAssignments) * 100) : 100;
  const gradesRate = data.teachers.totalAssignments > 0 ? Math.round(((data.teachers.totalAssignments - data.teachers.withoutGrades) / data.teachers.totalAssignments) * 100) : 100;
  const lapsesRate = data.lapses.total > 0 ? Math.round((data.lapses.blocked / data.lapses.total) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto pr-4">
      <div className="space-y-6 pb-8">
        {/* ===== Hero ===== */}
        <FadeIn>
          <div className="relative overflow-hidden rounded-2xl theme-panel-header p-8 md:p-10 text-header-text" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4 max-w-2xl">
                <Tag color="geekblue" className="border-none font-bold uppercase tracking-widest text-[10px] px-3 py-1 rounded-full">
                  Control de Estudios
                </Tag>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight font-headline">{data.period.name}</h1>
                <p className="text-header-text/80 text-base font-medium">
                  Seguimiento en tiempo real del período {data.period.period}
                </p>
                <div className="pt-1 flex flex-wrap gap-4 text-sm text-header-text/70">
                  <span>{data.lapses.total} lapsos</span>
                  <span>{data.lapses.blocked} cerrados</span>
                  <span>{data.teachers.totalAssignments} asignaciones</span>
                </div>
              </div>
              <div className="flex-shrink-0 flex flex-col items-center">
                <Progress
                  type="circle"
                  percent={checklistProgress}
                  size={120}
                  strokeColor={{ '0%': '#0ea5e9', '100%': '#38bdf8' }}
                  trailColor="rgba(255,255,255,0.15)"
                  format={(pct) => <span style={{ color: '#f8fafc', fontWeight: 800 }}>{pct}%</span>}
                />
                <p className="text-xs mt-2 text-header-text/70 font-medium">Checklist de cierre</p>
                <p className="text-sm font-bold text-header-text">{data.council.checklist.done}/{data.council.checklist.total}</p>
              </div>
            </div>
            <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none opacity-20" style={{ background: 'radial-gradient(closest-side, #38bdf8, transparent)' }} />
          </div>
        </FadeIn>

        {/* ===== KPI Cards Row ===== */}
        <Row gutter={[20, 20]}>
          <Col xs={12} md={6}>
            <FadeIn delay={50}>
              <StatCard icon={<UserOutlined style={{ fontSize: 22 }} />} label="Estudiantes" value={data.students.total} color="#1e40af" subtitle={`${data.students.matriculated} inscritos`} />
            </FadeIn>
          </Col>
          <Col xs={12} md={6}>
            <FadeIn delay={100}>
              <StatCard icon={<TeamOutlined style={{ fontSize: 22 }} />} label="Asignaciones" value={data.teachers.totalAssignments} color="#0ea5e9" subtitle="Docentes activos" />
            </FadeIn>
          </Col>
          <Col xs={12} md={6}>
            <FadeIn delay={150}>
              <StatCard icon={<BookOutlined style={{ fontSize: 22 }} />} label="Sin Plan" value={data.teachers.withoutPlans} color="#f59e0b" />
            </FadeIn>
          </Col>
          <Col xs={12} md={6}>
            <FadeIn delay={200}>
              <StatCard icon={<ExclamationCircleOutlined style={{ fontSize: 22 }} />} label="Sin Notas" value={data.teachers.withoutGrades} color="#ef4444" />
            </FadeIn>
          </Col>
        </Row>

        {/* ===== Charts Row ===== */}
        <Row gutter={[20, 20]}>
          {/* Matriculation Donut */}
          <Col xs={24} md={8}>
            <FadeIn delay={250}>
              <Card className="h-full" bodyStyle={{ padding: 24 }}>
                <div className="flex flex-col items-center">
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Matriculación</h3>
                  <div className="my-4">
                    <DonutChart
                      segments={[
                        { value: data.students.matriculated, color: '#1e40af' },
                        { value: data.students.pending, color: '#e2e8f0' },
                      ]}
                      centerValue={`${matriculationRate}%`}
                      centerLabel="Inscritos"
                    />
                  </div>
                  <div className="flex gap-6 text-sm w-full justify-center">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#1e40af' }} />
                      <span style={{ color: 'var(--color-text-muted)' }}>Inscritos: <strong style={{ color: 'var(--color-text-main)' }}>{data.students.matriculated}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#e2e8f0' }} />
                      <span style={{ color: 'var(--color-text-muted)' }}>Pendientes: <strong style={{ color: 'var(--color-text-main)' }}>{data.students.pending}</strong></span>
                    </div>
                  </div>
                </div>
              </Card>
            </FadeIn>
          </Col>

          {/* Teacher Compliance Bars */}
          <Col xs={24} md={8}>
            <FadeIn delay={300}>
              <Card className="h-full" bodyStyle={{ padding: 24 }}>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-6" style={{ color: 'var(--color-text-muted)' }}>Cumplimiento Docente</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>Planes de Evaluación</span>
                      <span className="text-lg font-black" style={{ color: plansRate >= 80 ? '#16a34a' : plansRate >= 50 ? '#f59e0b' : '#ef4444' }}>{plansRate}%</span>
                    </div>
                    <AnimatedBar value={data.teachers.totalAssignments - data.teachers.withoutPlans} max={data.teachers.totalAssignments || 1} color="#1e40af" delay={400} />
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{data.teachers.totalAssignments - data.teachers.withoutPlans} de {data.teachers.totalAssignments} asignaciones</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>Carga de Notas</span>
                      <span className="text-lg font-black" style={{ color: gradesRate >= 80 ? '#16a34a' : gradesRate >= 50 ? '#f59e0b' : '#ef4444' }}>{gradesRate}%</span>
                    </div>
                    <AnimatedBar value={data.teachers.totalAssignments - data.teachers.withoutGrades} max={data.teachers.totalAssignments || 1} color="#0ea5e9" delay={550} />
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{data.teachers.totalAssignments - data.teachers.withoutGrades} de {data.teachers.totalAssignments} asignaciones</p>
                  </div>
                </div>
              </Card>
            </FadeIn>
          </Col>

          {/* Lapses Progress */}
          <Col xs={24} md={8}>
            <FadeIn delay={350}>
              <Card className="h-full" bodyStyle={{ padding: 24 }}>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-6" style={{ color: 'var(--color-text-muted)' }}>Estado de Lapsos</h3>
                <div className="flex flex-col items-center">
                  <Progress
                    type="circle"
                    percent={lapsesRate}
                    size={140}
                    strokeColor={{ '0%': '#1e40af', '100%': '#0ea5e9' }}
                    format={(pct) => <span style={{ color: 'var(--color-text-main)', fontWeight: 800 }}>{pct}%</span>}
                  />
                  <div className="mt-4 space-y-2 w-full">
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--color-text-muted)' }}>Lapsos cerrados</span>
                      <span className="font-bold" style={{ color: 'var(--color-text-main)' }}>{data.lapses.blocked}/{data.lapses.total}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--color-text-muted)' }}>Checklist</span>
                      <span className="font-bold" style={{ color: 'var(--color-text-main)' }}>{data.council.checklist.done}/{data.council.checklist.total}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </FadeIn>
          </Col>
        </Row>

        {/* ===== Lapsos Timeline + Pending Lists ===== */}
        <Row gutter={[20, 20]}>
          {/* Lapsos */}
          <Col xs={24} lg={10}>
            <FadeIn delay={400}>
              <Card className="h-full" bodyStyle={{ padding: 24 }}>
                <div className="flex items-center gap-2 mb-4">
                  <CalendarOutlined style={{ color: 'var(--color-accent)' }} />
                  <h3 className="text-sm font-bold uppercase tracking-wider m-0" style={{ color: 'var(--color-text-muted)' }}>Lapsos Académicos</h3>
                </div>
                {data.lapses.terms.length === 0 ? (
                  <Empty description="Sin lapsos configurados" />
                ) : (
                  <div className="space-y-3">
                    {data.lapses.terms.map((term, idx) => (
                      <div
                        key={term.id}
                        className="flex items-center justify-between p-3 rounded-xl app-card-hover"
                        style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)', transition: 'all 0.2s ease' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black" style={{ backgroundColor: term.isBlocked ? 'rgba(22,163,74,0.1)' : 'rgba(245,158,11,0.1)', color: term.isBlocked ? '#16a34a' : '#f59e0b' }}>
                            {term.order}
                          </div>
                          <div>
                            <span className="font-semibold text-sm block" style={{ color: 'var(--color-text-main)' }}>{term.name}</span>
                            {term.openDate && (
                              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {term.openDate ? new Date(term.openDate).toLocaleDateString() : '—'} → {term.closeDate ? new Date(term.closeDate).toLocaleDateString() : '—'}
                              </span>
                            )}
                          </div>
                        </div>
                        <Tag color={term.isBlocked ? 'success' : 'warning'} className="font-semibold border-none rounded-full px-3" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {term.isBlocked ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                          {term.isBlocked ? 'Cerrado' : 'Abierto'}
                        </Tag>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </FadeIn>
          </Col>

          {/* Without Plans */}
          <Col xs={24} lg={7}>
            <FadeIn delay={450}>
              <Card
                className="h-full"
                bodyStyle={{ padding: 24 }}
                title={<span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}><BookOutlined style={{ color: '#f59e0b' }} /> Sin Plan de Evaluación</span>}
                extra={<Tag color="warning" className="font-bold rounded-full">{data.teachers.withoutPlans}</Tag>}
              >
                {data.teachers.sampleWithoutPlans.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <CheckCircleOutlined style={{ fontSize: 36, color: '#16a34a', marginBottom: 8 }} />
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Todo al día</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.teachers.sampleWithoutPlans.map((item, idx) => (
                      <div key={idx} className="p-2 rounded-lg app-card-hover" style={{ border: '1px solid rgba(15,23,42,0.06)' }}>
                        <p className="font-semibold text-sm m-0" style={{ color: 'var(--color-text-main)' }}>{item.teacher}</p>
                        <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>{item.subject} · {item.grade} / {item.section}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </FadeIn>
          </Col>

          {/* Without Grades */}
          <Col xs={24} lg={7}>
            <FadeIn delay={500}>
              <Card
                className="h-full"
                bodyStyle={{ padding: 24 }}
                title={<span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}><ExclamationCircleOutlined style={{ color: '#ef4444' }} /> Sin Carga de Notas</span>}
                extra={<Tag color="error" className="font-bold rounded-full">{data.teachers.withoutGrades}</Tag>}
              >
                {data.teachers.sampleWithoutGrades.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <CheckCircleOutlined style={{ fontSize: 36, color: '#16a34a', marginBottom: 8 }} />
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Todos han cargado</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.teachers.sampleWithoutGrades.map((item, idx) => (
                      <div key={idx} className="p-2 rounded-lg app-card-hover" style={{ border: '1px solid rgba(15,23,42,0.06)' }}>
                        <p className="font-semibold text-sm m-0" style={{ color: 'var(--color-text-main)' }}>{item.teacher}</p>
                        <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>{item.subject} · {item.grade} / {item.section}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </FadeIn>
          </Col>
        </Row>

        {/* ===== Quick Actions ===== */}
        <FadeIn delay={550}>
          <Card bodyStyle={{ padding: 24 }}>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>Acciones Rápidas</h3>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <QuickAction icon={<UserAddOutlined style={{ fontSize: 18 }} />} title="Matricular Estudiante" subtitle="Inscripción individual o masiva" color="#1e40af" onClick={() => navigate('/control-estudios/matricular-estudiante')} />
              </Col>
              <Col xs={24} sm={8}>
                <QuickAction icon={<CheckCircleOutlined style={{ fontSize: 18 }} />} title="Consejos de Curso" subtitle="Checklist y cierre de lapsos" color="#0ea5e9" onClick={() => navigate('/control-estudios/consejos-curso')} />
              </Col>
              <Col xs={24} sm={8}>
                <QuickAction icon={<EditOutlined style={{ fontSize: 18 }} />} title="Calificaciones" subtitle="Notas actuales e históricas" color="#8b5cf6" onClick={() => navigate('/control-estudios/calificaciones')} />
              </Col>
              <Col xs={24} sm={8}>
                <QuickAction icon={<FileExcelOutlined style={{ fontSize: 18 }} />} title="Resumen de Rendimiento" subtitle="Reportes académicos" color="#16a34a" onClick={() => navigate('/control-estudios/resumen-rendimiento')} />
              </Col>
              <Col xs={24} sm={8}>
                <QuickAction icon={<BookOutlined style={{ fontSize: 18 }} />} title="Gestión Académica" subtitle="Períodos, grados, secciones" color="#f59e0b" onClick={() => navigate('/control-estudios/academic')} />
              </Col>
              <Col xs={24} sm={8}>
                <QuickAction icon={<TeamOutlined style={{ fontSize: 18 }} />} title="Proyección" subtitle="Asignación académica" color="#ec4899" onClick={() => navigate('/control-estudios/proyeccion')} />
              </Col>
            </Row>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
};

export default ControlEstudiosDashboard;
