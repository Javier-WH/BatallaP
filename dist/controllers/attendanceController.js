"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postGateCheckin = exports.getRecordAudits = exports.getStudentSummary = exports.listSessions = exports.getClearanceReasons = exports.postClearSessionBlock = exports.postClearRecord = exports.putSessionRecords = exports.getSession = exports.getMySessions = void 0;
const sequelize_1 = require("sequelize");
const models_1 = require("../models/index.js");
const attendanceService_1 = require("../services/attendanceService.js");
const hasRole = (user, roles) => {
    if (!user || !user.roles)
        return false;
    const userRoles = user.roles.map((r) => (typeof r === 'string' ? r : r.name));
    return roles.some(role => userRoles.includes(role));
};
const STAFF_ROLES = ['Master', 'Administrador', 'Control de Estudios'];
const ALL_ATTENDANCE_ROLES = [...STAFF_ROLES, 'Profesor', 'Director'];
const requireAttendanceRole = (req, res) => {
    const user = req.session.user;
    if (!hasRole(user, ALL_ATTENDANCE_ROLES)) {
        res.status(403).json({ message: 'No tiene acceso al módulo de asistencias' });
        return false;
    }
    return true;
};
const isStaff = (req) => hasRole(req.session.user, STAFF_ROLES);
const getSessionUserPersonId = (req) => {
    var _a;
    const user = req.session.user;
    return (_a = user === null || user === void 0 ? void 0 : user.personId) !== null && _a !== void 0 ? _a : null;
};
/** Teacher of the session's schedule entry (null if not found). */
function getSessionTeacherPersonId(sessionId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const session = yield models_1.AttendanceSession.findByPk(sessionId, {
            include: [{ model: models_1.ScheduleEntry, as: 'scheduleEntry' }],
        });
        return (_b = (_a = session === null || session === void 0 ? void 0 : session.scheduleEntry) === null || _a === void 0 ? void 0 : _a.teacherId) !== null && _b !== void 0 ? _b : null;
    });
}
/**
 * GET /api/attendance/my-sessions?date=YYYY-MM-DD
 * Sessions for the logged-in teacher on a date (today or past for backfill).
 */
const getMySessions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!requireAttendanceRole(req, res))
            return;
        const personId = getSessionUserPersonId(req);
        if (!personId)
            return res.status(400).json({ message: 'Sesión sin persona asociada' });
        const date = String(req.query.date || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ message: 'date es requerido (YYYY-MM-DD)' });
        }
        const schoolPeriodId = req.query.schoolPeriodId ? Number(req.query.schoolPeriodId) : undefined;
        const sessions = yield (0, attendanceService_1.getTeacherSessionsForDate)(personId, date, schoolPeriodId);
        return res.json({ date, sessions });
    }
    catch (error) {
        console.error('[getMySessions] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al obtener sesiones' });
    }
});
exports.getMySessions = getMySessions;
/**
 * GET /api/attendance/sessions/:id
 * Roster + attendance records for one session.
 */
const getSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!requireAttendanceRole(req, res))
            return;
        const sessionId = Number(req.params.id);
        if (!sessionId)
            return res.status(400).json({ message: 'id inválido' });
        const detail = yield (0, attendanceService_1.getSessionDetail)(sessionId);
        return res.json(detail);
    }
    catch (error) {
        console.error('[getSession] Error:', error);
        return res.status(404).json({ message: error.message || 'Sesión no encontrada' });
    }
});
exports.getSession = getSession;
/**
 * PUT /api/attendance/sessions/:id/records
 * Body: { records: [{ inscriptionId, status, reason? }] }
 * Teachers can only save their own sessions; staff can save any.
 */
