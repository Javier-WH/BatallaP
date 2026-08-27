import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Spin, message, Button, Select } from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import api from '@/services/api';
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

// Letter codes matching the reference grid
const STATUS_META: Record<string, { label: string; color: string; bg: string; gradeType: string }> = {
  F:  { label: 'Regular',            color: '#3F6C4E', bg: '#E3ECE4', gradeType: 'regular' },
  R:  { label: 'Reparación',         color: '#B5632B', bg: '#F3E3D2', gradeType: 'revision' },
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
interface PeriodOption { id: number; periodShort: string | null; period: string; name: string; }

/* ── Row data: one per student ── */
interface RowData {
  personId: number;
  cedula: string;
  apellidos: string;
  nombres: string;
  plantelIds: number[];      // selected planteles for this student (all years)
  cells: Record<string, CellData>;  // key: `g__${gradeId}__${subjId}` → cell
  groupSubjectNames: Record<string, string[]>;  // `g__${gradeId}` → list of actual subject names from groups
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
  const [activeCell, setActiveCell] = useState<{ row: number; field: string } | null>(null);

  // Mode: section or individual student
  const [mode, setMode] = useState<'section' | 'individual'>('section');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [studentSearchResults, setStudentSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

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

      setStudents(rawStudents);
      setPlanteles(rawPlanteles);
      setAllPeriods(rawAllPeriods);

      // Show all years — the user needs to see and fill all grades (1ro–5to)
      // regardless of which section they're currently viewing.
      setActiveGradeOrder(999);
      const visibleYears = rawYears;
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
        const groupNames: Record<string, string[]> = {};  // `g__${gradeId}` → actual subject names
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
          if (g.plantelId) {
            instNum = `g__pid:${g.plantelId}`;
          }
          cells[key] = {
            score: g.finalScore != null ? formatGradePadded(g.finalScore, maxGrade) : '',
            status: statusCode,
            date: dateDisplay,
            inst: instNum,
            per: g.schoolPeriodId != null ? String(g.schoolPeriodId) : '',
            source: g.source ?? '',
            finalGradeId: g.finalGradeId,
            inscriptionSubjectId: g.inscriptionSubjectId,
            historicalGradeId: g.historicalGradeId ?? null,
            dirty: false,
          };
          if (g.subjectGroupId != null && g.subjectName) {
            const gk = `g__${g.gradeId}`;
            if (!groupNames[gk]) groupNames[gk] = [];
            if (!groupNames[gk].includes(g.subjectName)) {
              groupNames[gk].push(g.subjectName);
            }
          }
        }

        // Collect unique plantelIds for this student
        const studentPlantelIds: number[] = [];
        for (const g of rawGrades) {
          if (g.personId !== st.id || !g.plantelId) continue;
          if (!studentPlantelIds.includes(g.plantelId)) studentPlantelIds.push(g.plantelId);
        }

        // Resolve inst numbers from plantelIds
        for (const key of Object.keys(cells)) {
          const c = cells[key];
          if (c.inst.startsWith('g__pid:')) {
            const pid = Number(c.inst.replace('g__pid:', ''));
            const idx = studentPlantelIds.indexOf(pid);
            c.inst = idx >= 0 ? String(idx + 1) : '';
          }
        }

        return {
          personId: st.id,
          cedula: `${st.documentType ? st.documentType + ' ' : ''}${st.document}`,
          apellidos: st.lastName,
          nombres: st.firstName,
          plantelIds: studentPlantelIds,
          cells,
          groupSubjectNames: groupNames,
        };
      });

      setRows(newRows);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.message || 'Error al cargar notas');
    } finally {
      setLoading(false);
    }
  }, [activePeriodId, selectedSectionId, selectedGradeId, selectedStudent, mode, sections, maxGrade]);

  useEffect(() => {
    if (mode === 'section' && selectedSectionId) loadGrades();
    if (mode === 'individual' && selectedStudent) loadGrades();
  }, [selectedSectionId, selectedGradeId, selectedStudent, mode, loadGrades]);

  /* ── Field accessors ── */
  const getField = (row: RowData, key: string): string => {
    if (key === 'cedula') return row.cedula;
    if (key === 'apellidos') return row.apellidos;
    if (key === 'nombres') return row.nombres;
    if (key === 'plantelIds') return row.plantelIds.join(',');
    // cell key: spIdg__subjIdg__field
    const parts = key.split('g__');
    if (parts.length === 3) {
      const cellKey = `${parts[0]}__${parts[1]}`;
      const cell = row.cells[cellKey];
      if (!cell) return '';
      return (cell as any)[parts[2]] ?? '';
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
    const parts = key.split('g__');
    if (parts.length === 3) {
      const cellKey = `${parts[0]}__${parts[1]}`;
      const field = parts[2] as keyof CellData;
      const cell = row.cells[cellKey] || emptyCell();
      // Pad score fields to match maxGrade digit count
      let finalValue = value;
      if (field === 'score' && value !== '') {
        const num = Number(value);
        if (!isNaN(num)) finalValue = formatGradePadded(num, maxGrade);
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

  const updatePlantelIds = (rowIdx: number, ids: number[]) => {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, plantelIds: ids } : r));
  };

  /* ── Ref management ── */
  const registerRef = (rowIdx: number, key: string) => (el: HTMLInputElement | HTMLSelectElement | null) => {
    inputRefs.current[`${rowIdx}__${key}`] = el;
  };
  const focusCell = (rowIdx: number, key: string) => {
    const el = inputRefs.current[`${rowIdx}__${key}`];
    if (el) { el.focus(); if ((el as HTMLInputElement).select) (el as HTMLInputElement).select(); }
  };

  /* ── Keyboard navigation ── */
  const fieldKeys = useMemo(() => buildFieldKeys(years), [years]);

  const handleKeyDown = (e: React.KeyboardEvent, rowIdx: number, key: string) => {
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
  const dirtyCount = useMemo(() => {
    let c = 0;
    for (const row of rows) {
      for (const key of Object.keys(row.cells)) {
        if (row.cells[key].dirty) c++;
      }
      // plantelIds changes don't count as cell dirty, but we track separately
    }
    return c;
  }, [rows]);

  const handleSave = async () => {
    const changes: any[] = [];
    for (const row of rows) {
      for (const [cellKey, cell] of Object.entries(row.cells)) {
        if (!cell.dirty) continue;
        const parts = cellKey.split('__');
        const gradeId = Number(parts[1]);
        const subjId = Number(parts[2]);
        // Map inst number → plantelId
        let plantelId: number | null = null;
        if (cell.inst && cell.inst.trim() !== '') {
          const instNum = parseInt(cell.inst, 10);
          if (!isNaN(instNum) && instNum >= 1 && instNum <= row.plantelIds.length) {
            plantelId = row.plantelIds[instNum - 1];
          }
        }
        // Convert dd/mm/aaaa → yyyy-mm-dd
        let dateStr: string | null = null;
        if (cell.date) {
          const parts = cell.date.split('/');
          if (parts.length === 3) dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        const gradeType = STATUS_META[cell.status]?.gradeType || 'regular';
        // Use the cell's own schoolPeriodId (editable per-cell), fallback to column's
        const cellSpId = cell.per ? Number(cell.per) : null;
        const yearMatch = years.find(y => y.gradeId === gradeId);
        const spId = cellSpId ?? yearMatch?.schoolPeriodId ?? null;
        changes.push({
          personId: row.personId,
          schoolPeriodId: spId,
          gradeId,
          subjectId: subjId,
          historicalGradeId: cell.historicalGradeId,
          finalScore: cell.score === '' ? null : Number(cell.score),
          gradeType,
          plantelId,
          finalGradeId: cell.finalGradeId,
          inscriptionSubjectId: cell.inscriptionSubjectId,
          date: dateStr,
        });
      }
    }

    if (changes.length === 0) { message.info('No hay cambios para guardar'); return; }

    setSaving(true);
    try {
      const res = await api.post('/historical-grades/save', { changes });
      message.success(`${res.data.saved} nota${res.data.saved !== 1 ? 's' : ''} guardada${res.data.saved !== 1 ? 's' : ''}`);
      if (res.data.errors?.length > 0) message.warning(`Errores: ${res.data.errors.length}`);
      await loadGrades();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  /* ── Column layout ── */
  const COL = { n: 34, cedula: 120, apellidos: 100, nombres: 100, inst: 200 };
  const leftOf = {
    n: 0,
    cedula: COL.n,
    apellidos: COL.n + COL.cedula,
    nombres: COL.n + COL.cedula + COL.apellidos,
    inst: COL.n + COL.cedula + COL.apellidos + COL.nombres,
  };
  const frozenWidth = COL.n + COL.cedula + COL.apellidos + COL.nombres + COL.inst;
  const SUB_W = 44 + 44 + 78 + 40 + 48; // = 254 per subject (score, status, date, inst, per)
  const GROUP_COL_W = 130;        // extra column for group subject name
  // Years that have at least one group subject get an extra trailing column
  const yearHasGroups = (y: YearCol) => y.subjects.some(s => s.subjectGroupId !== null);
  const totalTableWidth = frozenWidth + years.reduce((s, y) =>
    s + y.subjects.length * SUB_W + (yearHasGroups(y) ? GROUP_COL_W : 0), 0);

  const cellInputStyle: React.CSSProperties = {
    width: '100%', border: 'none', outline: 'none', background: 'transparent',
    fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: T.ink, padding: '3px 4px',
  };

  return (
    <div style={{ background: T.paper, minHeight: '100%', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .hg-grid input:focus, .hg-grid select:focus { background: #FFF7DE !important; box-shadow: inset 0 0 0 1.5px #A9814B; }
        .hg-row:hover td { background: #F6F0DE !important; }
        .hg-row.active-row td { background: #FDF6E3 !important; }
        .hg-row.active-row td.hg-frozen { background: #FBF1D3 !important; }
        .hg-row.active-row td:hover { background: #F6E9C4 !important; }
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
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} disabled={dirtyCount === 0 || saving} loading={saving}>
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
                          <col style={{ width: 78 }} />
                          <col style={{ width: 40 }} />
                          <col style={{ width: 48 }} />
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
                      const isActiveYear = activeCell?.field.startsWith(`g__${y.gradeId}__`);
                      return (
                        <th key={`y-${y.gradeId}`} colSpan={span}
                          style={{ ...thPlain(width), borderLeft: `3px solid ${T.hairline}`, borderTop: `3px solid ${gc}`, fontSize: 12,
                            background: isActiveYear ? T.brassBg : T.headerBg }}>
                          {y.gradeName}
                          {y.periodShort && (
                            <div style={{ fontSize: 9, fontWeight: 400, color: T.inkFaint }}>{y.periodShort}</div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                  <tr>
                    {years.map(y => {
                      const isActiveYear = activeCell?.field.startsWith(`g__${y.gradeId}__`);
                      return (
                      <React.Fragment key={`s-row-${y.gradeId}`}>
                        {y.subjects.map((subj, si) => (
                          <th key={`s-${y.gradeId}-${subj.id}`} colSpan={5} title={subj.name}
                            style={{ ...thSub(254), borderLeft: si === 0 ? `3px solid ${y.gradeColor || T.hairline}` : `1px solid ${T.hairline}`,
                              background: isActiveYear ? '#F3E5C4' : T.headerBg }}>
                            {subj.name}
                          </th>
                        ))}
                        {yearHasGroups(y) && (
                          <th key={`s-grp-${y.gradeId}`} title="Materia del grupo cursada"
                            style={{ ...thSub(GROUP_COL_W), borderLeft: `1px solid ${T.hairline}`, fontSize: 9,
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
                      const isActiveYear = activeCell?.field.startsWith(`g__${y.gradeId}__`);
                      return (
                      <React.Fragment key={`sub-${y.gradeId}`}>
                        {y.subjects.map((subj, si) => (
                          <React.Fragment key={`${y.gradeId}-${subj.id}-sub`}>
                            <th style={{ ...thSub2(44), borderLeft: si === 0 ? `3px solid ${y.gradeColor || T.hairline}` : `1px solid ${T.hairline}`,
                              background: isActiveYear ? '#F3E5C4' : T.headerBg }}>Nota</th>
                            <th style={{ ...thSub2(44), background: isActiveYear ? '#F3E5C4' : T.headerBg }}>Est.</th>
                            <th style={{ ...thSub2(78), background: isActiveYear ? '#F3E5C4' : T.headerBg }}>Fecha</th>
                            <th style={{ ...thSub2(40), background: isActiveYear ? '#F3E5C4' : T.headerBg }}>Inst</th>
                            <th style={{ ...thSub2(48), background: isActiveYear ? '#F3E5C4' : T.headerBg }}>Per.</th>
                          </React.Fragment>
                        ))}
                        {yearHasGroups(y) && (
                          <th style={{ ...thSub2(GROUP_COL_W), borderLeft: `1px solid ${T.hairline}`, background: isActiveYear ? '#F3E5C4' : T.headerBg }}></th>
                        )}
                      </React.Fragment>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => {
                    const rowBg = ri % 2 === 0 ? '#FBF9F3' : T.card;
                    const isActiveRow = activeCell?.row === ri;
                    return (
                    <tr key={row.personId}
                      className={`hg-row${isActiveRow ? ' active-row' : ''}`}
                      style={{
                        borderTop: `1px solid ${T.hairline}`,
                        backgroundColor: rowBg,
                      }}>
                      {/* N° */}
                      <td className="hg-frozen" style={{ ...tdFrozen(leftOf.n, COL.n, rowBg), textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: isActiveRow ? T.brass : T.inkFaint, fontWeight: isActiveRow ? 700 : 400 }}>
                        {isActiveRow ? '▸' : String(ri + 1).padStart(2, '0')}
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
                          onChange={ids => updatePlantelIds(ri, ids)}
                          width={COL.inst - 8}
                          placeholder="Buscar plantel…"
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

                            // For system cells, show the periodShort from allPeriods
                            const perShort = cell.per
                              ? (allPeriods.find(p => p.id === Number(cell.per))?.periodShort ?? '')
                              : '';

                            return (
                              <React.Fragment key={cellKey}>
                                {/* Nota */}
                                <td style={{
                                  ...tdPlain(44),
                                  borderLeft: si === 0 ? `3px solid ${y.gradeColor || T.hairline}` : `1px solid ${T.hairline}`,
                                  background: failing ? T.redBg : passing ? T.greenBg : isSystem ? '#F0F0F0' : 'transparent',
                                }}>
                                  <input
                                    type="number" min={0} max={maxGrade} step={1}
                                    data-row={ri} data-field={scoreKey}
                                    ref={registerRef(ri, scoreKey)}
                                    value={cell.score}
                                    onChange={e => updateCell(ri, scoreKey, e.target.value)}
                                    onFocus={() => setActiveCell({ row: ri, field: scoreKey })}
                                    onBlur={() => {
                                      if (cell.score !== '') {
                                        const padded = formatGradePadded(Number(cell.score), maxGrade);
                                        if (padded !== '-' && padded !== cell.score) {
                                          updateCell(ri, scoreKey, padded);
                                        }
                                      }
                                    }}
                                    onKeyDown={e => handleKeyDown(e, ri, scoreKey)}
                                    onPaste={e => handlePaste(e, ri, scoreKey)}
                                    placeholder="—"
                                    readOnly={isSystem}
                                    style={{ ...cellInputStyle, textAlign: 'center', color: failing ? T.red : passing ? T.green : T.ink, fontWeight: 700, cursor: isSystem ? 'default' : 'text' }}
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
                                    disabled={isSystem}
                                    style={{
                                      ...cellInputStyle, fontWeight: 700, textAlign: 'center',
                                      color: statusMeta.color,
                                      background: cell.status !== 'F' ? statusMeta.bg : 'transparent',
                                      borderRadius: 3, cursor: isSystem ? 'default' : 'pointer',
                                    }}
                                  >
                                    {STATUS_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                                  </select>
                                </td>
                                {/* Fecha */}
                                <td style={{ ...tdPlain(78) }}>
                                  <input
                                    type="text"
                                    data-row={ri} data-field={dateKey}
                                    ref={registerRef(ri, dateKey)}
                                    value={cell.date}
                                    onChange={e => updateCell(ri, dateKey, e.target.value)}
                                    onFocus={() => setActiveCell({ row: ri, field: dateKey })}
                                    onKeyDown={e => handleKeyDown(e, ri, dateKey)}
                                    onPaste={e => handlePaste(e, ri, dateKey)}
                                    placeholder="dd/mm/aaaa"
                                    readOnly={isSystem}
                                    style={{ ...cellInputStyle, cursor: isSystem ? 'default' : 'text' }}
                                  />
                                </td>
                                {/* Inst */}
                                <td style={{ ...tdPlain(40) }}>
                                  <input
                                    type="text" maxLength={2}
                                    data-row={ri} data-field={instKey}
                                    ref={registerRef(ri, instKey)}
                                    value={cell.inst}
                                    onChange={e => updateCell(ri, instKey, e.target.value)}
                                    onFocus={() => setActiveCell({ row: ri, field: instKey })}
                                    onKeyDown={e => handleKeyDown(e, ri, instKey)}
                                    onPaste={e => handlePaste(e, ri, instKey)}
                                    placeholder="—"
                                    readOnly={isSystem}
                                    style={{ ...cellInputStyle, textAlign: 'center', color: T.brass, fontWeight: 700, cursor: isSystem ? 'default' : 'text' }}
                                  />
                                </td>
                                {/* Per. (School Period) */}
                                <td style={{ ...tdPlain(48), padding: 0 }}>
                                  <select
                                    data-row={ri} data-field={perKey}
                                    ref={registerRef(ri, perKey) as any}
                                    value={cell.per}
                                    onChange={e => updateCell(ri, perKey, e.target.value)}
                                    onFocus={() => setActiveCell({ row: ri, field: perKey })}
                                    onKeyDown={e => handleKeyDown(e, ri, perKey)}
                                    disabled={isSystem}
                                    title={allPeriods.find(p => p.id === Number(cell.per))?.name ?? ''}
                                    style={{
                                      ...cellInputStyle, fontSize: 10, textAlign: 'center',
                                      color: T.inkSoft, cursor: isSystem ? 'default' : 'pointer',
                                    }}
                                  >
                                    <option value="">{perShort || '—'}</option>
                                    {!isSystem && allPeriods.map(p => (
                                      <option key={p.id} value={p.id}>{p.periodShort ?? p.period}</option>
                                    ))}
                                  </select>
                                </td>
                              </React.Fragment>
                            );
                          })}
                          {/* Group subject name column */}
                          {yearHasGroups(y) && (
                            <td style={{
                              ...tdPlain(GROUP_COL_W),
                              borderLeft: `1px solid ${T.hairline}`,
                              fontSize: 11, color: T.inkSoft, padding: '3px 6px',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {(row.groupSubjectNames[`g__${y.gradeId}`] || []).join(', ')}
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
