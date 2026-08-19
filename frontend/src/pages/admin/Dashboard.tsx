import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Row, Col, Card, Tag, Empty, Alert, Progress, Spin, message } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  AlertOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ArrowRightOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

/* ---------- Types ---------- */
interface ActiveSchoolPeriod {
  id: number;
  name: string;
  period?: string;
  startYear?: number;
  endYear?: number;
}
interface GradeCatalogItem { id: number; name: string; }
interface PeriodStructureEntry {
  id: number;
  grade?: { id: number; name: string } | null;
  sections?: { id: number; name: string }[];
  subjects?: { id: number; name: string; subjectGroupId?: number | null }[];
}
interface TeacherRecordLite { id: number; teachingAssignments?: { id: number }[]; }
interface StudentGuardianLite {
  isRepresentative?: boolean;
  profile?: { id?: number; document?: string } | null;
}
interface InscriptionRecordLite {
  id: number;
  section?: { id: number; name: string } | null;
  subjects?: { id: number }[] | null;
  student?: { guardians?: StudentGuardianLite[] };
}
interface MatriculationRecordLite { id: number; status?: 'pending' | 'completed' | string; }

interface AdminOverviewData {
  period: ActiveSchoolPeriod;
  counts: {
    representatives: number;
    totalTeachers: number;
    teachersWithoutAssignments: number;
    studentsWithoutSection: number;
    studentsWithoutSubjects: number;
  };
  students: { total: number; matriculated: number; pending: number };
  coverage: {
    percentage: number;
    configuredGrades: number;
    totalGrades: number;
    missingGrades: string[];
    gradesWithoutSections: string[];
    gradesWithoutSubjects: string[];
  };
  alerts: string[];
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
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}
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

