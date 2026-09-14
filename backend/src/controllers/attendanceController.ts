import { Request, Response } from 'express';
import { Op } from 'sequelize';
import {
  AttendanceSession,
  AttendanceRecord,
  AttendanceAuditLog,
  ScheduleEntry,
  Schedule,
  PeriodGradeSection,
  PeriodGrade,
  Grade,
  Section,
  Subject,
  Person,
  Inscription,
  GateCheckin,
  GateDevice,
  IdCard,
} from '@/models';
import {
  getTeacherSessionsForDate,
  getSessionDetail,
  saveSessionRecords,
  clearAttendanceBlock,
  clearSessionBlock,
  listClearanceReasons,
  AttendanceRecordInput,
} from '@/services/attendanceService';

const hasRole = (user: any, roles: string[]): boolean => {
  if (!user || !user.roles) return false;
  const userRoles = user.roles.map((r: any) => (typeof r === 'string' ? r : r.name));
  return roles.some(role => userRoles.includes(role));
};

const STAFF_ROLES = ['Master', 'Administrador', 'Control de Estudios'];
const ALL_ATTENDANCE_ROLES = [...STAFF_ROLES, 'Profesor', 'Director'];

const requireAttendanceRole = (req: Request, res: Response): boolean => {
  const user = (req.session as any).user;
  if (!hasRole(user, ALL_ATTENDANCE_ROLES)) {
    res.status(403).json({ message: 'No tiene acceso al módulo de asistencias' });
    return false;
  }
  return true;
};

const isStaff = (req: Request): boolean => hasRole((req.session as any).user, STAFF_ROLES);

const getSessionUserPersonId = (req: Request): number | null => {
  const user = (req.session as any).user;
  return user?.personId ?? null;
};

/** Teacher of the session's schedule entry (null if not found). */
async function getSessionTeacherPersonId(sessionId: number): Promise<number | null> {
  const session = await AttendanceSession.findByPk(sessionId, {
    include: [{ model: ScheduleEntry, as: 'scheduleEntry' }],
  });
  return (session as any)?.scheduleEntry?.teacherId ?? null;
}

/**
 * GET /api/attendance/my-sessions?date=YYYY-MM-DD
 * Sessions for the logged-in teacher on a date (today or past for backfill).
 */
export const getMySessions = async (req: Request, res: Response) => {
  try {
    if (!requireAttendanceRole(req, res)) return;
    const personId = getSessionUserPersonId(req);
    if (!personId) return res.status(400).json({ message: 'Sesión sin persona asociada' });

    const date = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'date es requerido (YYYY-MM-DD)' });
    }
    const schoolPeriodId = req.query.schoolPeriodId ? Number(req.query.schoolPeriodId) : undefined;

    const sessions = await getTeacherSessionsForDate(personId, date, schoolPeriodId);
    return res.json({ date, sessions });
  } catch (error: any) {
    console.error('[getMySessions] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener sesiones' });
  }
};

/**
 * GET /api/attendance/sessions/:id
 * Roster + attendance records for one session.
 */
export const getSession = async (req: Request, res: Response) => {
  try {
    if (!requireAttendanceRole(req, res)) return;
    const sessionId = Number(req.params.id);
    if (!sessionId) return res.status(400).json({ message: 'id inválido' });

    const detail = await getSessionDetail(sessionId);
    return res.json(detail);
  } catch (error: any) {
    console.error('[getSession] Error:', error);
    return res.status(404).json({ message: error.message || 'Sesión no encontrada' });
  }
};

/**
 * PUT /api/attendance/sessions/:id/records
 * Body: { records: [{ inscriptionId, status, reason? }] }
 * Teachers can only save their own sessions; staff can save any.
 */
export const putSessionRecords = async (req: Request, res: Response) => {
  try {
    if (!requireAttendanceRole(req, res)) return;
    const sessionId = Number(req.params.id);
    if (!sessionId) return res.status(400).json({ message: 'id inválido' });

    const records = req.body?.records as AttendanceRecordInput[] | undefined;
    if (!Array.isArray(records)) {
      return res.status(400).json({ message: 'records es requerido' });
    }

    const personId = getSessionUserPersonId(req);
    if (!personId) return res.status(400).json({ message: 'Sesión sin persona asociada' });

    if (!isStaff(req)) {
      const teacherId = await getSessionTeacherPersonId(sessionId);
      if (teacherId !== personId) {
        return res.status(403).json({ message: 'Solo puede registrar asistencia de sus propias sesiones' });
      }
    }

    const result = await saveSessionRecords(sessionId, records, personId);
    return res.json(result);
  } catch (error: any) {
    console.error('[putSessionRecords] Error:', error);
    return res.status(400).json({ message: error.message || 'Error al guardar asistencia' });
  }
};

