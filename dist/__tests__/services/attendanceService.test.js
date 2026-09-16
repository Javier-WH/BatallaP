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
const attendanceService_1 = require("../../services/attendanceService.js");
const index_1 = require("../../models/index.js");
const testData_1 = require("../helpers/testData");
const MONDAY = '2026-09-14'; // Monday
const SATURDAY = '2026-09-19'; // Saturday
function setupTeacherWithSchedule(day, periodId) {
    return __awaiter(this, void 0, void 0, function* () {
        const structure = yield (0, testData_1.createAcademicStructure)();
        const { user, person } = yield (0, testData_1.createTestUser)({ firstName: 'Profe', lastName: 'Uno' });
        const schedule = yield index_1.Schedule.create({
            schoolPeriodId: structure.period.id,
            periodGradeSectionId: structure.periodGradeSection.id,
            status: 'published',
        });
        const entry = yield index_1.ScheduleEntry.create({
            scheduleId: schedule.id,
            day,
            periodId,
            subjectId: structure.subject.id,
            teacherId: person.id,
            isGroupSubject: false,
        });
        return { structure, user, person, schedule, entry };
    });
}
function setupStudent(structure, suffix) {
    return __awaiter(this, void 0, void 0, function* () {
        const { person } = yield (0, testData_1.createTestUser)({
            firstName: `Est${suffix}`,
            lastName: 'udiante',
        });
        const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
        return { person, inscription };
    });
}
describe('attendanceService', () => {
    describe('getDayNameForDate', () => {
        it('mapea lunes a "Lunes"', () => {
            expect((0, attendanceService_1.getDayNameForDate)(MONDAY)).toBe('Lunes');
        });
        it('mapea viernes a "Viernes"', () => {
            expect((0, attendanceService_1.getDayNameForDate)('2026-09-18')).toBe('Viernes');
        });
        it('retorna vacío para sábado y domingo', () => {
            expect((0, attendanceService_1.getDayNameForDate)(SATURDAY)).toBe('');
            expect((0, attendanceService_1.getDayNameForDate)('2026-09-20')).toBe('');
        });
    });
    describe('getTeacherSessionsForDate', () => {
        it('crea y retorna sesiones desde el horario del profesor', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const sessions = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            expect(sessions).toHaveLength(1);
            expect(sessions[0].periodId).toBe('m1');
            expect(sessions[0].sessionDate).toBe(MONDAY);
            expect(sessions[0].subjectName).toBeTruthy();
            // Session persisted
            const persisted = yield index_1.AttendanceSession.findAll();
            expect(persisted).toHaveLength(1);
            expect(persisted[0].scheduleEntryId).toBe(sessions[0].scheduleEntryId);
        }));
        it('es idempotente: la segunda llamada no duplica sesiones', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield setupTeacherWithSchedule('Lunes', 'm1');
            yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            expect(yield index_1.AttendanceSession.findAll()).toHaveLength(1);
        }));
        it('retorna vacío en fin de semana', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const sessions = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, SATURDAY);
            expect(sessions).toHaveLength(0);
        }));
        it('ordena mañana antes que tarde', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person, schedule } = yield setupTeacherWithSchedule('Lunes', 't1');
            yield index_1.ScheduleEntry.create({
                scheduleId: schedule.id,
                day: 'Lunes',
                periodId: 'm2',
                subjectId: null,
                teacherId: person.id,
                isGroupSubject: false,
            });
            const sessions = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            expect(sessions).toHaveLength(2);
            expect(sessions[0].periodId).toBe('m2');
            expect(sessions[1].periodId).toBe('t1');
        }));
        it('permite backfill de fechas pasadas', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const pastMonday = '2026-09-07';
            const sessions = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, pastMonday);
            expect(sessions).toHaveLength(1);
            expect(sessions[0].sessionDate).toBe(pastMonday);
        }));
    });
    describe('getSessionDetail', () => {
        it('retorna la nómina de la sección con registros vacíos al inicio', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person, entry } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            const [session] = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            const detail = yield (0, attendanceService_1.getSessionDetail)(session.id);
            expect(detail.session.id).toBe(session.id);
            expect(detail.roster).toHaveLength(1);
            expect(detail.roster[0].inscriptionId).toBe(inscription.id);
            expect(detail.roster[0].status).toBeNull();
            expect(detail.roster[0].blocked).toBe(false);
            expect(detail.roster[0].fullName).toBeTruthy();
        }));
    });
    describe('saveSessionRecords', () => {
        it('crea registros y escribe auditoría "marked"', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            const [session] = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            yield (0, attendanceService_1.saveSessionRecords)(session.id, [
                { inscriptionId: inscription.id, status: 'present' },
            ], person.id);
            const record = yield index_1.AttendanceRecord.findOne({ where: { sessionId: session.id } });
            expect(record.status).toBe('present');
            expect(record.teacherId).toBe(person.id);
            const audit = yield index_1.AttendanceAuditLog.findOne({ where: { attendanceRecordId: record.id } });
            expect(audit.action).toBe('marked');
            expect(audit.performedBy).toBe(person.id);
        }));
        it('actualiza el estado y escribe auditoría "status_changed"', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            const [session] = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            yield (0, attendanceService_1.saveSessionRecords)(session.id, [
                { inscriptionId: inscription.id, status: 'present' },
            ], person.id);
            yield (0, attendanceService_1.saveSessionRecords)(session.id, [
                { inscriptionId: inscription.id, status: 'late' },
            ], person.id);
            const audits = yield index_1.AttendanceAuditLog.findAll({ order: [['id', 'ASC']] });
            expect(audits).toHaveLength(2);
            expect(audits[0].action).toBe('marked');
            expect(audits[1].action).toBe('status_changed');
            expect(audits[1].previousValue).toEqual({ status: 'present' });
            expect(audits[1].newValue).toEqual({ status: 'late' });
        }));
        it('no duplica auditoría cuando el estado no cambia', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            const [session] = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            yield (0, attendanceService_1.saveSessionRecords)(session.id, [
                { inscriptionId: inscription.id, status: 'present' },
            ], person.id);
            yield (0, attendanceService_1.saveSessionRecords)(session.id, [
                { inscriptionId: inscription.id, status: 'present' },
            ], person.id);
            expect(yield index_1.AttendanceAuditLog.findAll()).toHaveLength(1);
        }));
        it('rechaza "absent" sin motivo', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            const [session] = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            yield expect((0, attendanceService_1.saveSessionRecords)(session.id, [
                { inscriptionId: inscription.id, status: 'absent' },
            ], person.id)).rejects.toThrow();
        }));
        it('rechaza "kicked" sin motivo', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            const [session] = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            yield expect((0, attendanceService_1.saveSessionRecords)(session.id, [
                { inscriptionId: inscription.id, status: 'kicked' },
            ], person.id)).rejects.toThrow();
        }));
        it('marca blocked cuando hubo ausencia sin desbloquear en sesión anterior del día', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person, schedule } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            const entry2 = yield index_1.ScheduleEntry.create({
                scheduleId: schedule.id,
                day: 'Lunes',
                periodId: 'm2',
                subjectId: null,
                teacherId: person.id,
                isGroupSubject: false,
            });
            const [s1] = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            yield (0, attendanceService_1.saveSessionRecords)(s1.id, [
                { inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' },
            ], person.id);
            // Simulate the second session of the day (m2)
            const s2 = yield index_1.AttendanceSession.findOrCreate({
                where: { scheduleEntryId: entry2.id, sessionDate: MONDAY },
                defaults: { scheduleEntryId: entry2.id, schoolPeriodId: structure.period.id, sessionDate: MONDAY },
            }).then(([s]) => s);
            yield (0, attendanceService_1.saveSessionRecords)(s2.id, [
                { inscriptionId: inscription.id, status: 'present' },
            ], person.id);
            const record = yield index_1.AttendanceRecord.findOne({ where: { sessionId: s2.id } });
            expect(record.blocked).toBe(true);
            const blockedAudit = yield index_1.AttendanceAuditLog.findOne({
                where: { attendanceRecordId: record.id, action: 'blocked' },
            });
            expect(blockedAudit).not.toBeNull();
        }));
        it('no marca blocked si la ausencia anterior fue desbloqueada', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person, schedule } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            const entry2 = yield index_1.ScheduleEntry.create({
                scheduleId: schedule.id,
                day: 'Lunes',
                periodId: 'm2',
                subjectId: null,
                teacherId: person.id,
                isGroupSubject: false,
            });
            const [s1] = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            yield (0, attendanceService_1.saveSessionRecords)(s1.id, [
                { inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' },
            ], person.id);
            // Force the block on the first record, then clear it
            const r1 = yield index_1.AttendanceRecord.findOne({ where: { sessionId: s1.id } });
            yield r1.update({ blocked: true });
            yield (0, attendanceService_1.listClearanceReasons)();
            yield (0, attendanceService_1.clearAttendanceBlock)(r1.id, person.id, 'parent_note', null);
            const s2 = yield index_1.AttendanceSession.findOrCreate({
                where: { scheduleEntryId: entry2.id, sessionDate: MONDAY },
                defaults: { scheduleEntryId: entry2.id, schoolPeriodId: structure.period.id, sessionDate: MONDAY },
            }).then(([s]) => s);
            yield (0, attendanceService_1.saveSessionRecords)(s2.id, [
                { inscriptionId: inscription.id, status: 'present' },
            ], person.id);
            const record = yield index_1.AttendanceRecord.findOne({ where: { sessionId: s2.id } });
            expect(record.blocked).toBe(false);
        }));
    });
    describe('clearAttendanceBlock', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, attendanceService_1.listClearanceReasons)();
        }));
        it('desbloquea con motivo y escribe auditoría "cleared"', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            const [session] = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            yield (0, attendanceService_1.saveSessionRecords)(session.id, [
                { inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' },
            ], person.id);
            const record = yield index_1.AttendanceRecord.findOne({ where: { sessionId: session.id } });
            // Force blocked state
            yield record.update({ blocked: true });
            const cleared = yield (0, attendanceService_1.clearAttendanceBlock)(record.id, person.id, 'parent_note', null);
            expect(cleared.blocked).toBe(false);
            expect(cleared.clearedBy).toBe(person.id);
            expect(cleared.clearanceReasonCode).toBe('parent_note');
            const audit = yield index_1.AttendanceAuditLog.findOne({
                where: { attendanceRecordId: record.id, action: 'cleared' },
            });
            expect(audit).not.toBeNull();
            expect(audit.reasonCode).toBe('parent_note');
            expect(audit.previousValue).toEqual({ blocked: true });
            expect(audit.newValue).toEqual({ blocked: false, clearedBy: person.id });
        }));
        it('rechaza cuando el motivo requiere nota y no se envía', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            const [session] = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            yield (0, attendanceService_1.saveSessionRecords)(session.id, [
                { inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' },
            ], person.id);
            const record = yield index_1.AttendanceRecord.findOne({ where: { sessionId: session.id } });
            yield record.update({ blocked: true });
            yield expect((0, attendanceService_1.clearAttendanceBlock)(record.id, person.id, 'other', null)).rejects.toThrow();
        }));
        it('rechaza si el registro no está bloqueado', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            const [session] = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            yield (0, attendanceService_1.saveSessionRecords)(session.id, [
                { inscriptionId: inscription.id, status: 'present' },
            ], person.id);
            const record = yield index_1.AttendanceRecord.findOne({ where: { sessionId: session.id } });
            yield expect((0, attendanceService_1.clearAttendanceBlock)(record.id, person.id, 'parent_note', null)).rejects.toThrow();
        }));
    });
    describe('listClearanceReasons', () => {
        it('siembra motivos por defecto la primera vez', () => __awaiter(void 0, void 0, void 0, function* () {
            const reasons = yield (0, attendanceService_1.listClearanceReasons)();
            expect(reasons.length).toBeGreaterThanOrEqual(4);
            const codes = reasons.map(r => r.code);
            expect(codes).toContain('nurse_visit');
            expect(codes).toContain('admin_authorized');
            expect(codes).toContain('parent_note');
            expect(codes).toContain('other');
            const other = reasons.find(r => r.code === 'other');
            expect(other.requiresNote).toBe(true);
            // Idempotent
            yield (0, attendanceService_1.listClearanceReasons)();
            expect(yield index_1.ClearanceReason.findAll()).toHaveLength(reasons.length);
        }));
    });
    describe('getSessionDetail — priorBlock', () => {
        it('retorna priorBlock para ausente sin desbloquear en sesión anterior del día', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person, schedule } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            yield index_1.ScheduleEntry.create({
                scheduleId: schedule.id,
                day: 'Lunes',
                periodId: 'm2',
                subjectId: null,
                teacherId: person.id,
                isGroupSubject: false,
            });
            const sessions = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            const [s1, s2] = sessions;
            yield (0, attendanceService_1.saveSessionRecords)(s1.id, [
                { inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' },
            ], person.id);
            const detail = yield (0, attendanceService_1.getSessionDetail)(s2.id);
            const entry = detail.roster.find(r => r.inscriptionId === inscription.id);
            expect(entry.priorBlock).not.toBeNull();
            expect(entry.priorBlock.status).toBe('absent');
            expect(entry.priorBlock.periodId).toBe('m1');
        }));
        it('no retorna priorBlock en la primera sesión del día', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            const [s1] = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            const detail = yield (0, attendanceService_1.getSessionDetail)(s1.id);
            const entry = detail.roster.find(r => r.inscriptionId === inscription.id);
            expect(entry.priorBlock).toBeNull();
        }));
        it('suprime priorBlock si el estudiante fue desbloqueado en la sesión actual', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person, schedule } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            yield index_1.ScheduleEntry.create({
                scheduleId: schedule.id,
                day: 'Lunes',
                periodId: 'm2',
                subjectId: null,
                teacherId: person.id,
                isGroupSubject: false,
            });
            const sessions = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            const [s1, s2] = sessions;
            yield (0, attendanceService_1.saveSessionRecords)(s1.id, [
                { inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' },
            ], person.id);
            yield (0, attendanceService_1.listClearanceReasons)();
            yield (0, attendanceService_1.clearSessionBlock)(s2.id, inscription.id, person.id, 'parent_note', null);
            const detail = yield (0, attendanceService_1.getSessionDetail)(s2.id);
            const entry = detail.roster.find(r => r.inscriptionId === inscription.id);
            expect(entry.priorBlock).toBeNull();
            expect(entry.status).toBe('present');
            expect(entry.blocked).toBe(false);
            expect(entry.clearanceReasonCode).toBe('parent_note');
        }));
    });
    describe('clearSessionBlock', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, attendanceService_1.listClearanceReasons)();
        }));
        it('crea el registro si no existe y lo desbloquea con auditoría completa', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person, schedule } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            yield index_1.ScheduleEntry.create({
                scheduleId: schedule.id,
                day: 'Lunes',
                periodId: 'm2',
                subjectId: null,
                teacherId: person.id,
                isGroupSubject: false,
            });
            const sessions = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            const [s1, s2] = sessions;
            yield (0, attendanceService_1.saveSessionRecords)(s1.id, [
                { inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' },
            ], person.id);
            const record = yield (0, attendanceService_1.clearSessionBlock)(s2.id, inscription.id, person.id, 'parent_note', null);
            expect(record.status).toBe('present');
            expect(record.blocked).toBe(false);
            expect(record.clearanceReasonCode).toBe('parent_note');
            const actions = (yield index_1.AttendanceAuditLog.findAll({
                where: { attendanceRecordId: record.id },
                order: [['id', 'ASC']],
            })).map(a => a.action);
            expect(actions).toEqual(['marked', 'blocked', 'cleared']);
        }));
        it('rechaza cuando el motivo requiere nota y no se envía', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, person } = yield setupTeacherWithSchedule('Lunes', 'm1');
            const { inscription } = yield setupStudent(structure, 'A');
            const [s1] = yield (0, attendanceService_1.getTeacherSessionsForDate)(person.id, MONDAY);
            yield expect((0, attendanceService_1.clearSessionBlock)(s1.id, inscription.id, person.id, 'other', null)).rejects.toThrow();
        }));
    });
});
