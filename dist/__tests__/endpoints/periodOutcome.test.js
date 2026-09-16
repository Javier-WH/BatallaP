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
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../app.js"));
const testData_1 = require("../helpers/testData");
const index_1 = require("../../models/index.js");
const testData_2 = require("../helpers/testData");
describe('Period Outcome Endpoints', () => {
    let agent;
    let periodId;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        agent = supertest_1.default.agent(app_1.default);
        const { user, person } = yield (0, testData_1.createTestUser)({ username: 'admin' });
        const masterRole = yield (0, testData_2.createTestRole)('Master');
        yield index_1.PersonRole.create({ personId: person.id, roleId: masterRole.id });
        yield agent
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'password123' });
        const period = yield (0, testData_1.createTestPeriod)();
        periodId = period.id;
    }));
    describe('GET /api/periods/:periodId/outcomes', () => {
        it('should return empty array when no outcomes exist', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield agent
                .get(`/api/periods/${periodId}/outcomes`)
                .expect(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        }));
        it('should return outcomes for period', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const { person } = yield (0, testData_1.createTestUser)({ username: 'student1' });
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            yield index_1.StudentPeriodOutcome.create({
                inscriptionId: inscription.id,
                finalAverage: 15.5,
                failedSubjects: 0,
                status: 'aprobado'
            });
            const response = yield agent
                .get(`/api/periods/${structure.period.id}/outcomes`)
                .expect(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].status).toBe('aprobado');
            // DECIMAL(5,2) — SQLite stores as REAL, MySQL as string; compare numerically
            expect(Number(response.body[0].finalAverage)).toBeCloseTo(15.5, 2);
        }));
        it('should filter outcomes by status', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const { person: person1 } = yield (0, testData_1.createTestUser)({ username: 'student1' });
            const { person: person2 } = yield (0, testData_1.createTestUser)({ username: 'student2' });
            const inscription1 = yield (0, testData_1.createTestInscription)(person1.id, structure.period.id, structure.grade.id, structure.section.id);
            const inscription2 = yield (0, testData_1.createTestInscription)(person2.id, structure.period.id, structure.grade.id, structure.section.id);
            yield index_1.StudentPeriodOutcome.create({
                inscriptionId: inscription1.id,
                finalAverage: 15.5,
                failedSubjects: 0,
                status: 'aprobado'
            });
            yield index_1.StudentPeriodOutcome.create({
                inscriptionId: inscription2.id,
                finalAverage: 8.5,
                failedSubjects: 5,
                status: 'reprobado'
            });
            const response = yield agent
                .get(`/api/periods/${structure.period.id}/outcomes?status=aprobado`)
                .expect(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].status).toBe('aprobado');
        }));
        it('should return 400 for invalid status', () => __awaiter(void 0, void 0, void 0, function* () {
            yield agent
                .get(`/api/periods/${periodId}/outcomes?status=invalid`)
                .expect(400);
        }));
    });
    describe('GET /api/periods/:periodId/pending-subjects', () => {
        it('should return empty array when no pending subjects exist', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield agent
                .get(`/api/periods/${periodId}/pending-subjects`)
                .expect(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        }));
        it('should return pending subjects for period', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const { person } = yield (0, testData_1.createTestUser)({ username: 'student1' });
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            yield index_1.PendingSubject.create({
                newInscriptionId: inscription.id,
                subjectId: structure.subject.id,
                originPeriodId: structure.period.id,
                status: 'pendiente'
            });
            const response = yield agent
                .get(`/api/periods/${structure.period.id}/pending-subjects`)
                .expect(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].status).toBe('pendiente');
        }));
    });
    describe('POST /api/periods/pending-subjects/:pendingSubjectId/resolve', () => {
        it('should resolve pending subject as aprobada', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const { person } = yield (0, testData_1.createTestUser)({ username: 'student1' });
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            const pendingSubject = yield index_1.PendingSubject.create({
                newInscriptionId: inscription.id,
                subjectId: structure.subject.id,
                originPeriodId: structure.period.id,
                status: 'pendiente'
            });
            const response = yield agent
                .post(`/api/periods/pending-subjects/${pendingSubject.id}/resolve`)
                .send({ status: 'aprobada' })
                .expect(200);
            expect(response.body.status).toBe('aprobada');
            expect(response.body.resolvedAt).toBeDefined();
        }));
        it('should return 400 for invalid status', () => __awaiter(void 0, void 0, void 0, function* () {
            yield agent
                .post('/api/periods/pending-subjects/1/resolve')
                .send({ status: 'invalid' })
                .expect(400);
        }));
    });
});