const putSessionRecords = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!requireAttendanceRole(req, res))
            return;
        const sessionId = Number(req.params.id);
        if (!sessionId)
            return res.status(400).json({ message: 'id inválido' });
        const records = (_a = req.body) === null || _a === void 0 ? void 0 : _a.records;
        if (!Array.isArray(records)) {
            return res.status(400).json({ message: 'records es requerido' });
        }
        const personId = getSessionUserPersonId(req);
        if (!personId)
            return res.status(400).json({ message: 'Sesión sin persona asociada' });
        if (!isStaff(req)) {
            const teacherId = yield getSessionTeacherPersonId(sessionId);
            if (teacherId !== personId) {
                return res.status(403).json({ message: 'Solo puede registrar asistencia de sus propias sesiones' });
            }
        }
        const result = yield (0, attendanceService_1.saveSessionRecords)(sessionId, records, personId);
        return res.json(result);
    }
    catch (error) {
        console.error('[putSessionRecords] Error:', error);
        return res.status(400).json({ message: error.message || 'Error al guardar asistencia' });
    }
});
exports.putSessionRecords = putSessionRecords;
/**
 * POST /api/attendance/records/:id/clear
 * Body: { reasonCode, reasonNote? }
 * Clears a block. Teachers can only clear their own sessions; staff any.
 */
const postClearRecord = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        if (!requireAttendanceRole(req, res))
            return;
        const recordId = Number(req.params.id);
        if (!recordId)
            return res.status(400).json({ message: 'id inválido' });
        const reasonCode = String(((_a = req.body) === null || _a === void 0 ? void 0 : _a.reasonCode) || '');
        const reasonNote = ((_b = req.body) === null || _b === void 0 ? void 0 : _b.reasonNote) != null ? String(req.body.reasonNote) : null;
        if (!reasonCode)
            return res.status(400).json({ message: 'reasonCode es requerido' });
        const personId = getSessionUserPersonId(req);
        if (!personId)
            return res.status(400).json({ message: 'Sesión sin persona asociada' });
        if (!isStaff(req)) {
            const record = yield models_1.AttendanceRecord.findByPk(recordId, {
                include: [{ model: models_1.AttendanceSession, as: 'session', include: [{ model: models_1.ScheduleEntry, as: 'scheduleEntry' }] }],
            });
            const teacherId = (_e = (_d = (_c = record === null || record === void 0 ? void 0 : record.session) === null || _c === void 0 ? void 0 : _c.scheduleEntry) === null || _d === void 0 ? void 0 : _d.teacherId) !== null && _e !== void 0 ? _e : null;
            if (teacherId !== personId) {
                return res.status(403).json({ message: 'Solo puede desbloquear registros de sus propias sesiones' });
            }
        }
        const record = yield (0, attendanceService_1.clearAttendanceBlock)(recordId, personId, reasonCode, reasonNote);
        return res.json(record);
    }
    catch (error) {
        console.error('[postClearRecord] Error:', error);
        return res.status(400).json({ message: error.message || 'Error al desbloquear' });
    }
});
exports.postClearRecord = postClearRecord;
/**
 * POST /api/attendance/sessions/:id/clear-block
 * Body: { inscriptionId, reasonCode, reasonNote? }
 * Clears a prior-session block directly from the session UI. Creates the
 * student's record if missing (status 'present'). Teachers: own sessions only.
 */
const postClearSessionBlock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        if (!requireAttendanceRole(req, res))
            return;
        const sessionId = Number(req.params.id);
        if (!sessionId)
            return res.status(400).json({ message: 'id inválido' });
        const inscriptionId = Number((_a = req.body) === null || _a === void 0 ? void 0 : _a.inscriptionId);
        const reasonCode = String(((_b = req.body) === null || _b === void 0 ? void 0 : _b.reasonCode) || '');
        const reasonNote = ((_c = req.body) === null || _c === void 0 ? void 0 : _c.reasonNote) != null ? String(req.body.reasonNote) : null;
        if (!inscriptionId || !reasonCode) {
            return res.status(400).json({ message: 'inscriptionId y reasonCode son requeridos' });
        }
        const personId = getSessionUserPersonId(req);
        if (!personId)
            return res.status(400).json({ message: 'Sesión sin persona asociada' });
        if (!isStaff(req)) {
            const teacherId = yield getSessionTeacherPersonId(sessionId);
            if (teacherId !== personId) {
                return res.status(403).json({ message: 'Solo puede desbloquear en sus propias sesiones' });
            }
        }
        const record = yield (0, attendanceService_1.clearSessionBlock)(sessionId, inscriptionId, personId, reasonCode, reasonNote);
        return res.json(record);
    }
    catch (error) {
        console.error('[postClearSessionBlock] Error:', error);
        return res.status(400).json({ message: error.message || 'Error al desbloquear' });
    }
});
exports.postClearSessionBlock = postClearSessionBlock;
/**
 * GET /api/attendance/clearance-reasons
 * Active clearance reasons (seeds defaults on first use).
 */
