import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Spin, message } from 'antd';
import {
  LeftOutlined, DownOutlined, WarningOutlined, StopOutlined,
  CheckOutlined, ClockCircleOutlined, UserOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { getSubjectVisual } from '@/utils/subjectVisuals';
import type { AttendanceSessionView, RosterEntry, AttendanceStatus, ClearanceReason } from './types';

/* ---------------- Design tokens (from the approved prototype) ----------------
   Fraunces (headings / subject names) + Inter (UI, body). Cool slate paper,
   emerald for "live/done", amber for attention/missing, per-subject hues. */
const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Inter:wght@400;500;600&display=swap');
.att-font-head { font-family: 'Fraunces', serif; }
.att-font-body { font-family: 'Inter', sans-serif; }
`;

const DAY_CHIPS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const DAY_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const MONTHS_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const REASON_CHIPS = ['Enfermo', 'Llegó tarde', 'Se retiró', 'Sin excusa', 'Otro'];

type SessionStatus = 'done' | 'current' | 'missing' | 'upcoming';

const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const mondayOf = (d: Dayjs): Dayjs => d.subtract((d.day() + 6) % 7, 'day');
const weekLabel = (mon: Dayjs): string => {
  const fri = mon.add(4, 'day');
  return `${mon.date()} ${MONTHS_ABBR[mon.month()]} – ${fri.date()} ${MONTHS_ABBR[fri.month()]}`;
};
const monthLabel = (m: Dayjs): string => `${MONTHS_FULL[m.month()]} ${m.year()}`;

/** All Mondays whose Mon–Fri week overlaps the given month, in order. */
const weeksOfMonth = (month: Dayjs): Dayjs[] => {
  const weeks: Dayjs[] = [];
  let cursor = mondayOf(month.startOf('month'));
  const end = month.endOf('month');
  while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
    weeks.push(cursor);
    cursor = cursor.add(7, 'day');
  }
  return weeks;
};

/**
 * Months of the school period, September (startYear) through August (endYear),
 * in chronological order. Falls back to the current Venezuelan school year
 * (Sep → Aug) when the period bounds are not loaded yet.
 */
const periodMonths = (viewPeriod: any): Dayjs[] => {
  const today = dayjs();
  let startYear: number;
  if (viewPeriod?.startYear && viewPeriod?.endYear) {
    startYear = Number(viewPeriod.startYear);
  } else {
    startYear = today.month() >= 8 ? today.year() : today.year() - 1;
  }
  return Array.from({ length: 12 }, (_, i) => {
    const m = 8 + i; // 8 = September (0-indexed)
    return dayjs(new Date(startYear + Math.floor(m / 12), m % 12, 1));
  });
};

const todayWeekdayIdx = (): number => {
  const d = dayjs().day();
  return d >= 1 && d <= 5 ? d - 1 : 0;
};

/**
 * Teacher attendance view — mobile-first, installed via PWA. Two screens:
 * schedule (timeline of today's sessions) and roster (mark attendance).
 * Mirrors the approved attendance-app prototype.
 */
const TeacherAttendanceTab: React.FC = () => {
  const { user } = useAuth();
  const { viewPeriod } = useSchool();
  const [month, setMonth] = useState<Dayjs>(() => dayjs().startOf('month'));
  const [weekMonday, setWeekMonday] = useState<Dayjs>(() => mondayOf(dayjs()));
  const [dayIdx, setDayIdx] = useState(todayWeekdayIdx);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [openSessionId, setOpenSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<AttendanceSessionView[]>([]);
  const [loading, setLoading] = useState(true);

  const months = useMemo(() => periodMonths(viewPeriod), [viewPeriod]);

  const selectedDate = weekMonday.add(dayIdx, 'day');
  const dateStr = selectedDate.format('YYYY-MM-DD');

  // Clamp the default month into the period range once the period loads.
  useEffect(() => {
    if (months.length === 0) return;
    const first = months[0];
    const last = months[months.length - 1];
    const current = dayjs().startOf('month');
    if (current.isBefore(first)) setMonth(first);
    else if (current.isAfter(last)) setMonth(last);
  }, [months]);

  const fetchSessions = useCallback(async (ds: string, periodId?: number) => {
    setLoading(true);
    try {
      const res = await api.get('/attendance/my-sessions', {
        params: { date: ds, ...(periodId ? { schoolPeriodId: periodId } : {}) },
      });
      setSessions(res.data.sessions ?? []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions(dateStr, viewPeriod?.id);
  }, [dateStr, viewPeriod?.id, fetchSessions]);

  const handlePickMonth = useCallback((m: Dayjs) => {
    setMonth(m);
    setMonthPickerOpen(false);
    // Select the week containing today when it overlaps the month,
    // otherwise the first week of the month.
    const weeks = weeksOfMonth(m);
    const todayMon = mondayOf(dayjs());
    const target = weeks.find(w => w.isSame(todayMon, 'day')) ?? weeks[0];
    setWeekMonday(target);
    const todayInWeek = mondayOf(dayjs()).isSame(target, 'day');
    setDayIdx(todayInWeek ? todayWeekdayIdx() : 0);
  }, []);

  const handlePickWeek = useCallback((mon: Dayjs) => {
    setWeekMonday(mon);
    setWeekPickerOpen(false);
    const todayInWeek = mondayOf(dayjs()).isSame(mon, 'day');
    setDayIdx(todayInWeek ? todayWeekdayIdx() : 0);
  }, []);

  const statusOf = useCallback((s: AttendanceSessionView, idx: number): SessionStatus => {
    const taken = s.counts.total > 0 || s.status === 'completed';
    if (taken) return 'done';
    const today = dayjs().format('YYYY-MM-DD');
    if (dateStr < today) return 'missing';
    if (dateStr > today) return 'upcoming';
    const firstNotDone = sessions.findIndex(x => !(x.counts.total > 0 || x.status === 'completed'));
    if (firstNotDone === -1) return 'done';
    return idx === firstNotDone ? 'current' : idx < firstNotDone ? 'missing' : 'upcoming';
  }, [sessions, dateStr]);

  const openSession = openSessionId != null ? sessions.find(s => s.id === openSessionId) ?? null : null;

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="flex justify-center py-4">
      <style>{FONT_IMPORT}</style>
      <div className="w-full max-w-sm bg-slate-50 rounded-[2rem] border border-slate-300 shadow-xl overflow-hidden min-h-[560px]">
        {openSession ? (
          <RosterScreen
            session={openSession}
            dateStr={dateStr}
            dayName={DAY_FULL[dayIdx]}
            onBack={() => { setOpenSessionId(null); fetchSessions(dateStr); }}
          />
        ) : (
          <ScheduleScreen
            userInitials={initials}
            months={months}
            month={month}
            monthPickerOpen={monthPickerOpen}
            onToggleMonthPicker={() => { setMonthPickerOpen(o => !o); setWeekPickerOpen(false); }}
            onPickMonth={handlePickMonth}
            weekMonday={weekMonday}
            weekPickerOpen={weekPickerOpen}
            onToggleWeekPicker={() => { setWeekPickerOpen(o => !o); setMonthPickerOpen(false); }}
            onPickWeek={handlePickWeek}
            dayIdx={dayIdx}
            onPickDay={setDayIdx}
            sessions={sessions}
            statusOf={statusOf}
            loading={loading}
            onSelectSession={(id) => setOpenSessionId(id)}
          />
        )}
      </div>
    </div>
  );
};

/* ---------------- Schedule Screen ---------------- */
function ScheduleScreen({
  userInitials, month, months, monthPickerOpen, onToggleMonthPicker, onPickMonth,
  weekMonday, weekPickerOpen, onToggleWeekPicker, onPickWeek,
  dayIdx, onPickDay, sessions, statusOf, loading, onSelectSession,
}: {
  userInitials: string;
  month: Dayjs;
  months: Dayjs[];
  monthPickerOpen: boolean;
  onToggleMonthPicker: () => void;
  onPickMonth: (m: Dayjs) => void;
  weekMonday: Dayjs;
  weekPickerOpen: boolean;
  onToggleWeekPicker: () => void;
  onPickWeek: (mon: Dayjs) => void;
  dayIdx: number;
  onPickDay: (i: number) => void;
  sessions: AttendanceSessionView[];
  statusOf: (s: AttendanceSessionView, idx: number) => SessionStatus;
  loading: boolean;
  onSelectSession: (id: number) => void;
}) {
  const weeks = weeksOfMonth(month);
  return (
    <div className="att-font-body">
      <div className="px-5 pt-6 pb-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <LeftOutlined style={{ fontSize: 14, color: '#94a3b8' }} />
          <h1 className="att-font-head text-lg text-slate-900">Asistencias</h1>
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
            <UserOutlined className="w-4 h-4 text-slate-500" />
            <span className="sr-only">{userInitials}</span>
          </div>
        </div>

        <div className="relative mt-3 flex justify-center gap-4">
          {/* Month picker — school period range: September (startYear) → August (endYear).
              Future months are listed but disabled until they begin. */}
          <div className="relative">
            <button
              onClick={onToggleMonthPicker}
              className="flex items-center gap-1 text-sm text-slate-500 att-font-body hover:text-slate-800"
            >
              {monthLabel(month)}
              <DownOutlined className="text-[10px]" />
            </button>
            {monthPickerOpen && (
              <div className="absolute top-7 left-1/2 -translate-x-1/2 z-10 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden w-44 max-h-64 overflow-y-auto">
                {months.map(m => {
                  const isFuture = m.isAfter(dayjs(), 'month');
                  return (
                    <button
                      key={m.format('YYYY-MM')}
                      disabled={isFuture}
                      onClick={() => onPickMonth(m)}
                      className={`w-full text-left px-4 py-2.5 text-sm att-font-body ${
                        isFuture
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'hover:bg-slate-50'
                      } ${
                        !isFuture && m.isSame(month, 'month') ? 'text-slate-900 font-medium' : ''
                      }`}
                    >
                      {monthLabel(m)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Week picker — weeks overlapping the month; fully-future weeks disabled */}
          <div className="relative">
            <button
              onClick={onToggleWeekPicker}
              className="flex items-center gap-1 text-sm text-slate-500 att-font-body hover:text-slate-800"
            >
              {weekLabel(weekMonday)}
              <DownOutlined className="text-[10px]" />
            </button>
            {weekPickerOpen && (
              <div className="absolute top-7 left-1/2 -translate-x-1/2 z-10 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden w-44 max-h-64 overflow-y-auto">
                {weeks.map(mon => {
                  const isFuture = mon.isAfter(dayjs(), 'day');
                  return (
                    <button
                      key={mon.format('YYYY-MM-DD')}
                      disabled={isFuture}
                      onClick={() => onPickWeek(mon)}
                      className={`w-full text-left px-4 py-2.5 text-sm att-font-body ${
                        isFuture
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'hover:bg-slate-50'
                      } ${
                        !isFuture && mon.isSame(weekMonday, 'day') ? 'text-slate-900 font-medium' : ''
                      }`}
                    >
                      {weekLabel(mon)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {DAY_CHIPS.map((d, i) => {
            const dayDate = weekMonday.add(i, 'day');
            const isFutureDay = dayDate.isAfter(dayjs(), 'day');
            return (
              <button
                key={d}
                disabled={isFutureDay}
                onClick={() => onPickDay(i)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium att-font-body transition-colors ${
                  i === dayIdx
                    ? 'bg-slate-900 text-white'
                    : isFutureDay
                      ? 'bg-white text-slate-300 border border-slate-100 cursor-not-allowed'
                      : 'bg-white text-slate-500 border border-slate-200'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-5">
        {loading ? (
          <div className="flex justify-center py-16"><Spin /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 text-slate-400 att-font-body text-sm">
            No tiene clases programadas este día.
          </div>
        ) : (
          <div className="relative">
            {sessions.map((session, i) => {
              const status = statusOf(session, i);
              const visual = getSubjectVisual({ name: session.subjectName });
              const Icon = visual.Icon;
              const isLast = i === sessions.length - 1;
              return (
                <div key={session.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <TimelineDot status={status} />
                    {!isLast && (
                      <div
                        className={`w-px flex-1 my-1 ${
                          status === 'done' ? 'bg-emerald-300' : 'bg-slate-200'
                        }`}
                        style={{ minHeight: '2.75rem' }}
                      />
                    )}
                  </div>

                  <button
                    onClick={() => onSelectSession(session.id)}
                    className="flex-1 mb-3 text-left bg-white rounded-xl border-y border-r border-slate-200 px-3.5 py-3 flex items-center gap-3 hover:border-slate-300 transition-colors"
                    style={{ borderLeft: `4px solid ${visual.color}` }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: visual.color }}
                    >
                      <Icon style={{ color: '#fff', fontSize: 16 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="att-font-head text-[15px] text-slate-900 truncate">{session.subjectName || 'Sin materia'}</span>
                        {status === 'missing' && <WarningOutlined className="text-amber-500 text-xs shrink-0" />}
                      </div>
                      <span className="text-xs text-slate-400 att-font-body">
                        {status === 'done' && 'Asistencia registrada'}
                        {status === 'current' && 'En curso — toca para tomar asistencia'}
                        {status === 'missing' && 'Terminó — asistencia sin registrar'}
                        {status === 'upcoming' && 'Aún no comienza'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 att-font-body shrink-0">{session.periodStart ?? session.periodId.toUpperCase()}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineDot({ status }: { status: SessionStatus }) {
  if (status === 'done')
    return <div className="w-3 h-3 rounded-full bg-emerald-500 mt-4" />;
  if (status === 'current')
    return (
      <div className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-white mt-4 flex items-center justify-center">
        <div className="w-1 h-1 rounded-full bg-emerald-500" />
      </div>
    );
  if (status === 'missing')
    return <div className="w-3 h-3 rounded-full border-2 border-amber-500 bg-amber-50 mt-4" />;
  return <div className="w-3 h-3 rounded-full border-2 border-slate-300 bg-white mt-4" />;
}

/* ---------------- Roster Screen ---------------- */
function RosterScreen({
  session, dateStr, dayName, onBack,
}: {
  session: AttendanceSessionView;
  dateStr: string;
  dayName: string;
  onBack: () => void;
}) {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('current');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/attendance/sessions/${session.id}`);
        if (cancelled) return;
        setRoster(res.data.roster ?? []);
        const taken = (res.data.roster ?? []).some((r: RosterEntry) => r.status !== null);
        const isToday = dateStr === dayjs().format('YYYY-MM-DD');
        if (taken) setSessionStatus('done');
        else setSessionStatus(isToday ? 'current' : 'missing');
      } catch {
        message.error('Error al cargar la nómina');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session.id, dateStr]);

  const isPast = sessionStatus === 'done' || sessionStatus === 'missing';

  const setStatus = (inscriptionId: number, status: AttendanceStatus) => {
    setRoster(prev => prev.map(r => {
      if (r.inscriptionId !== inscriptionId) return r;
      return {
        ...r,
        status,
        reason: status === 'present' ? null : (r.reason ?? null),
      };
    }));
  };

  const setReason = (inscriptionId: number, reason: string) => {
    setRoster(prev => prev.map(r => (r.inscriptionId === inscriptionId ? { ...r, reason } : r)));
  };

  const handleSave = async () => {
    const missingReason = roster.find(
      r => (r.status === 'absent' || r.status === 'kicked') && !(r.reason ?? '').trim()
    );
    if (missingReason) {
      message.warning(`Indique el motivo de ${missingReason.status === 'absent' ? 'ausencia' : 'expulsión'} de ${missingReason.fullName}`);
      return;
    }
    setSaving(true);
    try {
      const records = roster
        .filter(r => r.status !== null)
        .map(r => ({ inscriptionId: r.inscriptionId, status: r.status, reason: r.reason || null }));
      await api.put(`/attendance/sessions/${session.id}/records`, { records });
      message.success(isPast ? 'Cambios guardados' : 'Asistencia guardada');
      onBack();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar asistencia');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="att-font-body">
      <div className="px-5 pt-6 pb-4 border-b border-slate-200">
        <button onClick={onBack} className="flex items-center gap-1 text-slate-500 text-sm att-font-body mb-3">
          <LeftOutlined className="text-xs" /> Horario
        </button>
        <h1 className="att-font-head text-xl text-slate-900">{session.subjectName || 'Sin materia'}</h1>
        <p className="text-sm text-slate-400 att-font-body">{session.periodStart ?? session.periodId.toUpperCase()} · {dayName}</p>

        {sessionStatus === 'missing' && (
          <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <WarningOutlined className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 att-font-body leading-relaxed">
              Esta clase terminó sin registrar asistencia. Si la marca ahora, quedará registrada como ingreso tardío.
            </p>
          </div>
        )}
        {sessionStatus === 'done' && (
          <div className="mt-3 flex items-start gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
            <ClockCircleOutlined className="text-slate-500 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-600 att-font-body leading-relaxed">
              Está revisando un registro anterior. Cualquier cambio quedará registrado con su nombre y la hora.
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spin /></div>
      ) : (
        <div className="px-5 py-4 space-y-2.5">
          {roster.map(student => (
            <StudentRow
              key={student.inscriptionId}
              student={student}
              onSetStatus={setStatus}
              onSetReason={setReason}
              onClear={async (code, note) => {
                try {
                  await api.post(`/attendance/sessions/${session.id}/clear-block`, {
                    inscriptionId: student.inscriptionId,
                    reasonCode: code,
                    reasonNote: note || null,
                  });
                  message.success('Estudiante desbloqueado');
                  const res = await api.get(`/attendance/sessions/${session.id}`);
                  setRoster(res.data.roster ?? []);
                } catch (err: any) {
                  message.error(err?.response?.data?.message || 'Error al desbloquear');
                }
              }}
            />
          ))}
        </div>
      )}

      <div className="px-5 pb-6 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-slate-900 text-white rounded-xl py-3 att-font-body text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <CheckOutlined /> {isPast ? 'Guardar cambios' : 'Guardar asistencia'}
        </button>
      </div>
    </div>
  );
}

