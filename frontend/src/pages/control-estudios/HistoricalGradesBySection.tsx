import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Spin, message, Button, Select } from 'antd';
import { ReloadOutlined, SaveOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import PlantelMultiSelect from '@/components/shared/PlantelMultiSelect';
import { formatGradePadded } from '@/utils/gradeFormat';

/* ── Theme ── */
const T = {
  paper: '#F7F4EC',
  card: '#FFFFFF',
  ink: '#1E2A44',
  inkSoft: '#5B6B85',
  inkFaint: '#8B93A6',
  brass: '#A9814B',
  brassBg: '#EFE3C7',
  hairline: '#DDD5C0',
  headerBg: '#EFEADC',
  red: '#A5393B',
  redBg: '#F8E9E8',
  green: '#3F6C4E',
  greenBg: '#E3ECE4',
};

/* ── Pick black or white text based on background brightness ── */
function readableTextOn(bgHex: string | null | undefined): string {
  if (!bgHex) return T.inkSoft;
  const hex = bgHex.replace('#', '');
  if (hex.length !== 6) return T.inkSoft;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Relative luminance (per WCAG)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#1E2A44' : '#FFFFFF';
}

// Letter codes matching the reference grid
const STATUS_META: Record<string, { label: string; color: string; bg: string; gradeType: string }> = {
  F:  { label: 'Regular',            color: '#3F6C4E', bg: '#E3ECE4', gradeType: 'regular' },
  R:  { label: 'Revisión',          color: '#B5632B', bg: '#F3E3D2', gradeType: 'revision' },
  P:  { label: 'Materia Pendiente',  color: '#35548C', bg: '#E1E7F1', gradeType: 'materia_pendiente' },
  M:  { label: 'Rev. Materia Pend.', color: '#7B4B8C', bg: '#EBE1F1', gradeType: 'revision_materia_pendiente' },
  T:  { label: 'Transferencia',      color: '#5B6B85', bg: '#E8EAF0', gradeType: 'transferencia' },
  E:  { label: 'Equivalencia',       color: '#5B6B85', bg: '#E8EAF0', gradeType: 'equivalencia' },
};
const STATUS_KEYS = Object.keys(STATUS_META);
const GRADE_TYPE_TO_CODE: Record<string, string> = {};
for (const [code, meta] of Object.entries(STATUS_META)) {
  GRADE_TYPE_TO_CODE[meta.gradeType] = code;
}

/* ── Types ── */
interface Student {
  id: number;
  firstName: string;
  lastName: string;
  document: string;
  documentType?: string;
}
interface SubjectItem {
  id: number;
  name: string;
  abbreviation: string;
  subjectGroupId: number | null;
  memberIds: number[];   // all subject ids in this group (or just [id] if no group)
}
interface YearCol {
  schoolPeriodId: number | null;
  periodShort: string | null;
  gradeId: number;
  period: string;
  name: string;
  gradeName: string;
  gradeOrder: number;
  gradeColor: string | null;
  subjects: SubjectItem[];
}
interface GradeEntry {
  personId: number;
  schoolPeriodId: number | null;
  periodShort?: string | null;
  gradeId: number | null;
  subjectId: number;
  subjectGroupId: number | null;
  subjectName: string | null;
  finalScore: number | null;
  status: string | null;
  gradeType: string | null;
  plantelId: number | null;
  plantelName: string | null;
  finalGradeId: number | null;
  inscriptionSubjectId: number | null;
  historicalGradeId?: number | null;
  date: string | null;
  source?: string;
}
interface PlantelItem { id: number; code: string; name: string; }
interface SectionOption { id: number; name: string; gradeName: string; gradeId: number; }
interface PeriodOption { id: number; periodShort: string | null; period: string; name: string; status?: string; }

/* ── Row data: one per student ── */
interface RowData {
  personId: number;
  cedula: string;
  apellidos: string;
  nombres: string;
  plantelIds: number[];      // selected planteles for this student (all years), ordered
  systemPlantelIds: number[]; // planteles that come from system grades (cannot be removed)
  cells: Record<string, CellData>;  // key: `g__${gradeId}__${subjId}` → cell
  groupSubjectNames: Record<string, string>;  // `g__${gradeId}` → editable subject name for group
}
interface CellData {
  score: string;       // "16", ""
  status: string;      // "F", "R", "MP", ...
  date: string;        // "dd/mm/aaaa"
  inst: string;        // "1", "2" (references plantelIds index+1)
  per: string;         // schoolPeriodId as string, "" if unset
  source: string;      // "system", "historical", ""
  finalGradeId: number | null;
  inscriptionSubjectId: number | null;
  historicalGradeId: number | null;
  dirty: boolean;
}

/* ── LocalInput: keeps local state while editing, commits to parent on blur ── */
/* This prevents re-rendering the entire table on every keystroke. */
interface LocalInputProps {
  value: string;
  onCommit: (value: string) => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  registerRef?: (el: HTMLInputElement | null) => void;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  list?: string;
  placeholder?: string;
  readOnly?: boolean;
  style?: React.CSSProperties;
  'data-row'?: number;
  'data-field'?: string;
}
const LocalInput = React.memo(function LocalInput({
  value, onCommit, onFocus, onKeyDown, onPaste, registerRef,
  type = 'text', min, max, step, maxLength, list, placeholder, readOnly, style, ...rest
}: LocalInputProps) {
  const [local, setLocal] = useState(value);
  const focusedRef = useRef(false);
  const lastCommitted = useRef(value);

  // Sync from parent when not focused, or when the parent value changed
  // externally (e.g. multi-cell paste updated rows while this input is focused)
  useEffect(() => {
    if (!focusedRef.current || value !== lastCommitted.current) {
      setLocal(value);
    }
  }, [value]);

  return (
    <input
      {...rest as any}
      type={type}
      min={min}
      max={max}
      step={step}
      maxLength={maxLength}
      list={list}
      placeholder={placeholder}
      readOnly={readOnly}
      style={style}
      ref={registerRef}
      value={local}
      onChange={e => { setLocal(e.target.value); }}
      onFocus={() => { focusedRef.current = true; onFocus?.(); }}
      onBlur={(e) => {
        focusedRef.current = false;
        lastCommitted.current = e.target.value;
        onCommit(e.target.value);
      }}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  );
});

/* ── Inst number resolver ── */
/* System cells store "g__pid:<plantelId>" → resolve to index+1 in plantelIds.
   Historical cells store a plain number string ("1", "2") → return as-is. */
function resolveInstNum(inst: string, plantelIds: number[]): string {
  if (!inst) return '';
  if (inst.startsWith('g__pid:')) {
    const pid = Number(inst.replace('g__pid:', ''));
    const idx = plantelIds.indexOf(pid);
    return idx >= 0 ? String(idx + 1) : '';
  }
  return inst;
}

/* ── LocalDatePicker: simple text input for dates in DD/MM/YYYY format ── */
/* Replaces Ant Design DatePicker — much lighter, allows typing, copy/paste, selection. */
interface LocalDatePickerProps {
  value: string;              // "dd/mm/yyyy" or ""
  onCommit: (value: string) => void;  // receives "dd/mm/yyyy" or ""
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  registerRef?: (el: HTMLInputElement | null) => void;
  readOnly?: boolean;
  style?: React.CSSProperties;
  'data-row'?: number;
  'data-field'?: string;
}

const LocalDatePicker = React.memo(function LocalDatePicker({
  value, onCommit, onFocus, onKeyDown, onPaste, registerRef,
  readOnly, style, ...rest
}: LocalDatePickerProps) {
  const [local, setLocal] = useState(value);
  const focusedRef = useRef(false);
  const lastCommitted = useRef(value);

  useEffect(() => {
    if (!focusedRef.current || value !== lastCommitted.current) {
      setLocal(value);
    }
  }, [value]);

  return (
    <input
      {...rest as any}
      type="text"
      value={local}
      readOnly={readOnly}
      placeholder="dd/mm/aaaa"
      maxLength={10}
      style={style}
      ref={registerRef as any}
      onChange={e => {
        let val = e.target.value;
        // Auto-insert slashes only if the user is NOT typing slashes themselves.
        // If the user types "1/7/22" manually, don't interfere — normalize on blur instead.
        const digits = val.replace(/\D/g, '');
        const prevDigits = local.replace(/\D/g, '');
        const hasSlash = val.includes('/');
        const prevHadSlash = local.includes('/');
        // Only auto-format when: user added a digit (not a slash), no slash was typed yet,
        // and we're growing the digit count
        if (digits.length > prevDigits.length && digits.length <= 8 && !hasSlash && !prevHadSlash) {
          let formatted = '';
          if (digits.length >= 1) formatted = digits.substring(0, 2);
          if (digits.length >= 3) formatted = digits.substring(0, 2) + '/' + digits.substring(2, 4);
          if (digits.length >= 5) formatted = digits.substring(0, 2) + '/' + digits.substring(2, 4) + '/' + digits.substring(4, 8);
          if (digits.length === 3) formatted = digits.substring(0, 2) + '/' + digits.substring(2);
          if (digits.length === 5) formatted = digits.substring(0, 2) + '/' + digits.substring(2, 4) + '/' + digits.substring(4);
          val = formatted;
        }
        setLocal(val);
      }}
      onFocus={() => { focusedRef.current = true; onFocus?.(); }}
      onBlur={(e) => {
        focusedRef.current = false;
        const normalized = normalizeDate(e.target.value);
        lastCommitted.current = normalized;
        onCommit(normalized);
      }}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  );
});

/* ── LocalGroupInput: text input with local state for group subject names ── */
const LocalGroupInput = React.memo(function LocalGroupInput({
  value, onCommit, onFocus, style, readOnly,
}: {
  value: string;
  onCommit: (value: string) => void;
  onFocus?: () => void;
  style?: React.CSSProperties;
  readOnly?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const focusedRef = useRef(false);
  const lastCommitted = useRef(value);

  useEffect(() => {
    if (!focusedRef.current || value !== lastCommitted.current) {
      setLocal(value);
    }
  }, [value]);

  const commit = () => {
    focusedRef.current = false;
    lastCommitted.current = local;
    onCommit(local);
  };

  return (
    <input
      type="text"
      value={local}
      placeholder="—"
      style={style}
      readOnly={readOnly}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => { focusedRef.current = true; onFocus?.(); }}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
});

/* ── Date normalization: accepts "1/7/22", "01/7/2022", "1/07/22", etc → "01/07/2022" ── */
function normalizeDate(input: string): string {
  if (!input || !input.trim()) return '';
  const trimmed = input.trim();
  // Extract parts split by / or - or .
  const parts = trimmed.split(/[\/\-.]/).map(p => p.trim());
  if (parts.length !== 3) return trimmed; // not a date, return as-is
  let [dd, mm, yyyy] = parts;
  // Pad day and month to 2 digits
  dd = dd.padStart(2, '0');
  mm = mm.padStart(2, '0');
  // Expand 2-digit year to 4 digits: 00-30 → 2000-2030, 31-99 → 1931-1999
  if (yyyy.length === 2) {
    const yy = parseInt(yyyy, 10);
    yyyy = yy <= 30 ? `20${yyyy.padStart(2, '0')}` : `19${yyyy.padStart(2, '0')}`;
  }
  // Validate
  const d = parseInt(dd, 10);
  const m = parseInt(mm, 10);
  const y = parseInt(yyyy, 10);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return trimmed; // invalid, return as-is
  return `${dd}/${mm}/${yyyy}`;
}

/* ── Helpers ── */
function emptyCell(): CellData {
  return { score: '', status: 'F', date: '', inst: '', per: '', source: '', finalGradeId: null, inscriptionSubjectId: null, historicalGradeId: null, dirty: false };
}

/* Flat ordered list of field keys for Tab navigation + paste.
   Order: cedula, apellidos, nombres, plantelIds,
   then for each year → for each subject: score, status, date, inst, per */
function buildFieldKeys(years: YearCol[]): string[] {
  const keys: string[] = ['cedula', 'apellidos', 'nombres', 'plantelIds'];
  for (const y of years) {
    for (const subj of y.subjects) {
      const prefix = `g__${y.gradeId}__${subj.id}`;
      keys.push(`${prefix}g__score`);
      keys.push(`${prefix}g__status`);
      keys.push(`${prefix}g__date`);
      keys.push(`${prefix}g__inst`);
      keys.push(`${prefix}g__per`);
    }
  }
  return keys;
}

/* ── Main Component ── */
const HistoricalGradesBySection: React.FC = () => {
  const { settings } = useSchool();
  // System plantel: uses institution_name from settings, with a virtual id of -1
  const SYSTEM_PLANTEL_ID = -1;
  const systemPlantelName = settings.name || 'Institución';
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [activePeriodId, setActivePeriodId] = useState<number | null>(null);
  const [activeGradeOrder, setActiveGradeOrder] = useState<number>(999);
  const [students, setStudents] = useState<Student[]>([]);
  const [years, setYears] = useState<YearCol[]>([]);
  const [planteles, setPlanteles] = useState<PlantelItem[]>([]);
  const [allPeriods, setAllPeriods] = useState<PeriodOption[]>([]);
  const [rows, setRows] = useState<RowData[]>([]);
  const [maxGrade, setMaxGrade] = useState<number>(20);
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const activeCellRef = useRef<{ row: number; field: string } | null>(null);
  // Only store gradeId for header highlighting — updates only when year changes
  const [activeGradeId, setActiveGradeId] = useState<number | null>(null);

  const setActiveCell = useCallback((cell: { row: number; field: string } | null) => {
    activeCellRef.current = cell;
    if (cell) {
      const gradeId = Number(cell.field.split('__')[1]);
      setActiveGradeId(prev => prev === gradeId ? prev : gradeId);
    } else {
      setActiveGradeId(prev => prev === null ? prev : null);
    }
  }, []);

  // Mode: section or individual student
  const [mode, setMode] = useState<'section' | 'individual'>('section');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [studentSearchResults, setStudentSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  // Grade type filter: 'final' | 'revision' | 'materia_pendiente'
  const [gradeTypeFilter, setGradeTypeFilter] = useState<'final' | 'revision' | 'materia_pendiente'>('final');
  // Consolidated view: shows all note types with priority (MP > revision > regular), read-only
  const [consolidated, setConsolidated] = useState(false);

  /* ── Load sections for active period + max_grade ── */
  useEffect(() => {
    (async () => {
      try {
        const activeRes = await api.get('/academic/active');
        const period = activeRes.data;
        if (!period?.id) { message.warning('No hay un período escolar activo'); return; }
        setActivePeriodId(period.id);

        // Load max_grade in parallel (non-blocking)
        api.get('/settings/max_grade').then(res => {
          if (res.data?.max_grade) setMaxGrade(Number(res.data.max_grade));
        }).catch(() => {});

        const structureRes = await api.get(`/academic/structure/${period.id}`);
        const data = Array.isArray(structureRes.data) ? structureRes.data : [];

        // Deduplicate by grade.id (PeriodGrade may have multiple entries per grade due to specializations)
        const seenGradeIds = new Set<number>();
        const gradeOrderMap = new Map<number, number>();
        const secs: SectionOption[] = [];
        for (const s of data) {
          if (!s.grade || seenGradeIds.has(s.grade.id)) continue;
          seenGradeIds.add(s.grade.id);
          gradeOrderMap.set(s.grade.id, s.grade.order ?? 999);
          for (const sec of s.sections) {
            if (sec.name?.toUpperCase() === 'MATERIA PENDIENTE') continue;
            secs.push({ id: sec.id, name: sec.name, gradeName: s.grade.name, gradeId: s.grade.id });
          }
        }
        secs.sort((a, b) => {
          const orderA = gradeOrderMap.get(a.gradeId) ?? 999;
          const orderB = gradeOrderMap.get(b.gradeId) ?? 999;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name, 'es', { numeric: true });
        });
        setSections(secs);
      } catch (err) { console.error(err); message.error('Error al cargar estructura académica'); }
    })();
  }, []);

  /* ── Load grades when section or student is selected ── */
  const loadGrades = useCallback(async () => {
    if (!activePeriodId) return;
    if (mode === 'section' && !selectedSectionId) return;
    if (mode === 'individual' && !selectedStudent) return;

    setLoading(true);
    try {
      const params: any = { schoolPeriodId: activePeriodId };
      if (consolidated) {
        params.consolidated = 'true';
      } else {
        params.gradeTypeFilter = gradeTypeFilter;
      }
      if (mode === 'section') {
        params.sectionId = selectedSectionId;
        if (selectedGradeId) params.gradeId = selectedGradeId;
      } else {
        params.personId = selectedStudent!.id;
      }

      const res = await api.get('/historical-grades/by-section', { params });
      const data = res.data;
      const rawStudents: Student[] = data.students || [];
      const rawYears: YearCol[] = data.years || [];
      const rawGrades: GradeEntry[] = data.grades || [];
      const rawPlanteles: PlantelItem[] = data.planteles || [];
      const rawAllPeriods: PeriodOption[] = data.allPeriods || [];
      const rawPersonPlanteles: Record<number, { plantelId: number | null; order: number; isSystem: boolean }[]> = data.personPlanteles || {};

      // Add the system institution as a virtual plantel (id -1) so it appears in the dropdown
      const plantelesWithSystem = [
        { id: SYSTEM_PLANTEL_ID, code: 'SIST', name: systemPlantelName },
        ...rawPlanteles,
      ];

      setStudents(rawStudents);
      setPlanteles(plantelesWithSystem);
      setAllPeriods(rawAllPeriods);

      // Show all years — the user needs to see and fill all grades (1ro–5to)
      // regardless of which section they're currently viewing.
      // For materia_pendiente, exclude the last year (5to) since there are no pending subjects there.
      setActiveGradeOrder(999);
      const visibleYears = (!consolidated && gradeTypeFilter === 'materia_pendiente')
        ? rawYears.filter(y => y.gradeOrder < 5)
        : rawYears;
      setYears(visibleYears);

      // Build a lookup map: gradeId → realSubjectId → columnKey
      const subjectLookup = new Map<string, string>(); // `g__${gradeId}__${realSubjectId}` → columnKey
      for (const y of visibleYears) {
        for (const subj of y.subjects) {
          for (const memberId of subj.memberIds) {
            subjectLookup.set(`g__${y.gradeId}__${memberId}`, `g__${y.gradeId}__${subj.id}`);
          }
        }
      }

      // Build rows
      const newRows: RowData[] = rawStudents.map(st => {
        const cells: Record<string, CellData> = {};
        const groupNames: Record<string, string> = {};  // `g__${gradeId}` → subject name for group
        for (const g of rawGrades) {
          if (g.personId !== st.id) continue;
          // Match by gradeId first (most reliable), fallback to schoolPeriodId+gradeId
          let key = subjectLookup.get(`g__${g.gradeId}__${g.subjectId}`);
          if (!key && g.schoolPeriodId != null) {
            // Try matching by schoolPeriodId+gradeId for legacy grades
            const yearMatch = visibleYears.find(y => y.schoolPeriodId === g.schoolPeriodId && y.gradeId === g.gradeId);
            if (yearMatch) {
              key = subjectLookup.get(`g__${yearMatch.gradeId}__${g.subjectId}`);
            }
          }
          if (!key) continue;
          // System grades take priority over historical grades for the same cell
          const existing = cells[key];
          if (existing && existing.source === 'system' && g.source !== 'system') continue;
          const statusCode = g.gradeType ? (GRADE_TYPE_TO_CODE[g.gradeType] || 'F') : 'F';
          let dateDisplay = '';
          if (g.date) {
            const parts = g.date.split('-');
            if (parts.length === 3) dateDisplay = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
          let instNum = '';
          if (g.source === 'system') {
            // System grades always belong to the institution's plantel (virtual id -1)
            instNum = `g__pid:${SYSTEM_PLANTEL_ID}`;
          } else if (g.plantelId) {
            instNum = `g__pid:${g.plantelId}`;
          } else {
            // Historical grade with null plantelId → system plantel
            instNum = `g__pid:${SYSTEM_PLANTEL_ID}`;
          }
          cells[key] = {
            score: g.finalScore != null ? formatGradePadded(g.finalScore, maxGrade) : '',
            status: statusCode,
            date: dateDisplay,
            inst: instNum,
            per: g.periodShort ?? '',
            source: g.source ?? '',
            finalGradeId: g.finalGradeId,
            inscriptionSubjectId: g.inscriptionSubjectId,
            historicalGradeId: g.historicalGradeId ?? null,
            dirty: false,
          };
          if (g.subjectGroupId != null && g.subjectName) {
            const gk = `g__${g.gradeId}`;
            // For system grades, use the subject name. For historical grades, use subjectName if saved.
            if (!groupNames[gk]) groupNames[gk] = g.subjectName;
          }
        }

        // Collect plantelIds for this student.
        // Priority: saved personPlanteles (from PersonPlantel table) > reconstruct from grades.
        const savedPlanteles = rawPersonPlanteles[st.id];
        const studentPlantelIds: number[] = [];
        let hasSystemGrades = false;

        if (savedPlanteles && savedPlanteles.length > 0) {
          // Use saved order — system plantel is stored as plantelId=null → use SYSTEM_PLANTEL_ID
          for (const sp of savedPlanteles) {
            const pid = sp.isSystem ? SYSTEM_PLANTEL_ID : sp.plantelId;
            if (pid != null && !studentPlantelIds.includes(pid)) studentPlantelIds.push(pid);
            if (sp.isSystem) hasSystemGrades = true;
          }
        }

        // If no saved planteles, reconstruct from grades
        if (studentPlantelIds.length === 0) {
          for (const g of rawGrades) {
            if (g.personId !== st.id) continue;
            if (g.source === 'system') {
              hasSystemGrades = true;
              if (!studentPlantelIds.includes(SYSTEM_PLANTEL_ID)) studentPlantelIds.push(SYSTEM_PLANTEL_ID);
            } else if (g.plantelId && !studentPlantelIds.includes(g.plantelId)) {
              studentPlantelIds.push(g.plantelId);
            }
          }
        }
        // Ensure system plantel is always present if there are system grades
        if (hasSystemGrades && !studentPlantelIds.includes(SYSTEM_PLANTEL_ID)) {
          studentPlantelIds.unshift(SYSTEM_PLANTEL_ID);
        }

        // cell.inst keeps the plantelId (with prefix "pid:") for system cells.
        // The display number is resolved at render time from plantelIds order.
        // No need to convert here — the number updates automatically when plantelIds is reordered.

        return {
          personId: st.id,
          cedula: `${st.documentType ? st.documentType + ' ' : ''}${st.document}`,
          apellidos: st.lastName,
          nombres: st.firstName,
          plantelIds: studentPlantelIds,
          systemPlantelIds: [...studentPlantelIds],  // snapshot of system planteles
          cells,
          groupSubjectNames: groupNames,
        };
      });

      setRows(newRows);
      plantelChangesRef.current.clear();
      setPlantelDirtyCount(0);
      groupSubjectChangesRef.current.clear();
      setGroupSubjectDirtyCount(0);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.message || 'Error al cargar notas');
    } finally {
      setLoading(false);
    }
  }, [activePeriodId, selectedSectionId, selectedGradeId, selectedStudent, mode, gradeTypeFilter, consolidated, sections, maxGrade]);

  useEffect(() => {
    if (mode === 'section' && selectedSectionId) loadGrades();
    if (mode === 'individual' && selectedStudent) loadGrades();
  }, [selectedSectionId, selectedGradeId, selectedStudent, mode, gradeTypeFilter, consolidated, loadGrades]);

  /* ── Field accessors ── */
  const getField = (row: RowData, key: string): string => {
    if (key === 'cedula') return row.cedula;
    if (key === 'apellidos') return row.apellidos;
    if (key === 'nombres') return row.nombres;
    if (key === 'plantelIds') return row.plantelIds.join(',');
    // cell key format: g__${gradeId}__${subjId}__${field}
    const m = key.match(/^g__(\d+)__(\d+)__(\w+)$/);
    if (m) {
      const cellKey = `g__${m[1]}__${m[2]}`;
      const cell = row.cells[cellKey];
      if (!cell) return '';
      return (cell as any)[m[3]] ?? '';
    }
    return '';
  };

  const setField = (row: RowData, key: string, value: string): RowData => {
    if (key === 'cedula') return { ...row, cedula: value };
    if (key === 'apellidos') return { ...row, apellidos: value };
    if (key === 'nombres') return { ...row, nombres: value };
    if (key === 'plantelIds') {
      const ids = value ? value.split(',').map(Number).filter(n => !isNaN(n)) : [];
      return { ...row, plantelIds: ids };
    }
    const m = key.match(/^g__(\d+)__(\d+)__(\w+)$/);
    if (m) {
      const cellKey = `g__${m[1]}__${m[2]}`;
      const field = m[3] as keyof CellData;
      const cell = row.cells[cellKey] || emptyCell();
      // Skip if value hasn't changed (e.g. blur without editing)
      if ((cell as any)[field] === value) return row;
      // Pad score fields to match maxGrade digit count, and reject values > maxGrade
      let finalValue = value;
      if (field === 'score' && value !== '') {
        const num = Number(value);
        if (isNaN(num)) {
          finalValue = '';
        } else if (num > maxGrade) {
          finalValue = '';  // reject values above maxGrade
        } else {
          finalValue = formatGradePadded(num, maxGrade);
        }
      }
      return {
        ...row,
        cells: { ...row.cells, [cellKey]: { ...cell, [field]: finalValue, dirty: true } },
      };
    }
    return row;
  };

  const updateCell = (rowIdx: number, key: string, value: string) => {
    setRows(prev => prev.map((r, i) => i === rowIdx ? setField(r, key, value) : r));
  };

  const plantelChangesRef = useRef<Set<number>>(new Set());

  const updatePlantelIds = useCallback((rowIdx: number, ids: number[]) => {
    setRows(prev => prev.map((r, i) => {
      if (i === rowIdx) {
        plantelChangesRef.current.add(r.personId);
        return { ...r, plantelIds: ids };
      }
      return r;
    }));
    setPlantelDirtyCount(plantelChangesRef.current.size);
  }, []);

  // Track group subject name changes: { personId_gradeId → newName }
  const groupSubjectChangesRef = useRef<Set<string>>(new Set());
  const [groupSubjectDirtyCount, setGroupSubjectDirtyCount] = useState(0);

  const updateGroupSubjectName = useCallback((rowIdx: number, gk: string, value: string) => {
    setRows(prev => prev.map((r, i) => {
      if (i === rowIdx) {
        groupSubjectChangesRef.current.add(`${r.personId}_${gk}`);
        return { ...r, groupSubjectNames: { ...r.groupSubjectNames, [gk]: value } };
      }
      return r;
    }));
    setGroupSubjectDirtyCount(groupSubjectChangesRef.current.size);
  }, []);

  /* ── Ref management ── */
  const registerRef = (rowIdx: number, key: string) => (el: HTMLInputElement | HTMLSelectElement | null) => {
    inputRefs.current[`${rowIdx}__${key}`] = el;
  };
  const focusCell = (rowIdx: number, key: string) => {
    const el = inputRefs.current[`${rowIdx}__${key}`] as any;
    if (el) {
      if (typeof el.focus === 'function') el.focus();
      if (typeof el.select === 'function') el.select();
    }
  };

  /* ── Keyboard navigation ── */
  const fieldKeys = useMemo(() => buildFieldKeys(years), [years]);

  // Periods available for the "Per." dropdown: only past periods (historico/externo),
  // excluding the active period and future periods. Deduplicated by periodShort.
  const editablePeriods = useMemo(() => {
    const seen = new Set<string>();
    return allPeriods.filter(p => {
      if (p.status !== 'historico' && p.status !== 'externo') return false;
      const key = p.periodShort ?? p.period;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allPeriods]);

  const handleKeyDown = (e: React.KeyboardEvent, rowIdx: number, key: string) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setActiveCell(null);
      (e.target as HTMLElement).blur();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const dir = e.shiftKey ? -1 : 1;
      const targetRow = rowIdx + dir;
      if (targetRow < 0) return;
      if (targetRow >= rows.length) {
        // Don't create new rows — students are fixed from the section
        return;
      }
      focusCell(targetRow, key);
    } else if (e.key === 'Tab') {
      // Let native Tab work but wrap to next row at end
      const colIdx = fieldKeys.indexOf(key);
      if (!e.shiftKey && colIdx === fieldKeys.length - 1) {
        e.preventDefault();
        if (rowIdx + 1 < rows.length) focusCell(rowIdx + 1, fieldKeys[0]);
      } else if (e.shiftKey && colIdx === 0) {
        e.preventDefault();
        if (rowIdx - 1 >= 0) focusCell(rowIdx - 1, fieldKeys[fieldKeys.length - 1]);
      }
    }
  };

  /* ── Paste from Excel ── */
  const handlePaste = (e: React.ClipboardEvent, rowIdx: number, key: string) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\t') && !text.includes('\n')) return; // let native single-cell paste
    e.preventDefault();
    const grid = text
      .split(/\r\n|\n|\r/)
      .filter((line, idx, arr) => !(idx === arr.length - 1 && line === ''))
      .map(line => line.split('\t'));
    const startCol = fieldKeys.indexOf(key);

    setRows(prev => {
      const next = [...prev];
      grid.forEach((lineVals, ri) => {
        const targetRow = rowIdx + ri;
        if (targetRow >= next.length) return; // don't create new students
        let row = next[targetRow];
        lineVals.forEach((val, ci) => {
          const fk = fieldKeys[startCol + ci];
          if (!fk) return;
          row = setField(row, fk, val.trim());
        });
        next[targetRow] = row;
      });
      return next;
    });
  };

  /* ── Save ── */
  const [plantelDirtyCount, setPlantelDirtyCount] = useState(0);
  const dirtyCount = useMemo(() => {
    let c = 0;
    for (const row of rows) {
      for (const key of Object.keys(row.cells)) {
        if (row.cells[key].dirty) c++;
      }
    }
    // Add plantel and group subject changes count
    c += plantelDirtyCount + groupSubjectDirtyCount;
    return c;
  }, [rows, plantelDirtyCount]);

  const handleSave = async () => {
    const changes: any[] = [];
    for (const row of rows) {
      for (const [cellKey, cell] of Object.entries(row.cells)) {
        if (!cell.dirty) continue;
        const parts = cellKey.split('__');
        const gradeId = Number(parts[1]);
        const subjId = Number(parts[2]);
        // Map inst → plantelId
        // System cells: cell.inst = "g__pid:<plantelId>" → extract directly
        //   (SYSTEM_PLANTEL_ID = -1 → send null to backend, it's the institution's own plantel)
        // Historical cells: cell.inst = "1", "2" → map via plantelIds[index-1]
        let plantelId: number | null = null;
        if (cell.inst && cell.inst.trim() !== '') {
          if (cell.inst.startsWith('g__pid:')) {
            const pid = Number(cell.inst.replace('g__pid:', ''));
            plantelId = (pid === SYSTEM_PLANTEL_ID || !pid) ? null : pid;
          } else {
            const instNum = parseInt(cell.inst, 10);
            if (!isNaN(instNum) && instNum >= 1 && instNum <= row.plantelIds.length) {
              const mappedId = row.plantelIds[instNum - 1];
              plantelId = (mappedId === SYSTEM_PLANTEL_ID) ? null : mappedId;
            } else if (!isNaN(instNum) && instNum === 1 && row.plantelIds.length === 0) {
              // No planteles assigned but user wrote "1" → assume system plantel (null)
              plantelId = null;
            }
          }
        }
        // Convert dd/mm/aaaa → yyyy-mm-dd
        let dateStr: string | null = null;
        if (cell.date) {
          const parts = cell.date.split('/');
          if (parts.length === 3) dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        const gradeType = STATUS_META[cell.status]?.gradeType || 'regular';
        // cell.per is a periodShort (e.g. "03/04") or a YYYY-YYYY string (e.g. "2003-2004")
        // or empty. The backend resolves it: finds existing SchoolPeriod or creates a new one.
        // Only send periodLabel if the cell has one; don't fallback to the year's periodShort
        // (which could be the active period and get rejected by the backend).
        const cellPer = cell.per || null;
        // Get the group subject name if this subject belongs to a group
        const groupKey = `g__${gradeId}`;
        const subjName = row.groupSubjectNames[groupKey] || null;
        changes.push({
          personId: row.personId,
          periodLabel: cellPer,
          gradeId,
          subjectId: subjId,
          historicalGradeId: cell.historicalGradeId,
          finalScore: (cell.score === '' || Number(cell.score) === 0) ? null : Number(cell.score),
          gradeType,
          plantelId,
          finalGradeId: cell.finalGradeId,
          inscriptionSubjectId: cell.inscriptionSubjectId,
          date: dateStr,
          subjectName: subjName,
        });
      }
    }

    const hasPlantelChanges = plantelChangesRef.current.size > 0;
    const hasGroupSubjectChanges = groupSubjectChangesRef.current.size > 0;

    if (changes.length === 0 && !hasPlantelChanges && !hasGroupSubjectChanges) { message.info('No hay cambios para guardar'); return; }

    setSaving(true);
    try {
      // Save note changes (if any)
      if (changes.length > 0) {
        const res = await api.post('/historical-grades/save', { changes });
        message.success(`${res.data.saved} nota${res.data.saved !== 1 ? 's' : ''} guardada${res.data.saved !== 1 ? 's' : ''}`);
        if (res.data.errors?.length > 0) {
          for (const err of res.data.errors) message.error(err);
        }
      }

      // Save plantelIds for students that had plantel changes
      const plantelSaves: Promise<any>[] = [];
      for (const row of rows) {
        if (!plantelChangesRef.current.has(row.personId)) continue;
        const plantelesPayload = row.plantelIds.map(pid => ({
          plantelId: pid,
          isSystem: pid === SYSTEM_PLANTEL_ID,
        }));
        plantelSaves.push(
          api.post('/historical-grades/person-planteles', {
            personId: row.personId,
            planteles: plantelesPayload,
          })
        );
      }
      if (plantelSaves.length > 0) {
        await Promise.all(plantelSaves);
        plantelChangesRef.current.clear();
        setPlantelDirtyCount(0);
        if (changes.length === 0) {
          message.success(`Planteles guardados (${plantelSaves.length})`);
        }
      }
      // Save group subject names for students that had changes
      const groupSaves: Promise<any>[] = [];
      for (const row of rows) {
        for (const gk of Object.keys(row.groupSubjectNames)) {
          const changeKey = `${row.personId}_${gk}`;
          if (!groupSubjectChangesRef.current.has(changeKey)) continue;
          const gradeId = Number(gk.replace('g__', ''));
          groupSaves.push(
            api.post('/historical-grades/group-subject-name', {
              personId: row.personId,
              gradeId,
              subjectName: row.groupSubjectNames[gk] || '',
            })
          );
        }
      }
      if (groupSaves.length > 0) {
        await Promise.all(groupSaves);
        groupSubjectChangesRef.current.clear();
        setGroupSubjectDirtyCount(0);
        if (changes.length === 0 && plantelSaves.length === 0) {
          message.success(`Materias guardadas (${groupSaves.length})`);
        }
      }

      await loadGrades();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  /* ── Column layout ── */
  const COL = { n: 34, cedula: 84, apellidos: 118, nombres: 118, inst: 200 };
  const leftOf = {
    n: 0,
    cedula: COL.n,
    apellidos: COL.n + COL.cedula,
    nombres: COL.n + COL.cedula + COL.apellidos,
    inst: COL.n + COL.cedula + COL.apellidos + COL.nombres,
  };
  const frozenWidth = COL.n + COL.cedula + COL.apellidos + COL.nombres + COL.inst;
  const SUB_W = 44 + 44 + 88 + 40 + 53; // = 269 per subject (score, status, date, inst, per)
  const GROUP_COL_W = 130;        // extra column for group subject name
  // Years that have at least one group subject get an extra trailing column
  const yearHasGroups = (y: YearCol) => y.subjects.some(s => s.subjectGroupId !== null);
  const totalTableWidth = frozenWidth + years.reduce((s, y) =>
    s + y.subjects.length * SUB_W + (yearHasGroups(y) ? GROUP_COL_W : 0), 0);

  const cellInputStyle: React.CSSProperties = {
    width: '100%', border: 'none', outline: 'none', background: 'transparent',
    fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: T.ink, padding: '3px 4px',
  };

  return (
    <div style={{ background: T.paper, minHeight: '100%', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .hg-grid input:focus, .hg-grid select:focus { background: #FFF7DE !important; box-shadow: inset 0 0 0 1.5px #A9814B; }
        .hg-row:hover td { background: #F6F0DE !important; }
        .hg-row:focus-within td { background: #FDF6E3 !important; }
        .hg-row:focus-within td.hg-frozen { background: #FBF1D3 !important; }
        .hg-row:focus-within td:hover { background: #F6E9C4 !important; }
        .hg-row:focus-within .hg-row-num { color: #A9814B !important; font-weight: 700 !important; }
      `}</style>

      <div className="px-5 py-4">
        {/* Header / toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>Notas Históricas</h1>
            <p style={{ fontSize: 12, color: T.inkFaint }}>
              {students.length} estudiantes · {years.length} años · {dirtyCount > 0 ? `${dirtyCount} cambios sin guardar` : 'Sin cambios'}
              · Tab para moverte, Enter para bajar de fila, pega bloques desde Excel
              · Las celdas grises son notas del sistema (no editable)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Consolidated view toggle (eye) */}
            <Button
              type={consolidated ? 'primary' : 'default'}
              icon={consolidated ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              onClick={() => setConsolidated(c => !c)}
              title="Vista consolidada: muestra todas las notas con prioridad (Materia Pendiente > Revisión > Regular). Solo lectura."
              style={{ display: 'flex', alignItems: 'center' }}
            />
            <span
              onClick={() => setConsolidated(c => !c)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: consolidated ? '#1677FF' : '#BFBFBF',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              Vista Consolidada
            </span>
            {/* Grade type filter */}
            <Select
              value={gradeTypeFilter}
              onChange={(val) => setGradeTypeFilter(val)}
              disabled={consolidated}
              style={{ width: 170 }}
              options={[
                { value: 'final', label: 'Final' },
                { value: 'revision', label: 'Revisión' },
                { value: 'materia_pendiente', label: 'Materia Pendiente' },
              ]}
            />

            {/* Mode toggle */}
            <Select
              value={mode}
              onChange={(val) => {
                setMode(val);
                setSelectedSectionId(null);
                setSelectedGradeId(null);
                setSelectedStudent(null);
                setStudentSearch('');
                setStudentSearchResults([]);
                setRows([]);
                setStudents([]);
                plantelChangesRef.current.clear();
                setPlantelDirtyCount(0);
                groupSubjectChangesRef.current.clear();
                setGroupSubjectDirtyCount(0);
              }}
              style={{ width: 160 }}
              options={[
                { value: 'section', label: 'Por sección' },
                { value: 'individual', label: 'Estudiante individual' },
              ]}
            />

            {mode === 'section' && (
              <Select
                value={selectedSectionId != null && selectedGradeId != null
                  ? `${selectedGradeId}-${selectedSectionId}`
                  : undefined}
                onChange={(val) => {
                  const sec = sections.find(s => `${s.gradeId}-${s.id}` === val);
                  setSelectedSectionId(sec?.id ?? null);
                  setSelectedGradeId(sec?.gradeId ?? null);
                }}
                placeholder="Seleccionar sección…"
                style={{ width: 220 }}
                showSearch
                optionFilterProp="label"
                options={sections.map(s => ({ value: `${s.gradeId}-${s.id}`, label: `${s.gradeName} — ${s.name}` }))}
              />
            )}

            {mode === 'individual' && (
              <Select
                showSearch
                value={selectedStudent?.id}
                onChange={(val) => {
                  const st = studentSearchResults.find(s => s.id === val);
                  setSelectedStudent(st ?? null);
                }}
                onSearch={async (search) => {
                  setStudentSearch(search);
                  if (search.length >= 2) {
                    try {
                      const res = await api.get('/users', { params: { q: search, role: 'Alumno' } });
                      const results = (res.data?.users || res.data || []).map((u: any) => ({
                        id: u.personId || u.id,
                        firstName: u.firstName,
                        lastName: u.lastName,
                        document: u.document || '',
                        documentType: u.documentType || '',
                      }));
                      setStudentSearchResults(results);
                    } catch { setStudentSearchResults([]); }
                  } else {
                    setStudentSearchResults([]);
                  }
                }}
                filterOption={false}
                placeholder="Buscar estudiante…"
                style={{ width: 280 }}
                options={studentSearchResults.map(s => ({
                  value: s.id,
                  label: `${s.lastName || ''} ${s.firstName || ''} ${s.document ? `· ${s.documentType || ''}${s.document}` : ''}`.trim(),
                }))}
              />
            )}

            <Button icon={<ReloadOutlined />} onClick={loadGrades}
              disabled={(mode === 'section' && !selectedSectionId) || (mode === 'individual' && !selectedStudent) || loading}>
              Actualizar
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} disabled={consolidated || dirtyCount === 0 || saving} loading={saving}>
              Guardar ({dirtyCount})
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 px-3 py-2 rounded-md"
          style={{ background: T.card, border: `1px solid ${T.hairline}`, fontSize: 11, color: T.inkSoft }}>
          <span style={{ color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Convención</span>
          {STATUS_KEYS.map(k => (
            <span key={k} className="flex items-center gap-1">
              <span style={{ width: 9, height: 9, borderRadius: 3, background: STATUS_META[k].color, display: 'inline-block' }} />
              {k} = {STATUS_META[k].label}
            </span>
          ))}
          <span>Inst = número de la lista de instituciones de esa fila</span>
          <span className="flex items-center gap-1">
            <span style={{ width: 9, height: 9, borderRadius: 3, background: '#F0F0F0', border: `1px solid ${T.hairline}`, display: 'inline-block' }} />
            Gris = nota del sistema (no editable)
          </span>
        </div>

        <Spin spinning={loading}>
          {rows.length > 0 && years.length > 0 ? (
            <div
              className="hg-grid"
              style={{ overflow: 'auto', maxHeight: 'calc(100vh - 280px)', border: `1px solid ${T.hairline}`, borderRadius: 10, background: T.card }}
              onPaste={(e) => {
                const el = document.activeElement as any;
                const rk = el?.dataset?.row;
                const fk = el?.dataset?.field;
                if (rk !== undefined && fk) handlePaste(e as any, Number(rk), fk);
              }}
            >
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', width: totalTableWidth }}>
                <colgroup>
                  <col style={{ width: COL.n }} />
                  <col style={{ width: COL.cedula }} />
                  <col style={{ width: COL.apellidos }} />
                  <col style={{ width: COL.nombres }} />
                  <col style={{ width: COL.inst }} />
                  {years.map(y => (
                    <React.Fragment key={`col-year-${y.schoolPeriodId}-${y.gradeId}`}>
                      {y.subjects.map((subj) => (
                        <React.Fragment key={`col-${y.schoolPeriodId}-${y.gradeId}-${subj.id}`}>
                          <col style={{ width: 44 }} />
                          <col style={{ width: 44 }} />
                          <col style={{ width: 88 }} />
                          <col style={{ width: 40 }} />
                          <col style={{ width: 53 }} />
                        </React.Fragment>
                      ))}
                      {yearHasGroups(y) && <col style={{ width: GROUP_COL_W }} />}
                    </React.Fragment>
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th key="h-n" rowSpan={2} style={{ ...thFrozen(leftOf.n, COL.n), zIndex: 5 }}>N°</th>
                    <th key="h-ced" rowSpan={2} style={{ ...thFrozen(leftOf.cedula, COL.cedula), zIndex: 5 }}>Cédula</th>
                    <th key="h-ap" rowSpan={2} style={{ ...thFrozen(leftOf.apellidos, COL.apellidos), zIndex: 5 }}>Apellidos</th>
                    <th key="h-nom" rowSpan={2} style={{ ...thFrozen(leftOf.nombres, COL.nombres), zIndex: 5 }}>Nombres</th>
                    <th key="h-inst" rowSpan={2} style={{ ...thFrozen(leftOf.inst, COL.inst), zIndex: 5, textAlign: 'left', borderRight: `2px solid ${T.hairline}` }}>Instituciones</th>
                    {years.map(y => {
                      const hasGrp = yearHasGroups(y);
                      const span = y.subjects.length * 5 + (hasGrp ? 1 : 0);
                      const width = y.subjects.length * SUB_W + (hasGrp ? GROUP_COL_W : 0);
                      const gc = y.gradeColor || T.hairline;
                      const isActiveYear = activeGradeId === y.gradeId;
                      const headerBg = y.gradeColor || (isActiveYear ? T.brassBg : T.headerBg);
                      return (
                        <th key={`y-${y.gradeId}`} colSpan={span}
                          style={{ ...thPlain(width), borderLeft: `3px solid ${T.hairline}`, borderTop: `3px solid ${gc}`, fontSize: 14, fontWeight: 700,
                            background: headerBg, color: '#FFFFFF' }}>
                          {y.gradeName}
                        </th>
                      );
                    })}
                  </tr>
                  <tr>
                    {years.map(y => {
                      const isActiveYear = activeGradeId === y.gradeId;
                      return (
                      <React.Fragment key={`s-row-${y.gradeId}`}>
                        {y.subjects.map((subj, si) => (
                          <th key={`s-${y.gradeId}-${subj.id}`} colSpan={5} title={subj.name}
                            style={{ ...thSub(254), borderLeft: si === 0 ? `3px solid ${y.gradeColor || T.hairline}` : `2px solid ${y.gradeColor || T.hairline}`,
                              background: isActiveYear ? '#F3E5C4' : T.headerBg, color: '#000000', textTransform: 'uppercase', fontSize: 10 }}>
                            {subj.name}
                          </th>
                        ))}
                        {yearHasGroups(y) && (
                          <th key={`s-grp-${y.gradeId}`} title="Materia del grupo cursada"
                            style={{ ...thSub(GROUP_COL_W), borderLeft: `2px solid ${y.gradeColor || T.hairline}`, fontSize: 9,
                              background: isActiveYear ? '#F3E5C4' : T.headerBg }}>
                            Materia
                          </th>
                        )}
                      </React.Fragment>
                      );
                    })}
                  </tr>
                  <tr>
                    <th key="h2-n" style={{ ...thFrozen(leftOf.n, COL.n), top: 56, zIndex: 4 }}></th>
                    <th key="h2-ced" style={{ ...thFrozen(leftOf.cedula, COL.cedula), top: 56, zIndex: 4 }}></th>
                    <th key="h2-ap" style={{ ...thFrozen(leftOf.apellidos, COL.apellidos), top: 56, zIndex: 4 }}></th>
                    <th key="h2-nom" style={{ ...thFrozen(leftOf.nombres, COL.nombres), top: 56, zIndex: 4 }}></th>
                    <th key="h2-inst" style={{ ...thFrozen(leftOf.inst, COL.inst), top: 56, zIndex: 4, textAlign: 'left', borderRight: `2px solid ${T.hairline}` }}></th>
                    {years.map(y => {
                      const isActiveYear = activeGradeId === y.gradeId;
                      return (
                      <React.Fragment key={`sub-${y.gradeId}`}>
                        {y.subjects.map((subj, si) => (
                          <React.Fragment key={`${y.gradeId}-${subj.id}-sub`}>
                            <th style={{ ...thSub2(44), borderLeft: si === 0 ? `3px solid ${y.gradeColor || T.hairline}` : `2px solid ${y.gradeColor || T.hairline}`,
                              background: isActiveYear ? '#F3E5C4' : T.headerBg }}>Nota</th>
                            <th style={{ ...thSub2(44), background: isActiveYear ? '#F3E5C4' : T.headerBg }}>Est.</th>
                            <th style={{ ...thSub2(88), background: isActiveYear ? '#F3E5C4' : T.headerBg }}>Fecha</th>
                            <th style={{ ...thSub2(40), background: isActiveYear ? '#F3E5C4' : T.headerBg }}>Inst</th>
                            <th style={{ ...thSub2(53), background: isActiveYear ? '#F3E5C4' : T.headerBg }}>Per.</th>
                          </React.Fragment>
                        ))}
                        {yearHasGroups(y) && (
                          <th style={{ ...thSub2(GROUP_COL_W), borderLeft: `2px solid ${y.gradeColor || T.hairline}`, background: isActiveYear ? '#F3E5C4' : T.headerBg }}></th>
                        )}
                      </React.Fragment>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => {
                    const rowBg = ri % 2 === 0 ? '#FBF9F3' : T.card;
                    return (
                    <tr key={row.personId}
                      className="hg-row"
                      style={{
                        borderTop: `1px solid ${T.hairline}`,
                        backgroundColor: rowBg,
                      }}>
                      {/* N° */}
                      <td className="hg-frozen hg-row-num" style={{ ...tdFrozen(leftOf.n, COL.n, rowBg), textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: T.inkFaint, fontWeight: 400 }}>
                        {String(ri + 1).padStart(2, '0')}
                      </td>
                      {/* Cédula */}
                      <td className="hg-frozen" style={{ ...tdFrozen(leftOf.cedula, COL.cedula, rowBg), fontFamily: 'monospace', fontSize: 11, color: T.inkSoft, padding: '3px 6px' }}>
                        {row.cedula}
                      </td>
                      {/* Apellidos */}
                      <td className="hg-frozen" style={{ ...tdFrozen(leftOf.apellidos, COL.apellidos, rowBg), fontSize: 12, fontWeight: 500, color: T.ink, padding: '3px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.apellidos}
                      </td>
                      {/* Nombres */}
                      <td className="hg-frozen" style={{ ...tdFrozen(leftOf.nombres, COL.nombres, rowBg), fontSize: 12, color: T.ink, padding: '3px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.nombres}
                      </td>
                      {/* Instituciones (PlantelMultiSelect — one per row) */}
                      <td className="hg-frozen" style={{ ...tdFrozen(leftOf.inst, COL.inst, rowBg), padding: '2px 4px', borderRight: `2px solid ${T.hairline}` }}>
                        <PlantelMultiSelect
                          planteles={planteles}
                          selectedIds={row.plantelIds}
                          systemIds={row.systemPlantelIds}
                          onChange={ids => updatePlantelIds(ri, ids)}
                          width={COL.inst - 8}
                          placeholder="Buscar plantel…"
                          disabled={consolidated}
                        />
                      </td>

                      {/* Subject cells + optional group subject name column */}
                      {years.map(y => (
                        <React.Fragment key={`body-year-${y.schoolPeriodId}-${y.gradeId}`}>
                          {y.subjects.map((subj, si) => {
                            const cellKey = `g__${y.gradeId}__${subj.id}`;
                            const cell = row.cells[cellKey] || emptyCell();
                            const isSystem = cell.source === 'system';
                            const failing = cell.score !== '' && Number(cell.score) < maxGrade / 2;
                            const passing = cell.score !== '' && Number(cell.score) >= maxGrade / 2;
                            const statusMeta = STATUS_META[cell.status] || STATUS_META.F;
                            const scoreKey = `${cellKey}__score`;
                            const statusKey = `${cellKey}__status`;
                            const dateKey = `${cellKey}__date`;
                            const instKey = `${cellKey}__inst`;
                            const perKey = `${cellKey}__per`;

                            // For system cells, cell.per already contains the periodShort
                            const perShort = cell.per;

                            return (
                              <React.Fragment key={cellKey}>
                                {/* Nota */}
                                <td style={{
                                  ...tdPlain(44),
                                  borderLeft: si === 0 ? `3px solid ${y.gradeColor || T.hairline}` : `2px solid ${y.gradeColor || T.hairline}`,
                                  background: failing ? T.redBg : passing ? T.greenBg : isSystem ? '#F0F0F0' : 'transparent',
                                }}>
                                  <LocalInput
                                    type="number" min={0} max={maxGrade} step={1}
                                    data-row={ri} data-field={scoreKey}
                                    registerRef={registerRef(ri, scoreKey)}
                                    value={cell.score}
                                    onCommit={(val) => {
                                      if (val !== '') {
                                        const padded = formatGradePadded(Number(val), maxGrade);
                                        if (padded !== '-' && padded !== val) {
                                          updateCell(ri, scoreKey, padded);
                                          return;
                                        }
                                      }
                                      updateCell(ri, scoreKey, val);
                                    }}
                                    onFocus={() => setActiveCell({ row: ri, field: scoreKey })}
                                    onKeyDown={e => handleKeyDown(e, ri, scoreKey)}
                                    onPaste={e => handlePaste(e, ri, scoreKey)}
                                    placeholder="—"
                                    readOnly={isSystem || consolidated}
                                    style={{ ...cellInputStyle, textAlign: 'center', color: failing ? T.red : passing ? T.green : T.ink, fontWeight: 700, cursor: (isSystem || consolidated) ? 'default' : 'text' }}
                                  />
                                </td>
                                {/* Est. */}
                                <td style={{ ...tdPlain(44), padding: 0 }}>
                                  <select
                                    data-row={ri} data-field={statusKey}
                                    ref={registerRef(ri, statusKey) as any}
                                    value={cell.status}
                                    onChange={e => updateCell(ri, statusKey, e.target.value)}
                                    onFocus={() => setActiveCell({ row: ri, field: statusKey })}
                                    onKeyDown={e => handleKeyDown(e, ri, statusKey)}
                                    disabled={isSystem || consolidated}
                                    style={{
                                      ...cellInputStyle, fontWeight: 700, textAlign: 'center',
                                      color: statusMeta.color,
                                      background: cell.status !== 'F' ? statusMeta.bg : 'transparent',
                                      borderRadius: 3, cursor: (isSystem || consolidated) ? 'default' : 'pointer',
                                    }}
                                  >
                                    {STATUS_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                                  </select>
                                </td>
                                {/* Fecha */}
                                <td style={{ ...tdPlain(88) }}>
                                  <LocalDatePicker
                                    data-row={ri} data-field={dateKey}
                                    registerRef={registerRef(ri, dateKey)}
                                    value={cell.date}
                                    onCommit={val => updateCell(ri, dateKey, val)}
                                    onFocus={() => setActiveCell({ row: ri, field: dateKey })}
                                    onKeyDown={e => handleKeyDown(e, ri, dateKey)}
                                    onPaste={e => handlePaste(e, ri, dateKey)}
                                    readOnly={isSystem || consolidated}
                                    style={{ ...cellInputStyle, cursor: (isSystem || consolidated) ? 'default' : 'text', width: '100%' }}
                                  />
                                </td>
                                {/* Inst */}
                                <td style={{ ...tdPlain(40) }}>
                                  <LocalInput
                                    type="text" maxLength={2}
                                    data-row={ri} data-field={instKey}
                                    registerRef={registerRef(ri, instKey)}
                                    value={resolveInstNum(cell.inst, row.plantelIds)}
                                    onCommit={val => updateCell(ri, instKey, val)}
                                    onFocus={() => setActiveCell({ row: ri, field: instKey })}
                                    onKeyDown={e => handleKeyDown(e, ri, instKey)}
                                    onPaste={e => handlePaste(e, ri, instKey)}
                                    placeholder="—"
                                    readOnly={isSystem || consolidated}
                                    style={{ ...cellInputStyle, textAlign: 'center', color: T.brass, fontWeight: 700, cursor: (isSystem || consolidated) ? 'default' : 'text' }}
                                  />
                                </td>
                                {/* Per. (School Period) — input with datalist for existing periods + free text */}
                                <td style={{ ...tdPlain(53), padding: 0 }}>
                                  <LocalInput
                                    type="text"
                                    data-row={ri} data-field={perKey}
                                    registerRef={registerRef(ri, perKey)}
                                    value={cell.per}
                                    onCommit={val => updateCell(ri, perKey, val)}
                                    onFocus={() => setActiveCell({ row: ri, field: perKey })}
                                    onKeyDown={e => handleKeyDown(e, ri, perKey)}
                                    readOnly={isSystem || consolidated}
                                    list={`periods-${ri}`}
                                    placeholder="—"
                                    style={{
                                      ...cellInputStyle, fontSize: 10, textAlign: 'center',
                                      color: T.inkSoft, cursor: isSystem ? 'default' : 'text',
                                    }}
                                  />
                                  {!isSystem && (
                                    <datalist id={`periods-${ri}`}>
                                      {editablePeriods.map(p => (
                                        <option key={p.id} value={p.periodShort ?? p.period}>{p.name}</option>
                                      ))}
                                    </datalist>
                                  )}
                                </td>
                              </React.Fragment>
                            );
                          })}
                          {/* Group subject name column — editable for historical grades */}
                          {yearHasGroups(y) && (
                            <td style={{
                              ...tdPlain(GROUP_COL_W),
                              borderLeft: `2px solid ${y.gradeColor || T.hairline}`,
                              padding: 0,
                            }}>
                              <LocalGroupInput
                                value={row.groupSubjectNames[`g__${y.gradeId}`] || ''}
                                onCommit={val => updateGroupSubjectName(ri, `g__${y.gradeId}`, val)}
                                onFocus={() => setActiveCell({ row: ri, field: `g__${y.gradeId}__grp` })}
                                readOnly={consolidated}
                                style={{
                                  width: '100%', border: 'none', outline: 'none', background: 'transparent',
                                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: T.inkSoft,
                                  padding: '3px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}
                              />
                            </td>
                          )}
                        </React.Fragment>
                      ))}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            !loading && (
              <div style={{ textAlign: 'center', padding: 60, color: T.inkFaint, fontSize: 14 }}>
                {mode === 'section'
                  ? (selectedSectionId ? 'No hay estudiantes ni notas para esta sección' : 'Seleccione una sección para comenzar')
                  : (selectedStudent ? 'No hay datos para este estudiante' : 'Busque y seleccione un estudiante para comenzar')}
              </div>
            )
          )}
        </Spin>
      </div>
    </div>
  );
};

/* ── style helpers ── */
function thPlain(w: number): React.CSSProperties {
  return { position: 'sticky', top: 0, width: w, minWidth: w, background: T.headerBg, color: T.inkSoft, fontSize: 11, fontWeight: 600, textAlign: 'center', padding: '6px 6px', zIndex: 2, borderBottom: `1px solid ${T.hairline}` };
}
function thSub(w: number): React.CSSProperties {
  return { position: 'sticky', top: 28, width: w, minWidth: w, background: T.headerBg, color: T.inkFaint, fontSize: 9, fontWeight: 600, textAlign: 'center', padding: '3px 2px', zIndex: 2, borderBottom: `1px solid ${T.hairline}` };
}
function thSub2(w: number): React.CSSProperties {
  return { position: 'sticky', top: 50, width: w, minWidth: w, background: T.headerBg, color: T.inkFaint, fontSize: 9, fontWeight: 600, textAlign: 'center', padding: '2px 2px', zIndex: 2, borderBottom: `1px solid ${T.hairline}` };
}
function thFrozen(left: number, w: number): React.CSSProperties {
  return { ...thPlain(w), position: 'sticky', left, top: 0, textAlign: 'center' as const };
}
function tdPlain(w: number): React.CSSProperties {
  return { width: w, minWidth: w, padding: 0, borderRight: `1px solid ${T.hairline}`, borderBottom: `1px solid ${T.hairline}` };
}
function tdFrozen(left: number, w: number, bg: string = T.card): React.CSSProperties {
  return { ...tdPlain(w), position: 'sticky', left, background: bg, zIndex: 1, borderRight: `1px solid ${T.hairline}` };
}

export default HistoricalGradesBySection;
