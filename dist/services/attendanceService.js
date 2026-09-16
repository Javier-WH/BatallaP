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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDayNameForDate = getDayNameForDate;
exports.getTeacherSessionsForDate = getTeacherSessionsForDate;
exports.getSessionDetail = getSessionDetail;
exports.saveSessionRecords = saveSessionRecords;
exports.clearAttendanceBlock = clearAttendanceBlock;
exports.listClearanceReasons = listClearanceReasons;
exports.clearSessionBlock = clearSessionBlock;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const models_1 = require("../models/index.js");
const diarioService_1 = require("./diarioService");
const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused', 'kicked'];
const BLOCKING_STATUSES = ['absent', 'kicked'];
// Spanish day names used by ScheduleEntry.day (Lunes..Viernes)
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/** Map a YYYY-MM-DD calendar date to the Spanish day name ('' on weekends). */
function getDayNameForDate(dateStr) {
    // Parse at noon UTC so the calendar day is stable across timezones.
    const d = new Date(`${dateStr}T12:00:00Z`);
    if (isNaN(d.getTime()))
        return '';
    const name = DAY_NAMES[d.getUTCDay()];
    return name === 'Sábado' || name === 'Domingo' ? '' : name;
}
/** Sort key for period ids: morning (m1, m2...) before afternoon (t1, t2...). */
function periodSortKey(periodId) {
    const match = /^([mt])(\d+)$/.exec(periodId);
    if (!match)
        return 999;
    return (match[1] === 'm' ? 0 : 1) * 1000 + Number(match[2]);
}
function getPeriodInfoMap() {
    return __awaiter(this, void 0, void 0, function* () {
        const settingsRows = yield models_1.Setting.findAll({ where: { key: { [sequelize_1.Op.in]: [
                        'time_format',
                        'morning_start_time', 'morning_blocks_before_recess', 'morning_block_minutes_before',
                        'morning_recess_minutes', 'morning_blocks_after_recess', 'morning_block_minutes_after',
                        'afternoon_start_time', 'afternoon_blocks_before_recess', 'afternoon_block_minutes_before',
                        'afternoon_recess_minutes', 'afternoon_blocks_after_recess', 'afternoon_block_minutes_after',
                    ] } }, raw: true });
        const settings = {};
        for (const row of settingsRows)
            settings[row.key] = row.value;
        const periods = (0, diarioService_1.buildPeriodsFromSettings)(settings);
        const map = new Map();
        for (const p of [...periods.manana, ...periods.tarde])
            map.set(p.id, { start: p.start, end: p.end });
        return map;
    });
}
/**
 * Get-or-create the attendance sessions for a teacher on a calendar date,
 * derived from the published schedule entries for that weekday. Works for
 * past dates (paper backfill).
 */
