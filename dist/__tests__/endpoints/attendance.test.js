"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../app.js"));
const testData_1 = require("../helpers/testData");
const index_1 = require("../../models/index.js");
const MONDAY = '2026-09-14'; // Monday
function createLoginAgent(username, roleName) {
    return __awaiter(this, void 0, void 0, function* () {
        const agent = supertest_1.default.agent(app_1.default);
        const { user, person } = yield (0, testData_1.createTestUser)({ username });
        const role = yield (0, testData_1.createTestRole)(roleName);
        yield index_1.PersonRole.create({ personId: person.id, roleId: role.id });
        yield agent.post('/api/auth/login').send({ username: user.username, password: 'password123' });
        return { agent, user, person };
    });
}
function buildTeacherSetup() {
    return __awaiter(this, void 0, void 0, function* () {
        const structure = yield (0, testData_1.createAcademicStructure)();
        const { agent, person } = yield createLoginAgent('attteacher', 'Profesor');
        const schedule = yield index_1.Schedule.create({
            schoolPeriodId: structure.period.id,
            periodGradeSectionId: structure.periodGradeSection.id,
            status: 'published',
        });
        const entry = yield index_1.ScheduleEntry.create({
            scheduleId: schedule.id,
            day: 'Lunes',
            periodId: 'm1',
            subjectId: structure.subject.id,
            teacherId: person.id,
            isGroupSubject: false,
        });
        const { person: studentPerson } = yield (0, testData_1.createTestUser)({
            username: 'attstudent',
            firstName: 'Ana',
            lastName: 'Alumno',
        });
        const inscription = yield (0, testData_1.createTestInscription)(studentPerson.id, structure.period.id, structure.grade.id, structure.section.id);
        return { structure, agent, person, schedule, entry, inscription };
    });
}
describe('Attendance endpoints', () => {
    describe('GET /api/attendance/my-sessions', () => {
        it('retorna sesiones del profesor para la fecha', () => __awaiter(void 0, void 0, void 0, function* () {
            const { agent } = yield buildTeacherSetup();
            const res = yield agent.get(`/api/attendance/my-sessions?date=${MONDAY}`);
            expect(res.status).toBe(200);
            expect(res.body.sessions).toHaveLength(1);
            expect(res.body.sessions[0].periodId).toBe('m1');
            expect(res.body.sessions[0].sessionDate).toBe(MONDAY);
        }));
        it('rechaza fechas inválidas', () => __awaiter(void 0, void 0, void 0, function* () {
            const { agent } = yield buildTeacherSetup();
            const res = yield agent.get('/api/attendance/my-sessions?date=invalid');
            expect(res.status).toBe(400);
        }));
        it('filtra sesiones por schoolPeriodId cuando se envía', () => __awaiter(void 0, void 0, void 0, function* () {
            const { agent } = yield buildTeacherSetup();
            const otherStructure = yield (0, testData_1.createAcademicStructure)();
            const res = yield agent.get(`/api/attendance/my-sessions?date=${MONDAY}&schoolPeriodId=${otherStructure.period.id}`);
            expect(res.status).toBe(200);
            expect(res.body.sessions).toHaveLength(0);
        }));
        it('retorna sesiones del período correcto', () => __awaiter(void 0, void 0, void 0, function* () {
            const { agent, structure } = yield buildTeacherSetup();
            const res = yield agent.get(`/api/attendance/my-sessions?date=${MONDAY}&schoolPeriodId=${structure.period.id}`);
            expect(res.status).toBe(200);
            expect(res.body.sessions).toHaveLength(1);
        }));
        it('rechaza usuarios sin rol de asistencia', () => __awaiter(void 0, void 0, void 0, function* () {
            const agent = supertest_1.default.agent(app_1.default);
            const { person } = yield (0, testData_1.createTestUser)({ username: 'norole' });
            const role = yield (0, testData_1.createTestRole)('Alumno');
            yield index_1.PersonRole.create({ personId: person.id, roleId: role.id });
            yield agent.post('/api/auth/login').send({ username: 'norole', password: 'password123' });
            const res = yield agent.get(`/api/attendance/my-sessions?date=${MONDAY}`);
            expect(res.status).toBe(403);
        }));
    });
    describe('PUT /api/attendance/sessions/:id/records', () => {
        it('el profesor guarda asistencia de su propia sesión', () => __awaiter(void 0, void 0, void 0, function* () {
            const { agent, inscription } = yield buildTeacherSetup();
            const sessionsRes = yield agent.get(`/api/attendance/my-sessions?date=${MONDAY}`);
            const sessionId = sessionsRes.body.sessions[0].id;
            const res = yield agent.put(`/api/attendance/sessions/${sessionId}/records`).send({
                records: [{ inscriptionId: inscription.id, status: 'present' }],
            });
            expect(res.status).toBe(200);
            expect(res.body.created).toBe(1);
        }));
        it('rechaza absent sin motivo', () => __awaiter(void 0, void 0, void 0, function* () {
            const { agent, inscription } = yield buildTeacherSetup();
            const sessionsRes = yield agent.get(`/api/attendance/my-sessions?date=${MONDAY}`);
            const sessionId = sessionsRes.body.sessions[0].id;
            const res = yield agent.put(`/api/attendance/sessions/${sessionId}/records`).send({
                records: [{ inscriptionId: inscription.id, status: 'absent' }],
            });
            expect(res.status).toBe(400);
        }));
        it('un profesor no puede guardar en sesión ajena', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, inscription } = yield buildTeacherSetup();
            const other = yield createLoginAgent('otherteacher', 'Profesor');
            // Session owned by the first teacher
            const firstTeacherSession = yield (yield Promise.resolve().then(() => __importStar(require('../../models/index.js')))).AttendanceSession.create({
                scheduleEntryId: (yield index_1.ScheduleEntry.findOne()).id,
                schoolPeriodId: structure.period.id,
                sessionDate: MONDAY,
            });
            const res = yield other.agent.put(`/api/attendance/sessions/${firstTeacherSession.id}/records`).send({
                records: [{ inscriptionId: inscription.id, status: 'present' }],
            });
            expect(res.status).toBe(403);
        }));
    });
    describe('GET /api/attendance/clearance-reasons', () => {
        it('retorna motivos con siembra automática', () => __awaiter(void 0, void 0, void 0, function* () {
            const { agent } = yield buildTeacherSetup();
            const res = yield agent.get('/api/attendance/clearance-reasons');
            expect(res.status).toBe(200);
            expect(res.body.length).toBeGreaterThanOrEqual(4);
        }));
    });
    describe('POST /api/attendance/records/:id/clear', () => {
        it('Control de Estudios puede desbloquear cualquier registro', () => __awaiter(void 0, void 0, void 0, function* () {
            const { agent, inscription, structure } = yield buildTeacherSetup();
            const ce = yield createLoginAgent('attcontrol', 'Control de Estudios');
            const sessionsRes = yield agent.get(`/api/attendance/my-sessions?date=${MONDAY}`);
            const sessionId = sessionsRes.body.sessions[0].id;
            yield agent.put(`/api/attendance/sessions/${sessionId}/records`).send({
                records: [{ inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' }],
            });
            const { AttendanceRecord, ClearanceReason } = yield Promise.resolve().then(() => __importStar(require('../../models/index.js')));
            const record = yield AttendanceRecord.findOne({ where: { sessionId } });
            yield record.update({ blocked: true });
            yield ClearanceReason.create({ code: 'admin_authorized', label: 'Autorizado', requiresNote: false, active: true });
            const res = yield ce.agent.post(`/api/attendance/records/${record.id}/clear`).send({
                reasonCode: 'admin_authorized',
            });
            expect(res.status).toBe(200);
            expect(res.body.blocked).toBe(false);
            expect(res.body.clearanceReasonCode).toBe('admin_authorized');
        }));
    });
    describe('GET /api/attendance/students/:personId/summary', () => {
        it('staff obtiene el historial del estudiante', () => __awaiter(void 0, void 0, void 0, function* () {
            const { agent, inscription, structure } = yield buildTeacherSetup();
            const admin = yield createLoginAgent('attadmin', 'Administrador');
            const sessionsRes = yield agent.get(`/api/attendance/my-sessions?date=${MONDAY}`);
            const sessionId = sessionsRes.body.sessions[0].id;
            yield agent.put(`/api/attendance/sessions/${sessionId}/records`).send({
                records: [{ inscriptionId: inscription.id, status: 'late' }],
            });
            const { Inscription } = yield Promise.resolve().then(() => __importStar(require('../../models/index.js')));
            const ins = yield Inscription.findByPk(inscription.id);
            const res = yield admin.agent.get(`/api/attendance/students/${ins.personId}/summary?schoolPeriodId=${structure.period.id}`);
            expect(res.status).toBe(200);
            expect(res.body.totals.late).toBe(1);
            expect(res.body.records[0].status).toBe('late');
        }));
    });
});