/* ---------- Main component ---------- */
const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const periodRes = await api.get<ActiveSchoolPeriod | null>('/academic/periods/active');
      const activePeriod = periodRes.data;
      if (!activePeriod?.id) {
        setData(null);
        return;
      }

      const [structureRes, gradesRes, inscriptionsRes, pendingMatriculationsRes, teachersRes] = await Promise.all([
        api.get<PeriodStructureEntry[]>(`/academic/structure/${activePeriod.id}`),
        api.get<GradeCatalogItem[]>('/academic/grades'),
        api.get<InscriptionRecordLite[]>('/inscriptions', { params: { schoolPeriodId: activePeriod.id } }),
        api.get<MatriculationRecordLite[]>('/matriculations', { params: { schoolPeriodId: activePeriod.id, status: 'pending' } }),
        api.get<TeacherRecordLite[]>('/teachers', { params: { schoolPeriodId: activePeriod.id } }),
      ]);

      const structure = structureRes.data ?? [];
      const gradeCatalog = gradesRes.data ?? [];
      const inscriptions = inscriptionsRes.data ?? [];
      const pendingMatriculationsList = pendingMatriculationsRes.data ?? [];
      const teachers = teachersRes.data ?? [];

      const matriculatedCount = inscriptions.length;
      const pendingMatriculations = pendingMatriculationsList.length;
      const totalStudents = matriculatedCount + pendingMatriculations;
      const teachersWithoutAssignments = teachers.filter(t => !t.teachingAssignments || t.teachingAssignments.length === 0).length;
      const representativeSet = new Set<string>();
      inscriptions.forEach(inscription => {
        inscription.student?.guardians?.forEach(guardian => {
          if (guardian.isRepresentative) {
            const uniqueId = guardian.profile?.id ? `profile-${guardian.profile.id}` : guardian.profile?.document || `ins-${inscription.id}`;
            representativeSet.add(uniqueId);
          }
        });
      });

      const studentsWithoutSection = inscriptions.filter(ins => !ins.section).length;
      const studentsWithoutSubjects = inscriptions.filter(ins => !ins.subjects || ins.subjects.length === 0).length;

      const configuredGradeIds = new Set(
        structure.map(entry => entry.grade?.id).filter((id): id is number => typeof id === 'number')
      );
      const totalGrades = gradeCatalog.length;
      const missingGrades = gradeCatalog.filter(g => !configuredGradeIds.has(g.id)).map(g => g.name);
      const gradesWithoutSections = structure
        .filter(entry => entry.grade && (!entry.sections || entry.sections.length === 0))
        .map(entry => entry.grade?.name ?? `ID ${entry.id}`);
      const gradesWithoutSubjects = structure
        .filter(entry => entry.grade && (!entry.subjects || entry.subjects.length === 0))
        .map(entry => entry.grade?.name ?? `ID ${entry.id}`);

      const coveragePercentage = totalGrades === 0 ? 0 : (configuredGradeIds.size / totalGrades) * 100;

      const alerts: string[] = [];
      if (missingGrades.length) alerts.push(`Faltan ${missingGrades.length} grados por configurar: ${missingGrades.join(', ')}`);
      if (gradesWithoutSections.length) alerts.push(`Hay ${gradesWithoutSections.length} grados sin secciones asignadas.`);
      if (gradesWithoutSubjects.length) alerts.push(`Hay ${gradesWithoutSubjects.length} grados sin materias configuradas.`);
      if (studentsWithoutSection > 0) alerts.push(`${studentsWithoutSection} alumnos inscritos no tienen sección definida.`);
      if (studentsWithoutSubjects > 0) alerts.push(`${studentsWithoutSubjects} alumnos están inscritos sin materias asociadas.`);

      setData({
        period: activePeriod,
        counts: { representatives: representativeSet.size, totalTeachers: teachers.length, teachersWithoutAssignments, studentsWithoutSection, studentsWithoutSubjects },
        students: { total: totalStudents, matriculated: matriculatedCount, pending: pendingMatriculations },
        coverage: {
          percentage: Number(coveragePercentage.toFixed(1)),
          configuredGrades: configuredGradeIds.size,
          totalGrades,
          missingGrades,
          gradesWithoutSections,
          gradesWithoutSubjects,
        },
        alerts,
      });
    } catch (err) {
      console.error('Error building admin snapshot', err);
      setError('No se pudieron cargar las métricas administrativas.');
      message.error('No se pudo cargar el panel administrativo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  if (loading && !data) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }
  if (error) {
    return <Alert type="error" message="Panel administrativo" description={error} showIcon style={{ marginTop: 24 }} />;
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center" style={{ padding: '80px 0' }}>
        <Empty description="Configura un período escolar activo para ver el panel administrativo." />
      </div>
    );
  }

  const teacherCoverage = data.counts.totalTeachers === 0
    ? 0
    : Math.round(((data.counts.totalTeachers - data.counts.teachersWithoutAssignments) / data.counts.totalTeachers) * 100);

  const matriculationRate = data.students.total > 0 ? Math.round((data.students.matriculated / data.students.total) * 100) : 0;
  const coverageColor = data.coverage.percentage >= 80 ? '#16a34a' : data.coverage.percentage >= 50 ? '#f59e0b' : '#ef4444';
  const teacherColor = teacherCoverage >= 80 ? '#16a34a' : teacherCoverage >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="h-full overflow-y-auto pr-4">
      <div className="space-y-6 pb-8">
        {/* ===== Hero ===== */}
        <FadeIn>
          <div className="relative overflow-hidden rounded-2xl theme-panel-header p-8 md:p-10 text-header-text" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4 max-w-2xl">
                <Tag color="blue" className="border-none font-bold uppercase tracking-widest text-[10px] px-3 py-1 rounded-full">
                  Panel Administrativo
                </Tag>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight font-headline">{data.period.name}</h1>
                <p className="text-header-text/80 text-base font-medium">
                  Monitoreo de inscripciones, matrículas y estructura académica del período activo.
                </p>
                {data.period.period && (
                  <div className="pt-1 flex flex-wrap gap-4 text-sm text-header-text/70">
                    <span>{data.period.period}</span>
                    {data.period.startYear && <span>Año: {data.period.startYear}{data.period.endYear ? `–${data.period.endYear}` : ''}</span>}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 flex flex-col items-center">
                <Progress
                  type="circle"
                  percent={Math.round(data.coverage.percentage)}
                  size={120}
                  strokeColor={{ '0%': '#0ea5e9', '100%': '#38bdf8' }}
                  trailColor="rgba(255,255,255,0.15)"
                  format={(pct) => <span style={{ color: '#f8fafc', fontWeight: 800 }}>{pct}%</span>}
                />
                <p className="text-xs mt-2 text-header-text/70 font-medium">Cobertura de grados</p>
                <p className="text-sm font-bold text-header-text">{data.coverage.configuredGrades}/{data.coverage.totalGrades}</p>
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
              <StatCard icon={<TeamOutlined style={{ fontSize: 22 }} />} label="Docentes" value={data.counts.totalTeachers} color="#0ea5e9" subtitle={`${data.counts.teachersWithoutAssignments} sin asignación`} />
            </FadeIn>
          </Col>
          <Col xs={12} md={6}>
            <FadeIn delay={150}>
              <StatCard icon={<IdcardOutlined style={{ fontSize: 22 }} />} label="Representantes" value={data.counts.representatives} color="#8b5cf6" />
            </FadeIn>
          </Col>
          <Col xs={12} md={6}>
            <FadeIn delay={200}>
              <StatCard icon={<ExclamationCircleOutlined style={{ fontSize: 22 }} />} label="Alertas" value={data.alerts.length} color={data.alerts.length > 0 ? '#ef4444' : '#16a34a'} subtitle={data.alerts.length === 0 ? 'Sin alertas' : 'Revisar'} />
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

          {/* Teacher Coverage Bars */}
          <Col xs={24} md={8}>
            <FadeIn delay={300}>
              <Card className="h-full" bodyStyle={{ padding: 24 }}>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-6" style={{ color: 'var(--color-text-muted)' }}>Cobertura Docente</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>Asignaciones</span>
                      <span className="text-lg font-black" style={{ color: teacherColor }}>{teacherCoverage}%</span>
                    </div>
                    <AnimatedBar value={data.counts.totalTeachers - data.counts.teachersWithoutAssignments} max={data.counts.totalTeachers || 1} color="#0ea5e9" delay={400} />
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{data.counts.totalTeachers - data.counts.teachersWithoutAssignments} de {data.counts.totalTeachers} docentes</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>Grados configurados</span>
                      <span className="text-lg font-black" style={{ color: coverageColor }}>{Math.round(data.coverage.percentage)}%</span>
                    </div>
                    <AnimatedBar value={data.coverage.configuredGrades} max={data.coverage.totalGrades || 1} color="#1e40af" delay={550} />
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{data.coverage.configuredGrades} de {data.coverage.totalGrades} grados</p>
                  </div>
                </div>
              </Card>
            </FadeIn>
          </Col>

          {/* Student Issues */}
          <Col xs={24} md={8}>
            <FadeIn delay={350}>
              <Card className="h-full" bodyStyle={{ padding: 24 }}>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-6" style={{ color: 'var(--color-text-muted)' }}>Inconsistencias</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: data.counts.studentsWithoutSection > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(22,163,74,0.06)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: data.counts.studentsWithoutSection > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(22,163,74,0.1)', color: data.counts.studentsWithoutSection > 0 ? '#ef4444' : '#16a34a' }}>
                        {data.counts.studentsWithoutSection > 0 ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
                      </div>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>Sin sección</span>
                    </div>
                    <span className="text-xl font-black" style={{ color: data.counts.studentsWithoutSection > 0 ? '#ef4444' : '#16a34a' }}>{data.counts.studentsWithoutSection}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: data.counts.studentsWithoutSubjects > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(22,163,74,0.06)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: data.counts.studentsWithoutSubjects > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(22,163,74,0.1)', color: data.counts.studentsWithoutSubjects > 0 ? '#ef4444' : '#16a34a' }}>
                        {data.counts.studentsWithoutSubjects > 0 ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
                      </div>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>Sin materias</span>
                    </div>
                    <span className="text-xl font-black" style={{ color: data.counts.studentsWithoutSubjects > 0 ? '#ef4444' : '#16a34a' }}>{data.counts.studentsWithoutSubjects}</span>
                  </div>
                </div>
              </Card>
            </FadeIn>
          </Col>
        </Row>

        {/* ===== Alerts + Structure ===== */}
        <Row gutter={[20, 20]}>
          {/* Alerts */}
          <Col xs={24} lg={14}>
            <FadeIn delay={400}>
              <Card className="h-full" bodyStyle={{ padding: 24 }}>
                <div className="flex items-center gap-2 mb-4">
                  <AlertOutlined style={{ color: data.alerts.length > 0 ? '#f97316' : '#16a34a' }} />
                  <h3 className="text-sm font-bold uppercase tracking-wider m-0" style={{ color: 'var(--color-text-muted)' }}>Alertas de Estructura</h3>
                </div>
                {data.alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <CheckCircleOutlined style={{ fontSize: 36, color: '#16a34a', marginBottom: 8 }} />
                    <p className="font-semibold text-sm m-0" style={{ color: 'var(--color-text-main)' }}>La estructura del período está completa</p>
                    <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>Todos los grados configurados cuentan con secciones y materias definidas.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.alerts.map((alertMessage, index) => (
                      <Alert key={`alert-${index}`} type="warning" message={alertMessage} showIcon style={{ borderRadius: 12 }} />
                    ))}
                  </div>
                )}
              </Card>
            </FadeIn>
          </Col>

          {/* Missing grades + structure issues */}
          <Col xs={24} lg={10}>
            <FadeIn delay={450}>
              <Card className="h-full" bodyStyle={{ padding: 24 }}>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>Detalle de Cobertura</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Grados faltantes</p>
                    {data.coverage.missingGrades.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {data.coverage.missingGrades.map(name => (
                          <Tag key={name} color="error" className="rounded-full font-medium">{name}</Tag>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Todos los grados están configurados.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Sin secciones / materias</p>
                    <div className="flex gap-4">
                      <div className="flex-1 p-3 rounded-xl" style={{ backgroundColor: 'rgba(15,23,42,0.03)' }}>
                        <p className="text-2xl font-black m-0" style={{ color: data.coverage.gradesWithoutSections.length > 0 ? '#ef4444' : '#16a34a' }}>{data.coverage.gradesWithoutSections.length}</p>
                        <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>sin secciones</p>
                      </div>
                      <div className="flex-1 p-3 rounded-xl" style={{ backgroundColor: 'rgba(15,23,42,0.03)' }}>
                        <p className="text-2xl font-black m-0" style={{ color: data.coverage.gradesWithoutSubjects.length > 0 ? '#ef4444' : '#16a34a' }}>{data.coverage.gradesWithoutSubjects.length}</p>
                        <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>sin materias</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </FadeIn>
          </Col>
        </Row>

        {/* ===== Quick Actions ===== */}
        <FadeIn delay={500}>
          <Card bodyStyle={{ padding: 24 }}>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>Acciones Rápidas</h3>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <QuickAction icon={<UsergroupAddOutlined style={{ fontSize: 18 }} />} title="Matricular Estudiante" subtitle="Inscripción individual" color="#1e40af" onClick={() => navigate('/admin/matricular-estudiante')} />
              </Col>
              <Col xs={24} sm={8}>
                <QuickAction icon={<TeamOutlined style={{ fontSize: 18 }} />} title="Directorio" subtitle="Gestión de usuarios" color="#0ea5e9" onClick={() => navigate('/admin/directorio')} />
              </Col>
              <Col xs={24} sm={8}>
                <QuickAction icon={<BookOutlined style={{ fontSize: 18 }} />} title="Inscribir" subtitle="Estudiante, personal o representante" color="#8b5cf6" onClick={() => navigate('/admin/inscribir-estudiante')} />
              </Col>
            </Row>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
};

export default AdminDashboard;