function getTeacherSessionsForDate(personId, dateStr, schoolPeriodId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const dayName = getDayNameForDate(dateStr);
        if (!dayName)
            return [];
        const entries = yield models_1.ScheduleEntry.findAll({
            where: { day: dayName, teacherId: personId },
            include: [
                {
                    model: models_1.Schedule,
                    as: 'schedule',
                    where: schoolPeriodId ? { schoolPeriodId } : {},
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
                { model: models_1.Subject, as: 'subject' },
            ],
        });
        if (entries.length === 0)
            return [];
        const periodInfoMap = yield getPeriodInfoMap();
        const sessions = [];
        for (const entry of entries) {
            const schedule = entry.schedule;
            if (!schedule)
                continue;
            const pgs = schedule.section;
            if (!pgs)
                continue;
            const periodGrade = pgs.periodGrade;
            const schoolPeriodIdResolved = periodGrade === null || periodGrade === void 0 ? void 0 : periodGrade.schoolPeriodId;
            if (!schoolPeriodIdResolved)
                continue;
            const [session] = yield models_1.AttendanceSession.findOrCreate({
                where: { scheduleEntryId: entry.id, sessionDate: dateStr },
                defaults: {
                    scheduleEntryId: entry.id,
                    schoolPeriodId: schoolPeriodIdResolved,
                    sessionDate: dateStr,
                    status: 'pending',
                },
            });
            const records = yield models_1.AttendanceRecord.findAll({ where: { sessionId: session.id }, raw: true });
            const counts = { present: 0, absent: 0, late: 0, kicked: 0, total: records.length };
            for (const r of records) {
                if (r.status === 'present')
                    counts.present++;
                else if (r.status === 'absent')
                    counts.absent++;
                else if (r.status === 'late')
                    counts.late++;
                else if (r.status === 'kicked')
                    counts.kicked++;
            }
            const periodInfo = periodInfoMap.get(entry.periodId) || null;
            sessions.push({
                id: session.id,
                scheduleEntryId: entry.id,
                sessionDate: session.sessionDate,
                status: session.status,
                day: entry.day,
                periodId: entry.periodId,
                periodStart: (_a = periodInfo === null || periodInfo === void 0 ? void 0 : periodInfo.start) !== null && _a !== void 0 ? _a : null,
                periodEnd: (_b = periodInfo === null || periodInfo === void 0 ? void 0 : periodInfo.end) !== null && _b !== void 0 ? _b : null,
                subjectId: entry.subjectId,
                subjectName: (_d = (_c = entry.subject) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : null,
                gradeName: (_f = (_e = periodGrade === null || periodGrade === void 0 ? void 0 : periodGrade.grade) === null || _e === void 0 ? void 0 : _e.name) !== null && _f !== void 0 ? _f : '',
                sectionName: (_h = (_g = pgs.section) === null || _g === void 0 ? void 0 : _g.name) !== null && _h !== void 0 ? _h : '',
                counts,
            });
        }
        sessions.sort((a, b) => periodSortKey(a.periodId) - periodSortKey(b.periodId));
        return sessions;
    });
}
/** Roster of the session's section with each student's attendance record. */
function getSessionDetail(sessionId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const session = yield models_1.AttendanceSession.findByPk(sessionId, {
            include: [
                {
                    model: models_1.ScheduleEntry,
                    as: 'scheduleEntry',
                    include: [
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
                        { model: models_1.Subject, as: 'subject' },
                        { model: models_1.Person, as: 'teacher' },
                    ],
                },
            ],
        });
        if (!session)
            throw new Error('Sesión de asistencia no encontrada');
        const schedule = session.scheduleEntry.schedule;
        const pgs = schedule.section;
        const periodGrade = pgs.periodGrade;
        const inscriptions = yield models_1.Inscription.findAll({
            where: {
                schoolPeriodId: session.schoolPeriodId,
                gradeId: periodGrade.gradeId,
                sectionId: pgs.sectionId,
                withdrawnAt: null,
            },
            include: [{ model: models_1.Person, as: 'student' }],
            order: [[{ model: models_1.Person, as: 'student' }, 'lastName', 'ASC']],
        });
        const records = yield models_1.AttendanceRecord.findAll({ where: { sessionId: session.id } });
        const byInscription = new Map();
        for (const r of records)
            byInscription.set(r.inscriptionId, r);
        // Cross-session prior blocks: un-cleared absent/kicked in an EARLIER session
        // of the same day. Suppressed when the student was already cleared in THIS
        // session's record (the clearance lives on the current record).
        const rosterInscriptionIds = inscriptions.map(i => i.id);
        const currentEntryPeriodId = session.scheduleEntry.periodId;
        const clearedInCurrent = new Set(records.filter(r => r.clearedAt != null).map(r => r.inscriptionId));
        const priorByInscription = new Map();
        if (rosterInscriptionIds.length > 0) {
            const priorRecords = yield models_1.AttendanceRecord.findAll({
                where: {
                    inscriptionId: rosterInscriptionIds,
                    status: { [sequelize_1.Op.in]: BLOCKING_STATUSES },
                    clearedAt: null,
                },
                include: [
                    {
                        model: models_1.AttendanceSession,
                        as: 'session',
                        where: { sessionDate: session.sessionDate },
                        include: [{ model: models_1.ScheduleEntry, as: 'scheduleEntry', include: [{ model: models_1.Subject, as: 'subject' }] }],
                    },
                ],
            });
            for (const r of priorRecords) {
                const entry = (_a = r.session) === null || _a === void 0 ? void 0 : _a.scheduleEntry;
                if (!entry)
                    continue;
                if (r.session.scheduleEntryId === session.scheduleEntryId)
                    continue; // own session
                if (periodSortKey(entry.periodId) >= periodSortKey(currentEntryPeriodId))
                    continue;
                if (clearedInCurrent.has(r.inscriptionId))
                    continue;
                const existing = priorByInscription.get(r.inscriptionId);
                if (!existing || periodSortKey(entry.periodId) < periodSortKey(existing.periodId)) {
                    priorByInscription.set(r.inscriptionId, {
                        subjectName: (_c = (_b = entry.subject) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : null,
                        periodId: entry.periodId,
                        status: r.status,
                    });
                }
            }
        }
        const roster = inscriptions.map(ins => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
            const record = byInscription.get(ins.id) || null;
            return {
                inscriptionId: ins.id,
                personId: ins.personId,
                document: (_b = (_a = ins.student) === null || _a === void 0 ? void 0 : _a.document) !== null && _b !== void 0 ? _b : '',
                fullName: `${(_d = (_c = ins.student) === null || _c === void 0 ? void 0 : _c.lastName) !== null && _d !== void 0 ? _d : ''}, ${(_f = (_e = ins.student) === null || _e === void 0 ? void 0 : _e.firstName) !== null && _f !== void 0 ? _f : ''}`.trim(),
                status: (_g = record === null || record === void 0 ? void 0 : record.status) !== null && _g !== void 0 ? _g : null,
                reason: (_h = record === null || record === void 0 ? void 0 : record.reason) !== null && _h !== void 0 ? _h : null,
                blocked: (_j = record === null || record === void 0 ? void 0 : record.blocked) !== null && _j !== void 0 ? _j : false,
                clearedBy: (_k = record === null || record === void 0 ? void 0 : record.clearedBy) !== null && _k !== void 0 ? _k : null,
                clearedAt: (_l = record === null || record === void 0 ? void 0 : record.clearedAt) !== null && _l !== void 0 ? _l : null,
                clearanceReasonCode: (_m = record === null || record === void 0 ? void 0 : record.clearanceReasonCode) !== null && _m !== void 0 ? _m : null,
                clearanceReasonNote: (_o = record === null || record === void 0 ? void 0 : record.clearanceReasonNote) !== null && _o !== void 0 ? _o : null,
                priorBlock: (_p = priorByInscription.get(ins.id)) !== null && _p !== void 0 ? _p : null,
                recordId: (_q = record === null || record === void 0 ? void 0 : record.id) !== null && _q !== void 0 ? _q : null,
            };
        });
        return { session, roster };
    });
}
/**
 * Bulk upsert attendance records for a session. Writes an append-only audit
 * entry for every creation and status change. Computes the cross-session
 * block flag: a student absent/kicked (not cleared) in an earlier session of
 * the same day is blocked in this session.
 */
