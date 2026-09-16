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
describe('Academic Endpoints', () => {
    let agent;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        agent = supertest_1.default.agent(app_1.default);
        yield (0, testData_1.createTestUser)({ username: 'admin' });
        yield agent
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'password123' });
    }));
    describe('GET /api/academic/periods', () => {
        it('should return all school periods', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, testData_1.createTestPeriod)({ period: '2024-2025', startYear: 2024, endYear: 2025 });
            yield (0, testData_1.createTestPeriod)({ period: '2025-2026', startYear: 2025, endYear: 2026 });
            const response = yield agent
                .get('/api/academic/periods')
                .expect(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThanOrEqual(2);
        }));
    });
    describe('GET /api/academic/active', () => {
        it('should return active period', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, testData_1.createTestPeriod)({ isActive: true });
            const response = yield agent
                .get('/api/academic/active')
                .expect(200);
            // getActivePeriod returns the period object directly (or null)
            expect(response.body).not.toBeNull();
            expect(response.body.isActive).toBe(true);
        }));
        it('should return null when no active period', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, testData_1.createTestPeriod)({ isActive: false });
            const response = yield agent
                .get('/api/academic/active')
                .expect(200);
            expect(response.body).toBeNull();
        }));
    });
    describe('POST /api/academic/periods', () => {
        it('should create new school period', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield agent
                .post('/api/academic/periods')
                .send({
                period: '2026-2027',
                name: 'Año Escolar 2026-2027'
            })
                .expect(201);
            expect(response.body).toHaveProperty('id');
            expect(response.body.period).toBe('2026-2027');
        }));
        it('should return 400 for missing required fields', () => __awaiter(void 0, void 0, void 0, function* () {
            yield agent
                .post('/api/academic/periods')
                .send({
                period: '2026-2027'
            })
                .expect(400);
        }));
    });
    describe('GET /api/academic/grades', () => {
        it('should return all grades', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, testData_1.createTestGrade)({ name: 'Primer año' });
            yield (0, testData_1.createTestGrade)({ name: 'Segundo año' });
            const response = yield agent
                .get('/api/academic/grades')
                .expect(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThanOrEqual(2);
        }));
    });
    describe('GET /api/academic/sections', () => {
        it('should return all sections', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, testData_1.createTestSection)({ name: 'Sección A' });
            yield (0, testData_1.createTestSection)({ name: 'Sección B' });
            const response = yield agent
                .get('/api/academic/sections')
                .expect(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThanOrEqual(2);
        }));
    });
    describe('GET /api/academic/subjects', () => {
        it('should return all subjects', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, testData_1.createTestSubject)({ name: 'Matemática' });
            yield (0, testData_1.createTestSubject)({ name: 'Castellano' });
            const response = yield agent
                .get('/api/academic/subjects')
                .expect(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThanOrEqual(2);
        }));
    });
    describe('GET /api/academic/structure/:periodId', () => {
        it('should return period structure (array of PeriodGrades)', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const response = yield agent
                .get(`/api/academic/structure/${structure.period.id}`)
                .expect(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThanOrEqual(1);
            // Each item is a PeriodGrade with nested grade, sections, subjects
            expect(response.body[0]).toHaveProperty('grade');
            expect(response.body[0]).toHaveProperty('sections');
            expect(response.body[0]).toHaveProperty('subjects');
        }));
    });
    describe('POST /api/academic/structure/period-grade', () => {
        it('should assign grade to period', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const grade = yield (0, testData_1.createTestGrade)();
            const response = yield agent
                .post('/api/academic/structure/period-grade')
                .send({ schoolPeriodId: period.id, gradeId: grade.id })
                .expect(200);
            expect(response.body).toHaveProperty('id');
            expect(response.body.schoolPeriodId).toBe(period.id);
            expect(response.body.gradeId).toBe(grade.id);
        }));
    });
    describe('POST /api/academic/structure/section', () => {
        it('should assign section to period-grade', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const newSection = yield (0, testData_1.createTestSection)({ name: 'Sección B' });
            const response = yield agent
                .post('/api/academic/structure/section')
                .send({ periodGradeId: structure.periodGrade.id, sectionId: newSection.id })
                .expect(200);
            expect(response.body).toHaveProperty('periodGradeId');
            expect(response.body.periodGradeId).toBe(structure.periodGrade.id);
            expect(response.body.sectionId).toBe(newSection.id);
        }));
    });
    describe('POST /api/academic/structure/subject', () => {
        it('should assign subject to period-grade', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const newSubject = yield (0, testData_1.createTestSubject)({ name: 'Física' });
            const response = yield agent
                .post('/api/academic/structure/subject')
                .send({ periodGradeId: structure.periodGrade.id, subjectId: newSubject.id })
                .expect(200);
            expect(response.body).toHaveProperty('periodGradeId');
            expect(response.body.periodGradeId).toBe(structure.periodGrade.id);
            expect(response.body.subjectId).toBe(newSubject.id);
        }));
    });
});