/**
 * POST /api/attendance/records/:id/clear
 * Body: { reasonCode, reasonNote? }
 * Clears a block. Teachers can only clear their own sessions; staff any.
 */
export const postClearRecord = async (req: Request, res: Response) => {
  try {
    if (!requireAttendanceRole(req, res)) return;
    const recordId = Number(req.params.id);
    if (!recordId) return res.status(400).json({ message: 'id inválido' });

    const reasonCode = String(req.body?.reasonCode || '');
    const reasonNote = req.body?.reasonNote != null ? String(req.body.reasonNote) : null;
    if (!reasonCode) return res.status(400).json({ message: 'reasonCode es requerido' });

    const personId = getSessionUserPersonId(req);
    if (!personId) return res.status(400).json({ message: 'Sesión sin persona asociada' });

    if (!isStaff(req)) {
      const record = await AttendanceRecord.findByPk(recordId, {
        include: [{ model: AttendanceSession, as: 'session', include: [{ model: ScheduleEntry, as: 'scheduleEntry' }] }],
      });
      const teacherId = (record as any)?.session?.scheduleEntry?.teacherId ?? null;
      if (teacherId !== personId) {
        return res.status(403).json({ message: 'Solo puede desbloquear registros de sus propias sesiones' });
      }
    }

    const record = await clearAttendanceBlock(recordId, personId, reasonCode, reasonNote);
    return res.json(record);
  } catch (error: any) {
    console.error('[postClearRecord] Error:', error);
    return res.status(400).json({ message: error.message || 'Error al desbloquear' });
  }
};

/**
 * POST /api/attendance/sessions/:id/clear-block
 * Body: { inscriptionId, reasonCode, reasonNote? }
 * Clears a prior-session block directly from the session UI. Creates the
 * student's record if missing (status 'present'). Teachers: own sessions only.
 */
export const postClearSessionBlock = async (req: Request, res: Response) => {
  try {
    if (!requireAttendanceRole(req, res)) return;
    const sessionId = Number(req.params.id);
    if (!sessionId) return res.status(400).json({ message: 'id inválido' });

    const inscriptionId = Number(req.body?.inscriptionId);
    const reasonCode = String(req.body?.reasonCode || '');
    const reasonNote = req.body?.reasonNote != null ? String(req.body.reasonNote) : null;
    if (!inscriptionId || !reasonCode) {
      return res.status(400).json({ message: 'inscriptionId y reasonCode son requeridos' });
    }

    const personId = getSessionUserPersonId(req);
    if (!personId) return res.status(400).json({ message: 'Sesión sin persona asociada' });

    if (!isStaff(req)) {
      const teacherId = await getSessionTeacherPersonId(sessionId);
      if (teacherId !== personId) {
        return res.status(403).json({ message: 'Solo puede desbloquear en sus propias sesiones' });
      }
    }

    const record = await clearSessionBlock(sessionId, inscriptionId, personId, reasonCode, reasonNote);
    return res.json(record);
  } catch (error: any) {
    console.error('[postClearSessionBlock] Error:', error);
    return res.status(400).json({ message: error.message || 'Error al desbloquear' });
  }
};

/**
 * GET /api/attendance/clearance-reasons
 * Active clearance reasons (seeds defaults on first use).
 */
export const getClearanceReasons = async (req: Request, res: Response) => {
  try {
    if (!requireAttendanceRole(req, res)) return;
    const reasons = await listClearanceReasons();
    return res.json(reasons);
  } catch (error: any) {
    console.error('[getClearanceReasons] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener motivos' });
  }
};

/**
 * GET /api/attendance/sessions?schoolPeriodId=&dateFrom=&dateTo=&gradeId=&sectionId=
 * Staff view: sessions in a range with counts, subject and teacher info.
 */