function saveSessionRecords(sessionId, records, performedByPersonId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const session = yield models_1.AttendanceSession.findByPk(sessionId);
        if (!session)
            throw new Error('Sesión de asistencia no encontrada');
        for (const input of records) {
            if (!ATTENDANCE_STATUSES.includes(input.status)) {
                throw new Error(`Estado de asistencia inválido: ${input.status}`);
            }
            if (BLOCKING_STATUSES.includes(input.status) && !((_a = input.reason) === null || _a === void 0 ? void 0 : _a.trim())) {
                throw new Error('Debe indicar un motivo para ausencias o expulsiones');
            }
        }
        const result = { created: 0, updated: 0, unchanged: 0 };
        const t = yield database_1.default.transaction();
        try {
            const existing = yield models_1.AttendanceRecord.findAll({
                where: { sessionId, inscriptionId: records.map(r => r.inscriptionId) },
                transaction: t,
            });
            const byInscription = new Map();
            for (const r of existing)
                byInscription.set(r.inscriptionId, r);
            for (const input of records) {
                const current = byInscription.get(input.inscriptionId) || null;
                if (!current) {
                    const blocked = yield computeBlockedFlag(session, input.inscriptionId, t);
                    const record = yield models_1.AttendanceRecord.create({
                        sessionId,
                        inscriptionId: input.inscriptionId,
                        teacherId: performedByPersonId,
                        status: input.status,
                        reason: ((_b = input.reason) === null || _b === void 0 ? void 0 : _b.trim()) || null,
                        blocked,
                        markedAt: new Date(),
                    }, { transaction: t });
                    yield models_1.AttendanceAuditLog.create({
                        attendanceRecordId: record.id,
                        action: 'marked',
                        performedBy: performedByPersonId,
                        newValue: { status: input.status, reason: ((_c = input.reason) === null || _c === void 0 ? void 0 : _c.trim()) || null },
                        timestamp: new Date(),
                    }, { transaction: t });
                    if (blocked) {
                        yield models_1.AttendanceAuditLog.create({
                            attendanceRecordId: record.id,
                            action: 'blocked',
                            performedBy: performedByPersonId,
                            previousValue: { blocked: false },
                            newValue: { blocked: true },
                            timestamp: new Date(),
                        }, { transaction: t });
                    }
                    result.created++;
                }
                else {
                    const statusChanged = current.status !== input.status;
                    const reasonChanged = ((_d = current.reason) !== null && _d !== void 0 ? _d : null) !== (((_e = input.reason) === null || _e === void 0 ? void 0 : _e.trim()) || null);
                    if (statusChanged || reasonChanged) {
                        // Capture previous values BEFORE the update mutates the instance
                        const previousValue = { status: current.status };
                        if (reasonChanged)
                            previousValue.reason = (_f = current.reason) !== null && _f !== void 0 ? _f : null;
                        yield current.update({
                            status: input.status,
                            reason: ((_g = input.reason) === null || _g === void 0 ? void 0 : _g.trim()) || null,
                            teacherId: performedByPersonId,
                            markedAt: new Date(),
                        }, { transaction: t });
                        const newValue = { status: input.status };
                        if (reasonChanged)
                            newValue.reason = ((_h = input.reason) === null || _h === void 0 ? void 0 : _h.trim()) || null;
                        yield models_1.AttendanceAuditLog.create({
                            attendanceRecordId: current.id,
                            action: 'status_changed',
                            performedBy: performedByPersonId,
                            previousValue,
                            newValue,
                            timestamp: new Date(),
                        }, { transaction: t });
                        result.updated++;
                    }
                    else {
                        result.unchanged++;
                    }
                }
            }
            yield session.update({ status: 'completed' }, { transaction: t });
            yield t.commit();
            return result;
        }
        catch (error) {
            yield t.rollback();
            throw error;
        }
    });
}
/**
 * A student is blocked in this session if they have an un-cleared absent/kicked
 * record in an earlier session of the same day (same enrollment).
 */
