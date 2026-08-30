import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button, Empty, Spin, Tag, Tooltip, Modal, Select, message, Alert } from 'antd';
import { DeleteOutlined, ClearOutlined, ThunderboltOutlined } from '@ant-design/icons';
import api from '@/services/api';
import dayjs from 'dayjs';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

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

  const buildPeriods = (prefix: string, sectionId: string, sectionLabel: string, startTime: string, blocksBefore: number, minBefore: number, recess: number, blocksAfter: number, minAfter: number): Period[] => {
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

// Group subject colors — distinct from section colors (warm tones)
const GROUP_COLORS = [
  { bg: '#fff3e0', border: '#ff9800', text: '#e65100' },
  { bg: '#fbe9e7', border: '#ff5722', text: '#bf360c' },
  { bg: '#fff8e1', border: '#ffc107', text: '#ff6f00' },
  { bg: '#f3e5f5', border: '#9c27b0', text: '#4a148c' },
  { bg: '#e0f2f1', border: '#009688', text: '#004d40' },
];

function colorForGroup(key: string): typeof GROUP_COLORS[0] {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
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
  gradesList: { id: number; name: string }[];
}

const ClassroomDistribution: React.FC<ClassroomDistributionProps> = ({ settings, sectionsList, subjectsList, schoolPeriodId, gradesList }) => {
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
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Auto-distribution modal state
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [roomAssignments, setRoomAssignments] = useState<any[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [newAssignRoom, setNewAssignRoom] = useState<string | null>(null);
  const [newAssignType, setNewAssignType] = useState<'section' | 'subject' | 'group'>('section');
  const [newAssignSection, setNewAssignSection] = useState<string | null>(null);
  const [newAssignSubject, setNewAssignSubject] = useState<number | null>(null);
  const [newAssignGrade, setNewAssignGrade] = useState<number | null>(null);

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

  const clearAll = () => setAssignments({});

  // Load saved grid state on mount
  useEffect(() => {
    if (!schoolPeriodId) return;
    api.get(`/classroom-assignments/grid/${schoolPeriodId}`)
      .then(res => { if (res.data && Object.keys(res.data).length > 0) setAssignments(res.data); })
      .catch(() => {});
  }, [schoolPeriodId]);

  // Save grid state whenever assignments change (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!schoolPeriodId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.put(`/classroom-assignments/grid/${schoolPeriodId}`, assignments).catch(() => {});
    }, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [assignments, schoolPeriodId]);

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
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {classes.map(c => {
          const color = colorForClass(c.key);
          const isActive = activeKey === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setActiveKey(c.key)}
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
          onClick={() => setActiveKey(null)}
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
        <Button size="small" icon={<ThunderboltOutlined />} onClick={handleOpenAutoModal}>Distribución automática</Button>
        <Button size="small" icon={<ClearOutlined />} onClick={clearAll}>Limpiar todo</Button>
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
            {DAYS.map(day => (
              <React.Fragment key={day}>
                {/* Column header with vertical day label */}
                <tr>
                  <td
                    rowSpan={totalRowsPerDay}
                    className="border border-slate-300 border-t-4 border-t-slate-900 bg-slate-800 text-white text-center align-middle font-bold text-xs py-2"
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
                              return (
                                <td
                                  key={room}
                                  className="border border-slate-300 bg-white h-9 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                                  onMouseDown={() => handleDown(day, period.id, room)}
                                  onMouseEnter={() => handleEnter(day, period.id, room)}
                                />
                              );
                            }
                            const mergeInfo = buildMergeInfo(day, groupPeriods, room);
                            const info = mergeInfo[pIdx];
                            if (!info || info.skip) return null;
                            const parsed = info.value ? parseCellValue(info.value) : null;
                            let cellLabel = '';
                            let cellBg = '';
                            let cellText = '';
                            let cellBorder = '';
                            if (parsed?.type === 'section') {
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
                            return (
                              <td
                                key={room}
                                rowSpan={info.rowSpan}
                                onMouseDown={() => handleDown(day, period.id, room)}
                                onMouseEnter={() => handleEnter(day, period.id, room)}
                                className={`border border-slate-300 cursor-pointer select-none text-center align-middle text-[11px] font-semibold transition-colors ${
                                  parsed ? '' : 'bg-white hover:bg-slate-100'
                                } ${parsed?.type === 'group' ? 'italic' : ''} ${info.rowSpan > 1 ? 'py-2' : 'h-9'}`}
                                style={cellBg ? { background: cellBg, color: cellText, borderLeft: `3px solid ${cellBorder}` } : {}}
                              >
                                {cellLabel}
                                {info.rowSpan > 1 && parsed && (
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