export const listSessions = async (req: Request, res: Response) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({ message: 'Solo personal autorizado puede consultar sesiones' });
    }
    const schoolPeriodId = Number(req.query.schoolPeriodId);
    if (!schoolPeriodId) return res.status(400).json({ message: 'schoolPeriodId es requerido' });

    const where: any = { schoolPeriodId };
    if (req.query.dateFrom && req.query.dateTo) {
      where.sessionDate = { [Op.between]: [String(req.query.dateFrom), String(req.query.dateTo)] };
    } else if (req.query.date) {
      where.sessionDate = String(req.query.date);
    }

    const sessions = await AttendanceSession.findAll({
      where,
      include: [
        {
          model: ScheduleEntry,
          as: 'scheduleEntry',
          include: [
            { model: Subject, as: 'subject' },
            { model: Person, as: 'teacher' },
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
          ],
        },
      ],
      order: [['sessionDate', 'DESC']],
    });

    const filtered = (sessions as any[]).filter(s => {
      const pgs = s.scheduleEntry?.schedule?.section;
      if (req.query.gradeId && String(pgs?.periodGrade?.gradeId) !== String(req.query.gradeId)) return false;
      if (req.query.sectionId && String(pgs?.sectionId) !== String(req.query.sectionId)) return false;
      return true;
    });

    const withCounts = await Promise.all(filtered.map(async s => {
      const records = await AttendanceRecord.findAll({ where: { sessionId: s.id }, raw: true });
      const counts = { present: 0, absent: 0, late: 0, kicked: 0, blocked: 0, total: records.length };
      for (const r of records) {
        if (r.status === 'present') counts.present++;
        else if (r.status === 'absent') counts.absent++;
        else if (r.status === 'late') counts.late++;
        else if (r.status === 'kicked') counts.kicked++;
        if (r.blocked) counts.blocked++;
      }
      const pgs = s.scheduleEntry?.schedule?.section;
      return {
        id: s.id,
        sessionDate: s.sessionDate,
        status: s.status,
        periodId: s.scheduleEntry?.periodId ?? null,
        subjectName: s.scheduleEntry?.subject?.name ?? null,
        teacherName: s.scheduleEntry?.teacher
          ? `${s.scheduleEntry.teacher.lastName}, ${s.scheduleEntry.teacher.firstName}`.trim()
          : null,
        gradeName: pgs?.periodGrade?.grade?.name ?? '',
        sectionName: pgs?.section?.name ?? '',
        counts,
      };
    }));

    return res.json(withCounts);
  } catch (error: any) {
    console.error('[listSessions] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al listar sesiones' });
  }
};

/**
 * GET /api/attendance/students/:personId/summary?schoolPeriodId=
 * Full attendance trail for one student in a period.
 */
export const getStudentSummary = async (req: Request, res: Response) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({ message: 'Solo personal autorizado puede consultar resúmenes' });
    }
    const personId = Number(req.params.personId);
    const schoolPeriodId = Number(req.query.schoolPeriodId);
    if (!personId || !schoolPeriodId) {
      return res.status(400).json({ message: 'personId y schoolPeriodId son requeridos' });
    }

    const inscriptions = await Inscription.findAll({
      where: { personId, schoolPeriodId },
      attributes: ['id'],
      raw: true,
    });
    const inscriptionIds = inscriptions.map(i => i.id);
    if (inscriptionIds.length === 0) return res.json({ records: [], totals: null });

    const records = await AttendanceRecord.findAll({
      where: { inscriptionId: inscriptionIds },
      include: [
        {
          model: AttendanceSession,
          as: 'session',
          include: [
            {
              model: ScheduleEntry,
              as: 'scheduleEntry',
              include: [
                { model: Subject, as: 'subject' },
                { model: Person, as: 'teacher' },
              ],
            },
          ],
        },
      ],
      order: [['markedAt', 'DESC']],
    });

    const totals = { present: 0, absent: 0, late: 0, excused: 0, kicked: 0 };
    const rows = (records as any[]).map(r => {
      totals[r.status as keyof typeof totals] = (totals[r.status as keyof typeof totals] || 0) + 1;
      return {
        id: r.id,
        sessionDate: r.session?.sessionDate,
        periodId: r.session?.scheduleEntry?.periodId ?? null,
        subjectName: r.session?.scheduleEntry?.subject?.name ?? null,
        teacherName: r.session?.scheduleEntry?.teacher
          ? `${r.session.scheduleEntry.teacher.lastName}, ${r.session.scheduleEntry.teacher.firstName}`.trim()
          : null,
        status: r.status,
        reason: r.reason,
        blocked: r.blocked,
        clearedBy: r.clearedBy,
        clearedAt: r.clearedAt,
        clearanceReasonCode: r.clearanceReasonCode,
        clearanceReasonNote: r.clearanceReasonNote,
        markedAt: r.markedAt,
      };
    });

    return res.json({ records: rows, totals });
  } catch (error: any) {
    console.error('[getStudentSummary] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener resumen' });
  }
};

