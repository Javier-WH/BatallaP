import { Op } from 'sequelize';
import {
  AttendanceRecord,
  AttendanceSession,
  ScheduleEntry,
  Schedule,
  Subject,
  SubjectGroup,
  Inscription,
  Person,
  PeriodGrade,
  PeriodGradeSection,
  Grade,
  Section,
  Term,
  InscriptionSubject,
} from '@/models';
import { getDayNameForDate, getPeriodInfoMap, periodSortKey, shiftOfKey, type AttendanceStatus } from './attendanceService';
import { compareStudents } from './studentSortService';

/**
 * Attendance reports for staff (by section / by student).
 *
 * Cell semantics:
 *  - Weekly cell (one per day): the last status the student received that
 *    day. Expulsado wins over anything after it. A student present/late in an
 *    earlier block and later absent without justification is 'jubilado'.
 *  - Daily cell (one per class block): the status of that block, flagged
 *    'jubilado' when it is an unjustified absence after a present/late block
 *    the same day.
 *
 * Justified absence: status 'excused', or 'absent' whose reason is
 * Justificado or Enfermo.
 */

export type ReportCellCode = AttendanceStatus | 'jubilado';

export interface ReportCell {
  code: ReportCellCode;
  label: string;
  reason: string | null;
}

export interface ReportStudent {
  inscriptionId: number;
  personId: number;
  document: string;
  lastName: string;
  firstName: string;
  gender: 'M' | 'F' | null;
  gradeName: string;
  sectionName: string;
  rosterNumber: number | null;
}

export interface ReportDayColumn {
  key: string;
  /** Short header (subject abbreviation or subject-group abbreviation). */
  label: string;
  /** Full subject / group name for tooltips. */
  title: string;
  periodIds: string[];
  start: string | null;
  end: string | null;
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Presente',
  absent: 'Ausente',
  late: 'Tarde',
  excused: 'Justificado',
  kicked: 'Expulsado',
};

const JUSTIFIED_REASON_PREFIXES = ['justificado', 'enfermo'];
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function isJustifiedAbsence(status: AttendanceStatus, reason: string | null): boolean {
  if (status === 'excused') return true;
  if (status !== 'absent') return false;
  const r = (reason ?? '').trim().toLowerCase();
  return JUSTIFIED_REASON_PREFIXES.some(p => r.startsWith(p));
}

const isAttended = (status: AttendanceStatus) => status === 'present' || status === 'late';

const jubiladoLabel = (gender: 'M' | 'F' | null) => (gender === 'F' ? 'Jubilada' : 'Jubilado');

function cellFor(status: AttendanceStatus, reason: string | null): ReportCell {
  return { code: status, label: STATUS_LABELS[status], reason };
}

function shortSectionName(name: string | null | undefined): string {
  const raw = (name ?? '').trim();
  return raw.replace(/^secci[oó]n\s*/i, '').trim() || raw;
}

