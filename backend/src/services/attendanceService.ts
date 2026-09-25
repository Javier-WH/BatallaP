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
  Setting,
} from '@/models';
import { buildPeriodsFromSettings } from './diarioService';

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
function periodSortKey(periodId: string): number {
  const match = /^([mt])(\d+)$/.exec(periodId);
  if (!match) return 999;
  return (match[1] === 'm' ? 0 : 1) * 1000 + Number(match[2]);
}

async function getPeriodInfoMap(): Promise<Map<string, { start: string; end: string }>> {
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
  counts: { present: number; absent: number; late: number; kicked: number; total: number };
}

/**
 * Get-or-create the attendance sessions for a teacher on a calendar date,
 * derived from the published schedule entries for that weekday. Works for
 * past dates (paper backfill).
 */
export async function getTeacherSessionsForDate(
  personId: number,
  dateStr: string,
  schoolPeriodId?: number
): Promise<TeacherSessionView[]> {
  const dayName = getDayNameForDate(dateStr);
  if (!dayName) return [];

  const entries = await ScheduleEntry.findAll({
    where: { day: dayName, teacherId: personId },
    include: [
      {
        model: Schedule,
        as: 'schedule',
        where: schoolPeriodId ? { schoolPeriodId } : {},
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
  });

  if (entries.length === 0) return [];

  const periodInfoMap = await getPeriodInfoMap();

  const sessions: TeacherSessionView[] = [];
  for (const entry of entries as any[]) {
    const schedule = entry.schedule;
    if (!schedule) continue;
    const pgs = schedule.section;
    if (!pgs) continue;
    const periodGrade = pgs.periodGrade;
    const schoolPeriodIdResolved = periodGrade?.schoolPeriodId;
    if (!schoolPeriodIdResolved) continue;

    const [session] = await AttendanceSession.findOrCreate({
      where: { scheduleEntryId: entry.id, sessionDate: dateStr },
      defaults: {
        scheduleEntryId: entry.id,
        schoolPeriodId: schoolPeriodIdResolved,
        sessionDate: dateStr,
        status: 'pending',
      },
    });

    const records = await AttendanceRecord.findAll({ where: { sessionId: session.id }, raw: true });
    const counts = { present: 0, absent: 0, late: 0, kicked: 0, total: records.length };
    for (const r of records) {
      if (r.status === 'present') counts.present++;
      else if (r.status === 'absent') counts.absent++;
      else if (r.status === 'late') counts.late++;
      else if (r.status === 'kicked') counts.kicked++;
    }

    const periodInfo = periodInfoMap.get(entry.periodId) || null;
    sessions.push({
      id: session.id,
      scheduleEntryId: entry.id,
      sessionDate: session.sessionDate,
      status: session.status,
      day: entry.day,
      periodId: entry.periodId,
      periodStart: periodInfo?.start ?? null,
      periodEnd: periodInfo?.end ?? null,
      subjectId: entry.subjectId,
      subjectName: entry.subject?.name ?? null,
      gradeName: periodGrade?.grade?.name ?? '',
      sectionName: pgs.section?.name ?? '',
      counts,
    });
  }

  sessions.sort((a, b) => periodSortKey(a.periodId) - periodSortKey(b.periodId));
  return sessions;
}

export interface SessionRosterEntry {
  inscriptionId: number;
  personId: number;
  document: string;
  fullName: string;
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

  const schedule = (session as any).scheduleEntry.schedule;
  const pgs = schedule.section;
  const periodGrade = pgs.periodGrade;

  const inscriptions = await Inscription.findAll({
    where: {
      schoolPeriodId: (session as any).schoolPeriodId,
      gradeId: periodGrade.gradeId,
      sectionId: pgs.sectionId,
      withdrawnAt: null,
    },
    include: [{ model: Person, as: 'student' }],
    order: [[{ model: Person, as: 'student' }, 'lastName', 'ASC']],
  });

  const records = await AttendanceRecord.findAll({ where: { sessionId: session.id } });
  const byInscription = new Map<number, any>();
  for (const r of records as any[]) byInscription.set(r.inscriptionId, r);

  // Cross-session prior blocks: un-cleared absent/kicked in an EARLIER session
  // of the same day. Suppressed when the student was already cleared in THIS
  // session's record (the clearance lives on the current record).
  const rosterInscriptionIds = (inscriptions as any[]).map(i => i.id);
  const currentEntryPeriodId = (session as any).scheduleEntry.periodId;
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
      if (r.session.scheduleEntryId === (session as any).scheduleEntryId) continue; // own session
      if (periodSortKey(entry.periodId) >= periodSortKey(currentEntryPeriodId)) continue;
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

  const roster: SessionRosterEntry[] = (inscriptions as any[]).map(ins => {
    const record = byInscription.get(ins.id) || null;
    return {
      inscriptionId: ins.id,
      personId: ins.personId,
      document: ins.student?.document ?? '',
      fullName: `${ins.student?.lastName ?? ''}, ${ins.student?.firstName ?? ''}`.trim(),
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

  return { session, roster };
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
    const existing = await AttendanceRecord.findAll({
      where: { sessionId, inscriptionId: records.map(r => r.inscriptionId) },
      transaction: t,
    });
    const byInscription = new Map<number, any>();
    for (const r of existing as any[]) byInscription.set(r.inscriptionId, r);

    for (const input of records) {
      const current = byInscription.get(input.inscriptionId) || null;

      if (!current) {
        const blocked = await computeBlockedFlag(session, input.inscriptionId, t);
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

/**
 * A student is blocked in this session if they have an un-cleared absent/kicked
 * record in an earlier session of the same day (same enrollment).
 */
async function computeBlockedFlag(
  session: any,
  inscriptionId: number,
  t: Transaction
): Promise<boolean> {
  const entry = await ScheduleEntry.findByPk((session as any).scheduleEntryId, { transaction: t });
  if (!entry) return false;
  const currentOrder = periodSortKey(entry.periodId);

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
    r => periodSortKey(r.session?.scheduleEntry?.periodId ?? '') < currentOrder
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
      const blocked = await computeBlockedFlag(session, inscriptionId, t);
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