/**
 * GET /api/attendance/records/:id/audits
 * Audit trail for one attendance record (staff only).
 */
export const getRecordAudits = async (req: Request, res: Response) => {
  try {
    if (!isStaff(req)) {
      return res.status(403).json({ message: 'Solo personal autorizado puede consultar auditoría' });
    }
    const recordId = Number(req.params.id);
    if (!recordId) return res.status(400).json({ message: 'id inválido' });

    const audits = await AttendanceAuditLog.findAll({
      where: { attendanceRecordId: recordId },
      include: [{ model: Person, as: 'performer' }],
      order: [['timestamp', 'ASC']],
    });
    return res.json(audits);
  } catch (error: any) {
    console.error('[getRecordAudits] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener auditoría' });
  }
};

// ── Gate check-in (RFID foundation — hardware not deployed yet) ──

const DEBOUNCE_MS = 5000;      // same physical tap re-read
const DUPLICATE_WINDOW_MS = 60000; // suspicious rapid toggle → flag for review

/**
 * POST /api/gate/checkins
 * Body: { cardUid, deviceId?, timestamp? }
 * Single-reader toggle logic from the spec: infer entry/exit from the last
 * event of the day, with debounce and duplicate flagging. When two readers
 * per gate are installed, the reader sends its fixed eventType and the server
 * trusts it.
 */
export const postGateCheckin = async (req: Request, res: Response) => {
  try {
    const cardUid = String(req.body?.cardUid || '').trim();
    if (!cardUid) return res.status(400).json({ message: 'cardUid es requerido' });
    const deviceId = req.body?.deviceId ? Number(req.body.deviceId) : null;
    const providedEventType = req.body?.eventType === 'entry' || req.body?.eventType === 'exit'
      ? (req.body.eventType as 'entry' | 'exit')
      : null;
    const timestamp = req.body?.timestamp ? new Date(req.body.timestamp) : new Date();

    const card = await IdCard.findOne({ where: { cardUid, active: true } });
    if (!card) return res.status(404).json({ message: 'Tarjeta no registrada o inactiva' });

    if (deviceId) {
      const device = await GateDevice.findByPk(deviceId);
      if (!device || !device.active) {
        return res.status(404).json({ message: 'Dispositivo no registrado o inactivo' });
      }
    }

    const startOfDay = new Date(timestamp);
    startOfDay.setHours(0, 0, 0, 0);

    const lastToday = await GateCheckin.findOne({
      where: { personId: card.personId, timestamp: { [Op.gte]: startOfDay } },
      order: [['timestamp', 'DESC']],
    });

    let eventType: 'entry' | 'exit';
    let flaggedDuplicate = false;

    if (providedEventType) {
      // Two-reader setup: the reader's fixed direction is trusted.
      eventType = providedEventType;
      if (lastToday && lastToday.eventType === eventType
        && timestamp.getTime() - new Date(lastToday.timestamp).getTime() < DEBOUNCE_MS) {
        return res.status(200).json({ accepted: false, reason: 'duplicate' });
      }
    } else if (lastToday) {
      const delta = timestamp.getTime() - new Date(lastToday.timestamp).getTime();
      if (delta < DEBOUNCE_MS) {
        return res.status(200).json({ accepted: false, reason: 'duplicate' });
      }
      if (delta < DUPLICATE_WINDOW_MS) flaggedDuplicate = true;
      eventType = lastToday.eventType === 'entry' ? 'exit' : 'entry';
    } else {
      eventType = 'entry';
    }

    const checkin = await GateCheckin.create({
      personId: card.personId,
      cardUid,
      deviceId,
      eventType,
      timestamp,
      flaggedDuplicate,
    });

    // Notification worker (guardian SMS/push) is a future phase — the row is
    // queued implicitly by existing in gate_checkins.
    return res.status(201).json({
      accepted: true,
      eventType,
      flaggedDuplicate,
      checkinId: checkin.id,
      personId: card.personId,
    });
  } catch (error: any) {
    console.error('[postGateCheckin] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al registrar check-in' });
  }
};