const getClearanceReasons = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!requireAttendanceRole(req, res))
            return;
        const reasons = yield (0, attendanceService_1.listClearanceReasons)();
        return res.json(reasons);
    }
    catch (error) {
        console.error('[getClearanceReasons] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al obtener motivos' });
    }
});
exports.getClearanceReasons = getClearanceReasons;
/**
 * GET /api/attendance/sessions?schoolPeriodId=&dateFrom=&dateTo=&gradeId=&sectionId=
 * Staff view: sessions in a range with counts, subject and teacher info.
 */
const listSessions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isStaff(req)) {
            return res.status(403).json({ message: 'Solo personal autorizado puede consultar sesiones' });
        }
        const schoolPeriodId = Number(req.query.schoolPeriodId);
        if (!schoolPeriodId)
            return res.status(400).json({ message: 'schoolPeriodId es requerido' });
        const where = { schoolPeriodId };
        if (req.query.dateFrom && req.query.dateTo) {
            where.sessionDate = { [sequelize_1.Op.between]: [String(req.query.dateFrom), String(req.query.dateTo)] };
        }
        else if (req.query.date) {
            where.sessionDate = String(req.query.date);
        }
        const sessions = yield models_1.AttendanceSession.findAll({
            where,
            include: [
                {
                    model: models_1.ScheduleEntry,
                    as: 'scheduleEntry',
                    include: [
                        { model: models_1.Subject, as: 'subject' },
                        { model: models_1.Person, as: 'teacher' },
                        {
                            model: models_1.Schedule,
                            as: 'schedule',
                            include: [
                                {
                                    model: models_1.PeriodGradeSection,
                                    as: 'section',
                                    include: [
                                        { model: models_1.PeriodGrade, as: 'periodGrade', include: [{ model: models_1.Grade, as: 'grade' }] },
                                        { model: models_1.Section, as: 'section' },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
            order: [['sessionDate', 'DESC']],
        });
        const filtered = sessions.filter(s => {
            var _a, _b, _c;
            const pgs = (_b = (_a = s.scheduleEntry) === null || _a === void 0 ? void 0 : _a.schedule) === null || _b === void 0 ? void 0 : _b.section;
            if (req.query.gradeId && String((_c = pgs === null || pgs === void 0 ? void 0 : pgs.periodGrade) === null || _c === void 0 ? void 0 : _c.gradeId) !== String(req.query.gradeId))
                return false;
            if (req.query.sectionId && String(pgs === null || pgs === void 0 ? void 0 : pgs.sectionId) !== String(req.query.sectionId))
                return false;
            return true;
        });
        const withCounts = yield Promise.all(filtered.map((s) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            const records = yield models_1.AttendanceRecord.findAll({ where: { sessionId: s.id }, raw: true });
            const counts = { present: 0, absent: 0, late: 0, kicked: 0, blocked: 0, total: records.length };
            for (const r of records) {
                if (r.status === 'present')
                    counts.present++;
                else if (r.status === 'absent')
                    counts.absent++;
                else if (r.status === 'late')
                    counts.late++;
                else if (r.status === 'kicked')
                    counts.kicked++;
                if (r.blocked)
                    counts.blocked++;
            }
            const pgs = (_b = (_a = s.scheduleEntry) === null || _a === void 0 ? void 0 : _a.schedule) === null || _b === void 0 ? void 0 : _b.section;
            return {
                id: s.id,
                sessionDate: s.sessionDate,
                status: s.status,
                periodId: (_d = (_c = s.scheduleEntry) === null || _c === void 0 ? void 0 : _c.periodId) !== null && _d !== void 0 ? _d : null,
                subjectName: (_g = (_f = (_e = s.scheduleEntry) === null || _e === void 0 ? void 0 : _e.subject) === null || _f === void 0 ? void 0 : _f.name) !== null && _g !== void 0 ? _g : null,
                teacherName: ((_h = s.scheduleEntry) === null || _h === void 0 ? void 0 : _h.teacher)
                    ? `${s.scheduleEntry.teacher.lastName}, ${s.scheduleEntry.teacher.firstName}`.trim()
                    : null,
                gradeName: (_l = (_k = (_j = pgs === null || pgs === void 0 ? void 0 : pgs.periodGrade) === null || _j === void 0 ? void 0 : _j.grade) === null || _k === void 0 ? void 0 : _k.name) !== null && _l !== void 0 ? _l : '',
                sectionName: (_o = (_m = pgs === null || pgs === void 0 ? void 0 : pgs.section) === null || _m === void 0 ? void 0 : _m.name) !== null && _o !== void 0 ? _o : '',
                counts,
            };
        })));
        return res.json(withCounts);
    }
    catch (error) {
        console.error('[listSessions] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al listar sesiones' });
    }
});
exports.listSessions = listSessions;
/**
 * GET /api/attendance/students/:personId/summary?schoolPeriodId=
 * Full attendance trail for one student in a period.
 */
const getStudentSummary = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isStaff(req)) {
            return res.status(403).json({ message: 'Solo personal autorizado puede consultar resúmenes' });
        }
        const personId = Number(req.params.personId);
        const schoolPeriodId = Number(req.query.schoolPeriodId);
        if (!personId || !schoolPeriodId) {
            return res.status(400).json({ message: 'personId y schoolPeriodId son requeridos' });
        }
        const inscriptions = yield models_1.Inscription.findAll({
            where: { personId, schoolPeriodId },
            attributes: ['id'],
            raw: true,
        });
        const inscriptionIds = inscriptions.map(i => i.id);
        if (inscriptionIds.length === 0)
            return res.json({ records: [], totals: null });
        const records = yield models_1.AttendanceRecord.findAll({
            where: { inscriptionId: inscriptionIds },
            include: [
                {
                    model: models_1.AttendanceSession,
                    as: 'session',
                    include: [
                        {
                            model: models_1.ScheduleEntry,
                            as: 'scheduleEntry',
                            include: [
                                { model: models_1.Subject, as: 'subject' },
                                { model: models_1.Person, as: 'teacher' },
                            ],
                        },
                    ],
                },
            ],
            order: [['markedAt', 'DESC']],
        });
        const totals = { present: 0, absent: 0, late: 0, excused: 0, kicked: 0 };
        const rows = records.map(r => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            totals[r.status] = (totals[r.status] || 0) + 1;
            return {
                id: r.id,
                sessionDate: (_a = r.session) === null || _a === void 0 ? void 0 : _a.sessionDate,
                periodId: (_d = (_c = (_b = r.session) === null || _b === void 0 ? void 0 : _b.scheduleEntry) === null || _c === void 0 ? void 0 : _c.periodId) !== null && _d !== void 0 ? _d : null,
                subjectName: (_h = (_g = (_f = (_e = r.session) === null || _e === void 0 ? void 0 : _e.scheduleEntry) === null || _f === void 0 ? void 0 : _f.subject) === null || _g === void 0 ? void 0 : _g.name) !== null && _h !== void 0 ? _h : null,
                teacherName: ((_k = (_j = r.session) === null || _j === void 0 ? void 0 : _j.scheduleEntry) === null || _k === void 0 ? void 0 : _k.teacher)
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
    }
    catch (error) {
        console.error('[getStudentSummary] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al obtener resumen' });
    }
});
exports.getStudentSummary = getStudentSummary;
/**
 * GET /api/attendance/records/:id/audits
 * Audit trail for one attendance record (staff only).
 */
