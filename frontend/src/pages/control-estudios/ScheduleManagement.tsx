import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Tabs, Select, Card, Spin, message, Button, Tag, Empty, Tooltip, Modal, Switch, InputNumber, Alert, Popconfirm } from 'antd';
import { TableOutlined, UserOutlined, ReloadOutlined, EditOutlined, SaveOutlined, CloseOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import dayjs from 'dayjs';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

// ── Build periods from settings ──
interface Period { id: string; start: string; end: string; break?: boolean; label?: string; section: string; }
interface ScheduleSection { id: string; label: string; periods: Period[]; }

function formatTime(d: dayjs.Dayjs, use12h: boolean): string {
  if (use12h) {
    const h12 = d.hour() % 12 || 12;
    const m = d.minute().toString().padStart(2, '0');
    const ampm = d.hour() < 12 ? 'AM' : 'PM';
    return `${h12}:${m} ${ampm}`;
  }
  return `${d.hour()}:${d.minute().toString().padStart(2, '0')}`;
}

// Get the N consecutive periods (same section, skipping breaks) starting from a given period
function getBlockPeriods(sections: ScheduleSection[], startPeriod: Period, blockSize: number): Period[] {
  if (blockSize <= 1) return [startPeriod];
  // Find the section this period belongs to
  const section = sections.find(s => s.id === startPeriod.section);
  if (!section) return [startPeriod];
  // Get non-break periods in that section, starting from startPeriod
  const sectionPeriods = section.periods.filter(p => !p.break);
  const startIdx = sectionPeriods.findIndex(p => p.id === startPeriod.id);
  if (startIdx < 0) return [startPeriod];
  return sectionPeriods.slice(startIdx, startIdx + blockSize);
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

// ── Color helper for subjects ──
const SUBJECT_COLORS = ['#e6f7ff', '#f6ffed', '#fff7e6', '#fff1f0', '#f9f0ff', '#e6fffb', '#fcffe6', '#fffbe6'];
function colorForSubject(subjectId: number | null): string {
  if (!subjectId) return '#ffffff';
  return SUBJECT_COLORS[subjectId % SUBJECT_COLORS.length];
}

// ── Entry type ──
interface ScheduleEntryData {
  id?: number;
  day: string;
  periodId: string;
  subjectId: number | null;
  teacherId: number | null;
  isGroupSubject: boolean;
  subject?: { id: number; name: string; allowConsecutiveBlocks?: boolean; subjectGroupId?: number | null };
  teacher?: { id: number; firstName: string; lastName: string };
}

// ── Section option (subject + teachers) ──
interface SectionOption {
  periodGradeSubjectId: number;
  subjectId: number;
  subjectName: string;
  weeklyBlocks: number;
  allowConsecutiveBlocks: boolean;
  subjectGroupId: number | null;
  teachers: { teacherId: number; teacherName: string }[];
}

// ── Schedule Grid Component ──
// entries: key `${day}|${periodId}` -> array of entries (1 for regular, multiple for group subjects)
function cellSignature(cellEntries: ScheduleEntryData[] | undefined): string {
  if (!cellEntries || cellEntries.length === 0) return '';
  return cellEntries
    .map(e => `${e.subjectId}:${e.teacherId}:${e.isGroupSubject ? 1 : 0}`)
    .sort()
    .join('|');
}

function ScheduleGrid({ sections, entries, onCellClick, editable, getCellLabel }: {
  sections: ScheduleSection[];
  entries: Record<string, ScheduleEntryData[]>;
  onCellClick?: (day: string, period: Period) => void;
  editable: boolean;
  getCellLabel: (day: string, period: Period, cellEntries: ScheduleEntryData[]) => React.ReactNode;
}) {
  // Build an ordered list of non-break periods (row order)
  const orderedPeriods: Period[] = [];
  sections.forEach(s => s.periods.forEach(p => { if (!p.break) orderedPeriods.push(p); }));

  // rowspanMap: key `${day}|${period.id}` -> number (rowspan if start, 0 if covered)
  // Two consecutive non-break periods in the same section are mergeable when they have the same signature.
  // Stops at a break (don't merge across recess).
  const rowspanMap: Record<string, number> = {};
  DAYS.forEach(day => {
    for (let i = 0; i < orderedPeriods.length; i++) {
      const p = orderedPeriods[i];
      const key = `${day}|${p.id}`;
      const sig = cellSignature(entries[key]);
      if (!sig) { rowspanMap[key] = 1; continue; }
      const section = sections.find(s => s.id === p.section);
      if (!section) { rowspanMap[key] = 1; continue; }
      const rawPeriods = section.periods;
      const localIdx = rawPeriods.findIndex(pp => pp.id === p.id);
      if (localIdx < 0) { rowspanMap[key] = 1; continue; }
      let span = 1;
      let cursor = localIdx + 1;
      while (cursor < rawPeriods.length) {
        const nextRaw = rawPeriods[cursor];
        if (nextRaw.break) break;
        const nextKey = `${day}|${nextRaw.id}`;
        if (sig === cellSignature(entries[nextKey])) {
          span++;
          cursor++;
        } else {
          break;
        }
      }
      rowspanMap[key] = span;
      let markCursor = localIdx + 1;
      let marked = 0;
      while (marked < span - 1 && markCursor < rawPeriods.length) {
        const nextRaw = rawPeriods[markCursor];
        if (!nextRaw.break) {
          rowspanMap[`${day}|${nextRaw.id}`] = 0;
          marked++;
        }
        markCursor++;
      }
      i += span - 1;
    }
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth: '640px', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th className="border border-slate-300 bg-slate-800 text-white py-2 text-xs" style={{ width: `${100 / (DAYS.length + 1)}%` }}>Hora</th>
            {DAYS.map(d => (
              <th key={d} className="border border-slate-300 bg-slate-800 text-white py-2 text-xs uppercase tracking-wide" style={{ width: `${100 / (DAYS.length + 1)}%` }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map(sec => (
            <React.Fragment key={sec.id}>
              <tr>
                <td colSpan={DAYS.length + 1} className={`${sec.id === 'manana' ? 'bg-teal-700' : 'bg-indigo-700'} text-white text-center font-bold tracking-widest py-1.5 text-xs`}>
                  {sec.label}
                </td>
              </tr>
              {sec.periods.map(period =>
                period.break ? (
                  <tr key={period.id}>
                    <td colSpan={DAYS.length + 1} className="bg-amber-50 border-t-2 border-b-2 border-amber-400 text-amber-700 text-center text-[11px] py-1 font-medium">
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
                      const cellEntries = entries[key] ?? [];
                      const span = rowspanMap[key] ?? 1;
                      if (span === 0) return null;
                      // For merged blocks, compute the end time of the whole block
                      let blockEndTime = period.end;
                      if (span > 1 && cellEntries.length > 0) {
                        const section = sections.find(s => s.id === period.section);
                        const raw = section?.periods ?? [];
                        const li = raw.findIndex(pp => pp.id === period.id);
                        if (li >= 0) {
                          let count = 1;
                          for (let k = li + 1; k < raw.length && count < span; k++) {
                            if (!raw[k].break) { count++; blockEndTime = raw[k].end; }
                          }
                        }
                      }
                      const isMerged = span > 1 && cellEntries.length > 0;
                      return (
                        <td
                          key={day}
                          rowSpan={span}
                          className={`border border-slate-300 text-center text-xs px-1 align-middle ${editable ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-colors' : ''} ${isMerged ? 'h-auto py-2' : 'h-12'}`}
                          style={{ background: cellEntries.length === 1 ? colorForSubject(cellEntries[0].subjectId) : '#ffffff' }}
                          onClick={() => editable && onCellClick?.(day, period)}
                        >
                          {getCellLabel(day, period, cellEntries)}
                          {isMerged && (
                            <div className="text-[9px] text-slate-400 mt-1 border-t border-slate-200 pt-0.5">
                              {period.start}–{blockEndTime}
                            </div>
                          )}
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
  );
}

// ── Cell Editor Modal ──
interface CellEditorModalProps {
  open: boolean;
  day: string;
  period: Period;
  cellEntries: ScheduleEntryData[];
  options: SectionOption[];
  onClose: () => void;
  onSave: (entry: { subjectId: number | null; teacherId: number | null; isGroupSubject: boolean }) => void;
  onRemoveEntry: (subjectId: number) => void;
  onClearAll: () => void;
  onTeacherChange: (teacherId: number | null) => void;
  teacherConflict: { hasConflict: boolean; conflicts: any[] } | null;
  blockPeriods: Period[];
}

const CellEditorModal: React.FC<CellEditorModalProps> = ({ open, day, period, cellEntries, options, onClose, onSave, onRemoveEntry, onClearAll, onTeacherChange, teacherConflict, blockPeriods }) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [isGroup, setIsGroup] = useState(false);

  useEffect(() => {
    // Reset form when modal opens; don't pre-fill since we're adding new entries
    setSelectedSubjectId(null);
    setSelectedTeacherId(null);
    setIsGroup(false);
  }, [open]);

  const selectedOption = options.find(o => o.subjectId === selectedSubjectId);

  // Determine which subject options are available for adding
  // - If cell is empty: all options
  // - If cell has a non-group entry: no more can be added (block is full)
  // - If cell has group entries: only subjects from the same subjectGroupId, not already in the cell
  const hasNonGroup = cellEntries.some(e => !e.isGroupSubject);
  const hasGroup = cellEntries.some(e => e.isGroupSubject);
  const existingSubjectIds = new Set(cellEntries.map(e => e.subjectId));
  const existingGroupId = hasGroup ? options.find(o => o.subjectId === cellEntries.find(e => e.isGroupSubject)?.subjectId)?.subjectGroupId : null;

  const availableOptions = hasNonGroup
    ? [] // can't add more to a non-group cell
    : hasGroup
      ? options.filter(o => o.subjectGroupId === existingGroupId && !existingSubjectIds.has(o.subjectId))
      : options;

  const canAddMore = availableOptions.length > 0;

  // Auto-set isGroup when adding to a group cell
  useEffect(() => {
    if (hasGroup) setIsGroup(true);
  }, [hasGroup]);

  return (
    <Modal
      title={`${day} · ${period.start} - ${period.end}`}
      open={open}
      onCancel={onClose}
      width={520}
      footer={[
        cellEntries.length > 0 && (
          <Button key="clearAll" danger icon={<DeleteOutlined />} onClick={onClearAll} style={{ float: 'left' }}>
            Limpiar todo
          </Button>
        ),
        <Button key="cancel" icon={<CloseOutlined />} onClick={onClose}>Cerrar</Button>,
        canAddMore && (
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            disabled={!selectedSubjectId}
            onClick={() => onSave({ subjectId: selectedSubjectId, teacherId: selectedTeacherId, isGroupSubject: isGroup })}
          >
            {cellEntries.length > 0 ? 'Añadir' : 'Guardar'}
          </Button>
        ),
      ]}
    >
      <div className="flex flex-col gap-4 py-2">
        {/* Existing entries list */}
        {cellEntries.length > 0 && (
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
              Materias en este bloque ({cellEntries.length})
            </label>
            <div className="flex flex-col gap-1">
              {cellEntries.map((e, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-2 py-1.5" style={{ borderLeft: `3px solid ${colorForSubject(e.subjectId)}` }}>
                  <div className="flex flex-col">
                    <span className="font-semibold text-xs text-slate-800">{e.subject?.name ?? '—'}</span>
                    <span className="text-[10px] text-slate-500">
                      {e.teacher ? `${e.teacher.firstName} ${e.teacher.lastName}` : 'Sin profesor'}
                      {e.isGroupSubject && <span className="ml-1 text-purple-600">👥 Grupo</span>}
                    </span>
                  </div>
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onRemoveEntry(e.subjectId!)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add new entry form */}
        {canAddMore ? (
          <>
            <div className="border-t border-slate-200 pt-3">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                {cellEntries.length > 0 ? 'Añadir materia de grupo' : 'Materia'}
              </label>
              <Select
                placeholder="Seleccionar materia"
                style={{ width: '100%' }}
                value={selectedSubjectId}
                onChange={(val) => { setSelectedSubjectId(val); setSelectedTeacherId(null); }}
                options={availableOptions.map(o => ({
                  value: o.subjectId,
                  label: `${o.subjectName}${o.allowConsecutiveBlocks ? ' ⚡' : ''}${o.subjectGroupId ? ' 👥' : ''}`,
                }))}
                showSearch
                optionFilterProp="label"
                allowClear
              />
            </div>

            {selectedOption && (
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                  Profesor {selectedOption.teachers.length === 0 && <span className="text-red-500">(sin asignar)</span>}
                </label>
                <Select
                  placeholder="Seleccionar profesor"
                  style={{ width: '100%' }}
                  value={selectedTeacherId}
                  onChange={(val) => { setSelectedTeacherId(val); onTeacherChange(val); }}
                  options={selectedOption.teachers.map(t => ({ value: t.teacherId, label: t.teacherName }))}
                  allowClear
                  disabled={selectedOption.teachers.length === 0}
                />
              </div>
            )}

            {selectedOption?.subjectGroupId && !hasGroup && (
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">Materia de grupo</label>
                <Switch
                  checked={isGroup}
                  onChange={setIsGroup}
                  checkedChildren="Sí"
                  unCheckedChildren="No"
                />
                <span className="text-xs text-slate-500 ml-2">Múltiples secciones pueden ver esta materia simultáneamente</span>
              </div>
            )}

            {teacherConflict?.hasConflict && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                message="Conflicto de profesor"
                description={
                  <div>
                    <p className="text-xs mb-1">Este profesor ya tiene clase en este bloque:</p>
                    {teacherConflict.conflicts.map((c: any, i: number) => (
                      <div key={i} className="text-xs">
                        • {c.schedule?.section?.periodGrade?.grade?.name} {c.schedule?.section?.section?.name} — {c.subject?.name}
                      </div>
                    ))}
                  </div>
                }
              />
            )}

            {selectedOption && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded p-2">
                <strong>Bloques semanales requeridos:</strong> {selectedOption.weeklyBlocks}
                {selectedOption.allowConsecutiveBlocks && <span className="ml-2 text-purple-600">⚡ Permite bloques consecutivos</span>}
              </div>
            )}

            {blockPeriods.length > 1 && (
              <div className="text-xs text-blue-700 bg-blue-50 rounded p-2 border border-blue-200">
                <strong>Se asignará a {blockPeriods.length} horas académicas consecutivas:</strong>
                <div className="mt-1">
                  {blockPeriods.map((p, i) => (
                    <span key={p.id} className="inline-block mr-1">
                      {i > 0 && <span className="text-slate-400">→ </span>}
                      <span className="font-medium">{p.start}–{p.end}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          cellEntries.length > 0 && hasNonGroup && (
            <div className="text-xs text-amber-700 bg-amber-50 rounded p-2 border border-amber-200">
              Este bloque ya tiene una materia regular asignada. No se pueden añadir más materias.
            </div>
          )
        )}
      </div>
    </Modal>
  );
};

// ── Main Component ──
const ScheduleManagement: React.FC = () => {
  const { activePeriod } = useSchool();
  const [activeTab, setActiveTab] = useState('sections');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Section view state
  const [sectionsList, setSectionsList] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<number | undefined>();
  const [sectionSchedule, setSectionSchedule] = useState<any>(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cellModalOpen, setCellModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ day: string; period: Period } | null>(null);
  const [sectionOptions, setSectionOptions] = useState<SectionOption[]>([]);
  const [teacherConflict, setTeacherConflict] = useState<{ hasConflict: boolean; conflicts: any[] } | null>(null);
  const [saving, setSaving] = useState(false);

  // Teacher view state
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | undefined>();
  const [teacherEntries, setTeacherEntries] = useState<any[]>([]);
  const [teacherLoading, setTeacherLoading] = useState(false);

  const scheduleSections = useMemo(() => buildSections(settings), [settings]);

  // Load settings
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/settings');
        setSettings(res.data);
      } catch (e) {
        console.error('Error loading settings:', e);
      }
    };
    load();
  }, []);

  // Load sections list
  const loadSections = useCallback(async () => {
    if (!activePeriod) return;
    try {
      const res = await api.get(`/academic/structure/${activePeriod.id}`);
      // structure is PeriodGrade[] with { grade, sections: [{ id, name, PeriodGradeSection: { id, color } }] }
      // Use PeriodGradeSection.id as unique key (a Section can belong to multiple grades)
      const flat: any[] = [];
      (res.data || []).forEach((pg: any) => {
        (pg.sections || []).forEach((s: any) => {
          const pgsId = s.PeriodGradeSection?.id ?? s.id;
          flat.push({
            id: pgsId,
            sectionId: s.id,
            label: `${pg.grade?.name ?? ''} - ${s.name ?? ''}`,
            gradeName: pg.grade?.name,
            sectionName: s.name,
          });
        });
      });
      flat.sort((a, b) => a.label.localeCompare(b.label));
      setSectionsList(flat);
    } catch (e) {
      console.error('Error loading sections:', e);
    }
  }, [activePeriod]);

  // Load teachers list
  const loadTeachers = useCallback(async () => {
    try {
      const res = await api.get('/teachers');
      const flat = (res.data || []).map((t: any) => ({
        id: t.teacherId ?? t.personId ?? t.id,
        label: `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim(),
      }));
      flat.sort((a, b) => a.label.localeCompare(b.label));
      setTeachersList(flat);
    } catch (e) {
      console.error('Error loading teachers:', e);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadSections(), loadTeachers()]);
      setLoading(false);
    };
    load();
  }, [loadSections, loadTeachers]);

  // Load section schedule
  const loadSectionSchedule = useCallback(async (sectionId: number) => {
    if (!activePeriod) return;
    setSectionLoading(true);
    try {
      const createRes = await api.post('/schedules', { schoolPeriodId: activePeriod.id, periodGradeSectionId: sectionId });
      const scheduleId = createRes.data.id;
      const res = await api.get(`/schedules/${scheduleId}`);
      setSectionSchedule(res.data);
      setDirty(false);
      // Load options (subjects + teachers for this section)
      const optRes = await api.get(`/schedules/section/${sectionId}/options`);
      setSectionOptions(optRes.data || []);
    } catch (e) {
      console.error('Error loading section schedule:', e);
      message.error('Error al cargar el horario de la sección');
    } finally {
      setSectionLoading(false);
    }
  }, [activePeriod]);

  // Load teacher schedule
  const loadTeacherSchedule = useCallback(async (personId: number) => {
    if (!activePeriod) return;
    setTeacherLoading(true);
    try {
      const res = await api.get(`/schedules/teacher/${personId}`, { params: { schoolPeriodId: activePeriod.id } });
      setTeacherEntries(res.data || []);
    } catch (e) {
      console.error('Error loading teacher schedule:', e);
      message.error('Error al cargar el horario del profesor');
    } finally {
      setTeacherLoading(false);
    }
  }, [activePeriod]);

  useEffect(() => {
    if (selectedSectionId) loadSectionSchedule(selectedSectionId);
  }, [selectedSectionId, loadSectionSchedule]);

  useEffect(() => {
    if (selectedTeacherId) loadTeacherSchedule(selectedTeacherId);
  }, [selectedTeacherId, loadTeacherSchedule]);

  // Build entries map for section schedule (editable copy when in edit mode)
  // entries: Record<string, ScheduleEntryData[]> — supports multiple group subjects per cell
  const [editableEntries, setEditableEntries] = useState<Record<string, ScheduleEntryData[]>>({});

  const sectionEntriesMap = useMemo<Record<string, ScheduleEntryData[]>>(() => {
    const map: Record<string, ScheduleEntryData[]> = {};
    if (editMode) {
      Object.entries(editableEntries).forEach(([key, arr]) => {
        map[key] = arr;
      });
    } else if (Array.isArray(sectionSchedule?.entries)) {
      sectionSchedule!.entries.forEach((e: any) => {
        const key = `${e.day}|${e.periodId}`;
        if (!map[key]) map[key] = [];
        map[key].push({
          id: e.id,
          day: e.day,
          periodId: e.periodId,
          subjectId: e.subjectId,
          teacherId: e.teacherId,
          isGroupSubject: e.isGroupSubject,
          subject: e.subject,
          teacher: e.teacher,
        });
      });
    }
    return map;
  }, [sectionSchedule, editableEntries, editMode]);

  // Build entries map for teacher schedule — wrap in array for ScheduleGrid compatibility
  const teacherEntriesMap = useMemo<Record<string, any[]>>(() => {
    const map: Record<string, any[]> = {};
    teacherEntries.forEach((e: any) => {
      const key = `${e.day}|${e.periodId}`;
      const sec = e.schedule?.section;
      const gradeName = sec?.periodGrade?.grade?.name ?? '';
      const sectionName = sec?.section?.name ?? '';
      if (!map[key]) map[key] = [];
      map[key].push({
        subjectName: e.subject?.name,
        sectionLabel: `${gradeName} ${sectionName}`.trim(),
        isGroup: e.isGroupSubject,
      });
    });
    return map;
  }, [teacherEntries]);

  // Enter edit mode
  const enterEditMode = () => {
    const map: Record<string, ScheduleEntryData[]> = {};
    if (sectionSchedule?.entries) {
      sectionSchedule.entries.forEach((e: any) => {
        const key = `${e.day}|${e.periodId}`;
        if (!map[key]) map[key] = [];
        map[key].push({ ...e });
      });
    }
    setEditableEntries(map);
    setEditMode(true);
  };

  const exitEditMode = () => {
    setEditMode(false);
    setEditableEntries({});
    setDirty(false);
  };

  // Cell click handler
  const handleCellClick = async (day: string, period: Period) => {
    if (!editMode) return;
    const key = `${day}|${period.id}`;
    const cellEntries = editableEntries[key] ?? [];
    setEditingCell({ day, period });
    setCellModalOpen(true);
    setTeacherConflict(null);

    // If any entry has a teacher, check for conflicts across all block periods
    const teachersToCheck = Array.from(new Set(cellEntries.map(e => e.teacherId).filter((t): t is number => t !== null)));
    if (teachersToCheck.length > 0) {
      const blockSize = Number(settings.min_academic_hours_per_block) || 1;
      const blockPds = getBlockPeriods(scheduleSections, period, blockSize);
      try {
        const allConflicts: any[] = [];
        for (const teacherId of teachersToCheck) {
          for (const p of blockPds) {
            const res = await api.get('/schedules/conflicts', {
              params: {
                day,
                periodId: p.id,
                teacherId,
                scheduleId: sectionSchedule?.id,
                schoolPeriodId: activePeriod?.id,
              },
            });
            if (res.data?.hasConflict) allConflicts.push(...res.data.conflicts);
          }
        }
        setTeacherConflict({ hasConflict: allConflicts.length > 0, conflicts: allConflicts });
      } catch (e) {
        console.error('Error checking conflict:', e);
      }
    }
  };

  // Save cell from modal — adds a new entry to all block periods
  const handleSaveCell = (data: { subjectId: number | null; teacherId: number | null; isGroupSubject: boolean }) => {
    if (!editingCell || !data.subjectId) return;
    const blockSize = Number(settings.min_academic_hours_per_block) || 1;
    const blockPds = getBlockPeriods(scheduleSections, editingCell.period, blockSize);
    const subjectObj = sectionOptions.find(o => o.subjectId === data.subjectId);
    const teacherObj = data.teacherId ? sectionOptions.flatMap(o => o.teachers).find(t => t.teacherId === data.teacherId) : undefined;
    setEditableEntries(prev => {
      const copy = { ...prev };
      blockPds.forEach(p => {
        const key = `${editingCell.day}|${p.id}`;
        const arr = copy[key] ? [...copy[key]] : [];
        // Replace if same subjectId already exists, otherwise add
        const idx = arr.findIndex(e => e.subjectId === data.subjectId);
        const newEntry: ScheduleEntryData = {
          day: editingCell.day,
          periodId: p.id,
          subjectId: data.subjectId,
          teacherId: data.teacherId,
          isGroupSubject: data.isGroupSubject,
          subject: subjectObj ? { id: data.subjectId!, name: subjectObj.subjectName, subjectGroupId: subjectObj.subjectGroupId } : undefined,
          teacher: teacherObj ? { id: data.teacherId!, firstName: teacherObj.teacherName, lastName: '' } : undefined,
        };
        if (idx >= 0) arr[idx] = newEntry;
        else arr.push(newEntry);
        copy[key] = arr;
      });
      return copy;
    });
    setDirty(true);
    setCellModalOpen(false);
    setEditingCell(null);
  };

  // Remove a single entry (by subjectId) from all block periods
  const handleRemoveEntry = (subjectId: number) => {
    if (!editingCell) return;
    const blockSize = Number(settings.min_academic_hours_per_block) || 1;
    const blockPds = getBlockPeriods(scheduleSections, editingCell.period, blockSize);
    setEditableEntries(prev => {
      const copy = { ...prev };
      blockPds.forEach(p => {
        const key = `${editingCell.day}|${p.id}`;
        if (copy[key]) {
          const filtered = copy[key].filter(e => e.subjectId !== subjectId);
          if (filtered.length === 0) delete copy[key];
          else copy[key] = filtered;
        }
      });
      return copy;
    });
    setDirty(true);
    // Don't close modal — user might want to add another
  };

  // Clear all entries from all block periods
  const handleClearAll = () => {
    if (!editingCell) return;
    const blockSize = Number(settings.min_academic_hours_per_block) || 1;
    const blockPds = getBlockPeriods(scheduleSections, editingCell.period, blockSize);
    setEditableEntries(prev => {
      const copy = { ...prev };
      blockPds.forEach(p => {
        const key = `${editingCell.day}|${p.id}`;
        delete copy[key];
      });
      return copy;
    });
    setDirty(true);
    setCellModalOpen(false);
    setEditingCell(null);
  };

  // Check conflict when teacher changes in modal — check across all block periods
  const handleModalTeacherChange = async (teacherId: number | null) => {
    if (!editingCell || !teacherId) {
      setTeacherConflict(null);
      return;
    }
    const blockSize = Number(settings.min_academic_hours_per_block) || 1;
    const blockPds = getBlockPeriods(scheduleSections, editingCell.period, blockSize);
    try {
      const allConflicts: any[] = [];
      for (const p of blockPds) {
        const res = await api.get('/schedules/conflicts', {
          params: {
            day: editingCell.day,
            periodId: p.id,
            teacherId,
            scheduleId: sectionSchedule?.id,
            schoolPeriodId: activePeriod?.id,
          },
        });
        if (res.data?.hasConflict) allConflicts.push(...res.data.conflicts);
      }
      setTeacherConflict({ hasConflict: allConflicts.length > 0, conflicts: allConflicts });
    } catch (e) {
      console.error('Error checking conflict:', e);
    }
  };

  // Save all entries — flatten all arrays into a single list
  const handleSaveAll = async () => {
    if (!sectionSchedule) return;
    setSaving(true);
    try {
      const entries = Object.values(editableEntries).flat().map(e => ({
        day: e.day,
        periodId: e.periodId,
        subjectId: e.subjectId,
        teacherId: e.teacherId,
        isGroupSubject: e.isGroupSubject,
      }));
      await api.put(`/schedules/${sectionSchedule.id}/entries`, { entries });
      message.success('Horario guardado');
      setEditMode(false);
      setDirty(false);
      await loadSectionSchedule(selectedSectionId!);
    } catch (e: any) {
      console.error('Error saving schedule:', e);
      const errMsg = e?.response?.data?.message ?? 'Error al guardar el horario';
      message.error(errMsg);
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

  return (
    <div className="p-6">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'sections',
            label: <span><TableOutlined /> Horarios por Sección</span>,
            children: (
              <div>
                <div className="mb-4 flex items-center gap-4 flex-wrap">
                  <Select
                    placeholder="Seleccionar sección"
                    style={{ width: 300 }}
                    value={selectedSectionId}
                    onChange={(v) => { setSelectedSectionId(v); setEditMode(false); }}
                    options={sectionsList.map(s => ({ value: s.id, label: s.label }))}
                    showSearch
                    optionFilterProp="label"
                  />
                  {selectedSectionId && !editMode && (
                    <Button icon={<EditOutlined />} onClick={enterEditMode}>Editar</Button>
                  )}
                  {selectedSectionId && editMode && (
                    <>
                      <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveAll} loading={saving} disabled={!dirty}>
                        Guardar
                      </Button>
                      <Popconfirm
                        title="¿Salir sin guardar?"
                        description={dirty ? "Los cambios se perderán" : "No hay cambios sin guardar"}
                        onConfirm={exitEditMode}
                        disabled={false}
                      >
                        <Button icon={<CloseOutlined />}>Cancelar</Button>
                      </Popconfirm>
                      {dirty && <Tag color="orange">Sin guardar</Tag>}
                    </>
                  )}
                  {selectedSectionId && !editMode && (
                    <Button icon={<ReloadOutlined />} onClick={() => loadSectionSchedule(selectedSectionId)}>Recargar</Button>
                  )}
                </div>
                {!selectedSectionId ? (
                  <Empty description="Seleccione una sección para ver su horario" />
                ) : sectionLoading ? (
                  <div className="flex justify-center p-12"><Spin size="large" /></div>
                ) : (
                  <Card title={`Horario: ${sectionsList.find(s => s.id === selectedSectionId)?.label ?? ''}`}>
                    <ScheduleGrid
                      sections={scheduleSections}
                      entries={sectionEntriesMap}
                      editable={editMode}
                      onCellClick={handleCellClick}
                      getCellLabel={(_day, _period, cellEntries) => {
                        if (cellEntries.length === 0) {
                          return editMode
                            ? <span className="text-blue-400 text-[10px]">+ asignar</span>
                            : <span className="text-slate-300">—</span>;
                        }
                        if (cellEntries.length === 1) {
                          const e = cellEntries[0];
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-slate-800">{e.subject?.name ?? '—'}</span>
                              {e.teacher && (
                                <span className="text-slate-500 text-[10px]">
                                  {e.teacher.firstName} {e.teacher.lastName}
                                </span>
                              )}
                              {e.isGroupSubject && <Tag color="purple" style={{ fontSize: 9, margin: 0 }}>Grupo</Tag>}
                            </div>
                          );
                        }
                        // Multiple group subjects — render as stacked rows
                        return (
                          <div className="flex flex-col gap-1 w-full">
                            {cellEntries.map((e, i) => (
                              <div key={i} className="rounded px-1 py-0.5 text-left" style={{ background: colorForSubject(e.subjectId), borderLeft: '2px solid rgba(0,0,0,0.15)' }}>
                                <div className="font-semibold text-slate-800 leading-tight" style={{ fontSize: 10 }}>{e.subject?.name ?? '—'}</div>
                                <div className="text-slate-500 leading-tight" style={{ fontSize: 9 }}>
                                  {e.teacher ? `${e.teacher.firstName} ${e.teacher.lastName}` : 'Sin profesor'}
                                </div>
                              </div>
                            ))}
                            <Tag color="purple" style={{ fontSize: 8, margin: 0, alignSelf: 'center' }}>👥 Grupo</Tag>
                          </div>
                        );
                      }}
                    />
                  </Card>
                )}
              </div>
            ),
          },
          {
            key: 'teachers',
            label: <span><UserOutlined /> Horarios por Profesor</span>,
            children: (
              <div>
                <div className="mb-4 flex items-center gap-4">
                  <Select
                    placeholder="Seleccionar profesor"
                    style={{ width: 300 }}
                    value={selectedTeacherId}
                    onChange={setSelectedTeacherId}
                    options={teachersList.map(t => ({ value: t.id, label: t.label }))}
                    showSearch
                    optionFilterProp="label"
                  />
                  {selectedTeacherId && (
                    <Button icon={<ReloadOutlined />} onClick={() => loadTeacherSchedule(selectedTeacherId)}>Recargar</Button>
                  )}
                </div>
                {!selectedTeacherId ? (
                  <Empty description="Seleccione un profesor para ver su horario" />
                ) : teacherLoading ? (
                  <div className="flex justify-center p-12"><Spin size="large" /></div>
                ) : (
                  <Card title={`Horario: ${teachersList.find(t => t.id === selectedTeacherId)?.label ?? ''}`}>
                    <ScheduleGrid
                      sections={scheduleSections}
                      entries={teacherEntriesMap as any}
                      editable={false}
                      getCellLabel={(_day, _period, cellEntries: any) => {
                        const entry = Array.isArray(cellEntries) ? cellEntries[0] : cellEntries;
                        if (!entry?.subjectName) return <span className="text-slate-300">—</span>;
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-800">{entry.subjectName}</span>
                            {entry.sectionLabel && <span className="text-slate-500 text-[10px]">{entry.sectionLabel}</span>}
                            {entry.isGroup && <Tag color="purple" style={{ fontSize: 9, margin: 0 }}>Grupo</Tag>}
                          </div>
                        );
                      }}
                    />
                  </Card>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Cell Editor Modal */}
      <CellEditorModal
        open={cellModalOpen}
        day={editingCell?.day ?? ''}
        period={editingCell?.period ?? { id: '', start: '', end: '', section: '' }}
        cellEntries={editingCell ? editableEntries[`${editingCell.day}|${editingCell.period.id}`] ?? [] : []}
        options={sectionOptions}
        onClose={() => { setCellModalOpen(false); setEditingCell(null); setTeacherConflict(null); }}
        onSave={handleSaveCell}
        onRemoveEntry={handleRemoveEntry}
        onClearAll={handleClearAll}
        onTeacherChange={handleModalTeacherChange}
        teacherConflict={teacherConflict}
        blockPeriods={editingCell ? getBlockPeriods(scheduleSections, editingCell.period, Number(settings.min_academic_hours_per_block) || 1) : []}
      />
    </div>
  );
};

export default ScheduleManagement;
