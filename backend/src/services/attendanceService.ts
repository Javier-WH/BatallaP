import { Op, Transaction } from 'sequelize';
import sequelize from '@/config/database';
import {
  AttendanceSession,
  AttendanceRecord,
  AttendanceAuditLog,
  ClearanceReason,
  Schedule,
  ScheduleEntry,
  PeriodGradeSection,
  PeriodGrade,
  Grade,
  Section,
  Subject,
  Person,
  SchoolPeriod,
  Inscription,
  InscriptionSubject,
  Term,
  Setting,
} from '@/models';
import { buildPeriodsFromSettings } from './diarioService';
import { resolveActiveGroupSubjectIds } from './subjectGroupService';
import { compareStudents } from './studentSortService';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'kicked';

const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused', 'kicked'];

// Spanish day names used by ScheduleEntry.day (Lunes..Viernes)
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Map a YYYY-MM-DD calendar date to the Spanish day name ('' on weekends). */
export function getDayNameForDate(dateStr: string): string {
  // Parse at noon UTC so the calendar day is stable across timezones.
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (isNaN(d.getTime())) return '';
  const name = DAY_NAMES[d.getUTCDay()];
  return name === 'Sábado' || name === 'Domingo' ? '' : name;
}

/** Sort key for period ids: morning (m1, m2...) before afternoon (t1, t2...). */
export function periodSortKey(periodId: string): number {
  const match = /^([mt])(\d+)$/.exec(periodId);
  if (!match) return 999;
  return (match[1] === 'm' ? 0 : 1) * 1000 + Number(match[2]);
}

export async function getPeriodInfoMap(): Promise<Map<string, { start: string; end: string }>> {
  const settingsRows = await Setting.findAll({ where: { key: { [Op.in]: [
    'time_format',
    'morning_start_time', 'morning_blocks_before_recess', 'morning_block_minutes_before',
    'morning_recess_minutes', 'morning_blocks_after_recess', 'morning_block_minutes_after',
    'afternoon_start_time', 'afternoon_blocks_before_recess', 'afternoon_block_minutes_before',
    'afternoon_recess_minutes', 'afternoon_blocks_after_recess', 'afternoon_block_minutes_after',
  ] } }, raw: true });
  const settings: Record<string, string> = {};
  for (const row of settingsRows) settings[row.key] = row.value;
  const periods = buildPeriodsFromSettings(settings);
  const map = new Map<string, { start: string; end: string }>();
  for (const p of [...periods.manana, ...periods.tarde]) map.set(p.id, { start: p.start, end: p.end });
  return map;
}

/**
 * Term a calendar date belongs to: the term whose open/close window contains
 * it, else the period's active term. Null when neither can be resolved —
 * group-subject rosters then fall back to enrollment heuristics.
 */
async function resolveTermIdForDate(schoolPeriodId: number, dateStr: string): Promise<number | null> {
  const byWindow = await Term.findOne({
    where: {
      schoolPeriodId,
      openDate: { [Op.lte]: dateStr },
      closeDate: { [Op.gte]: dateStr },
    },
    order: [['order', 'ASC']],
    attributes: ['id'],
  });
  if (byWindow) return byWindow.id;
  const active = await Term.findOne({ where: { schoolPeriodId, isActive: true }, attributes: ['id'] });
  return active ? active.id : null;
}

export interface TeacherSessionView {
  id: number;
  scheduleEntryId: number;
  sessionDate: string;
  status: string;
  day: string;
  periodId: string;
  periodStart: string | null;
  periodEnd: string | null;
  subjectId: number | null;
  subjectName: string | null;
  gradeName: string;
  sectionName: string;
  /** Human label of the section(s) this session covers, e.g. "Primer año A/B". */
  sectionLabel: string;
  counts: { present: number; absent: number; late: number; kicked: number; total: number };
}

/** Strip the "SECCIÓN" prefix so labels stay short ('SECCIÓN A' → 'A'). */
function shortSectionName(name: string | null | undefined): string {
  const raw = (name ?? '').trim();
  const stripped = raw.replace(/^secci[oó]n\s*/i, '').trim();
  return stripped || raw;
}

/**
 * Label for the section(s) covered by a session cluster. Same grade across the
 * cluster → 'Primer año A/B'; mixed grades → 'Cuarto año A · Quinto año B'.
 */
function buildSectionLabel(cluster: any[]): string {
  const parts = cluster.map(e => ({
    gradeName: e.schedule?.section?.periodGrade?.grade?.name ?? '',
    sec: shortSectionName(e.schedule?.section?.section?.name),
  }));
  const gradeNames = new Set(parts.map(p => p.gradeName));
  if (gradeNames.size === 1) {
    const secs = Array.from(new Set(parts.map(p => p.sec).filter(Boolean)));
    return `${parts[0].gradeName} ${secs.join('/')}`.trim();
  }
  return Array.from(new Set(parts.map(p => `${p.gradeName} ${p.sec}`.trim()))).join(' · ');
}

/**
 * Cluster schedule entries into physical class blocks.
 *
 * The timetable stores one entry per clock hour, so a multi-hour class is
 * several entries (e.g. m1 + m2). Entries of the same class spanning
 * consecutive periods merge into one cluster: the merged session spans the
 * whole block (7:00–8:30, or 2:50–5:40 with the recess inside) instead of
 * producing one card per hour.
 *
 *   - Regular subjects merge only within the same section schedule, subject,
 *     teacher and day.
 *   - Group subjects (isGroupSubject) are one class shared by several
 *     sections, so they additionally merge across sections of the same
 *     school period for the same teacher+subject+day.
 *
 * Contiguity is consecutive period numbering (m2 → m3): a recess inside a
 * class stretch does not split the block, while the morning/afternoon
 * boundary (m → t) always does. Entries are returned with the
 * earliest-period entry first.
 */
