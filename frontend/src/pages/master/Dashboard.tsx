import { useEffect, useState, useRef } from 'react';
import { Row, Col, Card, Tag, Empty, message, Progress } from 'antd';
import {
  GlobalOutlined,
  ArrowRightOutlined,
  TeamOutlined,
  UserOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

interface MasterDashboardData {
  academic:
    | { period: null }
    | {
        period: { id: number; name: string; period: string };
        students: { total: number; matriculated: number; pending: number };
        lapses: {
          total: number;
          blocked: number;
          terms: { id: number; name: string; order: number; isBlocked: boolean; isActive: boolean; openDate?: Date | null; closeDate?: Date | null }[];
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
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, ...deps]);
  return value;
}

/* ---------- Donut chart (pure SVG) ---------- */
const DonutChart: React.FC<{
  segments: { value: number; color: string; label?: string }[];
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
      <div
        className="h-full rounded-full"
        style={{ width: `${width}%`, backgroundColor: color, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </div>
  );
};

/* ---------- Stat card ---------- */
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  suffix?: string;
  delay?: number;
}> = ({ icon, label, value, color, suffix, delay = 0 }) => {
  const animated = useCountUp(value, 1000, [value]);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  return (
    <div
      className="app-card app-card-hover p-5 flex items-center gap-4"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
        <p className="text-2xl font-black" style={{ color: 'var(--color-text-main)' }}>
          {animated}{suffix}
        </p>
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
    <div
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}
    >
      {children}
    </div>
  );
};

