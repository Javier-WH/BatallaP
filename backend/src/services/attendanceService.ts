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
const BLOCKING_STATUSES: AttendanceStatus[] = ['absent', 'kicked'];

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

  // Without an explicit period, default to the active one so schedules from
  // older periods do not leak in as duplicated blocks.
  let effectivePeriodId = schoolPeriodId;
  if (!effectivePeriodId) {
    const active = await SchoolPeriod.findOne({ where: { status: 'activo' }, attributes: ['id'], raw: true });
    effectivePeriodId = (active as any)?.id;
  }

  const entries = await ScheduleEntry.findAll({
    where: { day: dayName, teacherId: personId },
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
  });

  if (entries.length === 0) return [];

  const periodInfoMap = await getPeriodInfoMap();
  const blocks = clusterEntriesIntoClassBlocks(entries as any[], periodInfoMap);

  const sessions: TeacherSessionView[] = [];
  for (const cluster of blocks) {
    const canonical = [...cluster].sort((a: any, b: any) => a.id - b.id)[0];
    const schedule = canonical.schedule;
    const pgs = schedule.section;
    const periodGrade = pgs.periodGrade;

    const [session] = await AttendanceSession.findOrCreate({
      where: { scheduleEntryId: canonical.id, sessionDate: dateStr },
      defaults: {
        scheduleEntryId: canonical.id,
        schoolPeriodId: periodGrade.schoolPeriodId,
        sessionDate: dateStr,
        status: 'pending',
      },
    });

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

    const firstInfo = periodInfoMap.get(cluster[0].periodId) || null;
    const lastInfo = periodInfoMap.get(cluster[cluster.length - 1].periodId) || null;
    const subjectNames = Array.from(new Set(cluster.map((e: any) => e.subject?.name).filter(Boolean)));
    sessions.push({
      id: session.id,
      scheduleEntryId: canonical.id,
      sessionDate: session.sessionDate,
      status: clusterSessions.some((s: any) => s.status === 'completed') ? 'completed' : session.status,
      day: canonical.day,
      periodId: blockPeriodLabel(cluster),
      periodStart: firstInfo?.start ?? null,
      periodEnd: lastInfo?.end ?? null,
      subjectId: canonical.subjectId,
      subjectName: subjectNames.join(' / ') || null,
      gradeName: periodGrade?.grade?.name ?? '',
      sectionName: pgs.section?.name ?? '',
      sectionLabel: buildSectionLabel(cluster),
      counts,
    });
  }

  // Sort by the block's first real period id (periodId may be a 'm1-m2' range).
  sessions.sort((a, b) =>
    periodSortKey(a.periodId.split('-')[0]) - periodSortKey(b.periodId.split('-')[0]));
  return sessions;
}

export interface SessionRosterEntry {
  inscriptionId: number;
  personId: number;
  document: string;
  fullName: string;
  /** Section label (e.g. 'A', or 'Cuarto año A' in mixed-grade group classes). */
  sectionLabel: string | null;
  status: AttendanceStatus | null;
  reason: string | null;
  blocked: boolean;
  clearedBy: number | null;
  clearedAt: Date | null;
  clearanceReasonCode: string | null;
  clearanceReasonNote: string | null;
  priorBlock: { subjectName: string | null; periodId: string; status: AttendanceStatus } | null;
  recordId: number | null;
}

export interface SessionDetail {
  session: any;
  roster: SessionRosterEntry[];
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
  const schedule = entry.schedule;
  const pgs = schedule.section;
  const periodGrade = pgs.periodGrade;

  // The roster belongs to the whole class block: a class spanning several
  // consecutive periods merges its entries (records may live in sibling
  // sessions created before the merge), and group subjects additionally span
  // the sections sharing the class.
  const { entries: clusterEntries, periodInfoMap } = await findClassBlockEntries(
    entry, (session as any).schoolPeriodId
  );

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
      schoolPeriodId: (session as any).schoolPeriodId,
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
          (session as any).schoolPeriodId,
          (session as any).sessionDate
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

  // Cross-session prior blocks: un-cleared absent/kicked in an EARLIER session
  // of the same day. Records inside this same class block never self-block.
  // Suppressed when the student was already cleared in THIS session's record
  // (the clearance lives on the current record).
  const rosterInscriptionIds = rosterInscriptions.map(i => i.id);
  const clusterEntryIds = new Set(clusterEntries.map(e => e.id));
  const blockStartKey = Math.min(...clusterEntries.map(e => periodSortKey(e.periodId)));
  const clearedInCurrent = new Set(
    (records as any[]).filter(r => r.clearedAt != null).map(r => r.inscriptionId)
  );

  const priorByInscription = new Map<number, { subjectName: string | null; periodId: string; status: AttendanceStatus }>();
  if (rosterInscriptionIds.length > 0) {
    const priorRecords = await AttendanceRecord.findAll({
      where: {
        inscriptionId: rosterInscriptionIds,
        status: { [Op.in]: BLOCKING_STATUSES },
        clearedAt: null,
      },
      include: [
        {
          model: AttendanceSession,
          as: 'session',
          where: { sessionDate: (session as any).sessionDate },
          include: [{ model: ScheduleEntry, as: 'scheduleEntry', include: [{ model: Subject, as: 'subject' }] }],
        },
      ],
    });
    for (const r of priorRecords as any[]) {
      const entry = r.session?.scheduleEntry;
      if (!entry) continue;
      if (clusterEntryIds.has(r.session.scheduleEntryId)) continue; // same class block
      if (periodSortKey(entry.periodId) >= blockStartKey) continue;
      if (clearedInCurrent.has(r.inscriptionId)) continue;
      const existing = priorByInscription.get(r.inscriptionId);
      if (!existing || periodSortKey(entry.periodId) < periodSortKey(existing.periodId)) {
        priorByInscription.set(r.inscriptionId, {
          subjectName: entry.subject?.name ?? null,
          periodId: entry.periodId,
          status: r.status,
        });
      }
    }
  }

