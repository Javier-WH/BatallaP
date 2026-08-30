import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button, message, Spin, Tabs, Tag, Empty, DatePicker, Input, Alert, Modal, List } from 'antd';
import { SaveOutlined, DeleteOutlined, ScheduleOutlined, HomeOutlined, PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import ClassroomDistribution from '@/pages/control-estudios/ClassroomDistribution';
import dayjs from 'dayjs';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────
interface Period {
  id: string;
  start: string;
  end: string;
  break?: boolean;
  label?: string;
}

interface Section {
  id: string;
  label: string;
  headerColor: string;
  periods: Period[];
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

// Map dayjs day() (0=Sun, 1=Mon..5=Fri, 6=Sat) to our day names
function dayjsToDayName(d: dayjs.Dayjs): string | null {
  const idx = d.day();
  if (idx >= 1 && idx <= 5) return DAYS[idx - 1];
  return null;
}

const STATUSES = [
  { key: 'available', label: 'Disponible', swatch: 'bg-emerald-400', ring: 'ring-emerald-500' },
  { key: 'busy', label: 'Ocupado', swatch: 'bg-rose-400', ring: 'ring-rose-500' },
  { key: 'preferred', label: 'Preferido', swatch: 'bg-sky-400', ring: 'ring-sky-500' },
];

/** Lightens a hex color by mixing with white. amount: 0=original, 1=white */
function lightenColor(hex: string, amount: number): string {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return hex;
  const r = Math.round(parseInt(clean.slice(0, 2), 16) + (255 - parseInt(clean.slice(0, 2), 16)) * amount);
  const g = Math.round(parseInt(clean.slice(2, 4), 16) + (255 - parseInt(clean.slice(2, 4), 16)) * amount);
  const b = Math.round(parseInt(clean.slice(4, 6), 16) + (255 - parseInt(clean.slice(4, 6), 16)) * amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Build sections dynamically from schedule settings
// ─────────────────────────────────────────────────────────────────────────
function formatTime(d: dayjs.Dayjs, use12h: boolean): string {
  if (use12h) {
    const h12 = d.hour() % 12 || 12;
    const m = d.minute().toString().padStart(2, '0');
    const ampm = d.hour() < 12 ? 'AM' : 'PM';
    return `${h12}:${m} ${ampm}`;
  }
  const h = d.hour();
  const m = d.minute();
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function buildSections(settings: Record<string, string>): Section[] {
  const use12h = settings.time_format === '12';

  const sections: Section[] = [];

  const buildPeriods = (
    prefix: string,
    startTime: string,
    blocksBefore: number,
    minBefore: number,
    recess: number,
    blocksAfter: number,
    minAfter: number,
  ): Period[] => {
    const periods: Period[] = [];
    let cursor = dayjs(startTime, 'HH:mm');
    let idx = 1;

    for (let i = 0; i < blocksBefore; i++) {
      const start = formatTime(cursor, use12h);
      cursor = cursor.add(minBefore, 'minute');
      const end = formatTime(cursor, use12h);
      periods.push({ id: `${prefix}${idx}`, start, end });
      idx++;
    }

    if (recess > 0) {
      const rStart = formatTime(cursor, use12h);
      cursor = cursor.add(recess, 'minute');
      const rEnd = formatTime(cursor, use12h);
      periods.push({ id: `${prefix}_break`, start: rStart, end: rEnd, break: true, label: 'Receso' });
    }

    for (let i = 0; i < blocksAfter; i++) {
      const start = formatTime(cursor, use12h);
      cursor = cursor.add(minAfter, 'minute');
      const end = formatTime(cursor, use12h);
      periods.push({ id: `${prefix}${idx}`, start, end });
      idx++;
    }

    return periods;
  };

  // Morning
  const mStart = settings.morning_start_time || '07:00';
  const mBlocksBefore = Number(settings.morning_blocks_before_recess) || 3;
  const mMinBefore = Number(settings.morning_block_minutes_before) || 45;
  const mRecess = Number(settings.morning_recess_minutes) || 0;
  const mBlocksAfter = Number(settings.morning_blocks_after_recess) || 0;
  const mMinAfter = Number(settings.morning_block_minutes_after) || 40;
  const mPeriods = buildPeriods('m', mStart, mBlocksBefore, mMinBefore, mRecess, mBlocksAfter, mMinAfter);
  if (mPeriods.length > 0) {
    sections.push({ id: 'manana', label: 'MAÑANA', headerColor: 'bg-teal-700', periods: mPeriods });
  }

  // Afternoon
  const aStart = settings.afternoon_start_time || '13:00';
  const aBlocksBefore = Number(settings.afternoon_blocks_before_recess) || 2;
  const aMinBefore = Number(settings.afternoon_block_minutes_before) || 45;
  const aRecess = Number(settings.afternoon_recess_minutes) || 0;
  const aBlocksAfter = Number(settings.afternoon_blocks_after_recess) || 0;
  const aMinAfter = Number(settings.afternoon_block_minutes_after) || 40;
  const aPeriods = buildPeriods('t', aStart, aBlocksBefore, aMinBefore, aRecess, aBlocksAfter, aMinAfter);
  if (aPeriods.length > 0) {
    sections.push({ id: 'tarde', label: 'TARDE', headerColor: 'bg-indigo-700', periods: aPeriods });
  }

  return sections;
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────
export default function TeacherAvailability() {
  const { user } = useAuth();
  const { activePeriod } = useSchool();
  const [cellStatus, setCellStatus] = useState<Record<string, string>>({});
  const [activeKey, setActiveKey] = useState<string | null>('available');
  const [showJson, setShowJson] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);

  // Schedule state
  const [activeTab, setActiveTab] = useState('availability');
  const [scheduleEntries, setScheduleEntries] = useState<any[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Classroom distribution state
  const [classroomSettings, setClassroomSettings] = useState<Record<string, string>>({});
  const [classroomSections, setClassroomSections] = useState<any[]>([]);
  const [classroomSubjects, setClassroomSubjects] = useState<any[]>([]);
  const [classroomLoading, setClassroomLoading] = useState(false);

  // Teacher room requests state
  const [requestTab, setRequestTab] = useState('new'); // 'new' | 'myRequests'
  const [requestDate, setRequestDate] = useState<dayjs.Dayjs | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [requestSubject, setRequestSubject] = useState('');
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [myRequestsLoading, setMyRequestsLoading] = useState(false);
  const [selectedRequestCells, setSelectedRequestCells] = useState<Set<string>>(new Set());
  const [requestSelectionMode, setRequestSelectionMode] = useState(false);
  const requestSelecting = useRef(false);

  const painting = useRef(false);
  const paintValue = useRef<string | null>(null);

  useEffect(() => {
    const stop = () => { painting.current = false; };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  // Load schedule settings + saved availability
  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, availRes] = await Promise.all([
          api.get('/settings'),
          api.get('/teacher-availability'),
        ]);
        setSections(buildSections(settingsRes.data));
        setCellStatus(availRes.data || {});
      } catch (error) {
        console.error('Error loading availability data:', error);
        // Still load with default sections
        try {
          const settingsRes = await api.get('/settings');
          setSections(buildSections(settingsRes.data));
        } catch {
          setSections(buildSections({}));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load teacher schedule
  const loadSchedule = useCallback(async () => {
    const personId = (user as any)?.personId;
    if (!personId || !activePeriod) return;
    setScheduleLoading(true);
    try {
      const res = await api.get(`/schedules/teacher/${personId}`, { params: { schoolPeriodId: activePeriod.id } });
      setScheduleEntries(res.data || []);
    } catch (e) {
      console.error('Error loading teacher schedule:', e);
      setScheduleEntries([]);
    } finally {
      setScheduleLoading(false);
    }
  }, [user, activePeriod]);

  useEffect(() => {
    if (activeTab === 'schedule') loadSchedule();
  }, [activeTab, loadSchedule]);

  // Load classroom distribution data
  const loadClassroomData = useCallback(async () => {
    if (!activePeriod?.id) return;
    setClassroomLoading(true);
    try {
      const [settingsRes, structRes] = await Promise.all([
        api.get('/settings'),
        api.get(`/academic/structure/${activePeriod.id}`),
      ]);
      setClassroomSettings(settingsRes.data || {});

      const flat: any[] = [];
      const subjMap = new Map<number, { id: number; name: string; subjectGroupId?: number | null; color?: string | null }>();
      (structRes.data || []).forEach((pg: any) => {
        (pg.sections || []).forEach((s: any) => {
          if ((s.name || '').toUpperCase() === 'MATERIA PENDIENTE') return;
          const pgsId = s.PeriodGradeSection?.id ?? s.id;
          flat.push({
            id: pgsId,
            sectionId: s.id,
            gradeId: pg.grade?.id,
            label: `${pg.grade?.name ?? ''} - ${s.name ?? ''}`,
            gradeName: pg.grade?.name,
            gradeOrder: pg.grade?.order ?? 99,
            sectionName: s.name,
            color: s.PeriodGradeSection?.color ?? null,
            periodGradeColor: pg.color ?? null,
          });
        });
        (pg.subjects || []).forEach((sub: any) => {
          if (!subjMap.has(sub.id)) subjMap.set(sub.id, { id: sub.id, name: sub.name, subjectGroupId: sub.subjectGroupId ?? null, color: sub.color ?? null });
        });
      });
      flat.sort((a, b) => {
        if (a.gradeOrder !== b.gradeOrder) return a.gradeOrder - b.gradeOrder;
        return (a.sectionName || '').localeCompare(b.sectionName || '', 'es');
      });
      setClassroomSections(flat);
      setClassroomSubjects(Array.from(subjMap.values()));
    } catch (e) {
      console.error('Error loading classroom data:', e);
    } finally {
      setClassroomLoading(false);
    }
  }, [activePeriod]);

  useEffect(() => {
    if (activeTab === 'classrooms') loadClassroomData();
  }, [activeTab, loadClassroomData]);

  // Load teacher's room requests
  const loadMyRequests = useCallback(async () => {
    if (!activePeriod?.id || !user?.personId) return;
    setMyRequestsLoading(true);
    try {
      const res = await api.get('/room-bookings', {
        params: { schoolPeriodId: activePeriod.id },
      });
      // Filter to only this teacher's requests
      const mine = (res.data || []).filter((b: any) => b.requestedBy === user.personId);
      setMyRequests(mine);
    } catch {
      setMyRequests([]);
    } finally {
      setMyRequestsLoading(false);
    }
  }, [activePeriod, user]);

  useEffect(() => {
    if (activeTab === 'requestRoom') {
      loadClassroomData();
      loadMyRequests();
    }
  }, [activeTab, loadClassroomData, loadMyRequests]);

  // Cell key helper for request selection
  const reqCellKey = (day: string, periodId: string, room: string) => `${day}|${periodId}|${room}`;

  const handleReqSelectDown = (day: string, periodId: string, room: string) => {
    requestSelecting.current = true;
    const k = reqCellKey(day, periodId, room);
    setSelectedRequestCells(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const handleReqSelectEnter = (day: string, periodId: string, room: string) => {
    if (!requestSelecting.current) return;
    const k = reqCellKey(day, periodId, room);
    setSelectedRequestCells(prev => {
      if (prev.has(k)) return prev;
      const next = new Set(prev);
      next.add(k);
      return next;
    });
  };

  useEffect(() => {
    const stop = () => { requestSelecting.current = false; };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  const selectedRequestGroups = useMemo(() => {
    const groups: Record<string, { day: string; room: string; periodIds: string[] }> = {};
    for (const k of selectedRequestCells) {
      const [day, periodId, room] = k.split('|');
      const gk = `${day}|${room}`;
      if (!groups[gk]) groups[gk] = { day, room, periodIds: [] };
      groups[gk].periodIds.push(periodId);
    }
    return Object.values(groups);
  }, [selectedRequestCells]);

  // Days of week present in the selection (e.g. ["Lunes"])
  const selectedDays = useMemo(() => {
    const days = new Set<string>();
    for (const k of selectedRequestCells) days.add(k.split('|')[0]);
    return Array.from(days);
  }, [selectedRequestCells]);

  // Map day names to dayjs day() numbers
  const dayNameToNumber = (name: string): number => {
    const idx = DAYS.indexOf(name);
    return idx >= 0 ? idx + 1 : -1; // 1=Mon..5=Fri
  };

  // Disable dates that don't match any selected day
  const disabledRequestDate = (d: dayjs.Dayjs): boolean => {
    if (selectedDays.length === 0) return false; // no selection = all enabled
    const dayNum = d.day();
    return !selectedDays.some(name => dayNameToNumber(name) === dayNum);
  };

  const handleSubmitRequest = async () => {
    if (!requestDate) { message.warning('Seleccione una fecha'); return; }
    if (!requestSubject.trim()) { message.warning('Ingrese la materia/actividad'); return; }
    if (selectedRequestGroups.length === 0) { message.warning('Seleccione al menos un bloque en la grid'); return; }
    try {
      for (const g of selectedRequestGroups) {
        await api.post('/room-bookings', {
          room: g.room,
          day: g.day,
          periodIds: g.periodIds,
          specificDate: requestDate.format('YYYY-MM-DD'),
          teacherName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.username || 'Profesor',
          subjectName: requestSubject.trim(),
          reason: requestReason.trim(),
          status: 'pending',
          requestedBy: user?.personId,
          schoolPeriodId: activePeriod?.id,
        });
      }
      message.success('Solicitud enviada. Pendiente de aprobación por Control de Estudios.');
      setRequestDate(null);
      setRequestSubject('');
      setRequestReason('');
      setSelectedRequestCells(new Set());
      loadMyRequests();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        message.error(err.response.data?.message || 'Conflicto: el aula ya tiene una reserva para esos bloques');
      } else {
        message.error('Error al enviar la solicitud');
      }
    }
  };

  // Build schedule entries map for the grid
  const scheduleEntriesMap = useMemo<Record<string, any[]>>(() => {
    // Build section index map: gradeId -> sorted sectionIds -> index
    const gradeSectionsMap = new Map<number, Map<number, string>>();
    scheduleEntries.forEach((e: any) => {
      const sec = e.schedule?.section;
      const gradeId = sec?.periodGrade?.grade?.id;
      const sectionId = sec?.section?.id;
      const sectionName = sec?.section?.name ?? '';
      if (gradeId != null && sectionId != null) {
        if (!gradeSectionsMap.has(gradeId)) gradeSectionsMap.set(gradeId, new Map());
        const sections = gradeSectionsMap.get(gradeId)!;
        if (!sections.has(sectionId)) sections.set(sectionId, sectionName);
      }
    });
    const sectionIndexMap = new Map<string, number>();
    gradeSectionsMap.forEach((sections, gradeId) => {
      const sorted = Array.from(sections.entries()).sort((a, b) => a[1].localeCompare(b[1]));
      sorted.forEach(([sectionId], idx) => {
        sectionIndexMap.set(`${gradeId}:${sectionId}`, idx);
      });
    });

    const map: Record<string, any[]> = {};
    scheduleEntries.forEach((e: any) => {
      const key = `${e.day}|${e.periodId}`;
      const sec = e.schedule?.section;
      const gradeName = sec?.periodGrade?.grade?.name ?? '';
      const sectionName = sec?.section?.name ?? '';
      const gradeId = sec?.periodGrade?.grade?.id;
      const sectionId = sec?.section?.id;
      const gradeColor = sec?.periodGrade?.color ?? '#cccccc';
      const sectionIdx = (gradeId != null && sectionId != null) ? (sectionIndexMap.get(`${gradeId}:${sectionId}`) ?? 0) : 0;
      const sectionColor = lightenColor(gradeColor, 0.25 + sectionIdx * 0.25);
      if (!map[key]) map[key] = [];
      map[key].push({
        subjectName: e.subject?.name,
        subjectId: e.subjectId,
        sectionLabel: `${gradeName} ${sectionName}`.trim(),
        sectionSignature: `${gradeId ?? ''}:${sectionId ?? ''}`,
        sectionColor,
        isGroup: e.isGroupSubject,
      });
    });
    return map;
  }, [scheduleEntries]);

  // Cell signature for merging consecutive cells with same subject+section
  const cellSig = (entries: any[] | undefined): string => {
    if (!entries || entries.length === 0) return '';
    return entries
      .map(e => `${e.subjectId}:${e.sectionSignature}:${e.isGroup ? 1 : 0}`)
      .sort()
      .join('|');
  };

  // Build rowspan map: key `${day}|${period.id}` -> span (0 if covered by a merge above)
  const rowspanMap = useMemo<Record<string, number>>(() => {
    const result: Record<string, number> = {};
    DAYS.forEach(day => {
      sections.forEach(sec => {
        const nonBreakPeriods = sec.periods.filter(p => !p.break);
        for (let i = 0; i < nonBreakPeriods.length; i++) {
          const p = nonBreakPeriods[i];
          const key = `${day}|${p.id}`;
          const sig = cellSig(scheduleEntriesMap[key]);
          if (!sig) { result[key] = 1; continue; }
          let span = 1;
          for (let j = i + 1; j < nonBreakPeriods.length; j++) {
            const nextKey = `${day}|${nonBreakPeriods[j].id}`;
            if (sig === cellSig(scheduleEntriesMap[nextKey])) {
              span++;
            } else {
              break;
            }
          }
          result[key] = span;
          // Mark covered cells
          for (let j = i + 1; j < i + span; j++) {
            result[`${day}|${nonBreakPeriods[j].id}`] = 0;
          }
          i += span - 1;
        }
      });
    });
    return result;
  }, [scheduleEntriesMap, sections]);

  const keyFor = (day: string, periodId: string) => `${day}|${periodId}`;

  const applyPaint = useCallback((day: string, periodId: string, value: string | null) => {
    setCellStatus(prev => {
      const next = { ...prev };
      const k = keyFor(day, periodId);
      if (value === null) delete next[k];
      else next[k] = value;
      return next;
    });
  }, []);

  const handleDown = (day: string, periodId: string) => {
    const current = cellStatus[keyFor(day, periodId)] ?? null;
    const value = current === activeKey ? null : activeKey;
    painting.current = true;
    paintValue.current = value;
    applyPaint(day, periodId, value);
  };

  const handleEnter = (day: string, periodId: string) => {
    if (!painting.current) return;
    applyPaint(day, periodId, paintValue.current);
  };

  const statusMeta = (key: string) => STATUSES.find(s => s.key === key);

  const clearAll = () => setCellStatus({});

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/teacher-availability', { availability: cellStatus });
      message.success('Disponibilidad guardada correctamente');
    } catch (error) {
      console.error('Error saving availability:', error);
      message.error('Error al guardar la disponibilidad');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 gap-4">
        <Spin size="large" />
        <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando...</span>
      </div>
    );
  }

  // ── Availability Tab Content ──
  const availabilityTab = (
    <div className="w-full bg-slate-100 p-4 sm:p-6 flex justify-center">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
        <div className="mb-4">
          <h1 className="text-lg font-bold text-slate-800">Disponibilidad Semanal</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Clic para marcar una celda · arrastra para marcar varias a la vez.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {STATUSES.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveKey(s.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all ${
                activeKey === s.key
                  ? `border-slate-800 ring-2 ring-offset-1 ${s.ring} bg-slate-50`
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className={`w-3 h-3 rounded-sm ${s.swatch}`} />
              {s.label}
            </button>
          ))}
          <button
            onClick={() => setActiveKey(null)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all ${
              activeKey === null
                ? 'border-slate-800 ring-2 ring-offset-1 ring-slate-400 bg-slate-50'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <span className="w-3 h-3 rounded-sm border border-slate-400 bg-white" />
            Borrar
          </button>

          <span className="flex-1" />

          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-transparent"
          >
            <DeleteOutlined /> Limpiar todo
          </button>
          <button
            onClick={() => setShowJson(v => !v)}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-slate-200"
          >
            {showJson ? 'Ocultar datos' : 'Ver datos'}
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth: '640px', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th className="border border-slate-300 bg-slate-800 text-white py-2 text-xs" style={{ width: `${100 / (DAYS.length + 1)}%` }}>
                  Hora
                </th>
                {DAYS.map(d => (
                  <th
                    key={d}
                    className="border border-slate-300 bg-slate-800 text-white py-2 text-xs uppercase tracking-wide"
                    style={{ width: `${100 / (DAYS.length + 1)}%` }}
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map(section => (
                <React.Fragment key={section.id}>
                  <tr>
                    <td
                      colSpan={DAYS.length + 1}
                      className={`${section.headerColor} text-white text-center font-bold tracking-widest py-1.5 text-xs`}
                    >
                      {section.label}
                    </td>
                  </tr>
                  {section.periods.map(period =>
                    period.break ? (
                      <tr key={period.id}>
                        <td
                          colSpan={DAYS.length + 1}
                          className="bg-amber-50 border-t border-b border-amber-300 text-amber-700 text-center text-[10px] py-0.5 font-medium"
                        >
                          ⏸ {period.label} · {period.start}–{period.end}
                        </td>
                      </tr>
                    ) : (
                      <tr key={period.id}>
                        <td className="border border-slate-300 bg-slate-50 text-slate-600 text-xs text-center py-2 font-medium whitespace-nowrap">
                          {period.start} - {period.end}
                        </td>
                        {DAYS.map(day => {
                          const status = statusMeta(cellStatus[keyFor(day, period.id)]);
                          return (
                            <td
                              key={day}
                              onMouseDown={() => handleDown(day, period.id)}
                              onMouseEnter={() => handleEnter(day, period.id)}
                              className={`border border-slate-300 h-9 cursor-pointer select-none transition-colors ${
                                status ? status.swatch : 'bg-white hover:bg-slate-100'
                              }`}
                            />
                          );
                        })}
                      </tr>
                    )
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Save button */}
        <div className="mt-6 flex justify-end">
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            className="!rounded-xl !font-bold"
          >
            Guardar disponibilidad
          </Button>
        </div>

        {showJson && (
          <pre className="mt-4 p-3 bg-slate-900 text-slate-100 text-[11px] rounded-md overflow-x-auto">
            {JSON.stringify(cellStatus, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );

  // ── Schedule Tab Content ──
  const scheduleTab = (
    <div className="w-full bg-slate-100 p-4 sm:p-6 flex justify-center">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Mi Horario</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {activePeriod ? `Período: ${activePeriod.name}` : 'Sin período activo'}
            </p>
          </div>
          <Button icon={<ScheduleOutlined />} onClick={loadSchedule} loading={scheduleLoading}>Recargar</Button>
        </div>

        {scheduleLoading ? (
          <div className="flex justify-center p-12"><Spin size="large" /></div>
        ) : scheduleEntries.length === 0 ? (
          <Empty description="No hay horario asignado para este período" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: '640px', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="border border-slate-300 bg-slate-800 text-white py-2 text-xs" style={{ width: `${100 / (DAYS.length + 1)}%` }}>
                    Hora
                  </th>
                  {DAYS.map(d => (
                    <th
                      key={d}
                      className="border border-slate-300 bg-slate-800 text-white py-2 text-xs uppercase tracking-wide"
                      style={{ width: `${100 / (DAYS.length + 1)}%` }}
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sections.map(section => (
                  <React.Fragment key={section.id}>
                    <tr>
                      <td
                        colSpan={DAYS.length + 1}
                        className={`${section.headerColor} text-white text-center font-bold tracking-widest py-1.5 text-xs`}
                      >
                        {section.label}
                      </td>
                    </tr>
                    {section.periods.map(period =>
                      period.break ? (
                        <tr key={period.id}>
                          <td
                            colSpan={DAYS.length + 1}
                            className="bg-amber-50 border-t border-b border-amber-300 text-amber-700 text-center text-[10px] py-0.5 font-medium"
                          >
                            ⏸ {period.label} · {period.start}–{period.end}
                          </td>
                        </tr>
                      ) : (
                        <tr key={period.id}>
                          <td className="border border-slate-300 bg-slate-50 text-slate-600 text-xs text-center py-2 font-medium whitespace-nowrap">
                            {period.start} - {period.end}
                          </td>
                          {DAYS.map(day => {
                            const key = `${day}|${period.id}`;
                            const cellEntries = scheduleEntriesMap[key] ?? [];
                            const span = rowspanMap[key] ?? 1;
                            if (span === 0) return null; // covered by a merge above
                            if (cellEntries.length === 0) {
                              return (
                                <td key={day} rowSpan={span} className="border border-slate-300 bg-white">
                                  <span className="text-slate-300 text-center block">—</span>
                                </td>
                              );
                            }
                            // Compute end time for merged cells
                            let endTime = period.end;
                            if (span > 1) {
                              const sec = sections.find(s => s.id === period.section);
                              if (sec) {
                                const nonBreak = sec.periods.filter(p => !p.break);
                                const idx = nonBreak.findIndex(p => p.id === period.id);
                                if (idx >= 0 && idx + span - 1 < nonBreak.length) {
                                  endTime = nonBreak[idx + span - 1].end;
                                }
                              }
                            }
                            const sectionColor = cellEntries.length > 0 ? (cellEntries[0].sectionColor ?? '#cccccc') : '#cccccc';
                            return (
                              <td key={day} rowSpan={span} className="border border-slate-300 p-1 align-top" style={{
                                background: cellEntries.length > 0 ? sectionColor + '33' : '#ffffff',
                                borderLeft: cellEntries.length > 0 ? `3px solid ${sectionColor}` : '1px solid #cbd5e1',
                              }}>
                                {cellEntries.map((e: any, i: number) => (
                                  <div key={i} className="flex flex-col gap-0.5">
                                    <span className="font-bold text-slate-800 leading-tight" style={{ fontSize: 11 }}>
                                      {e.subjectName ?? '—'}
                                    </span>
                                    {e.sectionLabel && (
                                      <span className="text-slate-600 leading-tight font-semibold" style={{ fontSize: 9 }}>
                                        {e.sectionLabel}
                                      </span>
                                    )}
                                    {span > 1 && (
                                      <span className="text-slate-400 leading-tight" style={{ fontSize: 8 }}>
                                        hasta {endTime}
                                      </span>
                                    )}
                                    {e.isGroup && <Tag color="purple" style={{ fontSize: 8, margin: 0, alignSelf: 'flex-start' }}>Grupo</Tag>}
                                  </div>
                                ))}
                              </td>
                            );
                          })}
                        </tr>
                      )
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'availability',
            label: <span><ScheduleOutlined /> Disponibilidad</span>,
            children: availabilityTab,
          },
          {
            key: 'schedule',
            label: <span><ScheduleOutlined /> Mi Horario</span>,
            children: scheduleTab,
          },
          {
            key: 'classrooms',
            label: <span><HomeOutlined /> Distribución de Aulas</span>,
            children: classroomLoading ? (
              <div className="flex justify-center p-12"><Spin size="large" /></div>
            ) : classroomSections.length > 0 ? (
              <ClassroomDistribution
                settings={classroomSettings}
                sectionsList={classroomSections}
                subjectsList={classroomSubjects}
                schoolPeriodId={activePeriod?.id}
                gradesList={classroomSections.filter((s: any, i: number, arr: any[]) => arr.findIndex(x => x.gradeId === s.gradeId) === i).map((s: any) => ({ id: s.gradeId, name: s.gradeName }))}
                readOnly
              />
            ) : (
              <Empty description="No hay datos de estructura académica para este período" />
            ),
          },
          {
            key: 'requestRoom',
            label: <span><PlusOutlined /> Solicitar Aula</span>,
            children: classroomLoading ? (
              <div className="flex justify-center p-12"><Spin size="large" /></div>
            ) : classroomSections.length > 0 ? (
              <div className="space-y-4">
                <Alert
                  type="info"
                  showIcon
                  message="Solicitar un aula para una fecha específica"
                  description="1. Marque los bloques en la grid. 2. Seleccione la fecha. 3. Complete los datos y envíe."
                />
                <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-md">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha *</label>
                    <DatePicker
                      value={requestDate}
                      onChange={setRequestDate}
                      format="DD/MM/YYYY"
                      placeholder={selectedDays.length === 0 ? 'Primero marque bloques' : `Solo ${selectedDays.join(', ')}`}
                      disabledDate={disabledRequestDate}
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Materia / Actividad *</label>
                    <Input value={requestSubject} onChange={e => setRequestSubject(e.target.value)} placeholder="Ej: Ciencias de la Tierra" style={{ width: '100%' }} />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo (opcional)</label>
                    <Input value={requestReason} onChange={e => setRequestReason(e.target.value)} placeholder="Ej: Práctica de laboratorio" style={{ width: '100%' }} />
                  </div>
                  <div className="flex items-end gap-2">
                    {selectedRequestCells.size > 0 && (
                      <Button onClick={() => setSelectedRequestCells(new Set())}>Cancelar selección</Button>
                    )}
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleSubmitRequest} disabled={selectedRequestCells.size === 0}>
                      Enviar solicitud ({selectedRequestCells.size})
                    </Button>
                  </div>
                </div>
                <ClassroomDistribution
                  settings={classroomSettings}
                  sectionsList={classroomSections}
                  subjectsList={classroomSubjects}
                  schoolPeriodId={activePeriod?.id}
                  gradesList={classroomSections.filter((s: any, i: number, arr: any[]) => arr.findIndex(x => x.gradeId === s.gradeId) === i).map((s: any) => ({ id: s.gradeId, name: s.gradeName }))}
                  readOnly
                  externalSelectionMode
                  externalSelectedCells={selectedRequestCells}
                  onExternalSelectDown={handleReqSelectDown}
                  onExternalSelectEnter={handleReqSelectEnter}
                />

                {/* My requests list */}
                <div className="mt-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-2">Mis solicitudes</h3>
                  {myRequestsLoading ? (
                    <div className="flex justify-center p-4"><Spin /></div>
                  ) : myRequests.length === 0 ? (
                    <Empty description="No has enviado solicitudes" />
                  ) : (
                    <List
                      size="small"
                      bordered
                      dataSource={myRequests}
                      renderItem={(b: any) => (
                        <List.Item>
                          <div className="flex items-center justify-between w-full">
                            <div>
                              <strong>{b.subjectName}</strong> — {b.room} · {b.day} · {b.specificDate}
                              <div className="text-xs text-slate-500">{b.teacherName}{b.reason ? ` · ${b.reason}` : ''}</div>
                            </div>
                            <Tag color={b.status === 'approved' ? 'green' : b.status === 'rejected' ? 'red' : 'orange'}>
                              {b.status === 'approved' ? 'Aprobada' : b.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                            </Tag>
                          </div>
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              </div>
            ) : (
              <Empty description="No hay datos de estructura académica para este período" />
            ),
          },
        ]}
      />
    </div>
  );
}