function computeBlockedFlag(session, inscriptionId, t) {
    return __awaiter(this, void 0, void 0, function* () {
        const entry = yield models_1.ScheduleEntry.findByPk(session.scheduleEntryId, { transaction: t });
        if (!entry)
            return false;
        const currentOrder = periodSortKey(entry.periodId);
        const priorRecords = yield models_1.AttendanceRecord.findAll({
            where: {
                inscriptionId,
                status: { [sequelize_1.Op.in]: BLOCKING_STATUSES },
                clearedAt: null,
            },
            include: [
                {
                    model: models_1.AttendanceSession,
                    as: 'session',
                    where: { sessionDate: session.sessionDate },
                    include: [{ model: models_1.ScheduleEntry, as: 'scheduleEntry' }],
                },
            ],
            transaction: t,
        });
        return priorRecords.some(r => { var _a, _b, _c; return periodSortKey((_c = (_b = (_a = r.session) === null || _a === void 0 ? void 0 : _a.scheduleEntry) === null || _b === void 0 ? void 0 : _b.periodId) !== null && _c !== void 0 ? _c : '') < currentOrder; });
    });
}
/**
 * Clear a block on an attendance record. Requires an active clearance reason;
 * reasons with requiresNote need a non-empty note. Fully audited.
 */