  const roster: SessionRosterEntry[] = rosterInscriptions.map(ins => {
    const record = byInscription.get(ins.id) || null;
    return {
      inscriptionId: ins.id,
      personId: ins.personId,
      document: ins.student?.document ?? '',
      fullName: `${ins.student?.lastName ?? ''}, ${ins.student?.firstName ?? ''}`.trim(),
      sectionLabel: sectionLabelByKey.get(`${ins.gradeId}|${ins.sectionId}`) ?? null,
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
 * entry for every creation and status change. Computes the cross-session
 * block flag: a student absent/kicked (not cleared) in an earlier session of
 * the same day is blocked in this session.
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

    const existing = await AttendanceRecord.findAll({
      where: { sessionId, inscriptionId: records.map(r => r.inscriptionId) },
      transaction: t,
    });
    const byInscription = new Map<number, any>();
    for (const r of existing as any[]) byInscription.set(r.inscriptionId, r);

    for (const input of records) {
      const current = byInscription.get(input.inscriptionId) || null;

      if (!current) {
        const blocked = await computeBlockedFlag(session, input.inscriptionId, t, blockEntryIds, blockStartKey);
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

/**
 * A student is blocked in this session if they have an un-cleared absent/kicked
 * record in an earlier session of the same day (same enrollment). Records in
 * the same class block (blockEntryIds) do not count as prior.
 */
async function computeBlockedFlag(
  session: any,
  inscriptionId: number,
  t: Transaction,
  blockEntryIds: Set<number>,
  blockStartKey: number
): Promise<boolean> {
  const priorRecords = await AttendanceRecord.findAll({
    where: {
      inscriptionId,
      status: { [Op.in]: BLOCKING_STATUSES },
      clearedAt: null,
    },
    include: [
      {
        model: AttendanceSession,
        as: 'session',
        where: { sessionDate: (session as any).sessionDate },
        include: [{ model: ScheduleEntry, as: 'scheduleEntry' }],
      },
    ],
    transaction: t,
  });

  return (priorRecords as any[]).some(
    r => !blockEntryIds.has(r.session?.scheduleEntryId)
      && periodSortKey(r.session?.scheduleEntry?.periodId ?? '') < blockStartKey
  );
}

/**
 * Clear a block on an attendance record. Requires an active clearance reason;
 * reasons with requiresNote need a non-empty note. Fully audited.
 */
export async function clearAttendanceBlock(
  recordId: number,
  clearedByPersonId: number,
  reasonCode: string,
  reasonNote: string | null
): Promise<AttendanceRecord> {
  const record = await AttendanceRecord.findByPk(recordId);
  if (!record) throw new Error('Registro de asistencia no encontrado');
  if (!record.blocked) throw new Error('El registro no está bloqueado');

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
  { code: 'nurse_visit', label: 'Visita a enfermería', requiresNote: false },
  { code: 'admin_authorized', label: 'Autorizado por Administración', requiresNote: false },
  { code: 'parent_note', label: 'Nota del representante', requiresNote: false },
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
 * Clear a prior-session block directly from the session UI. Creates the
 * student's record for this session if it does not exist yet (status
 * 'present' — the student is physically in class), then applies the
 * clearance. Fully audited: 'marked' + 'blocked' + 'cleared'.
 */
export async function clearSessionBlock(
  sessionId: number,
  inscriptionId: number,
  clearedByPersonId: number,
  reasonCode: string,
  reasonNote: string | null
): Promise<AttendanceRecord> {
  let record = await AttendanceRecord.findOne({ where: { sessionId, inscriptionId } });

  if (!record) {
    const session = await AttendanceSession.findByPk(sessionId);
    if (!session) throw new Error('Sesión de asistencia no encontrada');

    const t: Transaction = await sequelize.transaction();
    try {
      const { blockEntryIds, blockStartKey } = await resolveSessionBlock(session, t);
      const blocked = await computeBlockedFlag(session, inscriptionId, t, blockEntryIds, blockStartKey);
      record = await AttendanceRecord.create({
        sessionId,
        inscriptionId,
        teacherId: clearedByPersonId,
        status: 'present',
        blocked,
        markedAt: new Date(),
      }, { transaction: t });

      await AttendanceAuditLog.create({
        attendanceRecordId: record.id,
        action: 'marked',
        performedBy: clearedByPersonId,
        newValue: { status: 'present', reason: null },
        timestamp: new Date(),
      }, { transaction: t });

      if (blocked) {
        await AttendanceAuditLog.create({
          attendanceRecordId: record.id,
          action: 'blocked',
          performedBy: clearedByPersonId,
          previousValue: { blocked: false },
          newValue: { blocked: true },
          timestamp: new Date(),
        }, { transaction: t });
      }

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  return clearAttendanceBlock(record!.id, clearedByPersonId, reasonCode, reasonNote);
}