function StudentRow({
  student, onSetStatus, onSetReason, onClear,
}: {
  student: RosterEntry;
  onSetStatus: (inscriptionId: number, status: AttendanceStatus) => void;
  onSetReason: (inscriptionId: number, reason: string) => void;
  onClear: (code: string, note: string) => Promise<void>;
}) {
  const [clearing, setClearing] = useState(false);
  const isBlocked = student.priorBlock != null;

  const pick = (status: AttendanceStatus) => {
    onSetStatus(student.inscriptionId, status);
  };

  if (isBlocked) {
    const prior = student.priorBlock!;
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={student.fullName} muted />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 att-font-body">{student.fullName}</p>
            <p className="text-xs text-amber-700 att-font-body flex items-center gap-1 mt-0.5">
              <StopOutlined className="text-[10px]" />
              {prior.status === 'absent' ? 'Ausente' : 'Expulsado'} en {prior.subjectName || 'clase anterior'}, {prior.periodId.toUpperCase()}
            </p>
          </div>
          <button
            onClick={() => setClearing(c => !c)}
            className="text-xs font-medium att-font-body text-amber-800 bg-amber-100 border border-amber-300 rounded-lg px-2.5 py-1.5 shrink-0"
          >
            Desbloquear
          </button>
        </div>
        {clearing && (
          <ClearancePanel
            onConfirm={onClear}
            onCancel={() => setClearing(false)}
          />
        )}
      </div>
    );
  }

  const showReason = student.status === 'absent' || student.status === 'kicked';

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-3">
      <div className="flex items-center gap-2.5">
        <Avatar name={student.fullName} />
        <p className="flex-1 text-sm font-medium text-slate-800 att-font-body truncate">{student.fullName}</p>
        <div className="flex gap-1.5 shrink-0">
          <StatusButton label="Presente" active={student.status === 'present'} color="emerald" onClick={() => pick('present')} />
          <StatusButton label="Ausente" active={student.status === 'absent'} color="rose" onClick={() => pick('absent')} />
          <StatusButton label="Expulsado" active={student.status === 'kicked'} color="slate" onClick={() => pick('kicked')} />
        </div>
      </div>
      {showReason && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100">
          <div className="flex flex-wrap gap-1.5">
            {REASON_CHIPS.map(r => (
              <button
                key={r}
                onClick={() => onSetReason(student.inscriptionId, r)}
                className={`text-[11px] att-font-body px-2 py-1 rounded-full border ${
                  student.reason === r
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClearancePanel({
  onConfirm, onCancel,
}: {
  onConfirm: (code: string, note: string) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [reasons, setReasons] = useState<ClearanceReason[]>([]);

  useEffect(() => {
    api.get('/attendance/clearance-reasons')
      .then(res => setReasons(res.data ?? []))
      .catch(() => setReasons([]));
  }, []);

  const selected = reasons.find(r => r.code === code);
  const needsNote = selected?.requiresNote === true;
  const canConfirm = code != null && (!needsNote || note.trim().length > 0);

  return (
    <div className="mt-2.5 pt-2.5 border-t border-amber-200">
      <p className="text-[11px] text-amber-700 att-font-body mb-1.5">Motivo para desbloquear</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {reasons.map(r => (
          <button
            key={r.code}
            onClick={() => setCode(r.code)}
            className={`text-[11px] att-font-body px-2 py-1 rounded-full border ${
              code === r.code ? 'bg-amber-800 text-white border-amber-800' : 'bg-white text-amber-800 border-amber-300'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      {needsNote && (
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Especifique el motivo…"
          className="w-full text-xs att-font-body border border-amber-300 rounded-lg px-2.5 py-1.5 mb-2 outline-none focus:border-amber-500"
        />
      )}
      <div className="flex gap-2">
        <button
          disabled={!canConfirm}
          onClick={() => code && onConfirm(code, note.trim() || '')}
          className="text-xs font-medium att-font-body text-white bg-amber-800 disabled:opacity-40 rounded-lg px-3 py-1.5"
        >
          Confirmar desbloqueo
        </button>
        <button onClick={onCancel} className="text-xs att-font-body text-amber-700 px-3 py-1.5">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function StatusButton({ label, active, color, onClick }: {
  label: string;
  active: boolean;
  color: 'emerald' | 'rose' | 'slate';
  onClick: () => void;
}) {
  const colors = {
    emerald: active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-200',
    rose: active ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-700 border-rose-200',
    slate: active ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200',
  };
  return (
    <button
      onClick={onClick}
      className={`text-[11px] font-medium att-font-body px-2 py-1.5 rounded-lg border ${colors[color]}`}
    >
      {label}
    </button>
  );
}

function Avatar({ name, muted }: { name: string; muted?: boolean }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium att-font-body shrink-0 ${
        muted ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-600'
      }`}
    >
      {initials}
    </div>
  );
}

export default TeacherAttendanceTab;
