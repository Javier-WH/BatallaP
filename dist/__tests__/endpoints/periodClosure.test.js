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
describe('Period Closure Endpoints', () => {
    let agent;
    let userId;
    let periodId;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        agent = supertest_1.default.agent(app_1.default);
        const { user, person } = yield (0, testData_1.createTestUser)({ username: 'admin' });
        userId = user.id;
        const masterRole = yield (0, testData_2.createTestRole)('Master');
        yield index_1.PersonRole.create({ personId: person.id, roleId: masterRole.id });
        yield agent
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'password123' });
        const period = yield (0, testData_1.createTestPeriod)();
        periodId = period.id;
    }));
    describe('GET /api/period-closure/:periodId/status', () => {
        it('should return period closure status', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield agent
                .get(`/api/period-closure/${periodId}/status`)
                .expect(200);
            expect(response.body).toHaveProperty('period');
            expect(response.body).toHaveProperty('checklist');
            expect(response.body).toHaveProperty('blockedTerms');
            expect(response.body).toHaveProperty('totalTerms');
            expect(response.body.period.id).toBe(periodId);
        }));
        it('should return 400 for invalid periodId', () => __awaiter(void 0, void 0, void 0, function* () {
            yield agent
                .get('/api/period-closure/invalid/status')
                .expect(400);
        }));
        it('should include nextPeriod when available', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, testData_1.createTestPeriod)({
                period: '2026-2027',
                name: 'Año Escolar 2026-2027',
                startYear: 2026,
                endYear: 2027,
                isActive: false
            });
            const response = yield agent
                .get(`/api/period-closure/${periodId}/status`)
                .expect(200);
            expect(response.body.nextPeriod).toBeDefined();
            expect(response.body.nextPeriod.period).toBe('2026-2027');
        }));
    });
    describe('GET /api/period-closure/:periodId/validate', () => {
        it('should validate closure requirements', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield agent
                .get(`/api/period-closure/${periodId}/validate`)
                .expect(200);
            expect(response.body).toHaveProperty('valid');
            expect(response.body).toHaveProperty('errors');
            expect(response.body).toHaveProperty('warnings');
        }));
        it('should return errors when next period does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield agent
                .get(`/api/period-closure/${periodId}/validate`)
                .expect(200);
            expect(response.body.valid).toBe(false);
            expect(response.body.errors).toContain('Debe existir un periodo siguiente creado antes de cerrar el periodo actual');
        }));
        it('should return errors when terms are not blocked', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, testData_1.createTestPeriod)({
                period: '2026-2027',
                startYear: 2026,
                endYear: 2027,
                isActive: false
            });
            // Create a structure with sections so areAllSectionsClosed returns false
            // (totalSections > 0 but no TermSectionClosure records).
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId });
            yield (0, testData_1.createTestTerm)(periodId, { isBlocked: false, name: 'Primer Lapso' });
            const response = yield agent
                .get(`/api/period-closure/${periodId}/validate`)
                .expect(200);
            expect(response.body.valid).toBe(false);
            // Validation now checks per-term: either blocked OR all sections closed
            expect(response.body.errors.some((e) => e.includes('no tiene todas sus secciones cerradas'))).toBe(true);
        }));
    });
    describe('GET /api/period-closure/:periodId/preview', () => {
        it('should return preview of student outcomes', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: periodId });
            const { person } = yield (0, testData_1.createTestUser)({ username: 'student1', document: '11111111' });
            yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            yield (0, testData_1.createTestSetting)('min_approval_grade', '10');
            const response = yield agent
                .get(`/api/period-closure/${structure.period.id}/preview`)
                .expect(200);
            expect(Array.isArray(response.body)).toBe(true);
        }));
    });
    describe('POST /api/period-closure/:periodId/execute', () => {
        it('should fail validation when requirements not met', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield agent
                .post(`/api/period-closure/${periodId}/execute`)
                .expect(400);
            expect(response.body).toHaveProperty('errors');
            expect(response.body.errors.length).toBeGreaterThan(0);
        }));
        it('should successfully close period when all requirements met', () => __awaiter(void 0, void 0, void 0, function* () {
            const nextPeriod = yield (0, testData_1.createTestPeriod)({
                period: '2026-2027',
                name: 'Año Escolar 2026-2027',
                startYear: 2026,
                endYear: 2027,
                status: 'preinscripcion'
            });
            const term1 = yield (0, testData_1.createTestTerm)(periodId, {
                name: 'Primer Lapso',
                order: 1,
                isBlocked: true
            });
            const term2 = yield (0, testData_1.createTestTerm)(periodId, {
                name: 'Segundo Lapso',
                order: 2,
                isBlocked: true
            });
            const term3 = yield (0, testData_1.createTestTerm)(periodId, {
                name: 'Tercer Lapso',
                order: 3,
                isBlocked: true
            });
            yield (0, testData_1.createTestSetting)('min_approval_grade', '10');
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: periodId });
            const { person } = yield (0, testData_1.createTestUser)({ username: 'student1', document: '11111111' });
            yield (0, testData_1.createTestInscription)(person.id, periodId, structure.grade.id, structure.section.id);
            yield index_1.PeriodGrade.create({
                schoolPeriodId: nextPeriod.id,
                gradeId: structure.grade.id
            });
            const response = yield agent
                .post(`/api/period-closure/${periodId}/execute`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('stats');
            expect(response.body.stats.totalStudents).toBeGreaterThan(0);
        }));
    });
});