export function clusterEntriesIntoClassBlocks(
  entries: any[],
  periodInfoMap: Map<string, { start: string; end: string }>
): any[][] {
  const groups = new Map<string, any[]>();
  for (const e of entries) {
    const sp = e.schedule?.schoolPeriodId ?? e.schedule?.section?.periodGrade?.schoolPeriodId;
    if (!sp) continue;
    const key = e.isGroupSubject
      ? `g|${sp}|${e.day}|${e.teacherId}|${e.subjectId}`
      : `s|${e.scheduleId ?? e.schedule?.id}|${e.day}|${e.teacherId}|${e.subjectId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  const blocks: any[][] = [];
  for (const list of groups.values()) {
    list.sort((a, b) =>
      periodSortKey(a.periodId) - periodSortKey(b.periodId) || a.id - b.id);
    let run: any[] = [];
    let prevKey: number | null = null;
    for (const e of list) {
      const key = periodSortKey(e.periodId);
      if (prevKey !== null && key !== prevKey) {
        // New period in the run: keep the run only when it is the next
        // consecutive period number. A recess between periods is a break
        // inside the same class, not a new block.
        if (key - prevKey !== 1) {
          blocks.push(run);
          run = [];
        }
      }
      run.push(e);
      prevKey = key;
    }
    if (run.length > 0) blocks.push(run);
  }
  return blocks;
}

/** Period label for a merged block: 'm1' or 'm1-m2' when it spans periods. */
function blockPeriodLabel(block: any[]): string {
  const first = block[0]?.periodId ?? '';
  const last = block[block.length - 1]?.periodId ?? '';
  return first === last ? first : `${first}-${last}`;
}

/**
 * Entries of the class block a schedule entry belongs to (see
 * clusterEntriesIntoClassBlocks). Returns the entry alone when no siblings
 * exist. Entries come back ordered by period.
 */
async function findClassBlockEntries(
  entry: any,
  schoolPeriodId: number
): Promise<{ entries: any[]; periodInfoMap: Map<string, { start: string; end: string }> }> {
  const candidateWhere: any = entry.isGroupSubject
    ? { day: entry.day, teacherId: entry.teacherId, isGroupSubject: true }
    : {
        day: entry.day,
        teacherId: entry.teacherId,
        subjectId: entry.subjectId,
        scheduleId: entry.scheduleId,
      };
  const candidates = await ScheduleEntry.findAll({
    where: candidateWhere,
    include: [
      {
        model: Schedule,
        as: 'schedule',
        where: { schoolPeriodId },
        required: true,
        include: [
          {
            model: PeriodGradeSection,
            as: 'section',
            include: [
              { model: PeriodGrade, as: 'periodGrade', include: [{ model: Grade, as: 'grade' }] },
              { model: Section, as: 'section' },
            ],
          },
        ],
      },
    ],
    order: [['id', 'ASC']],
  });
  const periodInfoMap = await getPeriodInfoMap();
  if (candidates.length === 0) return { entries: [entry], periodInfoMap };
  const blocks = clusterEntriesIntoClassBlocks(candidates as any[], periodInfoMap);
  const mine = blocks.find(b => b.some(e => e.id === entry.id));
  return { entries: mine ?? [entry], periodInfoMap };
}

/**
 * A teacher's schedule entries for the given weekdays. Without an explicit
 * period, defaults to the active one so schedules from older periods do not
 * leak in as duplicated blocks.
 */
async function loadTeacherEntries(personId: number, dayNames: string[], schoolPeriodId?: number): Promise<any[]> {
  let effectivePeriodId = schoolPeriodId;
  if (!effectivePeriodId) {
    const active = await SchoolPeriod.findOne({ where: { status: 'activo' }, attributes: ['id'], raw: true });
    effectivePeriodId = (active as any)?.id;
  }
  return ScheduleEntry.findAll({
    where: { day: dayNames, teacherId: personId },
    include: [
      {
        model: Schedule,
        as: 'schedule',
        where: effectivePeriodId ? { schoolPeriodId: effectivePeriodId } : {},
        include: [
          {
            model: PeriodGradeSection,
            as: 'section',
            include: [
              { model: PeriodGrade, as: 'periodGrade', include: [{ model: Grade, as: 'grade' }] },
              { model: Section, as: 'section' },
            ],
          },
        ],
      },
      { model: Subject, as: 'subject' },
    ],
    order: [['id', 'ASC']],
  }) as Promise<any[]>;
}

/** Get-or-create the session of a class block on a date (canonical = lowest entry id). */
async function getOrCreateBlockSession(cluster: any[], dateStr: string) {
  const canonical = [...cluster].sort((a: any, b: any) => a.id - b.id)[0];
  const [session] = await AttendanceSession.findOrCreate({
    where: { scheduleEntryId: canonical.id, sessionDate: dateStr },
    defaults: {
      scheduleEntryId: canonical.id,
      schoolPeriodId: canonical.schedule.section.periodGrade.schoolPeriodId,
      sessionDate: dateStr,
      status: 'pending',
    },
  });
  return session;
}

/**
 * Get-or-create the attendance sessions for a teacher on a calendar date,
 * derived from the schedule entries for that weekday. Works for past dates
 * (paper backfill).
 *
 * Entries are clustered into physical class blocks by
 * clusterEntriesIntoClassBlocks: consecutive periods of the same class and
 * group-subject sections of one shared class merge into a single session
 * (canonical = lowest entry id). Records already saved in sibling sessions
 * are still counted so nothing is lost on live data.
 */
export async function getTeacherSessionsForDate(
  personId: number,
  dateStr: string,
  schoolPeriodId?: number
): Promise<TeacherSessionView[]> {
  const dayName = getDayNameForDate(dateStr);
  if (!dayName) return [];

  const entries = await loadTeacherEntries(personId, [dayName], schoolPeriodId);
  if (entries.length === 0) return [];

  const periodInfoMap = await getPeriodInfoMap();
  const blocks = clusterEntriesIntoClassBlocks(entries, periodInfoMap);

  const sessions: TeacherSessionView[] = [];
  for (const cluster of blocks) {
    const session = await getOrCreateBlockSession(cluster, dateStr);

    // Records may also live in sibling sessions created before the merge.
    const clusterSessions = await AttendanceSession.findAll({
      where: { scheduleEntryId: cluster.map((e: any) => e.id), sessionDate: dateStr },
      raw: true,
    });
    const clusterSessionIds = clusterSessions.map((s: any) => s.id);
    const records = clusterSessionIds.length > 0
      ? await AttendanceRecord.findAll({ where: { sessionId: clusterSessionIds }, raw: true })
      : [];

    // Deduplicate by inscription, preferring the canonical session's record.
    const byInscription = new Map<number, any>();
    for (const r of records as any[]) {
      const prev = byInscription.get(r.inscriptionId);
      if (!prev
        || (r.sessionId === session.id && prev.sessionId !== session.id)
        || (prev.sessionId !== session.id && r.sessionId !== session.id && r.id > prev.id)) {
        byInscription.set(r.inscriptionId, r);
      }
    }
    const mergedRecords = [...byInscription.values()];
    const counts = { present: 0, absent: 0, late: 0, kicked: 0, total: mergedRecords.length };
    for (const r of mergedRecords) {
      if (r.status === 'present') counts.present++;
      else if (r.status === 'absent') counts.absent++;
      else if (r.status === 'late') counts.late++;
      else if (r.status === 'kicked') counts.kicked++;
    }

    sessions.push({
      id: session.id,
      sessionDate: session.sessionDate,
      status: clusterSessions.some((s: any) => s.status === 'completed') ? 'completed' : session.status,
      ...buildBlockView(cluster, periodInfoMap),
      counts,
    });
  }

  return sortBlocksByPeriod(sessions);
}

type BlockView = Omit<TeacherSessionView, 'id' | 'sessionDate' | 'status' | 'counts'>;

/** Descriptive fields of a class block (canonical = lowest entry id). */
function buildBlockView(cluster: any[], periodInfoMap: Map<string, { start: string; end: string }>): BlockView {
  const canonical = [...cluster].sort((a: any, b: any) => a.id - b.id)[0];
  const pgs = canonical.schedule.section;
  const firstInfo = periodInfoMap.get(cluster[0].periodId) || null;
  const lastInfo = periodInfoMap.get(cluster[cluster.length - 1].periodId) || null;
  const subjectNames = Array.from(new Set(cluster.map((e: any) => e.subject?.name).filter(Boolean)));
  return {
    scheduleEntryId: canonical.id,
    day: canonical.day,
    periodId: blockPeriodLabel(cluster),
    periodStart: firstInfo?.start ?? null,
    periodEnd: lastInfo?.end ?? null,
    subjectId: canonical.subjectId,
    subjectName: subjectNames.join(' / ') || null,
    gradeName: pgs.periodGrade?.grade?.name ?? '',
    sectionName: pgs.section?.name ?? '',
    sectionLabel: buildSectionLabel(cluster),
  };
}

/** Sort by the block's first real period id (periodId may be a 'm1-m2' range). */
function sortBlocksByPeriod<T extends { periodId: string }>(blocks: T[]): T[] {
  return blocks.sort((a, b) =>
    periodSortKey(a.periodId.split('-')[0]) - periodSortKey(b.periodId.split('-')[0]));
}

/**
 * Active block against a student in the session being viewed.
 *  - 'retired' (jubilado): an un-cleared unjustified absence preceded by a
 *    presence (present/late/kicked) — the student came to school and left
 *    early. Triggered in the same shift it blocks the rest of that shift;
 *    triggered in an earlier shift it blocks the whole next
 *    shift-with-records until cleared once.
 *  - 'kicked' (expulsado): an un-cleared expulsion in an earlier class block of
 *    the same day and shift. Blocks the rest of that shift.
 *  - 'absent' (inasistente): an un-cleared unjustified absence in an earlier
 *    class block of the same day and shift. Blocks the rest of that shift.
 */
export interface PriorBlock {
  kind: 'retired' | 'kicked' | 'absent';
  subjectName: string | null;
  /** Period id of the class where the block was triggered. */
  periodId: string;
  status: 'absent' | 'kicked';
  /** Date and shift ('m'/'t') of the shift containing the trigger. */
  sessionDate: string;
  shift: 'm' | 't';
}

export interface SessionRosterEntry {
  inscriptionId: number;
  personId: number;
  document: string;
  fullName: string;
  /** Official section list number (Inscription.rosterNumber). */
  rosterNumber: number | null;
  /** Section label (e.g. 'A', or 'Cuarto año A' in mixed-grade group classes). */
  sectionLabel: string | null;
  status: AttendanceStatus | null;
  reason: string | null;
  blocked: boolean;
  clearedBy: number | null;
  clearedAt: Date | null;
  clearanceReasonCode: string | null;
  clearanceReasonNote: string | null;
  priorBlock: PriorBlock | null;
  recordId: number | null;
}

export interface SessionDetail {
  session: any;
  roster: SessionRosterEntry[];
}

/**
 * Students of the class block a schedule entry belongs to, in roster order.
 * The roster belongs to the whole class block: a class spanning several
 * consecutive periods merges its entries (records may live in sibling
 * sessions created before the merge), and group subjects additionally span
 * the sections sharing the class. dateStr picks the term for group subjects.
 */
async function resolveBlockRoster(entry: any, schoolPeriodId: number, dateStr: string) {
  const { entries: clusterEntries, periodInfoMap } = await findClassBlockEntries(entry, schoolPeriodId);

  const pgsList: {
    gradeId: number; sectionId: number; gradeName: string; sectionName: string;
    gradeOrder: number | null;
  }[] = [];
  const seenPgs = new Set<number>();
  for (const e of clusterEntries) {
    const s = e.schedule?.section;
    if (!s || seenPgs.has(s.id)) continue;
    seenPgs.add(s.id);
    pgsList.push({
      gradeId: s.periodGrade.gradeId,
      sectionId: s.sectionId,
      gradeName: s.periodGrade?.grade?.name ?? '',
      sectionName: s.section?.name ?? '',
      gradeOrder: s.periodGrade?.grade?.order ?? null,
    });
  }
  const sectionLabelByKey = new Map<string, string>();
  const sortMetaByKey = new Map<string, { gradeOrder: number; gradeName: string; sectionName: string }>();
  for (const p of pgsList) {
    const sec = shortSectionName(p.sectionName);
    // Roster rows always carry grade + section — in mixed-grade group classes
    // the section letter alone would be ambiguous.
    sectionLabelByKey.set(`${p.gradeId}|${p.sectionId}`, `${p.gradeName} ${sec}`.trim());
    sortMetaByKey.set(`${p.gradeId}|${p.sectionId}`, {
      gradeOrder: p.gradeOrder ?? 9999,
      gradeName: p.gradeName,
      sectionName: sec,
    });
  }

  const inscriptions = await Inscription.findAll({
    where: {
      schoolPeriodId: schoolPeriodId,
      withdrawnAt: null,
      [Op.or]: pgsList.map(p => ({ gradeId: p.gradeId, sectionId: p.sectionId })),
    },
    include: [{ model: Person, as: 'student' }],
    order: [[{ model: Person, as: 'student' }, 'lastName', 'ASC']],
  });

  // Group subjects hold only the students taking them this term — a subset of
  // each section, not the whole roster. Resolution mirrors the grades view:
  // term choice → enrollment with qualifications → earliest enrollment.
  let rosterInscriptions = inscriptions as any[];
  if (entry.isGroupSubject) {
    const clusterSubjectIds = new Set(
      clusterEntries.map(e => e.subjectId).filter((x): x is number => x != null)
    );
    if (clusterSubjectIds.size > 0) {
      const groupSubjects = await Subject.findAll({
        where: { id: [...clusterSubjectIds] },
        attributes: ['id', 'subjectGroupId'],
        raw: true,
      });
      const groupIds = [...new Set(
        (groupSubjects as any[]).map(s => s.subjectGroupId).filter((g): g is number => g != null)
      )];
      if (groupIds.length > 0) {
        const termId = await resolveTermIdForDate(
          schoolPeriodId,
          dateStr
        );
        const keep = new Set<number>();
        for (const gid of groupIds) {
          const resolved = await resolveActiveGroupSubjectIds(
            rosterInscriptions.map(i => i.id), gid, termId
          );
          for (const [insId, subjectId] of resolved) {
            if (clusterSubjectIds.has(subjectId)) keep.add(insId);
          }
        }
        rosterInscriptions = rosterInscriptions.filter(i => keep.has(i.id));
      }
    }
  }

  // Sections grouped in order (A before B…) — within each section, the
  // canonical nomina order: document type → document number → surname → name.
  // Single-section rosters reduce to the canonical order alone.
  const sortMeta = (ins: any) =>
    sortMetaByKey.get(`${ins.gradeId}|${ins.sectionId}`)
    ?? { gradeOrder: 9999, gradeName: '', sectionName: '' };
  const cmpStr = (a: string, b: string) =>
    (a || '').trim().toLowerCase().localeCompare((b || '').trim().toLowerCase(), 'es');
  rosterInscriptions.sort((a, b) => {
    const ma = sortMeta(a);
    const mb = sortMeta(b);
    return (ma.gradeOrder - mb.gradeOrder)
      || cmpStr(ma.gradeName, mb.gradeName)
      || cmpStr(ma.sectionName, mb.sectionName)
      || compareStudents(a.student, b.student);
  });

  return { clusterEntries, periodInfoMap, rosterInscriptions, sectionLabelByKey };
}

export interface RosterIdentity {
  inscriptionId: number;
  personId: number;
  document: string;
  fullName: string;
  sectionLabel: string | null;
  /** Section list number in canonical order; null when not yet assigned. */
  rosterNumber: number | null;
}

function rosterIdentity(ins: any, sectionLabelByKey: Map<string, string>): RosterIdentity {
  return {
    inscriptionId: ins.id,
    personId: ins.personId,
    document: ins.student?.document ?? '',
    fullName: `${ins.student?.lastName ?? ''}, ${ins.student?.firstName ?? ''}`.trim(),
    sectionLabel: sectionLabelByKey.get(`${ins.gradeId}|${ins.sectionId}`) ?? null,
    rosterNumber: ins.rosterNumber ?? null,
  };
}

/** Roster of the session's section with each student's attendance record. */
export async function getSessionDetail(sessionId: number): Promise<SessionDetail> {
  const session = await AttendanceSession.findByPk(sessionId, {
    include: [
      {
        model: ScheduleEntry,
        as: 'scheduleEntry',
        include: [
          {
            model: Schedule,
            as: 'schedule',
            include: [
              {
                model: PeriodGradeSection,
                as: 'section',
                include: [
                  { model: PeriodGrade, as: 'periodGrade', include: [{ model: Grade, as: 'grade' }] },
                  { model: Section, as: 'section' },
                ],
              },
            ],
          },
          { model: Subject, as: 'subject' },
          { model: Person, as: 'teacher' },
        ],
      },
    ],
  });
  if (!session) throw new Error('Sesión de asistencia no encontrada');

  const entry = (session as any).scheduleEntry;
  const { clusterEntries, periodInfoMap, rosterInscriptions, sectionLabelByKey } = await resolveBlockRoster(
    entry, (session as any).schoolPeriodId, (session as any).sessionDate
  );

  // Merge records from the canonical session and any sibling sessions created
  // before group slots were merged (live data may have them).
  const clusterSessionRows = await AttendanceSession.findAll({
    where: {
      scheduleEntryId: clusterEntries.map(e => e.id),
      sessionDate: (session as any).sessionDate,
    },
    raw: true,
  });
  const clusterSessionIds = clusterSessionRows.map((s: any) => s.id);
  if (!clusterSessionIds.includes(session.id)) clusterSessionIds.push(session.id);
  const records = await AttendanceRecord.findAll({ where: { sessionId: clusterSessionIds } });
  const byInscription = new Map<number, any>();
  for (const r of records as any[]) {
    const prev = byInscription.get(r.inscriptionId);
    if (!prev
      || (r.sessionId === session.id && prev.sessionId !== session.id)
      || (prev.sessionId !== session.id && r.sessionId !== session.id && r.id > prev.id)) {
      byInscription.set(r.inscriptionId, r);
    }
  }

  // Blocks are computed live from the record timeline — never inferred from the
  // stored `blocked` flag, so fixing or clearing an earlier record takes effect
  // immediately. See computeSessionBlocks for the two rules (retired/kicked).
  const rosterInscriptionIds = rosterInscriptions.map(i => i.id);
  const clusterEntryIds = new Set(clusterEntries.map(e => e.id));
  const blockStartKey = Math.min(...clusterEntries.map(e => periodSortKey(e.periodId)));
  const priorByInscription = await computeSessionBlocks(
    (session as any).sessionDate,
    blockStartKey,
    clusterEntryIds,
    rosterInscriptionIds
  );

  const roster: SessionRosterEntry[] = rosterInscriptions.map(ins => {
    const record = byInscription.get(ins.id) || null;
    return {
      ...rosterIdentity(ins, sectionLabelByKey),
      status: record?.status ?? null,
      reason: record?.reason ?? null,
      blocked: record?.blocked ?? false,
      clearedBy: record?.clearedBy ?? null,
      clearedAt: record?.clearedAt ?? null,
      clearanceReasonCode: record?.clearanceReasonCode ?? null,
      clearanceReasonNote: record?.clearanceReasonNote ?? null,
      priorBlock: priorByInscription.get(ins.id) ?? null,
      recordId: record?.id ?? null,
    };
  });

  const firstInfo = periodInfoMap.get(clusterEntries[0]?.periodId ?? entry.periodId) ?? null;
  const lastInfo = periodInfoMap.get(clusterEntries[clusterEntries.length - 1]?.periodId ?? entry.periodId) ?? null;
  const sessionJson = session.toJSON() as any;
  sessionJson.periodId = blockPeriodLabel(clusterEntries);
  sessionJson.periodStart = firstInfo?.start ?? null;
  sessionJson.periodEnd = lastInfo?.end ?? null;
  sessionJson.sectionLabel = buildSectionLabel(clusterEntries);

  return { session: sessionJson, roster };
}

export interface AttendanceRecordInput {
  inscriptionId: number;
  status: AttendanceStatus;
  reason?: string | null;
}

export interface SaveRecordsResult {
  created: number;
  updated: number;
  unchanged: number;
}

/**
 * Bulk upsert attendance records for a session. Writes an append-only audit
 * entry for every creation and status change. Students under an active block
 * (retired from a previous shift, or kicked earlier this shift) cannot be
 * given a non-absent status: they must be cleared first. 'absent' writes are
 * allowed so a blocked student who simply did not come can still be marked.
 */
export async function saveSessionRecords(
  sessionId: number,
  records: AttendanceRecordInput[],
  performedByPersonId: number
): Promise<SaveRecordsResult> {
  const session = await AttendanceSession.findByPk(sessionId);
  if (!session) throw new Error('Sesión de asistencia no encontrada');

  for (const input of records) {
    if (!ATTENDANCE_STATUSES.includes(input.status)) {
      throw new Error(`Estado de asistencia inválido: ${input.status}`);
    }
    if (input.status === 'kicked' && !input.reason?.trim()) {
      throw new Error('Debe indicar un motivo para expulsiones');
    }
  }

  const result: SaveRecordsResult = { created: 0, updated: 0, unchanged: 0 };
  const t: Transaction = await sequelize.transaction();
  try {
    // Resolve this session's class block once: records saved in sibling
    // sessions of the same block must not self-block the student.
    const { blockEntryIds, blockStartKey } = await resolveSessionBlock(session, t);
    const blockMap = await computeSessionBlocks(
      (session as any).sessionDate,
      blockStartKey,
      blockEntryIds,
      records.map(r => r.inscriptionId),
      t
    );

    const existing = await AttendanceRecord.findAll({
      where: { sessionId, inscriptionId: records.map(r => r.inscriptionId) },
      transaction: t,
    });
    const byInscription = new Map<number, any>();
    for (const r of existing as any[]) byInscription.set(r.inscriptionId, r);

    // A blocked student's write is rejected only when it would create or
    // CHANGE the record — re-saving an identical value stays a harmless no-op.
    const blockedIds = records
      .filter(input => {
        if (!blockMap.has(input.inscriptionId) || input.status === 'absent') return false;
        const current = byInscription.get(input.inscriptionId);
        const same = current && current.status === input.status
          && (current.reason ?? null) === (input.reason?.trim() || null);
        return !same;
      })
      .map(input => input.inscriptionId);
    if (blockedIds.length > 0) {
      const inscriptions = await Inscription.findAll({
        where: { id: blockedIds },
        include: [{ model: Person, as: 'student' }],
        transaction: t,
      });
      const names = inscriptions.map((i: any) =>
        `${i.student?.lastName ?? ''}, ${i.student?.firstName ?? ''}`.trim() || `#${i.id}`);
      throw new Error(
        `${names.join('; ')} ${blockedIds.length === 1 ? 'está bloqueado' : 'están bloqueados'} `
        + '(jubilado, inasistente o expulsado): debe desbloquearse antes de registrar asistencia.'
      );
    }

    for (const input of records) {
      const current = byInscription.get(input.inscriptionId) || null;

      if (!current) {
        const blocked = blockMap.has(input.inscriptionId);
        const record = await AttendanceRecord.create({
          sessionId,
          inscriptionId: input.inscriptionId,
          teacherId: performedByPersonId,
          status: input.status,
          reason: input.reason?.trim() || null,
          blocked,
          markedAt: new Date(),
        }, { transaction: t });

        await AttendanceAuditLog.create({
          attendanceRecordId: record.id,
          action: 'marked',
          performedBy: performedByPersonId,
          newValue: { status: input.status, reason: input.reason?.trim() || null },
          timestamp: new Date(),
        }, { transaction: t });

        if (blocked) {
          await AttendanceAuditLog.create({
            attendanceRecordId: record.id,
            action: 'blocked',
            performedBy: performedByPersonId,
            previousValue: { blocked: false },
            newValue: { blocked: true },
            timestamp: new Date(),
          }, { transaction: t });
        }
        result.created++;
      } else {
        const statusChanged = current.status !== input.status;
        const reasonChanged = (current.reason ?? null) !== (input.reason?.trim() || null);
        if (statusChanged || reasonChanged) {
          // Capture previous values BEFORE the update mutates the instance
          const previousValue: Record<string, unknown> = { status: current.status };
          if (reasonChanged) previousValue.reason = current.reason ?? null;

          await current.update({
            status: input.status,
            reason: input.reason?.trim() || null,
            teacherId: performedByPersonId,
            markedAt: new Date(),
            // Keep the flag honest: cleared/lifted blocks must not linger.
            blocked: blockMap.has(input.inscriptionId),
          }, { transaction: t });

          const newValue: Record<string, unknown> = { status: input.status };
          if (reasonChanged) newValue.reason = input.reason?.trim() || null;

          await AttendanceAuditLog.create({
            attendanceRecordId: current.id,
            action: 'status_changed',
            performedBy: performedByPersonId,
            previousValue,
            newValue,
            timestamp: new Date(),
          }, { transaction: t });
          result.updated++;
        } else {
          result.unchanged++;
        }
      }
    }

    await session.update({ status: 'completed' }, { transaction: t });
    await t.commit();
    return result;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

/* ---------------- Offline support (teacher PWA) ---------------- */

const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

export interface TemplateBlock extends BlockView {
  roster: RosterIdentity[];
}

export interface TeacherWeekTemplate {
  schoolPeriodId: number | null;
  generatedAt: string;
  /** Blocks per weekday name (Lunes..Viernes), in period order. */
  days: Record<string, TemplateBlock[]>;
}

/**
 * The teacher's weekly timetable with each block's roster, without creating
 * sessions. The phone caches it so attendance can be taken offline on any
 * date: the weekday picks the blocks, the calendar date identifies the
 * session when it syncs. Rosters resolve group subjects for dateStr's term.
 */
export async function getTeacherWeekTemplate(personId: number, dateStr: string): Promise<TeacherWeekTemplate> {
  const days: Record<string, TemplateBlock[]> = Object.fromEntries(WEEKDAY_NAMES.map(d => [d, []]));
  const active = await SchoolPeriod.findOne({ where: { status: 'activo' }, attributes: ['id'], raw: true });
  const schoolPeriodId: number | null = (active as any)?.id ?? null;
  if (!schoolPeriodId) return { schoolPeriodId, generatedAt: new Date().toISOString(), days };

  const entries = await loadTeacherEntries(personId, WEEKDAY_NAMES, schoolPeriodId);
  const periodInfoMap = await getPeriodInfoMap();
  for (const cluster of clusterEntriesIntoClassBlocks(entries, periodInfoMap)) {
    const view = buildBlockView(cluster, periodInfoMap);
    const canonical = cluster.find((e: any) => e.id === view.scheduleEntryId);
    const { rosterInscriptions, sectionLabelByKey } = await resolveBlockRoster(canonical, schoolPeriodId, dateStr);
    days[view.day]?.push({ ...view, roster: rosterInscriptions.map(ins => rosterIdentity(ins, sectionLabelByKey)) });
  }
  for (const d of WEEKDAY_NAMES) sortBlocksByPeriod(days[d]);
  return { schoolPeriodId, generatedAt: new Date().toISOString(), days };
}

export interface OfflineRecordInput extends AttendanceRecordInput {
  /** Value the phone had for this student when the teacher marked it (null = empty). */
  baseStatus: AttendanceStatus | null;
  baseReason?: string | null;
}

export interface OfflineSyncConflict {
  inscriptionId: number;
  /** 1-based position in the current roster (the teacher's list number). */
  listNumber: number;
  fullName: string;
  serverStatus: AttendanceStatus | null;
  serverReason: string | null;
}

export interface OfflineSyncResult extends SaveRecordsResult {
  sessionId: number;
  conflicts: OfflineSyncConflict[];
  /** Students no longer in the block's roster (withdrawn, moved section…). */
  notInRoster: number[];
  /**
   * Students skipped because they are under an active block (retired/kicked):
   * only 'absent' writes apply to them; they must be cleared online.
   */
  blockedStudents: { inscriptionId: number; listNumber: number; fullName: string }[];
}

/** Teacher of a schedule entry (null when the entry does not exist). */
export async function getScheduleEntryTeacherId(scheduleEntryId: number): Promise<number | null> {
  const entry = await ScheduleEntry.findByPk(scheduleEntryId, { attributes: ['teacherId'], raw: true });
  return (entry as any)?.teacherId ?? null;
}

/**
 * Apply attendance taken offline, identified by (block, date) instead of a
 * session id — the session is created on demand like when the teacher opens
 * the day online. Optimistic concurrency: a student's mark only applies when
 * the server still holds the value the phone had when marking it; otherwise
 * the server value (e.g. a Control de Estudios correction) is kept and the
 * student is reported as a conflict.
 */
export async function saveOfflineRecords(
  scheduleEntryId: number,
  sessionDate: string,
  records: OfflineRecordInput[],
  performedByPersonId: number
): Promise<OfflineSyncResult> {
  const entry = await ScheduleEntry.findByPk(scheduleEntryId, {
    include: [{
      model: Schedule,
      as: 'schedule',
      include: [{ model: PeriodGradeSection, as: 'section', include: [{ model: PeriodGrade, as: 'periodGrade' }] }],
    }],
  });
  if (!entry) throw new Error('Bloque de horario no encontrado');
  if (getDayNameForDate(sessionDate) !== (entry as any).day) {
    throw new Error('La fecha no corresponde al día de este bloque');
  }
  // Allow one day of slack for the phone/server timezone difference.
  const maxDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (sessionDate > maxDate) throw new Error('No se puede registrar asistencia de una fecha futura');

  const { entries: cluster } = await findClassBlockEntries(entry, (entry as any).schedule.schoolPeriodId);
  const session = await getOrCreateBlockSession(cluster, sessionDate);
  const { roster } = await getSessionDetail(session.id);
  const indexById = new Map(roster.map((r, i) => [r.inscriptionId, i]));

  const { blockEntryIds, blockStartKey } = await resolveSessionBlock(session);
  const blockMap = await computeSessionBlocks(
    sessionDate, blockStartKey, blockEntryIds, records.map(r => r.inscriptionId)
  );

  const norm = (reason: string | null | undefined) => reason?.trim() || null;
  const conflicts: OfflineSyncConflict[] = [];
  const notInRoster: number[] = [];
  const blockedStudents: OfflineSyncResult['blockedStudents'] = [];
  const accepted: AttendanceRecordInput[] = [];
  for (const input of records) {
    const idx = indexById.get(input.inscriptionId);
    if (idx === undefined) {
      notInRoster.push(input.inscriptionId);
      continue;
    }
    const current = roster[idx];
    const alreadyApplied = current.status === input.status && norm(current.reason) === norm(input.reason);
    const untouched = current.status === (input.baseStatus ?? null) && norm(current.reason) === norm(input.baseReason);
    if (!alreadyApplied && !untouched) {
      conflicts.push({
        inscriptionId: current.inscriptionId,
        listNumber: current.rosterNumber ?? idx + 1,
        fullName: current.fullName,
        serverStatus: current.status,
        serverReason: current.reason,
      });
      continue;
    }
    // A live block (appeared while the phone was offline) rejects non-absent
    // writes; 'absent' and no-op rewrites still go through.
    if (blockMap.has(input.inscriptionId) && input.status !== 'absent' && !alreadyApplied) {
      blockedStudents.push({
        inscriptionId: current.inscriptionId,
        listNumber: current.rosterNumber ?? idx + 1,
        fullName: current.fullName,
      });
      continue;
    }
    accepted.push({ inscriptionId: input.inscriptionId, status: input.status, reason: input.reason ?? null });
  }

  const result = accepted.length > 0
    ? await saveSessionRecords(session.id, accepted, performedByPersonId)
    : { created: 0, updated: 0, unchanged: 0 };
  return { sessionId: session.id, ...result, conflicts, notInRoster, blockedStudents };
}

/** Resolve the class block of a session: entry ids and earliest period key. */
async function resolveSessionBlock(
  session: any,
  t?: Transaction
): Promise<{ blockEntryIds: Set<number>; blockStartKey: number }> {
  const sessionEntry = await ScheduleEntry.findByPk((session as any).scheduleEntryId, { transaction: t });
  const blockEntryIds = new Set<number>([(session as any).scheduleEntryId]);
  let blockStartKey = periodSortKey(sessionEntry?.periodId ?? '');
  if (sessionEntry) {
    const { entries: blockEntries } = await findClassBlockEntries(sessionEntry, (session as any).schoolPeriodId);
    for (const e of blockEntries) {
      blockEntryIds.add(e.id);
      blockStartKey = Math.min(blockStartKey, periodSortKey(e.periodId));
    }
  }
  return { blockEntryIds, blockStartKey };
}

/** 'm' (morning) periods sort below 1000; 't' (afternoon) at 1000+. */
export const shiftOfKey = (key: number): 'm' | 't' => (key < 1000 ? 'm' : 't');

/** Statuses that count as "the student was there" for the retirement rule. */
const PRESENCE_STATUSES: AttendanceStatus[] = ['present', 'late', 'kicked'];

/** An absent mark is justified when it carries one of these reasons. */
const JUSTIFYING_ABSENT_REASONS = new Set(['justificado', 'enfermo']);
const isUnjustifiedAbsence = (status: AttendanceStatus, reason: string | null) =>
  status === 'absent' && !JUSTIFYING_ABSENT_REASONS.has((reason ?? '').trim().toLowerCase());

/** Add days to a YYYY-MM-DD string (noon UTC keeps the day stable). */
const shiftDays = (dateStr: string, days: number): string =>
  new Date(Date.parse(`${dateStr}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

/** One attendance record flattened to what the block rules need. */
interface DayRecord {
  date: string;
  shift: 'm' | 't';
  /** periodSortKey of the record's class block (its session's canonical entry). */
  key: number;
  status: AttendanceStatus;
  reason: string | null;
  clearedAt: Date | null;
  /** True when the record's session belongs to the class block being viewed. */
  inCluster: boolean;
  subjectName: string | null;
  periodId: string;
}

/**
 * Compute the active block of each student for one session, live from their
 * attendance records (last 45 days). Two independent rules:
 *
 *  - 'kicked': an un-cleared expulsion in an EARLIER class block of the same
 *    day+shift blocks the rest of the shift. Records inside the same class
 *    block never self-block. A clearance recorded in a LATER class of the
 *    same shift (or in this very block) lifts it.
 *  - 'absent' (inasistente): an un-cleared unjustified absence in an EARLIER
 *    class block of the same day+shift blocks the rest of the shift — the
 *    student was not in school for that class. When that absence was preceded
 *    by a same-shift presence it is reported as 'retired' instead (the
 *    student came and left early). Justified absences (Justificado/Enfermo)
 *    never block. When both in-shift rules fire, the most recent event wins.
 *    A clearance frees the shift until a NEW event re-blocks the student.
 *  - 'retired' (jubilado): in the student's most recent earlier shift WITH
 *    records — afternoon of the same day, or a previous day's shift — a
 *    presence followed later by an unjustified absence means they left school
 *    early. The whole following shift is blocked until cleared once; a
 *    clearance in any class of the blocked shift lifts it for the rest.
 *
 * The block waits for the student: if they produce no records in the blocked
 * shift (nobody could mark them), the NEXT shift with records still sees it.
 */
async function computeSessionBlocks(
  sessionDate: string,
  blockStartKey: number,
  clusterEntryIds: Set<number>,
  inscriptionIds: number[],
  t?: Transaction
): Promise<Map<number, PriorBlock>> {
  const result = new Map<number, PriorBlock>();
  if (inscriptionIds.length === 0) return result;
  const currentShift = shiftOfKey(blockStartKey);

  const rows = await AttendanceRecord.findAll({
    where: { inscriptionId: inscriptionIds },
    include: [
      {
        model: AttendanceSession,
        as: 'session',
        required: true,
        where: { sessionDate: { [Op.gte]: shiftDays(sessionDate, -45), [Op.lte]: sessionDate } },
        include: [{ model: ScheduleEntry, as: 'scheduleEntry', include: [{ model: Subject, as: 'subject' }] }],
      },
    ],
    transaction: t,
  });

  const byStudent = new Map<number, DayRecord[]>();
  for (const r of rows as any[]) {
    const entry = r.session?.scheduleEntry;
    if (!entry?.periodId) continue;
    const d: DayRecord = {
      date: r.session.sessionDate,
      shift: entry.periodId.startsWith('t') ? 't' : 'm',
      key: periodSortKey(entry.periodId),
      status: r.status,
      reason: r.reason ?? null,
      clearedAt: r.clearedAt ?? null,
      inCluster: clusterEntryIds.has(entry.id),
      subjectName: entry.subject?.name ?? null,
      periodId: entry.periodId,
    };
    const list = byStudent.get(r.inscriptionId) ?? [];
    list.push(d);
    byStudent.set(r.inscriptionId, list);
  }

  // 'YYYY-MM-DD|m' < 'YYYY-MM-DD|t' — ISO dates and 'm'<'t' sort lexicographically.
  const shiftOrder = (d: DayRecord) => `${d.date}|${d.shift}`;

  for (const [inscriptionId, recs] of byStudent) {
    // Same-shift blocks — kicked or inasistente in an earlier class block.
    // The most recent un-cleared event determines the shown block.
    const inSameShift = (d: DayRecord) =>
      d.date === sessionDate && d.shift === currentShift && !d.inCluster && d.key < blockStartKey;
    const freedAfter = (key: number) => recs.some(d => d.date === sessionDate
      && d.shift === currentShift && d.clearedAt !== null && d.key > key && d.key <= blockStartKey);

    const kick = recs
      .filter(d => inSameShift(d) && d.status === 'kicked' && d.clearedAt === null && !freedAfter(d.key))
      .sort((a, b) => b.key - a.key)[0];
    const away = recs
      .filter(d => inSameShift(d) && isUnjustifiedAbsence(d.status, d.reason)
        && d.clearedAt === null && !freedAfter(d.key))
      .sort((a, b) => b.key - a.key)[0];
    const inShift = kick && away ? (kick.key >= away.key ? kick : away) : (kick ?? away);
    if (inShift) {
      // An in-shift absence after an earlier same-shift presence is a
      // retirement (the student was there and left); otherwise inasistente.
      const hadPresence = recs.some(d => d.date === sessionDate && d.shift === currentShift
        && PRESENCE_STATUSES.includes(d.status) && d.key < inShift.key);
      const kind: PriorBlock['kind'] = inShift.status === 'kicked'
        ? 'kicked'
        : hadPresence ? 'retired' : 'absent';
      result.set(inscriptionId, {
        kind, subjectName: inShift.subjectName, periodId: inShift.periodId,
        status: inShift.status === 'kicked' ? 'kicked' : 'absent',
        sessionDate: inShift.date, shift: inShift.shift,
      });
      continue;
    }

    // Rule 1 — retired in the most recent earlier shift WITH records.
    const earlier = recs.filter(d => shiftOrder(d) < `${sessionDate}|${currentShift}`);
    if (earlier.length === 0) continue;
    const lastShift = earlier.reduce((max, d) => (shiftOrder(d) > max ? shiftOrder(d) : max), '');
    const prev = earlier.filter(d => shiftOrder(d) === lastShift).sort((a, b) => a.key - b.key);
    const trigger = prev.find((d, i) =>
      isUnjustifiedAbsence(d.status, d.reason)
      && prev.slice(0, i).some(p => PRESENCE_STATUSES.includes(p.status)));
    if (!trigger || trigger.clearedAt !== null) continue;
    const freedHere = recs.some(d => d.date === sessionDate && d.shift === currentShift
      && d.clearedAt !== null && d.key <= blockStartKey);
    if (freedHere) continue;
    result.set(inscriptionId, {
      kind: 'retired', subjectName: trigger.subjectName, periodId: trigger.periodId,
      status: 'absent', sessionDate: trigger.date, shift: trigger.shift,
    });
  }
  return result;
}

/**
 * Clear a block on an attendance record. Requires an active clearance reason;
 * reasons with requiresNote need a non-empty note. Fully audited.
 *
 * The stored `blocked` flag is the normal gate, but a record whose flag is
 * false can still be under a live block (e.g. saved before the triggering
 * record existed). In that case the flag is fixed and the clearance proceeds —
 * a visible block must always be clearable.
 */
export async function clearAttendanceBlock(
  recordId: number,
  clearedByPersonId: number,
  reasonCode: string,
  reasonNote: string | null
): Promise<AttendanceRecord> {
  const record = await AttendanceRecord.findByPk(recordId, {
    include: [{ model: AttendanceSession, as: 'session' }],
  });
  if (!record) throw new Error('Registro de asistencia no encontrado');
  if (!(record as any).blocked) {
    const session = (record as any).session;
    const { blockEntryIds, blockStartKey } = await resolveSessionBlock(session);
    const live = await computeSessionBlocks(
      session.sessionDate, blockStartKey, blockEntryIds, [(record as any).inscriptionId]
    );
    if (!live.has((record as any).inscriptionId)) throw new Error('El registro no está bloqueado');
    await record.update({ blocked: true });
    await AttendanceAuditLog.create({
      attendanceRecordId: record.id,
      action: 'blocked',
      performedBy: clearedByPersonId,
      previousValue: { blocked: false },
      newValue: { blocked: true },
      timestamp: new Date(),
    });
  }

  const reason = await ClearanceReason.findOne({ where: { code: reasonCode, active: true } });
  if (!reason) throw new Error('Motivo de desbloqueo inválido');
  if (reason.requiresNote && !reasonNote?.trim()) {
    throw new Error('Debe especificar el motivo');
  }

  const t: Transaction = await sequelize.transaction();
  try {
    await record.update({
      blocked: false,
      clearedBy: clearedByPersonId,
      clearedAt: new Date(),
      clearanceReasonCode: reason.code,
      clearanceReasonNote: reasonNote?.trim() || null,
    }, { transaction: t });

    await AttendanceAuditLog.create({
      attendanceRecordId: record.id,
      action: 'cleared',
      performedBy: clearedByPersonId,
      reasonCode: reason.code,
      reasonNote: reasonNote?.trim() || null,
      previousValue: { blocked: true },
      newValue: { blocked: false, clearedBy: clearedByPersonId },
      timestamp: new Date(),
    }, { transaction: t });

    await t.commit();
    return record;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

const DEFAULT_CLEARANCE_REASONS = [
  { code: 'nurse_visit', label: 'Enfermo', requiresNote: false },
  { code: 'admin_authorized', label: 'Autorizado por Administración', requiresNote: false },
  { code: 'parent_note', label: 'Llegó tarde', requiresNote: false },
  { code: 'other', label: 'Otro (especificar)', requiresNote: true },
];

/** List active clearance reasons, seeding defaults on first use. */
export async function listClearanceReasons() {
  const existing = await ClearanceReason.findAll({ where: { active: true }, order: [['id', 'ASC']] });
  if (existing.length > 0) return existing;

  await ClearanceReason.bulkCreate(DEFAULT_CLEARANCE_REASONS.map(r => ({ ...r, active: true })));
  return ClearanceReason.findAll({ where: { active: true }, order: [['id', 'ASC']] });
}

/**
 * Clear a live block directly from the session UI. Creates the student's
 * record for this session if it does not exist yet (status 'present' — the
 * student is physically in class), then applies the clearance. Fully audited:
 * 'marked' + 'blocked' + 'cleared'. Throws when there is no live block, so a
 * stray record is never created for an unblocked student.
 */
export async function clearSessionBlock(
  sessionId: number,
  inscriptionId: number,
  clearedByPersonId: number,
  reasonCode: string,
  reasonNote: string | null
): Promise<AttendanceRecord> {
  const session = await AttendanceSession.findByPk(sessionId);
  if (!session) throw new Error('Sesión de asistencia no encontrada');

  const { blockEntryIds, blockStartKey } = await resolveSessionBlock(session);
  const blockMap = await computeSessionBlocks(
    (session as any).sessionDate, blockStartKey, blockEntryIds, [inscriptionId]
  );
  if (!blockMap.has(inscriptionId)) {
    throw new Error('El estudiante no está bloqueado en esta sesión');
  }

  let record = await AttendanceRecord.findOne({ where: { sessionId, inscriptionId } });

  if (!record) {
    const t: Transaction = await sequelize.transaction();
    try {
      record = await AttendanceRecord.create({
        sessionId,
        inscriptionId,
        teacherId: clearedByPersonId,
        status: 'present',
        blocked: true,
        markedAt: new Date(),
      }, { transaction: t });

      await AttendanceAuditLog.create({
        attendanceRecordId: record.id,
        action: 'marked',
        performedBy: clearedByPersonId,
        newValue: { status: 'present', reason: null },
        timestamp: new Date(),
      }, { transaction: t });
      await AttendanceAuditLog.create({
        attendanceRecordId: record.id,
        action: 'blocked',
        performedBy: clearedByPersonId,
        previousValue: { blocked: false },
        newValue: { blocked: true },
        timestamp: new Date(),
      }, { transaction: t });

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  return clearAttendanceBlock(record!.id, clearedByPersonId, reasonCode, reasonNote);
}
