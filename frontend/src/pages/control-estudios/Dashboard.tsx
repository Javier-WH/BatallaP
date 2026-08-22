import { useEffect, useMemo, useState, useRef } from 'react';
import { Row, Col, Card, Tag, Empty, Progress, message } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  BookOutlined,
  ReadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { getSubjectVisual } from '@/utils/subjectVisuals';

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
    byGrade: GradeProgress[];
    byGradeContent: ContentGradeProgress[];
  };
}

interface AssignmentInsight {
  teacher: string;
  subject: string;
  grade: string;
  section: string;
}

interface SectionDetail {
  sectionId: number;
  sectionName: string;
  sectionColor: string;
  teacherName: string;
  hasPlan: boolean;
  hasGrades: boolean;
}

interface SubjectProgress {
  subjectId: number;
  subjectName: string;
  subjectIcon: string | null;
  subjectColor: string | null;
  subjectAbbreviation: string | null;
  order: number;
  totalSections: number;
  withPlan: number;
  withoutPlan: number;
  withGrades: number;
  withoutGrades: number;
  sections: SectionDetail[];
}

interface GradeProgress {
  gradeId: number;
  gradeName: string;
  gradeColor: string | null;
  gradeOrder: number;
  subjects: SubjectProgress[];
}

interface ContentSubjectProgress {
  subjectId: number;
  subjectName: string;
  subjectIcon: string | null;
  subjectColor: string | null;
  subjectAbbreviation: string | null;
  order: number;
  hasContent: boolean;
}