function clearAttendanceBlock(recordId, clearedByPersonId, reasonCode, reasonNote) {
    return __awaiter(this, void 0, void 0, function* () {
        const record = yield models_1.AttendanceRecord.findByPk(recordId);
        if (!record)
            throw new Error('Registro de asistencia no encontrado');
        if (!record.blocked)
            throw new Error('El registro no está bloqueado');
        const reason = yield models_1.ClearanceReason.findOne({ where: { code: reasonCode, active: true } });
        if (!reason)
            throw new Error('Motivo de desbloqueo inválido');
        if (reason.requiresNote && !(reasonNote === null || reasonNote === void 0 ? void 0 : reasonNote.trim())) {
            throw new Error('Debe especificar el motivo');
        }
        const t = yield database_1.default.transaction();
        try {
            yield record.update({
                blocked: false,
                clearedBy: clearedByPersonId,
                clearedAt: new Date(),
                clearanceReasonCode: reason.code,
                clearanceReasonNote: (reasonNote === null || reasonNote === void 0 ? void 0 : reasonNote.trim()) || null,
            }, { transaction: t });
            yield models_1.AttendanceAuditLog.create({
                attendanceRecordId: record.id,
                action: 'cleared',
                performedBy: clearedByPersonId,
                reasonCode: reason.code,
                reasonNote: (reasonNote === null || reasonNote === void 0 ? void 0 : reasonNote.trim()) || null,
                previousValue: { blocked: true },
                newValue: { blocked: false, clearedBy: clearedByPersonId },
                timestamp: new Date(),
            }, { transaction: t });
            yield t.commit();
            return record;
        }
        catch (error) {
            yield t.rollback();
            throw error;
        }
    });
}
const DEFAULT_CLEARANCE_REASONS = [
    { code: 'nurse_visit', label: 'Visita a enfermería', requiresNote: false },
    { code: 'admin_authorized', label: 'Autorizado por Administración', requiresNote: false },
    { code: 'parent_note', label: 'Nota del representante', requiresNote: false },
    { code: 'other', label: 'Otro (especificar)', requiresNote: true },
];
/** List active clearance reasons, seeding defaults on first use. */
function listClearanceReasons() {
    return __awaiter(this, void 0, void 0, function* () {
        const existing = yield models_1.ClearanceReason.findAll({ where: { active: true }, order: [['id', 'ASC']] });
        if (existing.length > 0)
            return existing;
        yield models_1.ClearanceReason.bulkCreate(DEFAULT_CLEARANCE_REASONS.map(r => (Object.assign(Object.assign({}, r), { active: true }))));
        return models_1.ClearanceReason.findAll({ where: { active: true }, order: [['id', 'ASC']] });
    });
}
/**
 * Clear a prior-session block directly from the session UI. Creates the
 * student's record for this session if it does not exist yet (status
 * 'present' — the student is physically in class), then applies the
 * clearance. Fully audited: 'marked' + 'blocked' + 'cleared'.
 */
function clearSessionBlock(sessionId, inscriptionId, clearedByPersonId, reasonCode, reasonNote) {
    return __awaiter(this, void 0, void 0, function* () {
        let record = yield models_1.AttendanceRecord.findOne({ where: { sessionId, inscriptionId } });
        if (!record) {
            const session = yield models_1.AttendanceSession.findByPk(sessionId);
            if (!session)
                throw new Error('Sesión de asistencia no encontrada');
            const t = yield database_1.default.transaction();
            try {
                const blocked = yield computeBlockedFlag(session, inscriptionId, t);
                record = yield models_1.AttendanceRecord.create({
                    sessionId,
                    inscriptionId,
                    teacherId: clearedByPersonId,
                    status: 'present',
                    blocked,
                    markedAt: new Date(),
                }, { transaction: t });
                yield models_1.AttendanceAuditLog.create({
                    attendanceRecordId: record.id,
                    action: 'marked',
                    performedBy: clearedByPersonId,
                    newValue: { status: 'present', reason: null },
                    timestamp: new Date(),
                }, { transaction: t });
                if (blocked) {
                    yield models_1.AttendanceAuditLog.create({
                        attendanceRecordId: record.id,
                        action: 'blocked',
                        performedBy: clearedByPersonId,
                        previousValue: { blocked: false },
                        newValue: { blocked: true },
                        timestamp: new Date(),
                    }, { transaction: t });
                }
                yield t.commit();
            }
            catch (error) {
                yield t.rollback();
                throw error;
            }
        }
        return clearAttendanceBlock(record.id, clearedByPersonId, reasonCode, reasonNote);
    });
}