const MasterDashboard: React.FC = () => {
  const [data, setData] = useState<MasterDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
  const hasPeriod = academic.period !== null;
  const a = hasPeriod ? (academic as Extract<typeof academic, { period: { id: number } }>) : null;

  // Derived metrics
  const matriculated = a?.students.matriculated ?? 0;
  const pending = a?.students.pending ?? 0;
  const totalStudents = a?.students.total ?? 0;
  const matriculationRate = totalStudents > 0 ? Math.round((matriculated / totalStudents) * 100) : 0;

  const withoutPlans = a?.teachers.withoutPlans ?? 0;
  const withoutGrades = a?.teachers.withoutGrades ?? 0;
  const totalAssignments = a?.teachers.totalAssignments ?? 0;
  const plansRate = totalAssignments > 0 ? Math.round(((totalAssignments - withoutPlans) / totalAssignments) * 100) : 100;
  const gradesRate = totalAssignments > 0 ? Math.round(((totalAssignments - withoutGrades) / totalAssignments) * 100) : 100;

  const checklistDone = a?.council.checklist.done ?? 0;
  const checklistTotal = a?.council.checklist.total ?? 0;
  const checklistRate = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  const blockedTerms = a?.council.blockedTerms ?? 0;
  const totalTerms = a?.council.totalTerms ?? 0;

  return (
    <div className="h-full overflow-y-auto pr-4">
      <div className="space-y-6 pb-8">
        {/* ===== Hero ===== */}
        <FadeIn>
          <div className="relative overflow-hidden rounded-2xl theme-panel-header p-8 md:p-10 text-header-text" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4 max-w-2xl">
                <Tag color="gold" className="border-none font-bold uppercase tracking-widest text-[10px] px-3 py-1 rounded-full">
                  Acceso de Súper Usuario
                </Tag>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight font-headline">{institution.name}</h1>
                {institution.motto && <p className="text-header-text/80 text-lg font-medium">"{institution.motto}"</p>}
                <div className="pt-2 flex flex-wrap gap-4 text-sm text-header-text/70">
                  <span>Código: {institution.code || 'N/D'}</span>
                  <span>Usuarios: {users.total}</span>
                  {hasPeriod && <span>Período: {a!.period.name}</span>}
                </div>
              </div>
              {institution.logoUrl && (
                <div className="flex-shrink-0">
                  <img
                    src={institution.logoUrl}
                    alt="Logo"
                    className="object-contain"
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: institution.logoShape === 'circle' ? '50%' : 16,
                      background: 'rgba(255,255,255,0.08)',
                      padding: 6,
                    }}
                  />
                </div>
              )}
            </div>
            <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none opacity-20" style={{ background: 'radial-gradient(closest-side, var(--color-accent), transparent)' }} />
          </div>
        </FadeIn>

        {/* ===== KPI Cards Row ===== */}
        {hasPeriod && (
          <Row gutter={[20, 20]}>
            <Col xs={12} md={6}>
              <FadeIn delay={50}>
                <StatCard icon={<UserOutlined style={{ fontSize: 22 }} />} label="Estudiantes" value={totalStudents} color="#1e40af" />
              </FadeIn>
            </Col>
            <Col xs={12} md={6}>
              <FadeIn delay={100}>
                <StatCard icon={<TeamOutlined style={{ fontSize: 22 }} />} label="Docentes" value={totalAssignments} color="#0ea5e9" suffix={` (${totalAssignments})`} />
              </FadeIn>
            </Col>
            <Col xs={12} md={6}>
              <FadeIn delay={150}>
                <StatCard icon={<BookOutlined style={{ fontSize: 22 }} />} label="Sin Plan" value={withoutPlans} color="#f59e0b" />
              </FadeIn>
            </Col>
            <Col xs={12} md={6}>
              <FadeIn delay={200}>
                <StatCard icon={<ExclamationCircleOutlined style={{ fontSize: 22 }} />} label="Sin Notas" value={withoutGrades} color="#ef4444" />
              </FadeIn>
            </Col>
          </Row>
        )}

        {/* ===== Charts Row ===== */}
        {hasPeriod && (
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
                          { value: matriculated, color: '#1e40af' },
                          { value: pending, color: '#e2e8f0' },
                        ]}
                        centerValue={`${matriculationRate}%`}
                        centerLabel="Inscritos"
                      />
                    </div>
                    <div className="flex gap-6 text-sm w-full justify-center">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#1e40af' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>Inscritos: <strong style={{ color: 'var(--color-text-main)' }}>{matriculated}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#e2e8f0' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>Pendientes: <strong style={{ color: 'var(--color-text-main)' }}>{pending}</strong></span>
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
                      <AnimatedBar value={totalAssignments - withoutPlans} max={totalAssignments || 1} color="#1e40af" delay={400} />
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{totalAssignments - withoutPlans} de {totalAssignments} asignaciones</p>
                    </div>
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>Carga de Notas</span>
                        <span className="text-lg font-black" style={{ color: gradesRate >= 80 ? '#16a34a' : gradesRate >= 50 ? '#f59e0b' : '#ef4444' }}>{gradesRate}%</span>
                      </div>
                      <AnimatedBar value={totalAssignments - withoutGrades} max={totalAssignments || 1} color="#0ea5e9" delay={550} />
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{totalAssignments - withoutGrades} de {totalAssignments} asignaciones</p>
                    </div>
                  </div>
                </Card>
              </FadeIn>
            </Col>

            {/* Council Progress */}
            <Col xs={24} md={8}>
              <FadeIn delay={350}>
                <Card className="h-full" bodyStyle={{ padding: 24 }}>
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-6" style={{ color: 'var(--color-text-muted)' }}>Estado del Cierre</h3>
                  <div className="flex flex-col items-center">
                    <Progress
                      type="circle"
                      percent={checklistRate}
                      size={140}
                      strokeColor={{ '0%': '#1e40af', '100%': '#0ea5e9' }}
                      format={(pct) => <span style={{ color: 'var(--color-text-main)', fontWeight: 800 }}>{pct}%</span>}
                    />
                    <div className="mt-4 space-y-2 w-full">
                      <div className="flex justify-between text-sm">
                        <span style={{ color: 'var(--color-text-muted)' }}>Checklist</span>
                        <span className="font-bold" style={{ color: 'var(--color-text-main)' }}>{checklistDone}/{checklistTotal}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: 'var(--color-text-muted)' }}>Lapsos bloqueados</span>
                        <span className="font-bold" style={{ color: 'var(--color-text-main)' }}>{blockedTerms}/{totalTerms}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </FadeIn>
            </Col>
          </Row>
        )}

        {/* ===== Lapsos Timeline + Pending Lists ===== */}
        {hasPeriod && (
          <Row gutter={[20, 20]}>
            {/* Lapsos */}
            <Col xs={24} lg={10}>
              <FadeIn delay={400}>
                <Card className="h-full" bodyStyle={{ padding: 24 }}>
                  <div className="flex items-center gap-2 mb-4">
                    <CalendarOutlined style={{ color: 'var(--color-accent)' }} />
                    <h3 className="text-sm font-bold uppercase tracking-wider m-0" style={{ color: 'var(--color-text-muted)' }}>Lapsos Académicos</h3>
                  </div>
                  {a!.lapses.terms.length === 0 ? (
                    <Empty description="Sin lapsos configurados" />
                  ) : (
                    <div className="space-y-3">
                      {a!.lapses.terms.map((term, idx) => (
                        <div
                          key={term.id}
                          className="flex items-center justify-between p-3 rounded-xl app-card-hover"
                          style={{
                            backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(15,23,42,0.02)',
                            border: '1px solid rgba(15,23,42,0.06)',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                              style={{
                                backgroundColor: term.isBlocked ? 'rgba(22,163,74,0.1)' : 'rgba(245,158,11,0.1)',
                                color: term.isBlocked ? '#16a34a' : '#f59e0b',
                              }}
                            >
                              {term.order}
                            </div>
                            <span className="font-semibold text-sm" style={{ color: 'var(--color-text-main)' }}>{term.name}</span>
                          </div>
                          <Tag
                            color={term.isBlocked ? 'success' : 'warning'}
                            className="font-semibold border-none rounded-full px-3"
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          >
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
                  extra={<Tag color="warning" className="font-bold rounded-full">{withoutPlans}</Tag>}
                >
                  {!hasPeriod || a!.teachers.sampleWithoutPlans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <CheckCircleOutlined style={{ fontSize: 36, color: '#16a34a', marginBottom: 8 }} />
                      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Todo al día</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {a!.teachers.sampleWithoutPlans.map((item, idx) => (
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
                  extra={<Tag color="error" className="font-bold rounded-full">{withoutGrades}</Tag>}
                >
                  {!hasPeriod || a!.teachers.sampleWithoutGrades.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <CheckCircleOutlined style={{ fontSize: 36, color: '#16a34a', marginBottom: 8 }} />
                      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Todos han cargado</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {a!.teachers.sampleWithoutGrades.map((item, idx) => (
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
        )}

        {/* ===== Quick Actions ===== */}
        <FadeIn delay={550}>
          <Card bodyStyle={{ padding: 24 }}>
            <div className="flex items-center gap-2 mb-4">
              <SettingOutlined style={{ color: 'var(--color-accent)' }} />
              <h3 className="text-sm font-bold uppercase tracking-wider m-0" style={{ color: 'var(--color-text-muted)' }}>Acciones Rápidas</h3>
            </div>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <button
                  onClick={() => navigate('/master/settings')}
                  className="w-full p-4 rounded-xl text-left app-card-hover group"
                  style={{ border: '1px solid rgba(15,23,42,0.08)', backgroundColor: 'var(--color-content-bg)', cursor: 'pointer' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(30,64,175,0.1)', color: '#1e40af' }}>
                        <SettingOutlined style={{ fontSize: 18 }} />
                      </div>
                      <div>
                        <p className="font-bold text-sm m-0" style={{ color: 'var(--color-text-main)' }}>Configurar Institución</p>
                        <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>Identidad y preferencias</p>
                      </div>
                    </div>
                    <ArrowRightOutlined className="group-hover:translate-x-1 transition-transform" style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                </button>
              </Col>
              <Col xs={24} sm={8}>
                <button
                  onClick={() => navigate('/master/users')}
                  className="w-full p-4 rounded-xl text-left app-card-hover group"
                  style={{ border: '1px solid rgba(15,23,42,0.08)', backgroundColor: 'var(--color-content-bg)', cursor: 'pointer' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(14,165,233,0.1)', color: '#0ea5e9' }}>
                        <TeamOutlined style={{ fontSize: 18 }} />
                      </div>
                      <div>
                        <p className="font-bold text-sm m-0" style={{ color: 'var(--color-text-main)' }}>Administrar Usuarios</p>
                        <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>{users.total} registrados</p>
                      </div>
                    </div>
                    <ArrowRightOutlined className="group-hover:translate-x-1 transition-transform" style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                </button>
              </Col>
              <Col xs={24} sm={8}>
                <button
                  onClick={() => navigate('/master/academic')}
                  className="w-full p-4 rounded-xl text-left app-card-hover group"
                  style={{ border: '1px solid rgba(15,23,42,0.08)', backgroundColor: 'var(--color-content-bg)', cursor: 'pointer' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(212,175,55,0.1)', color: '#d4af37' }}>
                        <GlobalOutlined style={{ fontSize: 18 }} />
                      </div>
                      <div>
                        <p className="font-bold text-sm m-0" style={{ color: 'var(--color-text-main)' }}>Estructura Académica</p>
                        <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>Períodos, grados, secciones</p>
                      </div>
                    </div>
                    <ArrowRightOutlined className="group-hover:translate-x-1 transition-transform" style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                </button>
              </Col>
            </Row>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
};

export default MasterDashboard;