interface ContentGradeProgress {
  gradeId: number;
  gradeName: string;
  gradeColor: string | null;
  gradeOrder: number;
  subjects: ContentSubjectProgress[];
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
/* ---------- Subject progress row ---------- */
// Convert "Primer año" → "1er", "Quinto año" → "5to", etc.
// Includes apocoped forms (primer, tercer) used in some DB entries.
const ordinalToNumber: Record<string, string> = {
  'primero': '1er', 'primer': '1er',
  'segundo': '2do',
  'tercero': '3ro', 'tercer': '3ro',
  'cuarto': '4to',
  'quinto': '5to',
  'sexto': '6to',
  'séptimo': '7mo',
  'octavo': '8vo',
  'noveno': '9no',
  'décimo': '10mo',
  'undécimo': '11mo',
  'duodécimo': '12mo',
};
const shortGradeName = (name: string): string => {
  const lower = name.toLowerCase().trim();
  for (const [word, num] of Object.entries(ordinalToNumber)) {
    if (lower.startsWith(word)) {
      return num;
    }
  }
  return name;
};

/* ---------- Band helpers ---------- */
type BandKey = 'red' | 'amber' | 'blue' | 'green';
const bandOf = (v: number): BandKey => {
  if (v >= 100) return 'green';
  if (v >= 75) return 'blue';
  if (v >= 40) return 'amber';
  return 'red';
};
const BAND_STYLES: Record<BandKey, { wrap: string; bar: string; text: string; dot: string }> = {
  red:   { wrap: 'bg-red-50',     bar: 'bg-red-500',     text: 'text-red-600',     dot: 'bg-red-500' },
  amber: { wrap: 'bg-amber-50',   bar: 'bg-amber-500',   text: 'text-amber-600',   dot: 'bg-amber-500' },
  blue:  { wrap: 'bg-blue-50',    bar: 'bg-blue-500',    text: 'text-blue-600',    dot: 'bg-blue-500' },
  green: { wrap: 'bg-emerald-50', bar: 'bg-emerald-500', text: 'text-emerald-600', dot: 'bg-emerald-500' },
};
const avgOf = (nums: number[]) => (nums.length === 0 ? 0 : Math.round(nums.reduce((a, b) => a + b, 0) / nums.length));

/* ---------- Grade tabs card with subject progress (table layout) ---------- */
const GradeProgressCard: React.FC<{
  title: React.ReactNode;
  extra: React.ReactNode;
  byGrade: GradeProgress[];
  mode: 'plan' | 'grades';
  accentColor: string;
}> = ({ title, extra, byGrade, mode }) => {
  const [activeGrade, setActiveGrade] = useState<string>(byGrade[0]?.gradeId?.toString() || '');

  useEffect(() => {
    if (byGrade.length > 0 && !byGrade.find(g => g.gradeId.toString() === activeGrade)) {
      setActiveGrade(byGrade[0].gradeId.toString());
    }
  }, [byGrade]);

  if (byGrade.length === 0) {
    return (
      <Card className="h-full" bodyStyle={{ padding: 24 }} title={title} extra={extra}>
        <div className="flex flex-col items-center justify-center py-8">
          <CheckCircleOutlined style={{ fontSize: 36, color: '#16a34a', marginBottom: 8 }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin asignaciones</p>
        </div>
      </Card>
    );
  }

  // Per-grade overall percentage for the tab badge
  const gradePct = (grade: GradeProgress): number => {
    const totalDone = grade.subjects.reduce((sum, s) => sum + (mode === 'plan' ? s.withPlan : s.withGrades), 0);
    const totalSections = grade.subjects.reduce((sum, s) => sum + s.totalSections, 0);
    return totalSections > 0 ? Math.round((totalDone / totalSections) * 100) : 0;
  };

  const activeGradeData = byGrade.find(g => g.gradeId.toString() === activeGrade) || byGrade[0];

  // Collect unique sections across all subjects of the active grade (sorted)
  const sectionColsMap = new Map<number, { sectionName: string; sectionColor: string }>();
  activeGradeData.subjects.forEach(s => {
    s.sections.forEach(sec => {
      if (!sectionColsMap.has(sec.sectionId)) {
        sectionColsMap.set(sec.sectionId, { sectionName: sec.sectionName, sectionColor: sec.sectionColor });
      }
    });
  });
  const sectionColumns = Array.from(sectionColsMap.entries())
    .map(([id, val]) => ({ sectionId: id, ...val }))
    .sort((a, b) => a.sectionName.localeCompare(b.sectionName, 'es'));

  const overall = gradePct(activeGradeData);

  return (
    <Card
      className="h-full"
      bodyStyle={{ padding: 16 }}
      title={
        <div className="flex items-center justify-between w-full">
          {title}
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums"
            style={{ backgroundColor: '#0f172a', color: '#fff' }}
          >
            <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Total</span>
            <span>{overall}%</span>
          </div>
        </div>
      }
      extra={extra}
    >
      {/* Compact tab buttons */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {byGrade.map(grade => {
          const pct = gradePct(grade);
          const active = grade.gradeId.toString() === activeGrade;
          const gColor = grade.gradeColor || '#1e40af';
          const badgeBg =
            pct === 100 ? 'rgba(16,163,74,0.12)' :
            pct === 0   ? 'rgba(239,68,68,0.12)' :
                          'rgba(245,158,11,0.12)';
          const badgeColor =
            pct === 100 ? '#16a34a' :
            pct === 0   ? '#ef4444' :
                          '#f59e0b';
          return (
            <button
              key={grade.gradeId}
              onClick={() => setActiveGrade(grade.gradeId.toString())}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
              style={
                active
                  ? { backgroundColor: gColor, color: '#fff', borderColor: gColor }
                  : { backgroundColor: '#fff', color: 'rgba(15,23,42,0.6)', borderColor: 'rgba(15,23,42,0.12)' }
              }
            >
              {shortGradeName(grade.gradeName)}
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                style={active
                  ? { backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }
                  : { backgroundColor: badgeBg, color: badgeColor }}
              >
                {pct}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 480 }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(15,23,42,0.03)' }}>
                <th
                  className="text-left text-[10px] font-semibold uppercase tracking-wide px-3 py-2 border-b border-slate-200"
                  style={{ color: 'rgba(15,23,42,0.5)', minWidth: 150 }}
                >
                  Materia
                </th>
                {sectionColumns.map((c, i) => {
                  const colAvg = avgOf(activeGradeData.subjects.map(s => {
                    const sec = s.sections.find(x => x.sectionId === c.sectionId);
                    if (!sec) return 0;
                    return (mode === 'plan' ? sec.hasPlan : sec.hasGrades) ? 100 : 0;
                  }));
                  return (
                    <th
                      key={c.sectionId}
                      className="text-center text-[10px] font-semibold uppercase tracking-wide px-3 py-2 border-b border-slate-200"
                      style={{ color: 'rgba(15,23,42,0.5)', minWidth: 96 }}
                    >
                      {c.sectionName.replace(/^SECCION\s+/i, '').replace(/^SECCIÓN\s+/i, '')}
                      <span
                        className="block text-xs font-bold normal-case tracking-normal tabular-nums mt-0.5"
                        style={{ color: colAvg === 100 ? '#16a34a' : colAvg === 0 ? '#ef4444' : 'rgba(15,23,42,0.85)' }}
                      >
                        {colAvg}%
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {activeGradeData.subjects.map(subject => {
                const { Icon, color: subjColor } = getSubjectVisual({
                  name: subject.subjectName,
                  icon: subject.subjectIcon,
                  color: subject.subjectColor,
                });
                const sectionMap = new Map(subject.sections.map(s => [s.sectionId, s]));
                return (
                  <tr key={subject.subjectId} className="hover:bg-slate-50/70">
                    <td className="px-3 py-1.5 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-2 text-[12.5px] font-medium" style={{ color: 'rgba(15,23,42,0.9)' }}>
                        <Icon style={{ width: 15, height: 15, color: subjColor, flexShrink: 0 }} />
                        <span
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={subject.subjectName}
                        >
                          {subject.subjectName}
                        </span>
                      </div>
                    </td>
                    {sectionColumns.map(col => {
                      const sec = sectionMap.get(col.sectionId);
                      const v = sec ? ((mode === 'plan' ? sec.hasPlan : sec.hasGrades) ? 100 : 0) : -1;
                      if (v < 0) {
                        return (
                          <td key={col.sectionId} className="px-3 py-1.5 border-b border-slate-100 last:border-0 text-center">
                            <span className="text-[10px]" style={{ color: 'rgba(15,23,42,0.15)' }}>—</span>
                          </td>
                        );
                      }
                      const b = BAND_STYLES[bandOf(v)];
                      return (
                        <td key={col.sectionId} className="px-3 py-1.5 border-b border-slate-100 last:border-0" title={sec?.teacherName}>
                          <div className={`flex items-center gap-2 rounded-md px-2 py-1 ${b.wrap}`}>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }}>
                              <div className={`h-full rounded-full ${b.bar}`} style={{ width: `${v}%` }} />
                            </div>
                            <span className={`flex items-center gap-0.5 text-[11px] font-semibold tabular-nums min-w-[32px] justify-end ${b.text}`}>
                              {v}%
                              {v === 100 && <CheckCircleOutlined style={{ fontSize: 10 }} />}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-3 py-2 border-t border-slate-200 text-[10px]" style={{ color: 'rgba(15,23,42,0.5)' }}>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />0–39%</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />40–74%</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />75–99%</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />100%</span>
        </div>
      </div>
    </Card>
  );
};

/* ---------- Content progress card (simplified, no sections) ---------- */
const ContentProgressCard: React.FC<{
  title: React.ReactNode;
  extra: React.ReactNode;
  byGrade: ContentGradeProgress[];
}> = ({ title, extra, byGrade }) => {
  const [activeGrade, setActiveGrade] = useState<string>(byGrade[0]?.gradeId?.toString() || '');

  useEffect(() => {
    if (byGrade.length > 0 && !byGrade.find(g => g.gradeId.toString() === activeGrade)) {
      setActiveGrade(byGrade[0].gradeId.toString());
    }
  }, [byGrade]);

  if (byGrade.length === 0) {
    return (
      <Card className="h-full" bodyStyle={{ padding: 24 }} title={title} extra={extra}>
        <div className="flex flex-col items-center justify-center py-8">
          <CheckCircleOutlined style={{ fontSize: 36, color: '#16a34a', marginBottom: 8 }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin asignaciones</p>
        </div>
      </Card>
    );
  }

  const gradePct = (grade: ContentGradeProgress): number => {
    if (grade.subjects.length === 0) return 0;
    const done = grade.subjects.filter(s => s.hasContent).length;
    return Math.round((done / grade.subjects.length) * 100);
  };

  const activeGradeData = byGrade.find(g => g.gradeId.toString() === activeGrade) || byGrade[0];
  const overall = gradePct(activeGradeData);

  return (
    <Card
      className="h-full"
      bodyStyle={{ padding: 16 }}
      title={
        <div className="flex items-center justify-between w-full">
          {title}
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums"
            style={{ backgroundColor: '#0f172a', color: '#fff' }}
          >
            <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Total</span>
            <span>{overall}%</span>
          </div>
        </div>
      }
      extra={extra}
    >
      {/* Compact tab buttons */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {byGrade.map(grade => {
          const pct = gradePct(grade);
          const active = grade.gradeId.toString() === activeGrade;
          const gColor = grade.gradeColor || '#1e40af';
          const badgeBg =
            pct === 100 ? 'rgba(16,163,74,0.12)' :
            pct === 0   ? 'rgba(239,68,68,0.12)' :
                          'rgba(245,158,11,0.12)';
          const badgeColor =
            pct === 100 ? '#16a34a' :
            pct === 0   ? '#ef4444' :
                          '#f59e0b';
          return (
            <button
              key={grade.gradeId}
              onClick={() => setActiveGrade(grade.gradeId.toString())}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
              style={
                active
                  ? { backgroundColor: gColor, color: '#fff', borderColor: gColor }
                  : { backgroundColor: '#fff', color: 'rgba(15,23,42,0.6)', borderColor: 'rgba(15,23,42,0.12)' }
              }
            >
              {shortGradeName(grade.gradeName)}
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                style={active
                  ? { backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }
                  : { backgroundColor: badgeBg, color: badgeColor }}
              >
                {pct}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Subject list — one row per subject, single bar */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: 'rgba(15,23,42,0.03)' }}>
                <th
                  className="text-left text-[10px] font-semibold uppercase tracking-wide px-3 py-2 border-b border-slate-200"
                  style={{ color: 'rgba(15,23,42,0.5)' }}
                >
                  Materia
                </th>
                <th
                  className="text-center text-[10px] font-semibold uppercase tracking-wide px-3 py-2 border-b border-slate-200"
                  style={{ color: 'rgba(15,23,42,0.5)', width: 120 }}
                >
                  Contenido
                </th>
              </tr>
            </thead>
            <tbody>
              {activeGradeData.subjects.map(subject => {
                const { Icon, color: subjColor } = getSubjectVisual({
                  name: subject.subjectName,
                  icon: subject.subjectIcon,
                  color: subject.subjectColor,
                });
                const v = subject.hasContent ? 100 : 0;
                const b = BAND_STYLES[bandOf(v)];
                return (
                  <tr key={subject.subjectId} className="hover:bg-slate-50/70">
                    <td className="px-3 py-1.5 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-2 text-[12.5px] font-medium" style={{ color: 'rgba(15,23,42,0.9)' }}>
                        <Icon style={{ width: 15, height: 15, color: subjColor, flexShrink: 0 }} />
                        <span
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={subject.subjectName}
                        >
                          {subject.subjectName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 border-b border-slate-100 last:border-0">
                      <div className={`flex items-center gap-2 rounded-md px-2 py-1 ${b.wrap}`}>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }}>
                          <div className={`h-full rounded-full ${b.bar}`} style={{ width: `${v}%` }} />
                        </div>
                        <span className={`flex items-center gap-0.5 text-[11px] font-semibold tabular-nums min-w-[32px] justify-end ${b.text}`}>
                          {v}%
                          {v === 100 && <CheckCircleOutlined style={{ fontSize: 10 }} />}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-3 py-2 border-t border-slate-200 text-[10px]" style={{ color: 'rgba(15,23,42,0.5)' }}>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Sin contenido</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Completo</span>
        </div>
      </div>
    </Card>
  );
};

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
          <Col xs={24} md={6}>
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
          <Col xs={24} md={6}>
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
          <Col xs={24} md={6}>
            <FadeIn delay={350}>
              <Card className="h-full" bodyStyle={{ padding: 24 }}>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-6" style={{ color: 'var(--color-text-muted)' }}>Estado de Lapsos</h3>
                <div className="flex flex-col items-center">
                  <Progress
                    type="circle"
                    percent={lapsesRate}
                    size={120}
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

          {/* Lapsos Académicos */}
          <Col xs={24} md={6}>
            <FadeIn delay={400}>
              <Card className="h-full" bodyStyle={{ padding: 20 }}>
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
                        className="flex items-center justify-between p-2.5 rounded-xl app-card-hover"
                        style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)', transition: 'all 0.2s ease' }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black" style={{ backgroundColor: term.isBlocked ? 'rgba(22,163,74,0.1)' : 'rgba(245,158,11,0.1)', color: term.isBlocked ? '#16a34a' : '#f59e0b' }}>
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
                        <Tag color={term.isBlocked ? 'success' : 'warning'} className="font-semibold border-none rounded-full px-2.5" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
        </Row>

        {/* ===== Progress Cards: Planes + Notas (left) + Contenidos (right) ===== */}
        <Row gutter={[20, 20]}>
          {/* Plans Progress by Grade */}
          <Col xs={24} lg={9}>
            <FadeIn delay={450}>
              <GradeProgressCard
                title={<span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}><BookOutlined style={{ color: '#f59e0b' }} /> Planes de Evaluación</span>}
                extra={<Tag color="warning" className="font-bold rounded-full">{data.teachers.withoutPlans}</Tag>}
                byGrade={data.teachers.byGrade}
                mode="plan"
                accentColor="#f59e0b"
              />
            </FadeIn>
          </Col>

          {/* Grades Progress by Grade */}
          <Col xs={24} lg={9}>
            <FadeIn delay={500}>
              <GradeProgressCard
                title={<span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}><ExclamationCircleOutlined style={{ color: '#ef4444' }} /> Carga de Notas</span>}
                extra={<Tag color="error" className="font-bold rounded-full">{data.teachers.withoutGrades}</Tag>}
                byGrade={data.teachers.byGrade}
                mode="grades"
                accentColor="#ef4444"
              />
            </FadeIn>
          </Col>

          {/* Content Progress by Grade */}
          <Col xs={24} lg={6}>
            <FadeIn delay={550}>
              <ContentProgressCard
                title={<span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}><ReadOutlined style={{ color: '#0ea5e9' }} /> Carga de Contenidos</span>}
                extra={<Tag color="processing" className="font-bold rounded-full">{data.teachers.byGradeContent.filter(g => g.subjects.some(s => !s.hasContent)).length}</Tag>}
                byGrade={data.teachers.byGradeContent}
              />
            </FadeIn>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default ControlEstudiosDashboard;
