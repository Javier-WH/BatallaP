import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button, Empty, Spin, Tag, Tooltip, Modal, Select, message, Alert, DatePicker, Input, List } from 'antd';
import { DeleteOutlined, ClearOutlined, ThunderboltOutlined, HighlightOutlined, PlusOutlined, InboxOutlined, FileExcelOutlined } from '@ant-design/icons';
import api from '@/services/api';
import dayjs from 'dayjs';
import { generateClassroomDistribution } from '@/utils/generateHorario';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

// Map dayjs day() (0=Sun, 1=Mon..5=Fri, 6=Sat) to our day names
function dayjsToDayName(d: dayjs.Dayjs): string | null {
  const idx = d.day(); // 0-6
  if (idx >= 1 && idx <= 5) return DAYS[idx - 1];
  return null; // weekend
}

interface Period { id: string; start: string; end: string; break?: boolean; label?: string; section: string; }
interface ScheduleSection { id: string; label: string; periods: Period[]; }

function formatTime(d: dayjs.Dayjs, use12h: boolean): string {
  if (use12h) {
    const h = d.hour();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${d.minute().toString().padStart(2, '0')} ${ampm}`;
  }
  return d.format('HH:mm');
}

function buildSections(settings: Record<string, string>): ScheduleSection[] {
  const use12h = settings.time_format === '12';
  const sections: ScheduleSection[] = [];

  const buildPeriods = (prefix: string, sectionId: string, _sectionLabel: string, startTime: string, blocksBefore: number, minBefore: number, recess: number, blocksAfter: number, minAfter: number): Period[] => {
    const periods: Period[] = [];
    let cursor = dayjs(startTime, 'HH:mm');
    let idx = 1;
    for (let i = 0; i < blocksBefore; i++) {
      const start = formatTime(cursor, use12h);
      cursor = cursor.add(minBefore, 'minute');
      const end = formatTime(cursor, use12h);
      periods.push({ id: `${prefix}${idx}`, start, end, section: sectionId });
      idx++;
    }
    if (recess > 0) {
      const rStart = formatTime(cursor, use12h);
      cursor = cursor.add(recess, 'minute');
      const rEnd = formatTime(cursor, use12h);
      periods.push({ id: `${prefix}_break`, start: rStart, end: rEnd, break: true, label: 'Receso', section: sectionId });
    }
    for (let i = 0; i < blocksAfter; i++) {
      const start = formatTime(cursor, use12h);
      cursor = cursor.add(minAfter, 'minute');
      const end = formatTime(cursor, use12h);
      periods.push({ id: `${prefix}${idx}`, start, end, section: sectionId });
      idx++;
    }
    return periods;
  };

  const mStart = settings.morning_start_time || '07:00';
  const mPeriods = buildPeriods('m', 'manana', 'MAÑANA', mStart, Number(settings.morning_blocks_before_recess) || 3, Number(settings.morning_block_minutes_before) || 45, Number(settings.morning_recess_minutes) || 0, Number(settings.morning_blocks_after_recess) || 0, Number(settings.morning_block_minutes_after) || 40);
  if (mPeriods.length > 0) sections.push({ id: 'manana', label: 'MAÑANA', periods: mPeriods });

  const aStart = settings.afternoon_start_time || '13:00';
  const aPeriods = buildPeriods('t', 'tarde', 'TARDE', aStart, Number(settings.afternoon_blocks_before_recess) || 2, Number(settings.afternoon_block_minutes_before) || 45, Number(settings.afternoon_recess_minutes) || 0, Number(settings.afternoon_blocks_after_recess) || 0, Number(settings.afternoon_block_minutes_after) || 40);
  if (aPeriods.length > 0) sections.push({ id: 'tarde', label: 'TARDE', periods: aPeriods });

  return sections;
}

// Color palette for grade-section swatches
const SECTION_COLORS = [
  { bg: '#e6f7ff', border: '#1890ff', text: '#003a8c' },
  { bg: '#f6ffed', border: '#52c41a', text: '#237804' },
  { bg: '#fff7e6', border: '#fa8c16', text: '#ad6800' },
  { bg: '#fff1f0', border: '#f5222d', text: '#a8071a' },
  { bg: '#f9f0ff', border: '#722ed1', text: '#391085' },
  { bg: '#e6fffb', border: '#13c2c2', text: '#00474f' },
  { bg: '#fcffe6', border: '#a0d911', text: '#3f6600' },
  { bg: '#fffbe6', border: '#fadb14', text: '#614700' },
  { bg: '#fff0f6', border: '#eb2f96', text: '#9e1068' },
  { bg: '#f0f5ff', border: '#2f54eb', text: '#10239e' },
  { bg: '#e8f5e9', border: '#4caf50', text: '#1b5e20' },
  { bg: '#fce4ec', border: '#e91e63', text: '#880e4f' },
];

function colorForClass(key: string): typeof SECTION_COLORS[0] {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return SECTION_COLORS[Math.abs(hash) % SECTION_COLORS.length];
}

// Distinct colors per grade (used when section has no custom color)
const GRADE_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
];

function colorForGrade(gradeId: number): string {
  return GRADE_PALETTE[gradeId % GRADE_PALETTE.length];
}

// Parse a cell value: "gradeId-sectionId" (section) or "group:subjectId:gradeId" (group)
function parseCellValue(value: string): { type: 'section'; sectionKey: string } | { type: 'group'; subjectId: number; gradeId: number } | null {
  if (!value) return null;
  if (value.startsWith('group:')) {
    const parts = value.split(':');
    const subjectId = Number(parts[1]);
    const gradeId = Number(parts[2]);
    if (subjectId && gradeId) return { type: 'group', subjectId, gradeId };
    return null;
  }
  return { type: 'section', sectionKey: value };
}

// Mix a hex color with white (factor > 0 = lighter) or black (factor < 0 = darker)
function mixColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (factor >= 0) {
    const mix = factor;
    const nr = Math.round(r + (255 - r) * mix);
    const ng = Math.round(g + (255 - g) * mix);
    const nb = Math.round(b + (255 - b) * mix);
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
  } else {
    const mix = -factor;
    const nr = Math.round(r * (1 - mix));
    const ng = Math.round(g * (1 - mix));
    const nb = Math.round(b * (1 - mix));
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
  }
}
function lightenColor(hex: string, factor: number): string { return mixColor(hex, factor); }
function darkenColor(hex: string, factor: number): string { return mixColor(hex, -factor); }

interface ClassItem {
  key: string; // e.g. "1A"
  label: string; // e.g. "1° A"
  color?: string | null;
  periodGradeColor?: string | null;
}

interface ClassroomDistributionProps {
  settings: Record<string, string>;
  sectionsList: { id: number; label: string; gradeName: string; sectionName: string; gradeId: number; sectionId: number; color?: string | null; periodGradeColor?: string | null }[];
  subjectsList: { id: number; name: string; subjectGroupId?: number | null; color?: string | null }[];
  schoolPeriodId?: number;
  schoolPeriodName?: string;
  gradesList: { id: number; name: string }[];
  readOnly?: boolean;
  // External selection (for teacher requests)
  externalSelectedCells?: Set<string>;
  onExternalSelectDown?: (day: string, periodId: string, room: string) => void;
  onExternalSelectEnter?: (day: string, periodId: string, room: string) => void;
  externalSelectionMode?: boolean;
  // When set, only allow external selection on this day (e.g. "Miércoles")
  allowedSelectionDay?: string | null;
}

const ClassroomDistribution: React.FC<ClassroomDistributionProps> = ({
  settings, sectionsList, subjectsList, schoolPeriodId, schoolPeriodName, gradesList, readOnly = false,
  externalSelectedCells, onExternalSelectDown, onExternalSelectEnter, externalSelectionMode = false,
  allowedSelectionDay = null,
}) => {
  const scheduleSections = useMemo(() => buildSections(settings), [settings]);

  // Build class items from sectionsList
  const classes: ClassItem[] = useMemo(() => {
    return sectionsList.map(s => ({
      key: `${s.gradeId}-${s.sectionId}`,
      label: s.label,
      color: s.color,
      periodGradeColor: s.periodGradeColor,
    }));
  }, [sectionsList]);

  // Build room list from settings + Cancha
  const roomCount = Number(settings.available_classrooms) || 0;
  const rooms = useMemo(() => {
    const list = Array.from({ length: roomCount }, (_, i) => `Aula ${i + 1}`);
    list.push('Cancha');
    return list;
  }, [roomCount]);

  // assignments: "Lunes|m1|Aula 3" -> classKey
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  // activeKey: undefined = no tool, null = erase, string = paint section
  const [activeKey, setActiveKey] = useState<string | null | undefined>(undefined);

  // Block selection state (for extraordinary assignments)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const selecting = useRef(false);

  // Auto-distribution modal state
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [roomAssignments, setRoomAssignments] = useState<any[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [newAssignRoom, setNewAssignRoom] = useState<string | null>(null);
  const [newAssignType, setNewAssignType] = useState<'section' | 'subject' | 'group'>('section');
  const [newAssignSection, setNewAssignSection] = useState<string | null>(null);
  const [newAssignSubject, setNewAssignSubject] = useState<number | null>(null);
  const [newAssignGrade, setNewAssignGrade] = useState<number | null>(null);

  // Extraordinary booking modal state
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState<dayjs.Dayjs | null>(null);
  const [bookingTeacher, setBookingTeacher] = useState<string>('');
  const [bookingSubject, setBookingSubject] = useState<string>('');
  const [bookingReason, setBookingReason] = useState<string>('');
  const [bookings, setBookings] = useState<any[]>([]);
  const [, setBookingsLoading] = useState(false);
  // Map: "day|periodId" -> array of sectionKeys that the teacher is normally in (to clear when they have a booking)
  const [teacherSlots, setTeacherSlots] = useState<Record<string, string[]>>({});

  // Selected date for viewing extraordinary bookings
  const [viewDate, setViewDate] = useState<dayjs.Dayjs | null>(null);

  // Day filters (which days to show in the grid) — empty = show all
  const [activeDay, setActiveDay] = useState<string | null>(null);

  // Pending requests modal (Control de Estudios)
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const loadPendingRequests = useCallback(async () => {
    if (!schoolPeriodId) return;
    setRequestsLoading(true);
    try {
      const res = await api.get('/room-bookings', { params: { schoolPeriodId, status: 'pending' } });
      setPendingRequests(res.data || []);
    } catch {
      setPendingRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, [schoolPeriodId]);

  const handleApproveRequest = async (id: number) => {
    try {
      await api.put(`/room-bookings/${id}`, { status: 'approved' });
      message.success('Solicitud aprobada. Solicitudes en conflicto rechazadas automáticamente.');
      loadPendingRequests();
      if (viewDate) loadBookingsForDate(viewDate);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        message.error(err.response.data?.message || 'Conflicto al aprobar: el aula ya está reservada');
      } else {
        message.error('Error al aprobar');
      }
    }
  };

  const handleRejectRequest = async (id: number) => {
    try {
      await api.put(`/room-bookings/${id}`, { status: 'rejected' });
      message.success('Solicitud rechazada');
      loadPendingRequests();
    } catch {
      message.error('Error al rechazar');
    }
  };

  // Load bookings for a specific date
  const loadBookingsForDate = useCallback(async (date: dayjs.Dayjs) => {
    if (!schoolPeriodId) return;
    setBookingsLoading(true);
    try {
      const res = await api.get('/room-bookings', {
        params: { schoolPeriodId, date: date.format('YYYY-MM-DD'), status: 'approved' },
      });
      const approvedBookings = res.data || [];
      setBookings(approvedBookings);

      // For each booking, load the teacher's regular schedule to know which cells to clear
      // Group bookings by requestedBy (teacher personId)
      const teacherIds = [...new Set(approvedBookings.map((b: any) => b.requestedBy).filter(Boolean))];
      if (teacherIds.length > 0) {
        const teacherSlotsMap: Record<string, string[]> = {};
        for (const tid of teacherIds) {
          try {
            const schedRes = await api.get(`/schedules/teacher/${tid}`, { params: { schoolPeriodId } });
            const entries = schedRes.data || [];
            for (const e of entries) {
              const key = `${e.day}|${e.periodId}`;
              if (!teacherSlotsMap[key]) teacherSlotsMap[key] = [];
              // Track which rooms this teacher is normally in
              const sec = e.schedule?.section;
              if (sec) {
                // We need the room assignment for this section — look it up in assignments
                const gradeId = sec.periodGrade?.grade?.id;
                const sectionId = sec.section?.id;
                if (gradeId != null && sectionId != null) {
                  const sectionKey = `${gradeId}-${sectionId}`;
                  teacherSlotsMap[key].push(sectionKey);
                }
              }
            }
          } catch { /* ignore */ }
        }
        setTeacherSlots(teacherSlotsMap);
      } else {
        setTeacherSlots({});
      }
    } catch {
      setBookings([]);
      setTeacherSlots({});
    } finally {
      setBookingsLoading(false);
    }
  }, [schoolPeriodId]);

  useEffect(() => {
    if (viewDate) loadBookingsForDate(viewDate);
    else setBookings([]);
  }, [viewDate, loadBookingsForDate]);

  // Parse bookings into a map: cellKey -> booking
  const bookingMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const b of bookings) {
      const periodIds: string[] = JSON.parse(b.periodIds || '[]');
      for (const pid of periodIds) {
        map[`${b.day}|${pid}|${b.room}`] = b;
      }
    }
    return map;
  }, [bookings]);

  // Build a set of cellKeys that should be shown as "empty" because the teacher
  // has an extraordinary booking at that time slot in a different room.
  // Logic: for each booking, the teacher's regular slots at that day+period
  // should be cleared (the teacher can't be in 2 places at once).
  const clearedCells = useMemo(() => {
    const cleared = new Set<string>();
    for (const b of bookings) {
      const periodIds: string[] = JSON.parse(b.periodIds || '[]');
      for (const pid of periodIds) {
        const slotKey = `${b.day}|${pid}`;
        const sectionKeys = teacherSlots[slotKey];
        if (!sectionKeys) continue;
        // For each section the teacher is normally in at this slot,
        // find which room that section is assigned to, and mark it as cleared
        for (const sk of sectionKeys) {
          // Search all rooms for this sectionKey at this day+period
          for (const room of rooms) {
            const ck = `${b.day}|${pid}|${room}`;
            const val = assignments[ck];
            if (val === sk) {
              cleared.add(ck);
            }
          }
        }
      }
    }
    return cleared;
  }, [bookings, teacherSlots, assignments, rooms]);

  // Group selected cells by day+room to determine which periods are selected
  const selectedGroups = useMemo(() => {
    const groups: Record<string, { day: string; room: string; periodIds: string[] }> = {};
    for (const k of selectedCells) {
      const [day, periodId, room] = k.split('|');
      const gk = `${day}|${room}`;
      if (!groups[gk]) groups[gk] = { day, room, periodIds: [] };
      groups[gk].periodIds.push(periodId);
    }
    return Object.values(groups);
  }, [selectedCells]);

  const handleSaveBooking = async () => {
    if (!bookingDate) { message.warning('Seleccione una fecha'); return; }
    if (!bookingTeacher.trim()) { message.warning('Ingrese el nombre del profesor'); return; }
    if (!bookingSubject.trim()) { message.warning('Ingrese la materia/actividad'); return; }
    if (selectedGroups.length === 0) { message.warning('Seleccione al menos un bloque'); return; }
    // Validate that the selected blocks' day matches the date's day of week
    const expectedDay = dayjsToDayName(bookingDate);
    if (!expectedDay) { message.warning('La fecha seleccionada es fin de semana. Elija un día de lunes a viernes.'); return; }
    const mismatchedDays = selectedGroups.filter(g => g.day !== expectedDay);
    if (mismatchedDays.length > 0) {
      message.warning(`Los bloques seleccionados son de ${mismatchedDays[0].day} pero la fecha corresponde a ${expectedDay}. Seleccione bloques de ${expectedDay} o cambie la fecha.`);
      return;
    }
    try {
      for (const g of selectedGroups) {
        await api.post('/room-bookings', {
          room: g.room,
          day: g.day,
          periodIds: g.periodIds,
          specificDate: bookingDate.format('YYYY-MM-DD'),
          teacherName: bookingTeacher.trim(),
          subjectName: bookingSubject.trim(),
          reason: bookingReason.trim(),
          status: 'approved',
          schoolPeriodId,
        });
      }
      message.success('Asignación extraordinaria guardada');
      setBookingModalOpen(false);
      setBookingTeacher('');
      setBookingSubject('');
      setBookingReason('');
      setBookingDate(null);
      clearSelection();
      setViewDate(bookingDate);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        message.error(err.response.data?.message || 'Conflicto: el aula ya tiene una reserva para esos bloques');
      } else {
        message.error('Error al guardar la asignación');
      }
    }
  };

  const painting = useRef(false);
  const paintValue = useRef<string | null>(null);

  useEffect(() => {
    const stop = () => { painting.current = false; };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  const cellKey = (day: string, periodId: string, room: string) => `${day}|${periodId}|${room}`;

  const applyPaint = useCallback((day: string, periodId: string, room: string, value: string | null) => {
    setAssignments(prev => {
      const k = cellKey(day, periodId, room);
      if (value === prev[k]) return prev;
      const next = { ...prev };
      if (value === null) delete next[k];
      else next[k] = value;
      return next;
    });
  }, []);

  const handleDown = (day: string, periodId: string, room: string) => {
    if (activeKey === undefined) return; // no tool selected
    const current = assignments[cellKey(day, periodId, room)] ?? null;
    const value = current === activeKey ? null : activeKey;
    painting.current = true;
    paintValue.current = value;
    applyPaint(day, periodId, room, value);
  };

  const handleEnter = (day: string, periodId: string, room: string) => {
    if (!painting.current) return;
    applyPaint(day, periodId, room, paintValue.current);
  };

  // ── Block selection (for extraordinary assignments) ──
  const clearSelection = () => setSelectedCells(new Set());

  useEffect(() => {
    const stop = () => { selecting.current = false; };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  const clearAll = () => setAssignments({});

  // Load saved grid state on mount
  useEffect(() => {
    if (!schoolPeriodId) return;
    api.get(`/classroom-assignments/grid/${schoolPeriodId}`)
      .then(res => { if (res.data && Object.keys(res.data).length > 0) setAssignments(res.data); })
      .catch(() => {});
  }, [schoolPeriodId]);

  // Save grid state whenever assignments change (debounced, skipped in readOnly mode)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!schoolPeriodId || readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.put(`/classroom-assignments/grid/${schoolPeriodId}`, assignments).catch(() => {});
    }, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [assignments, schoolPeriodId, readOnly]);

  // ── Auto-distribution modal ──
  const loadRoomAssignments = useCallback(async () => {
    setAutoLoading(true);
    try {
      const res = await api.get('/classroom-assignments');
      setRoomAssignments(res.data || []);
    } catch {
      message.error('Error al cargar asignaciones de aulas');
    } finally {
      setAutoLoading(false);
    }
  }, []);

  const handleOpenAutoModal = () => {
    setNewAssignRoom(null);
    setNewAssignType('section');
    setNewAssignSection(null);
    setNewAssignSubject(null);
    setNewAssignGrade(null);
    loadRoomAssignments();
    setAutoModalOpen(true);
  };

  const handleAddAssignment = async () => {
    if (!newAssignRoom) { message.warning('Seleccione un aula'); return; }
    if (newAssignType === 'section' && !newAssignSection) { message.warning('Seleccione una sección'); return; }
    if (newAssignType === 'subject' && !newAssignSubject) { message.warning('Seleccione una materia'); return; }
    if (newAssignType === 'group' && (!newAssignSubject || !newAssignGrade)) { message.warning('Seleccione una materia y un grado'); return; }
    try {
      await api.post('/classroom-assignments', {
        room: newAssignRoom,
        targetType: newAssignType,
        sectionKey: newAssignType === 'section' ? newAssignSection : null,
        subjectId: (newAssignType === 'subject' || newAssignType === 'group') ? newAssignSubject : null,
        gradeId: newAssignType === 'group' ? newAssignGrade : null,
      });
      message.success('Asignación guardada');
      setNewAssignRoom(null);
      setNewAssignSection(null);
      setNewAssignSubject(null);
      setNewAssignGrade(null);
      loadRoomAssignments();
    } catch {
      message.error('Error al guardar asignación');
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    try {
      await api.delete(`/classroom-assignments/${id}`);
      loadRoomAssignments();
    } catch {
      message.error('Error al eliminar asignación');
    }
  };

  // Apply room assignments to the grid
  // For each section, load its existing schedule and place the section in its assigned room
  // only at the blocks where it actually has classes.
  // Subject assignments override the home room for that subject's blocks.
  // Group assignments overwrite with group:subjectId:gradeId.
  const handleApplyAuto = async () => {
    const next: Record<string, string> = {};

    const sectionAssigns = roomAssignments.filter((a: any) => a.targetType === 'section');
    const subjectAssigns = roomAssignments.filter((a: any) => a.targetType === 'subject');
    const groupAssigns = roomAssignments.filter((a: any) => a.targetType === 'group');

    // Build lookup maps
    const sectionRoomMap = new Map<string, string>(); // sectionKey -> room
    for (const a of sectionAssigns) {
      if (a.sectionKey) sectionRoomMap.set(a.sectionKey, a.room);
    }
    const subjectRoomMap = new Map<number, string>(); // subjectId -> room (non-group)
    for (const a of subjectAssigns) {
      if (a.subjectId) subjectRoomMap.set(a.subjectId, a.room);
    }
    const groupRoomMap = new Map<string, string>(); // "subjectId:gradeId" -> room
    for (const a of groupAssigns) {
      if (a.subjectId && a.gradeId != null) groupRoomMap.set(`${a.subjectId}:${a.gradeId}`, a.room);
    }

    try {
      for (const s of sectionsList) {
        const sectionKey = `${s.gradeId}-${s.sectionId}`;
        const homeRoom = sectionRoomMap.get(sectionKey);

        // Load existing schedule (without creating new ones)
        const res = await api.get('/schedules', { params: { schoolPeriodId, sectionId: s.id } });
        const schedules = res.data || [];
        if (schedules.length === 0) continue;
        const entries = schedules[0].entries || [];

        for (const entry of entries) {
          // Group subject: check group assignment
          if (entry.isGroupSubject) {
            const groupKey = `${entry.subjectId}:${s.gradeId}`;
            const groupRoom = groupRoomMap.get(groupKey);
            if (groupRoom) {
              next[cellKey(entry.day, entry.periodId, groupRoom)] = `group:${entry.subjectId}:${s.gradeId}`;
            }
            // Also keep the section in its home room during group blocks
            else if (homeRoom) {
              next[cellKey(entry.day, entry.periodId, homeRoom)] = sectionKey;
            }
          }
          // Non-group subject: check subject assignment first, then home room
          else {
            const subjectRoom = subjectRoomMap.get(entry.subjectId);
            if (subjectRoom) {
              next[cellKey(entry.day, entry.periodId, subjectRoom)] = sectionKey;
            } else if (homeRoom) {
              next[cellKey(entry.day, entry.periodId, homeRoom)] = sectionKey;
            }
          }
        }
      }
    } catch (e) {
      console.error('Error loading schedules for distribution:', e);
      message.error('Error al cargar horarios');
    }

    setAssignments(next);
    setAutoModalOpen(false);
    message.success('Distribución aplicada');
  };

  const classMeta = (key: string | null) => classes.find(c => c.key === key);

  // Build merge info for consecutive same-class cells in a room column
  const buildMergeInfo = (day: string, periods: Period[], room: string) => {
    const info: ({ value: string | null; rowSpan: number; skip: boolean } | null)[] = new Array(periods.length).fill(null);
    let i = 0;
    while (i < periods.length) {
      const val = assignments[cellKey(day, periods[i].id, room)] ?? null;
      let j = i + 1;
      while (
        val !== null &&
        j < periods.length &&
        (assignments[cellKey(day, periods[j].id, room)] ?? null) === val
      ) {
        j++;
      }
      const runLen = j - i;
      info[i] = { value: val, rowSpan: runLen, skip: false };
      for (let k = i + 1; k < j; k++) info[k] = { value: val, rowSpan: 0, skip: true };
      i = j;
    }
    return info;
  };

  // Total rows per day block (for vertical day label rowspan)
  const totalRowsPerDay = useMemo(() => {
    let n = 1; // column header row
    scheduleSections.forEach(section => {
      n += 1; // section banner
      section.periods.forEach(p => {
        if (!p.break) n += 1;
      });
    });
    return n;
  }, [scheduleSections]);

  const bannerColSpan = rooms.length + 1;

  if (rooms.length === 0) {
    return (
      <div className="p-6">
        <Empty description="No hay aulas configuradas. Vaya a Configuración → Horarios y establezca el número de aulas disponibles." />
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="p-6">
        <Empty description="No hay secciones disponibles en el período activo." />
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Toolbar (hidden in readOnly mode) */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {classes.map(c => {
            const color = colorForClass(c.key);
            const isActive = activeKey === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setActiveKey(isActive ? undefined : c.key)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-all ${
                  isActive
                    ? 'border-slate-800 ring-2 ring-offset-1 ring-slate-400 bg-slate-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <span className="w-3 h-3 rounded-sm" style={{ background: color.bg, border: `1px solid ${color.border}` }} />
                {c.label}
              </button>
            );
          })}
          <button
            onClick={() => setActiveKey(activeKey === null ? undefined : null)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-all ${
              activeKey === null
                ? 'border-slate-800 ring-2 ring-offset-1 ring-slate-400 bg-slate-50'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <span className="w-3 h-3 rounded-sm border border-slate-400 bg-white" />
            Borrar
          </button>
          <span className="flex-1" />
          <Button
            size="small"
            type={selectionMode ? 'primary' : 'default'}
            icon={<HighlightOutlined />}
            onClick={() => { setSelectionMode(!selectionMode); clearSelection(); }}
          >
            Seleccionar
          </Button>
          {selectedCells.size > 0 && (
            <>
              <Button size="small" onClick={clearSelection}>Cancelar selección</Button>
              <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setBookingModalOpen(true)}>
                Asignar extraordinaria ({selectedCells.size})
              </Button>
            </>
          )}
          <Button size="small" icon={<ThunderboltOutlined />} onClick={handleOpenAutoModal}>Distribución automática</Button>
          <Button size="small" icon={<ClearOutlined />} onClick={clearAll}>Limpiar todo</Button>
          {!readOnly && (
            <Button
              size="small"
              icon={<InboxOutlined />}
              onClick={() => { loadPendingRequests(); setRequestsModalOpen(true); }}
            >
              Solicitudes
              {pendingRequests.length > 0 && <Tag color="orange" style={{ marginLeft: 4 }}>{pendingRequests.length}</Tag>}
            </Button>
          )}
          <Button
            size="small"
            icon={<FileExcelOutlined />}
            onClick={() => {
              const sectionLabels: Record<string, string> = {};
              sectionsList.forEach(s => {
                sectionLabels[`${s.gradeId}-${s.sectionId}`] = s.label;
              });
              generateClassroomDistribution({
                schoolPeriodName: schoolPeriodName || '',
                sections: scheduleSections,
                rooms,
                assignments,
                sectionLabels,
              }).catch(() => message.error('Error al exportar distribución de aulas'));
            }}
          >
            Exportar Excel
          </Button>
        </div>
      )}

      {/* Date picker for viewing extraordinary bookings (visible in all modes) */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-slate-500 font-semibold">Ver asignaciones para fecha:</span>
        <DatePicker
          size="small"
          allowClear
          placeholder="Seleccionar fecha"
          value={viewDate}
          onChange={(d) => setViewDate(d)}
          format="DD/MM/YYYY"
        />
        {viewDate && bookings.length > 0 && (
          <Tag color="orange">{bookings.length} asignación{bookings.length > 1 ? 'es' : ''} extraordinaria{bookings.length > 1 ? 's' : ''}</Tag>
        )}
        <span className="flex-1" />
        <span className="text-xs text-slate-500 font-semibold">Días:</span>
        {DAYS.map(d => (
          <button
            key={d}
            onClick={() => setActiveDay(activeDay === d ? null : d)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
              activeDay === d
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {d.slice(0, 3).toUpperCase()}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm" style={{ width: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '28px' }} />
            <col style={{ width: '110px' }} />
            {rooms.map(r => <col key={r} />)}
          </colgroup>
          <tbody>
            {DAYS.filter(day => !activeDay || day === activeDay).map(day => (
              <React.Fragment key={day}>
                {/* Column header with vertical day label */}
                <tr>
                  <td
                    rowSpan={totalRowsPerDay}
                    className="border border-slate-300 border-t-4 border-t-slate-900 bg-slate-800 text-white text-center align-middle font-bold text-[16px] py-2"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'upright', letterSpacing: '0.2em' }}
                  >
                    {day.toUpperCase()}
                  </td>
                  <th className="border border-slate-300 border-t-4 border-t-slate-900 bg-slate-200 text-slate-700 py-1.5 text-[10px] whitespace-nowrap">Hora</th>
                  {rooms.map(r => (
                    <th key={r} className="border border-slate-300 border-t-4 border-t-slate-900 bg-slate-200 text-slate-700 py-1.5 text-[10px]">{r}</th>
                  ))}
                </tr>

                {scheduleSections.map(section => (
                  <React.Fragment key={section.id}>
                    <tr>
                      <td colSpan={bannerColSpan} className={`${section.id === 'manana' ? 'bg-teal-700' : 'bg-indigo-700'} text-white text-center font-bold tracking-widest py-1 text-[11px]`}>
                        {section.label}
                      </td>
                    </tr>
                    {section.periods.filter(p => !p.break).map(period => (
                        <tr key={period.id}>
                          <td className="border border-slate-300 bg-slate-50 text-slate-600 text-[10px] text-center py-1 font-medium leading-tight">
                            <div>{period.start}</div>
                            <div>{period.end}</div>
                          </td>
                          {rooms.map(room => {
                            // Build merge info lazily for this row
                            const groupPeriods = section.periods.filter(p => !p.break);
                            const pIdx = groupPeriods.findIndex(p => p.id === period.id);
                            if (pIdx < 0) {
                              const k = cellKey(day, period.id, room);
                              const isSelected = selectedCells.has(k) || (externalSelectedCells?.has(k) ?? false);
                              const useExternal = externalSelectionMode && onExternalSelectDown;
                              const dayAllowed = !allowedSelectionDay || day === allowedSelectionDay;
                              const canSelect = useExternal && dayAllowed;
                              return (
                                <td
                                  key={room}
                                  className={`border border-slate-300 bg-white h-9 transition-colors ${
                                    isSelected ? 'ring-2 ring-inset ring-amber-400 bg-amber-50' : ''
                                  } ${
                                    !canSelect && useExternal ? 'opacity-30' : ''
                                  } ${
                                    readOnly && !canSelect ? '' : canSelect
                                      ? 'cursor-crosshair select-none'
                                      : activeKey !== undefined ? 'cursor-pointer select-none hover:bg-slate-100' : ''
                                  }`}
                                  onMouseDown={(readOnly && !canSelect) ? undefined : canSelect ? () => onExternalSelectDown!(day, period.id, room) : () => handleDown(day, period.id, room)}
                                  onMouseEnter={(readOnly && !canSelect) ? undefined : canSelect ? () => onExternalSelectEnter!(day, period.id, room) : () => handleEnter(day, period.id, room)}
                                />
                              );
                            }
                            const mergeInfo = buildMergeInfo(day, groupPeriods, room);
                            const info = mergeInfo[pIdx];
                            if (!info || info.skip) return null;
                            const parsed = info.value ? parseCellValue(info.value) : null;
                            const k = cellKey(day, period.id, room);
                            const booking = bookingMap[k];
                            const isCleared = clearedCells.has(k);
                            let cellLabel = '';
                            let cellBg = '';
                            let cellText = '';
                            let cellBorder = '';
                            let cellCleared = false;
                            if (booking) {
                              // Extraordinary booking overlay
                              cellLabel = `${booking.teacherName}\n${booking.subjectName}`;
                              cellBg = '#dc2626';
                              cellText = '#ffffff';
                              cellBorder = '#991b1b';
                            } else if (isCleared && viewDate) {
                              // Teacher has an extraordinary booking elsewhere — this slot is empty
                              cellCleared = true;
                              cellLabel = '—';
                              cellBg = '#f1f5f9';
                              cellText = '#94a3b8';
                              cellBorder = '#cbd5e1';
                            } else if (parsed?.type === 'section') {
                              const meta = classMeta(parsed.sectionKey);
                              cellLabel = meta?.label ?? '';
                              // Priority: section color > periodGrade color > grade palette
                              const sectionColor = meta?.color && meta.color !== '#ffffff' ? meta.color : null;
                              const gradeColor = meta?.periodGradeColor && meta.periodGradeColor !== '#ffffff' ? meta.periodGradeColor : null;
                              const gradeId = Number(parsed.sectionKey.split('-')[0]);
                              const baseColor = sectionColor ?? gradeColor ?? colorForGrade(gradeId);
                              cellBg = lightenColor(baseColor, 0.82);
                              cellText = darkenColor(baseColor, 0.45);
                              cellBorder = baseColor;
                            } else if (parsed?.type === 'group') {
                              const subj = subjectsList.find(s => s.id === parsed.subjectId);
                              const grade = gradesList.find(g => g.id === parsed.gradeId);
                              cellLabel = `${grade?.name ?? ''} ${subj?.name ?? ''}`.trim();
                              // Priority: subject color > periodGrade color (looked up from sectionsList) > grade palette
                              const subjColor = subj?.color && subj.color !== '#ffffff' ? subj.color : null;
                              // Find periodGradeColor for this gradeId from sectionsList
                              const refSection = sectionsList.find(s => s.gradeId === parsed.gradeId);
                              const gradeColor = refSection?.periodGradeColor && refSection.periodGradeColor !== '#ffffff' ? refSection.periodGradeColor : null;
                              const baseColor = subjColor ?? gradeColor ?? colorForGrade(parsed.gradeId);
                              cellBg = lightenColor(baseColor, 0.82);
                              cellText = darkenColor(baseColor, 0.45);
                              cellBorder = baseColor;
                            }
                            const isSelected = selectedCells.has(k) || (externalSelectedCells?.has(k) ?? false);
                            const useExternal = externalSelectionMode && onExternalSelectDown;
                            const dayAllowed = !allowedSelectionDay || day === allowedSelectionDay;
                            const canSelect = useExternal && dayAllowed;
                            return (
                              <td
                                key={room}
                                rowSpan={info.rowSpan}
                                onMouseDown={(readOnly && !canSelect) ? undefined : canSelect ? () => onExternalSelectDown!(day, period.id, room) : () => handleDown(day, period.id, room)}
                                onMouseEnter={(readOnly && !canSelect) ? undefined : canSelect ? () => onExternalSelectEnter!(day, period.id, room) : () => handleEnter(day, period.id, room)}
                                className={`border border-slate-300 text-center align-middle text-[11px] font-semibold transition-colors ${
                                  !canSelect && useExternal ? 'opacity-30' : ''
                                } ${
                                  (readOnly && !canSelect) ? '' : canSelect ? 'cursor-crosshair select-none' : activeKey !== undefined ? 'cursor-pointer select-none' : ''
                                } ${parsed ? '' : 'bg-white hover:bg-slate-100'} ${parsed?.type === 'group' ? 'italic' : ''} ${info.rowSpan > 1 ? 'py-2' : 'h-9'} ${
                                  isSelected ? 'ring-2 ring-inset ring-amber-400' : ''
                                }`}
                                style={cellBg ? { background: isSelected ? '#fef3c7' : cellBg, color: cellText, borderLeft: `3px solid ${cellBorder}` } : isSelected ? { background: '#fef3c7' } : {}}
                              >
                                {booking ? (
                                  <Tooltip title={`${booking.teacherName} — ${booking.subjectName}${booking.reason ? ` (${booking.reason})` : ''}`}>
                                    <div className="leading-tight">
                                      <div className="font-bold text-[10px]">{booking.teacherName}</div>
                                      <div className="text-[9px] italic opacity-80">{booking.subjectName}</div>
                                    </div>
                                  </Tooltip>
                                ) : cellCleared ? (
                                  <Tooltip title="Profesor con asignación extraordinaria en otra aula">
                                    <span className="text-slate-400 italic">{cellLabel}</span>
                                  </Tooltip>
                                ) : cellLabel}
                                {info.rowSpan > 1 && parsed && !booking && !cellCleared && (
                                  <div className="text-[9px] opacity-60 mt-1 border-t border-current pt-0.5">
                                    {period.start}–{groupPeriods[Math.min(pIdx + info.rowSpan - 1, groupPeriods.length - 1)].end}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                    ))}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending Requests Modal (Control de Estudios) */}
      <Modal
        title="Solicitudes de aula pendientes"
        open={requestsModalOpen}
        onCancel={() => setRequestsModalOpen(false)}
        footer={<Button onClick={() => setRequestsModalOpen(false)}>Cerrar</Button>}
        width={680}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        {requestsLoading ? (
          <div className="flex justify-center p-8"><Spin /></div>
        ) : pendingRequests.length === 0 ? (
          <Empty description="No hay solicitudes pendientes" />
        ) : (
          <List
            itemLayout="vertical"
            dataSource={pendingRequests}
            renderItem={(b: any) => {
              const periodIds: string[] = JSON.parse(b.periodIds || '[]');
              const conflicts: number[] = b.conflictsWith || [];
              const hasConflicts = conflicts.length > 0;
              return (
                <List.Item
                  actions={[
                    <Button key="approve" type="primary" size="small" onClick={() => handleApproveRequest(b.id)}>
                      Aprobar
                    </Button>,
                    <Button key="reject" danger size="small" onClick={() => handleRejectRequest(b.id)}>
                      Rechazar
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <span>
                        {b.teacherName} — {b.subjectName}
                        {hasConflicts && (
                          <Tag color="red" style={{ marginLeft: 8 }}>Conflicto con {conflicts.length} solicitud{conflicts.length > 1 ? 'es' : ''}</Tag>
                        )}
                      </span>
                    }
                    description={
                      <div className="text-sm text-slate-600">
                        <div><strong>Aula:</strong> {b.room} · <strong>Día:</strong> {b.day} · <strong>Fecha:</strong> {b.specificDate}</div>
                        <div><strong>Bloques:</strong> {periodIds.length} ({periodIds.join(', ')})</div>
                        {b.reason && <div><strong>Motivo:</strong> {b.reason}</div>}
                        {hasConflicts && (
                          <div className="text-red-600 text-xs mt-1">
                            Al aprobar esta solicitud, las demás en conflicto se rechazarán automáticamente.
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Modal>

      {/* Extraordinary Booking Modal */}
      <Modal
        title="Asignación extraordinaria de aula"
        open={bookingModalOpen}
        onCancel={() => setBookingModalOpen(false)}
        onOk={handleSaveBooking}
        okText="Guardar"
        cancelText="Cancelar"
        width={520}
      >
        <Alert
          type="info"
          showIcon
          message="Asignación para una fecha específica"
          description="Esta asignación solo aplica para el día seleccionado. No afecta la distribución semanal regular."
          style={{ marginBottom: 16 }}
        />
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha *</label>
            <DatePicker
              value={bookingDate}
              onChange={setBookingDate}
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
              placeholder="Seleccione la fecha"
            />
            {bookingDate && dayjsToDayName(bookingDate) && (
              <div className="text-xs text-blue-600 mt-1">Día de la semana: <strong>{dayjsToDayName(bookingDate)}</strong> — solo se guardarán bloques de {dayjsToDayName(bookingDate)}.</div>
            )}
            {bookingDate && !dayjsToDayName(bookingDate) && (
              <div className="text-xs text-red-600 mt-1">La fecha es fin de semana — seleccione un día de lunes a viernes.</div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Profesor *</label>
            <Input value={bookingTeacher} onChange={e => setBookingTeacher(e.target.value)} placeholder="Nombre del profesor" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Materia / Actividad *</label>
            <Input value={bookingSubject} onChange={e => setBookingSubject(e.target.value)} placeholder="Ej: Ciencias de la Tierra" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo (opcional)</label>
            <Input.TextArea value={bookingReason} onChange={e => setBookingReason(e.target.value)} placeholder="Ej: Práctica de laboratorio" rows={2} />
          </div>
          <div className="bg-slate-50 rounded-md p-3 text-xs text-slate-600">
            <strong>Bloques seleccionados:</strong>
            <ul className="mt-1 space-y-0.5">
              {selectedGroups.map((g, i) => (
                <li key={i}>{g.day} — {g.room} ({g.periodIds.length} bloque{g.periodIds.length > 1 ? 's' : ''})</li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>

      {/* Auto-distribution Modal */}
      <Modal
        title="Distribución automática de aulas"
        open={autoModalOpen}
        onCancel={() => setAutoModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setAutoModalOpen(false)}>Cancelar</Button>,
          <Button key="apply" type="primary" onClick={handleApplyAuto} disabled={roomAssignments.length === 0}>
            Aplicar a la grid
          </Button>,
        ]}
        width={680}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' } }}
      >
        {autoLoading ? (
          <div className="flex justify-center p-8"><Spin /></div>
        ) : (
          <div className="space-y-5">
            <Alert
              type="info"
              showIcon
              message="¿Cómo funciona?"
              description={
                <div className="text-xs space-y-1.5 mt-1">
                  <p><strong>1. Asigna cada sección a su aula</strong> — ej: 1° A → Aula 1, 1° B → Aula 2. Esto llena todos los bloques de la semana.</p>
                  <p><strong>2. Asigna materias a aulas específicas</strong> — ej: Educación Física → Cancha. Esto sobrescribe el aula de la sección solo en los bloques donde se dicta esa materia.</p>
                  <p><strong>3. Asigna materias de grupo por grado</strong> — ej: 1° Artes Gráficas → Aula 1, 1° Redacción → Aula 2. En los bloques de materias de grupo, cada materia va a su aula y los estudiantes de ambas secciones se reparten.</p>
                  <p className="pt-1">Al final, presiona <strong>«Aplicar a la grid»</strong> para generar la distribución.</p>
                </div>
              }
            />

            {/* Existing assignments */}
            {roomAssignments.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-2">Asignaciones configuradas ({roomAssignments.length})</h4>
                <div className="space-y-1.5">
                  {roomAssignments.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50">
                      <Tag color={a.targetType === 'section' ? 'green' : a.targetType === 'group' ? 'orange' : 'blue'} style={{ margin: 0 }}>{a.room}</Tag>
                      {a.targetType === 'section' ? (
                        <span className="flex-1">
                          <span className="text-slate-400 text-xs">Sección → </span>
                          <strong>{classes.find(c => c.key === a.sectionKey)?.label ?? a.sectionKey}</strong>
                        </span>
                      ) : a.targetType === 'group' ? (
                        <span className="flex-1">
                          <span className="text-slate-400 text-xs">Grupo → </span>
                          <strong>{gradesList.find(g => g.id === a.gradeId)?.name ?? a.gradeId} — {a.subject?.name ?? a.subjectId}</strong>
                        </span>
                      ) : (
                        <span className="flex-1">
                          <span className="text-slate-400 text-xs">Materia → </span>
                          <strong>{a.subject?.name ?? a.subjectId}</strong>
                        </span>
                      )}
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteAssignment(a.id)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add new assignment */}
            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3">Agregar nueva asignación</h4>

              {/* Step 1: Choose room */}
              <div className="mb-3">
                <label className="text-xs font-semibold text-slate-500 block mb-1">Paso 1 — Selecciona el aula</label>
                <Select
                  placeholder="Ej: Aula 1, Cancha…"
                  style={{ width: '100%' }}
                  value={newAssignRoom ?? undefined}
                  onChange={setNewAssignRoom}
                  options={rooms.map(r => ({ value: r, label: r }))}
                />
              </div>

              {/* Step 2: Choose type */}
              <div className="mb-3">
                <label className="text-xs font-semibold text-slate-500 block mb-1">Paso 2 — ¿Qué va en esta aula?</label>
                <Select
                  style={{ width: '100%' }}
                  value={newAssignType}
                  onChange={(v) => { setNewAssignType(v); setNewAssignSection(null); setNewAssignSubject(null); setNewAssignGrade(null); }}
                  options={[
                    { value: 'section', label: 'Una sección (ej: 1° A siempre en Aula 1)' },
                    { value: 'subject', label: 'Una materia (ej: Educación Física siempre en Cancha)' },
                    { value: 'group', label: 'Materia de grupo por grado (ej: 1° Artes Gráficas en Aula 1)' },
                  ]}
                />
              </div>

              {/* Step 3: Choose target */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  Paso 3 — {newAssignType === 'section' ? 'Selecciona la sección' : newAssignType === 'subject' ? 'Selecciona la materia' : 'Selecciona el grado y la materia de grupo'}
                </label>
                {newAssignType === 'section' ? (
                  <Select
                    showSearch
                    placeholder="Ej: 1° A, 2° B…"
                    style={{ width: '100%' }}
                    value={newAssignSection ?? undefined}
                    onChange={setNewAssignSection}
                    optionFilterProp="label"
                    options={classes
                      .filter(c => !roomAssignments.some((a: any) => a.targetType === 'section' && a.sectionKey === c.key))
                      .map(c => ({ value: c.key, label: c.label }))}
                  />
                ) : newAssignType === 'subject' ? (
                  <Select
                    showSearch
                    placeholder="Ej: Educación Física…"
                    style={{ width: '100%' }}
                    value={newAssignSubject ?? undefined}
                    onChange={setNewAssignSubject}
                    optionFilterProp="label"
                    options={subjectsList
                      .filter(s => !roomAssignments.some((a: any) => a.targetType === 'subject' && a.subjectId === s.id))
                      .map(s => ({ value: s.id, label: s.name }))}
                  />
                ) : (
                  <div className="flex gap-2">
                    <Select
                      showSearch
                      placeholder="Grado"
                      style={{ width: '35%' }}
                      value={newAssignGrade ?? undefined}
                      onChange={setNewAssignGrade}
                      optionFilterProp="label"
                      options={gradesList.map(g => ({ value: g.id, label: g.name }))}
                    />
                    <Select
                      showSearch
                      placeholder="Materia de grupo"
                      style={{ width: '65%' }}
                      value={newAssignSubject ?? undefined}
                      onChange={setNewAssignSubject}
                      optionFilterProp="label"
                      options={subjectsList
                        .filter(s => s.subjectGroupId != null)
                        .filter(s => !roomAssignments.some((a: any) => a.targetType === 'group' && a.subjectId === s.id && a.gradeId === newAssignGrade))
                        .map(s => ({ value: s.id, label: s.name }))}
                    />
                  </div>
                )}
              </div>

              <Button
                type="primary"
                onClick={handleAddAssignment}
                disabled={!newAssignRoom}
                block
              >
                + Agregar asignación
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ClassroomDistribution;