/** Calendar dates (YYYY-MM-DD) from..to inclusive, weekdays only. */
function weekdaysBetween(dateFrom: string, dateTo: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${dateFrom}T12:00:00Z`);
  const end = new Date(`${dateTo}T12:00:00Z`);
  if (isNaN(cur.getTime()) || isNaN(end.getTime())) return out;
  while (cur <= end && out.length < 400) {
    const dow = cur.getUTCDay();
    if (dow >= 1 && dow <= 5) out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dow = d.getUTCDay();
  return addDays(dateStr, dow === 0 ? -6 : 1 - dow);
}

/** Column grouping key: one column per regular subject, one per subject group. */
function columnBaseKey(subjectId: number | null, subjectGroupId: number | null): string | null {
  if (subjectGroupId != null) return `g${subjectGroupId}`;
  if (subjectId != null) return `s${subjectId}`;
  return null;
}

export interface DayRecord {
  status: AttendanceStatus;
  reason: string | null;
  periodId: string;
  sortKey: number;
  baseKey: string | null;
  id: number;
}

/** Records of the given inscriptions in a date range, grouped by inscription → date. */
async function loadRecords(
  inscriptionIds: number[],
  dateFrom: string,
  dateTo: string
): Promise<Map<number, Map<string, DayRecord[]>>> {
  const byInscription = new Map<number, Map<string, DayRecord[]>>();
  if (inscriptionIds.length === 0) return byInscription;

  const records = await AttendanceRecord.findAll({
    where: { inscriptionId: inscriptionIds },
    include: [
      {
        model: AttendanceSession,
        as: 'session',
        required: true,
        where: { sessionDate: { [Op.between]: [dateFrom, dateTo] } },
        include: [
          {
            model: ScheduleEntry,
            as: 'scheduleEntry',
            include: [{ model: Subject, as: 'subject', attributes: ['id', 'subjectGroupId'] }],
          },
        ],
      },
    ],
  });

  for (const r of records as any[]) {
    const entry = r.session?.scheduleEntry;
    if (!entry) continue;
    const date = String(r.session.sessionDate).slice(0, 10);
    if (!byInscription.has(r.inscriptionId)) byInscription.set(r.inscriptionId, new Map());
    const byDate = byInscription.get(r.inscriptionId)!;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push({
      status: r.status,
      reason: r.reason ?? null,
      periodId: entry.periodId,
      sortKey: periodSortKey(entry.periodId),
      baseKey: columnBaseKey(entry.subjectId ?? null, entry.subject?.subjectGroupId ?? null),
      id: r.id,
    });
  }
  for (const byDate of byInscription.values()) {
    for (const list of byDate.values()) list.sort((a, b) => a.sortKey - b.sortKey || a.id - b.id);
  }
  return byInscription;
}

/** Weekly cell: last status of the day, with Expulsado and Jubilado rules. */
export function summarizeDay(records: DayRecord[] | undefined, gender: 'M' | 'F' | null): ReportCell | null {
  if (!records || records.length === 0) return null;
  const kicked = records.find(r => r.status === 'kicked');
  if (kicked) return cellFor('kicked', kicked.reason);
  const last = records[records.length - 1];
  if (
    last.status === 'absent'
    && !isJustifiedAbsence(last.status, last.reason)
    // Jubilado only counts within the same shift: attending an earlier block
    // and then skipping a later one. Attendance in another shift (e.g. the
    // morning) does not retire the student in the afternoon.
    && records.some(r => r.sortKey < last.sortKey && shiftOfKey(r.sortKey) === shiftOfKey(last.sortKey) && isAttended(r.status))
  ) {
    return { code: 'jubilado', label: jubiladoLabel(gender), reason: last.reason };
  }
  return cellFor(last.status, last.reason);
}

function toReportStudent(ins: any): ReportStudent {
  return {
    inscriptionId: ins.id,
    personId: ins.personId,
    document: ins.student?.document ?? '',
    lastName: ins.student?.lastName ?? '',
    firstName: ins.student?.firstName ?? '',
    gender: ins.student?.gender ?? null,
    gradeName: ins.grade?.name ?? '',
    sectionName: shortSectionName(ins.section?.name),
    rosterNumber: ins.rosterNumber ?? null,
  };
}

const inscriptionIncludes = [
  { model: Person, as: 'student' },
  { model: Grade, as: 'grade' },
  { model: Section, as: 'section' },
];

/** Active inscriptions of a section, canonical nomina order. */
async function loadSectionInscriptions(schoolPeriodId: number, gradeId: number, sectionId: number) {
  const list = await Inscription.findAll({
    where: { schoolPeriodId, gradeId, sectionId, withdrawnAt: null },
    include: inscriptionIncludes,
  });
  return (list as any[]).sort((a, b) => compareStudents(a.student ?? {}, b.student ?? {}));
}

/**
 * Class-block columns a section sees on a date, from its timetable. Group
 * subjects of the same group collapse into one column labelled with the group
 * abbreviation (each student takes only one subject of the group). Consecutive
 * periods of the same subject/group form one column.
 */
async function loadDayColumns(
  schoolPeriodId: number,
  gradeId: number,
  sectionId: number,
  dateStr: string
): Promise<ReportDayColumn[]> {
  const dayName = getDayNameForDate(dateStr);
  if (!dayName) return [];
  const pg = await PeriodGrade.findOne({ where: { schoolPeriodId, gradeId } });
  if (!pg) return [];
  const pgs = await PeriodGradeSection.findOne({ where: { periodGradeId: pg.id, sectionId } });
  if (!pgs) return [];
  const schedule = await Schedule.findOne({ where: { schoolPeriodId, periodGradeSectionId: pgs.id } });
  if (!schedule) return [];

  const entries = await ScheduleEntry.findAll({
    where: { scheduleId: schedule.id, day: dayName },
    include: [{ model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] }],
  }) as any[];

  const periodInfoMap = await getPeriodInfoMap();
  const groups = new Map<string, { entries: any[]; label: string; title: string }>();
  for (const e of entries) {
    const groupId = e.subject?.subjectGroupId ?? null;
    const key = columnBaseKey(e.subjectId ?? null, groupId);
    if (!key) continue;
    if (!groups.has(key)) {
      const g = e.subject?.subjectGroup;
      const label = groupId != null
        ? (g?.shortAbbreviation || g?.longAbbreviation || g?.name || 'GRUPO')
        : (e.subject?.abbreviation || e.subject?.name || '—');
      const title = groupId != null ? (g?.name ?? label) : (e.subject?.name ?? label);
      groups.set(key, { entries: [], label, title });
    }
    groups.get(key)!.entries.push(e);
  }

  const columns: (ReportDayColumn & { sortKey: number })[] = [];
  for (const [baseKey, g] of groups) {
    const periods = [...new Set(g.entries.map(e => e.periodId as string))]
      .sort((a, b) => periodSortKey(a) - periodSortKey(b));
    let run: string[] = [];
    const flush = () => {
      if (run.length === 0) return;
      columns.push({
        key: `${baseKey}|${run[0]}`,
        label: g.label,
        title: g.title,
        periodIds: run,
        start: periodInfoMap.get(run[0])?.start ?? null,
        end: periodInfoMap.get(run[run.length - 1])?.end ?? null,
        sortKey: periodSortKey(run[0]),
      });
      run = [];
    };
    for (const p of periods) {
      const prev = run[run.length - 1];
      if (prev && periodSortKey(p) - periodSortKey(prev) !== 1) flush();
      run.push(p);
    }
    flush();
  }
  columns.sort((a, b) => a.sortKey - b.sortKey);
  return columns.map(({ sortKey: _s, ...c }) => c);
}

/** Column a record belongs to: same subject/group and period inside the block (nearest as fallback). */
function columnForRecord(columns: ReportDayColumn[], rec: DayRecord): ReportDayColumn | null {
  if (!rec.baseKey) return null;
  const same = columns.filter(c => c.key.startsWith(`${rec.baseKey}|`));
  if (same.length === 0) return null;
  const exact = same.find(c => c.periodIds.includes(rec.periodId));
  if (exact) return exact;
  return same.reduce((best, c) =>
    Math.abs(periodSortKey(c.periodIds[0]) - rec.sortKey) < Math.abs(periodSortKey(best.periodIds[0]) - rec.sortKey)
      ? c : best);
}

/** Daily cells: one per class block, with the Jubilado flag on unjustified absences after attending. */
export function dayCells(
  columns: ReportDayColumn[],
  records: DayRecord[] | undefined,
  gender: 'M' | 'F' | null
): Record<string, ReportCell | null> {
  const cells: Record<string, ReportCell | null> = {};
  for (const c of columns) cells[c.key] = null;
  if (!records) return cells;
  const latestByColumn = new Map<string, DayRecord>();
  for (const rec of records) {
    const col = columnForRecord(columns, rec);
    if (col) latestByColumn.set(col.key, rec); // records are sorted, last wins
  }
  for (const [key, rec] of latestByColumn) {
    const jubilado = rec.status === 'absent'
      && !isJustifiedAbsence(rec.status, rec.reason)
      // Same shift only — presence in another shift does not trigger it.
      && records.some(r => r.sortKey < rec.sortKey && shiftOfKey(r.sortKey) === shiftOfKey(rec.sortKey) && isAttended(r.status));
    cells[key] = jubilado
      ? { code: 'jubilado', label: jubiladoLabel(gender), reason: rec.reason }
      : cellFor(rec.status, rec.reason);
  }
  return cells;
}

async function sectionHeader(gradeId: number, sectionId: number) {
  const [grade, section] = await Promise.all([Grade.findByPk(gradeId), Section.findByPk(sectionId)]);
  return { gradeName: grade?.name ?? '', sectionName: shortSectionName(section?.name) };
}

const dayInfo = (date: string) => ({
  date,
  dayShort: WEEKDAY_SHORT[new Date(`${date}T12:00:00Z`).getUTCDay()],
});

/** Section × weekdays grid. */
export async function getSectionWeekReport(params: {
  schoolPeriodId: number; gradeId: number; sectionId: number; dateFrom: string; dateTo: string;
}) {
  const { schoolPeriodId, gradeId, sectionId, dateFrom, dateTo } = params;
  const [inscriptions, header] = await Promise.all([
    loadSectionInscriptions(schoolPeriodId, gradeId, sectionId),
    sectionHeader(gradeId, sectionId),
  ]);
  const days = weekdaysBetween(dateFrom, dateTo).map(dayInfo);
  const records = await loadRecords(inscriptions.map(i => i.id), dateFrom, dateTo);
  const students = inscriptions.map(ins => {
    const s = toReportStudent(ins);
    const byDate = records.get(ins.id);
    const cells: Record<string, ReportCell | null> = {};
    for (const d of days) cells[d.date] = summarizeDay(byDate?.get(d.date), s.gender);
    return { ...s, cells };
  });
  return { ...header, dateFrom, dateTo, days, students };
}

/** Section × class blocks of one day. Optionally restricted to one inscription. */
export async function getSectionDayReport(params: {
  schoolPeriodId: number; gradeId: number; sectionId: number; date: string; inscriptionId?: number;
}) {
  const { schoolPeriodId, gradeId, sectionId, date, inscriptionId } = params;
  const [allInscriptions, header, columns] = await Promise.all([
    loadSectionInscriptions(schoolPeriodId, gradeId, sectionId),
    sectionHeader(gradeId, sectionId),
    loadDayColumns(schoolPeriodId, gradeId, sectionId, date),
  ]);
  const inscriptions = inscriptionId
    ? allInscriptions.filter(i => i.id === inscriptionId)
    : allInscriptions;
  const records = await loadRecords(inscriptions.map(i => i.id), date, date);
  const students = inscriptions.map(ins => {
    const s = toReportStudent(ins);
    return { ...s, cells: dayCells(columns, records.get(ins.id)?.get(date), s.gender) };
  });
  return { ...header, date, dayShort: dayInfo(date).dayShort, columns, students };
}

/** One student: rows = weeks (Mon–Fri) covering the range. */
export async function getStudentWeeksReport(params: { inscriptionId: number; dateFrom: string; dateTo: string }) {
  const { inscriptionId, dateFrom, dateTo } = params;
  const ins = await Inscription.findByPk(inscriptionId, { include: inscriptionIncludes });
  if (!ins) throw new Error('Inscripción no encontrada');
  const student = toReportStudent(ins);
  const records = (await loadRecords([inscriptionId], dateFrom, dateTo)).get(inscriptionId);

  const weeks: { weekStart: string; weekEnd: string; days: { date: string; dayShort: string; inRange: boolean; cell: ReportCell | null }[] }[] = [];
  for (let monday = mondayOf(dateFrom); monday <= dateTo; monday = addDays(monday, 7)) {
    const days = [0, 1, 2, 3, 4].map(offset => {
      const date = addDays(monday, offset);
      const inRange = date >= dateFrom && date <= dateTo;
      return {
        ...dayInfo(date),
        inRange,
        cell: inRange ? summarizeDay(records?.get(date), student.gender) : null,
      };
    });
    weeks.push({ weekStart: monday, weekEnd: addDays(monday, 4), days });
    if (weeks.length > 60) break;
  }
  return {
    student,
    schoolPeriodId: (ins as any).schoolPeriodId,
    gradeId: (ins as any).gradeId,
    sectionId: (ins as any).sectionId,
    dateFrom,
    dateTo,
    weeks,
  };
}

/** One student × class blocks of one day (columns from the student's section timetable). */
export async function getStudentDayReport(params: { inscriptionId: number; date: string }) {
  const ins = await Inscription.findByPk(params.inscriptionId);
  if (!ins) throw new Error('Inscripción no encontrada');
  return getSectionDayReport({
    schoolPeriodId: (ins as any).schoolPeriodId,
    gradeId: (ins as any).gradeId,
    sectionId: (ins as any).sectionId,
    date: params.date,
    inscriptionId: params.inscriptionId,
  });
}

/** Name / document search over active inscriptions of a period. Every word must match. */
export async function searchStudents(schoolPeriodId: number, q: string) {
  const words = q.trim().split(/\s+/).filter(w => w.length > 0).slice(0, 5);
  if (words.length === 0) return [];
  const list = await Inscription.findAll({
    where: {
      schoolPeriodId,
      withdrawnAt: null,
      [Op.and]: words.map(w => ({
        [Op.or]: [
          { '$student.firstName$': { [Op.like]: `%${w}%` } },
          { '$student.lastName$': { [Op.like]: `%${w}%` } },
          { '$student.document$': { [Op.like]: `%${w}%` } },
        ],
      })),
    },
    include: inscriptionIncludes.map(i => ({ ...i, required: i.as === 'student' })),
    limit: 20,
    subQuery: false,
  });
  return (list as any[])
    .sort((a, b) => compareStudents(a.student ?? {}, b.student ?? {}))
    .map(toReportStudent);
}

// ── Statistical summary (list of students with attendance totals) ──

export interface AttendanceCounts {
  /** Class blocks. */
  totalBlocks: number;
  attendedBlocks: number;
  lateBlocks: number;
  absentBlocks: number;
  justifiedBlocks: number;
  kickedBlocks: number;
  /** Calendar days with at least one record. */
  totalDays: number;
  /** Days with at least one unjustified absence (jubilado included). */
  absentDays: number;
  /** Days whose only absences are justified. */
  justifiedDays: number;
  kickedDays: number;
  attendedDays: number;
}

export interface SummaryStudent extends ReportStudent, AttendanceCounts {
  withdrawn: boolean;
}

export interface SummaryRange {
  termId: number | null;
  termName: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

const emptyCounts = (): AttendanceCounts => ({
  totalBlocks: 0, attendedBlocks: 0, lateBlocks: 0, absentBlocks: 0, justifiedBlocks: 0, kickedBlocks: 0,
  totalDays: 0, absentDays: 0, justifiedDays: 0, kickedDays: 0, attendedDays: 0,
});

/** Counts of one student from its records grouped by date. */
export function countAttendance(byDate: Map<string, DayRecord[]> | undefined): AttendanceCounts {
  const c = emptyCounts();
  if (!byDate) return c;
  for (const records of byDate.values()) {
    if (records.length === 0) continue;
    let unjustified = 0;
    let justified = 0;
    let kicked = 0;
    for (const r of records) {
      c.totalBlocks += 1;
      if (isAttended(r.status)) c.attendedBlocks += 1;
      if (r.status === 'late') c.lateBlocks += 1;
      if (r.status === 'kicked') { c.kickedBlocks += 1; kicked += 1; }
      else if (r.status === 'absent' || r.status === 'excused') {
        if (isJustifiedAbsence(r.status, r.reason)) { c.justifiedBlocks += 1; justified += 1; }
        else { c.absentBlocks += 1; unjustified += 1; }
      }
    }
    c.totalDays += 1;
    if (kicked > 0) c.kickedDays += 1;
    if (unjustified > 0) c.absentDays += 1;
    else if (justified > 0) c.justifiedDays += 1;
    else c.attendedDays += 1;
  }
  return c;
}

const sumCounts = (list: AttendanceCounts[]): AttendanceCounts =>
  list.reduce((acc, c) => {
    (Object.keys(acc) as (keyof AttendanceCounts)[]).forEach(k => { acc[k] += c[k]; });
    return acc;
  }, emptyCounts());

const isoDate = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/** Date window of a term (lapso). Terms without both dates cannot bound attendance. */
export async function resolveSummaryRange(schoolPeriodId: number, termId?: number | null): Promise<SummaryRange> {
  if (!termId) return { termId: null, termName: null, dateFrom: null, dateTo: null };
  const term = await Term.findByPk(termId);
  if (!term || term.schoolPeriodId !== schoolPeriodId) {
    throw Object.assign(new Error('El lapso no pertenece al período'), { status: 400 });
  }
  if (!term.openDate || !term.closeDate) {
    throw Object.assign(new Error(`El lapso "${term.name}" no tiene fechas de inicio y cierre configuradas`), { status: 400 });
  }
  return { termId: term.id, termName: term.name, dateFrom: isoDate(term.openDate), dateTo: isoDate(term.closeDate) };
}

/**
 * Students of a period (withdrawn included, tagged) with their attendance
 * totals in blocks and days. Optionally restricted to a term, grade or section.
 * A withdrawn student keeps the section where they took classes.
 */
export async function getAttendanceSummary(params: {
  schoolPeriodId: number; termId?: number | null; gradeId?: number | null; sectionId?: number | null;
}) {
  const { schoolPeriodId, gradeId, sectionId } = params;
  const range = await resolveSummaryRange(schoolPeriodId, params.termId);

  const list = await Inscription.findAll({
    where: { schoolPeriodId, ...(gradeId ? { gradeId } : {}) },
    include: inscriptionIncludes,
  }) as any[];

  // Withdrawn inscriptions lost their sectionId: recover it from their subjects.
  const withdrawnIds = list.filter(i => i.withdrawnAt && !i.sectionId).map(i => i.id);
  const sectionByInscription = new Map<number, any>();
  if (withdrawnIds.length > 0) {
    const rows = await InscriptionSubject.findAll({
      where: { inscriptionId: withdrawnIds, sectionId: { [Op.ne]: null } } as any,
    }) as any[];
    const sectionIds = [...new Set(rows.map(r => r.sectionId))];
    const sections = await Section.findAll({ where: { id: sectionIds } });
    const sectionById = new Map(sections.map(s => [s.id, s]));
    for (const r of rows) {
      if (!sectionByInscription.has(r.inscriptionId)) sectionByInscription.set(r.inscriptionId, sectionById.get(r.sectionId) ?? null);
    }
  }

  const resolved = list
    .map(ins => ({ ins, section: ins.section ?? sectionByInscription.get(ins.id) ?? null }))
    // Materia Pendiente is a period-closure artifact, not a real section.
    .filter(({ section }) => !section?.isMateriaPendiente)
    .filter(({ ins, section }) => (ins.withdrawnAt || section) && (!sectionId || section?.id === sectionId));

  const records = await loadRecords(
    resolved.map(r => r.ins.id),
    range.dateFrom ?? '1900-01-01',
    range.dateTo ?? '2999-12-31',
  );

  // Grade → section → canonical nómina order.
  const students: SummaryStudent[] = resolved
    .sort((a, b) =>
      ((a.ins.grade?.order ?? 0) - (b.ins.grade?.order ?? 0))
      || String(a.section?.name ?? '').localeCompare(String(b.section?.name ?? ''), 'es')
      || compareStudents(a.ins.student ?? {}, b.ins.student ?? {}))
    .map(({ ins, section }) => ({
      ...toReportStudent({ id: ins.id, personId: ins.personId, student: ins.student, grade: ins.grade, section, rosterNumber: ins.rosterNumber }),
      withdrawn: !!ins.withdrawnAt,
      ...countAttendance(records.get(ins.id)),
    }));

  return { ...range, students, totals: sumCounts(students) };
}

export interface AbsenceDetailRow {
  recordId: number;
  date: string;
  periodId: string;
  start: string | null;
  end: string | null;
  subjectName: string | null;
  teacherName: string | null;
  status: AttendanceStatus;
  /** 'absent' = unjustified, 'jubilado' = unjustified after attending earlier in the same shift. */
  category: 'absent' | 'justified' | 'late' | 'kicked' | 'jubilado';
  reason: string | null;
}

/**
 * Every non-present record of one student, with date, class block, subject
 * and teacher — so the supervisor sees exactly when they missed.
 */
export async function getAbsenceDetail(params: { inscriptionId: number; termId?: number | null }) {
  const ins = await Inscription.findByPk(params.inscriptionId, { include: inscriptionIncludes }) as any;
  if (!ins) throw Object.assign(new Error('Inscripción no encontrada'), { status: 404 });
  const range = await resolveSummaryRange(ins.schoolPeriodId, params.termId);

  const records = await AttendanceRecord.findAll({
    where: { inscriptionId: ins.id },
    include: [{
      model: AttendanceSession,
      as: 'session',
      required: true,
      ...(range.dateFrom && range.dateTo ? { where: { sessionDate: { [Op.between]: [range.dateFrom, range.dateTo] } } } : {}),
      include: [{
        model: ScheduleEntry,
        as: 'scheduleEntry',
        include: [{ model: Subject, as: 'subject' }, { model: Person, as: 'teacher' }],
      }],
    }],
  }) as any[];

  const periodInfo = await getPeriodInfoMap();
  const byDate = new Map<string, { r: any; entry: any; sortKey: number }[]>();
  for (const r of records) {
    const entry = r.session?.scheduleEntry;
    if (!entry) continue;
    const date = String(r.session.sessionDate).slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push({ r, entry, sortKey: periodSortKey(entry.periodId) });
  }

  const rows: AbsenceDetailRow[] = [];
  for (const [date, items] of byDate) {
    items.sort((a, b) => a.sortKey - b.sortKey || a.r.id - b.r.id);
    for (const { r, entry, sortKey } of items) {
      const status = r.status as AttendanceStatus;
      if (status === 'present') continue;
      let category: AbsenceDetailRow['category'];
      if (status === 'late') category = 'late';
      else if (status === 'kicked') category = 'kicked';
      else if (isJustifiedAbsence(status, r.reason)) category = 'justified';
      else {
        const wasPresent = items.some(o => o.sortKey < sortKey
          && shiftOfKey(o.sortKey) === shiftOfKey(sortKey) && isAttended(o.r.status));
        category = wasPresent ? 'jubilado' : 'absent';
      }
      const t = entry.teacher;
      rows.push({
        recordId: r.id,
        date,
        periodId: entry.periodId,
        start: periodInfo.get(entry.periodId)?.start ?? null,
        end: periodInfo.get(entry.periodId)?.end ?? null,
        subjectName: entry.subject?.name ?? null,
        teacherName: t ? `${t.lastName}, ${t.firstName}` : null,
        status,
        category,
        reason: r.reason ?? null,
      });
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || periodSortKey(a.periodId) - periodSortKey(b.periodId));

  const dayRecords = await loadRecords([ins.id], range.dateFrom ?? '1900-01-01', range.dateTo ?? '2999-12-31');
  return {
    ...range,
    student: { ...toReportStudent(ins), withdrawn: !!ins.withdrawnAt },
    schoolPeriodId: ins.schoolPeriodId,
    counts: countAttendance(dayRecords.get(ins.id)),
    rows,
  };
}