const getRecordAudits = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isStaff(req)) {
            return res.status(403).json({ message: 'Solo personal autorizado puede consultar auditoría' });
        }
        const recordId = Number(req.params.id);
        if (!recordId)
            return res.status(400).json({ message: 'id inválido' });
        const audits = yield models_1.AttendanceAuditLog.findAll({
            where: { attendanceRecordId: recordId },
            include: [{ model: models_1.Person, as: 'performer' }],
            order: [['timestamp', 'ASC']],
        });
        return res.json(audits);
    }
    catch (error) {
        console.error('[getRecordAudits] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al obtener auditoría' });
    }
});
exports.getRecordAudits = getRecordAudits;
// ── Gate check-in (RFID foundation — hardware not deployed yet) ──
const DEBOUNCE_MS = 5000; // same physical tap re-read
const DUPLICATE_WINDOW_MS = 60000; // suspicious rapid toggle → flag for review
/**
 * POST /api/gate/checkins
 * Body: { cardUid, deviceId?, timestamp? }
 * Single-reader toggle logic from the spec: infer entry/exit from the last
 * event of the day, with debounce and duplicate flagging. When two readers
 * per gate are installed, the reader sends its fixed eventType and the server
 * trusts it.
 */
const postGateCheckin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        const cardUid = String(((_a = req.body) === null || _a === void 0 ? void 0 : _a.cardUid) || '').trim();
        if (!cardUid)
            return res.status(400).json({ message: 'cardUid es requerido' });
        const deviceId = ((_b = req.body) === null || _b === void 0 ? void 0 : _b.deviceId) ? Number(req.body.deviceId) : null;
        const providedEventType = ((_c = req.body) === null || _c === void 0 ? void 0 : _c.eventType) === 'entry' || ((_d = req.body) === null || _d === void 0 ? void 0 : _d.eventType) === 'exit'
            ? req.body.eventType
            : null;
        const timestamp = ((_e = req.body) === null || _e === void 0 ? void 0 : _e.timestamp) ? new Date(req.body.timestamp) : new Date();
        const card = yield models_1.IdCard.findOne({ where: { cardUid, active: true } });
        if (!card)
            return res.status(404).json({ message: 'Tarjeta no registrada o inactiva' });
        if (deviceId) {
            const device = yield models_1.GateDevice.findByPk(deviceId);
            if (!device || !device.active) {
                return res.status(404).json({ message: 'Dispositivo no registrado o inactivo' });
            }
        }
        const startOfDay = new Date(timestamp);
        startOfDay.setHours(0, 0, 0, 0);
        const lastToday = yield models_1.GateCheckin.findOne({
            where: { personId: card.personId, timestamp: { [sequelize_1.Op.gte]: startOfDay } },
            order: [['timestamp', 'DESC']],
        });
        let eventType;
        let flaggedDuplicate = false;
        if (providedEventType) {
            // Two-reader setup: the reader's fixed direction is trusted.
            eventType = providedEventType;
            if (lastToday && lastToday.eventType === eventType
                && timestamp.getTime() - new Date(lastToday.timestamp).getTime() < DEBOUNCE_MS) {
                return res.status(200).json({ accepted: false, reason: 'duplicate' });
            }
        }
        else if (lastToday) {
            const delta = timestamp.getTime() - new Date(lastToday.timestamp).getTime();
            if (delta < DEBOUNCE_MS) {
                return res.status(200).json({ accepted: false, reason: 'duplicate' });
            }
            if (delta < DUPLICATE_WINDOW_MS)
                flaggedDuplicate = true;
            eventType = lastToday.eventType === 'entry' ? 'exit' : 'entry';
        }
        else {
            eventType = 'entry';
        }
        const checkin = yield models_1.GateCheckin.create({
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
    }
    catch (error) {
        console.error('[postGateCheckin] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al registrar check-in' });
    }
});
exports.postGateCheckin = postGateCheckin;
