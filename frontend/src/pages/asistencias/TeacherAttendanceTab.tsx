import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Input, Spin, message } from 'antd';
import axios from 'axios';
import {
  LeftOutlined, DownOutlined, RightOutlined, WarningOutlined, StopOutlined,
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
const getApiErrorMessage = (error: unknown, fallback: string): string =>
  axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || fallback : fallback;

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
const periodMonths = (viewPeriod: { startYear?: number | string | null; endYear?: number | string | null } | null | undefined): Dayjs[] => {
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
      <div
        className="w-full max-w-sm bg-slate-50 rounded-[2rem] border border-slate-300 shadow-xl overflow-hidden flex flex-col"
        style={openSession
          ? { height: 'min(760px, calc(100dvh - 220px))', minHeight: 440 }
          : { minHeight: 560 }}
      >
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
  const [selectedInscriptionId, setSelectedInscriptionId] = useState<number | null>(null);
  const rosterListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/attendance/sessions/${session.id}`);
        if (cancelled) return;
        const loadedRoster: RosterEntry[] = res.data.roster ?? [];
        setRoster(loadedRoster);
        setSelectedInscriptionId(current =>
          current && loadedRoster.some(student => student.inscriptionId === current)
            ? current
            : loadedRoster[0]?.inscriptionId ?? null
        );
        const taken = loadedRoster.some(student => student.status !== null);
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

  const selectedStudent = roster.find(student => student.inscriptionId === selectedInscriptionId) ?? null;
  const selectedIndex = selectedStudent ? roster.indexOf(selectedStudent) : -1;

  const selectStudentAtScrollLine = () => {
    const list = rosterListRef.current;
    if (!list) return;

    const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-inscription-id]'));
    if (rows.length === 0) return;

    const listBounds = list.getBoundingClientRect();
    const focusY = listBounds.top + list.clientHeight / 2;
    let closestId: number | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      const bounds = row.getBoundingClientRect();
      const distance = Math.abs((bounds.top + bounds.bottom) / 2 - focusY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = Number(row.dataset.inscriptionId);
      }
    }
    if (closestId != null) setSelectedInscriptionId(current => current === closestId ? current : closestId);
  };

  const scrollToStudent = (inscriptionId: number) => {
    const list = rosterListRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-inscription-id="${inscriptionId}"]`);
    if (!list || !row) {
      setSelectedInscriptionId(inscriptionId);
      return;
    }

    const rowBounds = row.getBoundingClientRect();
    const listBounds = list.getBoundingClientRect();
    const focusY = listBounds.top + list.clientHeight / 2;
    list.scrollTop += (rowBounds.top + rowBounds.bottom) / 2 - focusY;
    setSelectedInscriptionId(inscriptionId);
  };

  const handleSave = async () => {
    const missingReason = roster.find(r => r.status === 'kicked' && !(r.reason ?? '').trim());
    if (missingReason) {
      scrollToStudent(missingReason.inscriptionId);
      message.warning(`Indique el motivo de expulsión de ${missingReason.fullName}`);
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
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, 'Error al guardar asistencia'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="att-font-body flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 shrink-0 px-5 pt-4 pb-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="flex items-center gap-1 text-slate-500 text-sm att-font-body">
            <LeftOutlined className="text-xs" /> Horario
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 tabular-nums">
              {roster.filter(r => r.status !== null).length}/{roster.length}
            </span>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-slate-900 text-white rounded-lg px-3 py-2 att-font-body text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <CheckOutlined /> {saving ? 'Guardando…' : isPast ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </div>
        <h1 className="att-font-head text-xl text-slate-900">{session.subjectName || 'Sin materia'}</h1>
        <p className="text-sm text-slate-400 att-font-body">{session.periodStart ?? session.periodId.toUpperCase()} · {dayName}</p>

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
        <div className="flex min-h-0 flex-1 justify-center py-16"><Spin /></div>
      ) : (
        <div className="relative min-h-0 flex-1">
          <div
            ref={rosterListRef}
            onScroll={selectStudentAtScrollLine}
            className="absolute inset-0 overflow-y-auto overscroll-contain touch-pan-y px-3"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div style={{ height: 'max(0px, calc(50% - 21px))' }} aria-hidden="true" />
            {roster.map((student, index) => (
              <StudentListRow
                key={student.inscriptionId}
                student={student}
                index={index}
                selected={student.inscriptionId === selectedInscriptionId}
                onClick={() => scrollToStudent(student.inscriptionId)}
              />
            ))}
            <div style={{ height: 'max(0px, calc(50% - 21px))' }} aria-hidden="true" />
          </div>
          {selectedStudent && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-3">
              <div className="pointer-events-auto w-full max-w-sm">
                <SelectedStudentEditor
                  student={selectedStudent}
                  index={selectedIndex}
                  total={roster.length}
                  onPrev={() => scrollToStudent(roster[Math.max(0, selectedIndex - 1)]?.inscriptionId ?? selectedStudent.inscriptionId)}
                  onNext={() => scrollToStudent(roster[Math.min(roster.length - 1, selectedIndex + 1)]?.inscriptionId ?? selectedStudent.inscriptionId)}
                  onSetStatus={(status) => {
                    setStatus(selectedStudent.inscriptionId, status);
                    const canAdvance = status === 'present' || status === 'absent' || (status === 'kicked' && Boolean(selectedStudent.reason?.trim()));
                    if (canAdvance && selectedIndex < roster.length - 1) {
                      scrollToStudent(roster[selectedIndex + 1].inscriptionId);
                    }
                  }}
                  onSetReason={(reason) => setReason(selectedStudent.inscriptionId, reason)}
                  onBackgroundScroll={(delta) => {
                    if (rosterListRef.current) rosterListRef.current.scrollTop += delta;
                  }}
                  onClear={async (code, note) => {
                    try {
                      await api.post(`/attendance/sessions/${session.id}/clear-block`, {
                        inscriptionId: selectedStudent.inscriptionId,
                        reasonCode: code,
                        reasonNote: note || null,
                      });
                      message.success('Estudiante desbloqueado');
                      const res = await api.get(`/attendance/sessions/${session.id}`);
                      setRoster(res.data.roster ?? []);
                      return true;
                    } catch (err: unknown) {
                      message.error(getApiErrorMessage(err, 'Error al desbloquear'));
                      return false;
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function StudentListRow({ student, index, selected, onClick }: {
  student: RosterEntry;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  const blocked = student.priorBlock != null;
  const badges: { code: string; label: string; status: AttendanceStatus; color: 'emerald' | 'rose' | 'slate' | 'amber' | 'blue' }[] = [
    { code: 'P', label: 'Presente', status: 'present', color: 'emerald' },
    { code: 'A', label: 'Ausente', status: 'absent', color: 'rose' },
    { code: 'E', label: 'Expulsado', status: 'kicked', color: 'slate' },
  ];
  if (student.status === 'late') badges.push({ code: 'T', label: 'Tarde', status: 'late', color: 'amber' });
  if (student.status === 'excused') badges.push({ code: 'J', label: 'Justificado', status: 'excused', color: 'blue' });

  return (
    <button
      type="button"
      data-inscription-id={student.inscriptionId}
      onClick={onClick}
      aria-label={`Editar asistencia de ${student.fullName}`}
      aria-hidden={selected}
      tabIndex={selected ? -1 : 0}
      className={`w-full flex items-center gap-2.5 px-2 py-2.5 border-b border-slate-200 text-left transition-colors ${selected ? 'invisible pointer-events-none' : 'bg-slate-100/70 text-slate-500 opacity-75 hover:opacity-100 hover:bg-slate-200/80'}`}
    >
      <span className="w-6 shrink-0 text-[11px] text-slate-400 tabular-nums">
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-700 att-font-body">
        {student.fullName}
      </span>
      {blocked ? (
        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
          Bloqueado
        </span>
      ) : (
        <span className="flex shrink-0 gap-1">
          {badges.map(badge => {
            const active = student.status === badge.status;
            const colors = {
              emerald: active ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-300',
              rose: active ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-slate-200 text-slate-300',
              slate: active ? 'bg-slate-700 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-300',
              amber: active ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-300',
              blue: active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-300',
            };
            return (
              <span
                key={badge.code}
                title={badge.label}
                aria-label={`${badge.label}${active ? ', seleccionado' : ''}`}
                className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-semibold ${colors[badge.color]}`}
              >
                {badge.code}
              </span>
            );
          })}
        </span>
      )}
    </button>
  );
}

function SelectedStudentEditor({
  student, index, total, onPrev, onNext, onSetStatus, onSetReason, onBackgroundScroll, onClear,
}: {
  student: RosterEntry;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onSetStatus: (status: AttendanceStatus) => void;
  onSetReason: (reason: string) => void;
  onBackgroundScroll: (delta: number) => void;
  onClear: (code: string, note: string) => Promise<boolean>;
}) {
  const [clearing, setClearing] = useState(false);
  const prior = student.priorBlock;
  const hasReason = Boolean(student.reason?.trim());
  const touchY = useRef<number | null>(null);

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    touchY.current = target.closest('button, input, textarea') ? null : event.touches[0]?.clientY ?? null;
  };
  const handleTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    if (touchY.current == null) return;
    const currentY = event.touches[0]?.clientY;
    if (currentY == null) return;
    const delta = touchY.current - currentY;
    if (Math.abs(delta) > 1) {
      onBackgroundScroll(delta);
      touchY.current = currentY;
      if (event.cancelable) event.preventDefault();
    }
  };

  return (
    <section
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => { touchY.current = null; }}
      onWheel={(event) => {
        const target = event.target as HTMLElement;
        if (!target.closest('button, input, textarea')) {
          onBackgroundScroll(event.deltaY);
          event.preventDefault();
        }
      }}
      className="h-[310px] shrink-0 overflow-y-auto rounded-xl border border-slate-300 bg-white p-3 shadow-sm"
      aria-label={`Asistencia de ${student.fullName}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <button type="button" onClick={onPrev} disabled={index === 0} className="px-2 py-1 text-slate-500 disabled:opacity-30" aria-label="Estudiante anterior">
          <LeftOutlined />
        </button>
        <span className="text-[11px] text-slate-400 tabular-nums">{String(index + 1).padStart(2, '0')} de {total}</span>
        <button type="button" onClick={onNext} disabled={index >= total - 1} className="px-2 py-1 text-slate-500 disabled:opacity-30" aria-label="Estudiante siguiente">
          <RightOutlined />
        </button>
      </div>

      <div className="mb-2 px-1">
        <p className="text-[11px] text-slate-400 tabular-nums m-0">{String(index + 1).padStart(2, '0')}</p>
        <h2 className="att-font-head text-xl leading-tight text-slate-900 m-0 line-clamp-2 min-h-12">{student.fullName}</h2>
      </div>

      {prior ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="m-0 flex items-start gap-2 text-xs leading-relaxed text-amber-800">
            <StopOutlined className="mt-0.5 shrink-0" />
            {prior.status === 'absent' ? 'Ausente' : 'Expulsado'} en {prior.subjectName || 'clase anterior'}, {prior.periodId.toUpperCase()}. Debe desbloquearse antes de registrar asistencia.
          </p>
          {!clearing ? (
            <button
              type="button"
              onClick={() => setClearing(true)}
              className="mt-3 w-full rounded-lg border border-amber-300 bg-amber-100 py-2 text-xs font-medium text-amber-900"
            >
              Desbloquear estudiante
            </button>
          ) : (
            <ClearancePanel
              onConfirm={async (code, note) => {
                if (await onClear(code, note)) setClearing(false);
              }}
              onCancel={() => setClearing(false)}
            />
          )}
        </div>
      ) : (
        <>
          <div className="mb-2">
            <p className="mb-1 text-[11px] font-medium text-slate-500">Motivo (opcional para ausente; obligatorio para expulsado)</p>
            <div className="mb-1.5 flex flex-wrap gap-1">
              {REASON_CHIPS.map(reason => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => onSetReason(reason)}
                  className={`text-[10px] att-font-body px-2 py-1 rounded-full border ${
                    student.reason === reason
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <Input.TextArea
              value={student.reason ?? ''}
              onChange={event => onSetReason(event.target.value)}
              placeholder="Elige una razón o escríbela…"
              autoSize={false}
              rows={2}
              maxLength={250}
              className="text-xs att-font-body"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <BigStatusButton label="Presente" active={student.status === 'present'} color="emerald" onClick={() => onSetStatus('present')} />
            <BigStatusButton label="Ausente" active={student.status === 'absent'} color="rose" onClick={() => onSetStatus('absent')} />
            <BigStatusButton
              label="Expulsado"
              active={student.status === 'kicked'}
              color="slate"
              disabled={!hasReason}
              onClick={() => onSetStatus('kicked')}
            />
          </div>
        </>
      )}
    </section>
  );
}

function BigStatusButton({ label, active, color, disabled = false, onClick }: {
  label: string;
  active: boolean;
  color: 'emerald' | 'rose' | 'slate';
  disabled?: boolean;
  onClick: () => void;
}) {
  const colors = {
    emerald: active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-200',
    rose: active ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-700 border-rose-200',
    slate: active ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? 'Indique un motivo antes de registrar una expulsión' : undefined}
      className={`min-h-12 text-[11px] sm:text-xs font-semibold att-font-body px-2 py-2.5 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed ${colors[color]}`}
    >
      {label}
    </button>
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

export default TeacherAttendanceTab;
