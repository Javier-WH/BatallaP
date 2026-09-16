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
describe('Inscription Endpoints', () => {
    let agent;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        agent = supertest_1.default.agent(app_1.default);
        const { person } = yield (0, testData_1.createTestUser)({ username: 'admin' });
        const masterRole = yield (0, testData_1.createTestRole)('Master');
        yield index_1.PersonRole.create({ personId: person.id, roleId: masterRole.id });
        yield agent
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'password123' });
    }));
    // Helper: create a student person with Alumno role
    function createStudentPerson(username) {
        return __awaiter(this, void 0, void 0, function* () {
            const { person } = yield (0, testData_1.createTestUser)({ username });
            const role = yield (0, testData_1.createTestRole)('Alumno');
            yield index_1.PersonRole.create({ personId: person.id, roleId: role.id });
            return person;
        });
    }
    // Helper: create an inscription WITH a matriculation so it shows up in listings
    function createInscriptionWithMatriculation(personId, periodId, gradeId, sectionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const inscription = yield (0, testData_1.createTestInscription)(personId, periodId, gradeId, sectionId);
            yield index_1.Matriculation.create({
                schoolPeriodId: periodId,
                gradeId,
                sectionId,
                personId,
                inscriptionId: inscription.id,
                status: 'completed',
                escolaridad: 'regular',
                hiddenFromControlEstudios: false,
            });
            return inscription;
        });
    }
    describe('GET /api/inscriptions', () => {
        it('should return all inscriptions', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const person = yield createStudentPerson('student1');
            yield createInscriptionWithMatriculation(person.id, structure.period.id, structure.grade.id, structure.section.id);
            const response = yield agent
                .get('/api/inscriptions')
                .expect(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThanOrEqual(1);
        }));
        it('should filter inscriptions by period', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure1 = yield (0, testData_1.createAcademicStructure)();
            const person1 = yield createStudentPerson('student1');
            const person2 = yield createStudentPerson('student2');
            yield createInscriptionWithMatriculation(person1.id, structure1.period.id, structure1.grade.id, structure1.section.id);
            const response = yield agent
                .get(`/api/inscriptions?schoolPeriodId=${structure1.period.id}`)
                .expect(200);
            expect(response.body.length).toBeGreaterThanOrEqual(1);
        }));
    });
    describe('GET /api/inscriptions/:id', () => {
        it('should return inscription by id', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const person = yield createStudentPerson('student1');
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            const response = yield agent
                .get(`/api/inscriptions/${inscription.id}`)
                .expect(200);
            expect(response.body.id).toBe(inscription.id);
            expect(response.body).toHaveProperty('student');
            expect(response.body).toHaveProperty('grade');
        }));
        it('should return 404 for non-existent inscription', () => __awaiter(void 0, void 0, void 0, function* () {
            yield agent
                .get('/api/inscriptions/99999')
                .expect(404);
        }));
    });
    describe('POST /api/inscriptions', () => {
        it('should create new inscription (matriculation)', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const person = yield createStudentPerson('student1');
            const response = yield agent
                .post('/api/inscriptions')
                .send({
                personId: person.id,
                schoolPeriodId: structure.period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                escolaridad: 'regular'
            })
                .expect(201);
            // createInscription returns { message, matriculation, reportUuid }
            expect(response.body).toHaveProperty('matriculation');
            expect(response.body.matriculation.personId).toBe(person.id);
            expect(response.body.matriculation.escolaridad).toBe('regular');
        }));
        it('should return 400 for missing required fields', () => __awaiter(void 0, void 0, void 0, function* () {
            yield agent
                .post('/api/inscriptions')
                .send({
                personId: 1
            })
                .expect(400);
        }));
        it('should prevent duplicate inscription for same period', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const person = yield createStudentPerson('student1');
            yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            yield agent
                .post('/api/inscriptions')
                .send({
                personId: person.id,
                schoolPeriodId: structure.period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                escolaridad: 'regular'
            })
                .expect(400);
        }));
    });
    describe('PUT /api/inscriptions/:id', () => {
        it('should update inscription', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const person = yield createStudentPerson('student1');
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            const response = yield agent
                .put(`/api/inscriptions/${inscription.id}`)
                .send({
                escolaridad: 'repitiente'
            })
                .expect(200);
            // updateInscription returns { message, inscription }
            expect(response.body.message).toMatch(/actualizado/i);
            expect(response.body.inscription.id).toBe(inscription.id);
        }));
    });
    describe('DELETE /api/inscriptions/:id', () => {
        it('should delete inscription', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const person = yield createStudentPerson('student1');
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            yield agent
                .delete(`/api/inscriptions/${inscription.id}`)
                .expect(200);
            const deleted = yield index_1.Inscription.findByPk(inscription.id);
            expect(deleted).toBeNull();
        }));
    });
    describe('POST /api/inscriptions/:id/subjects', () => {
        it('should enroll student in subject', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const person = yield createStudentPerson('student1');
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            const response = yield agent
                .post(`/api/inscriptions/${inscription.id}/subjects`)
                .send({
                subjectId: structure.subject.id
            })
                .expect(200);
            // addSubjectToInscription returns { message: '...' }
            expect(response.body.message).toMatch(/agregad/i);
            // Verify the InscriptionSubject was created
            const is = yield index_1.InscriptionSubject.findOne({
                where: { inscriptionId: inscription.id, subjectId: structure.subject.id }
            });
            expect(is).not.toBeNull();
            expect(is.inscriptionId).toBe(inscription.id);
            expect(is.subjectId).toBe(structure.subject.id);
        }));
    });
    describe('DELETE /api/inscriptions/:inscriptionId/subjects/:subjectId', () => {
        it('should unenroll student from subject', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const person = yield createStudentPerson('student1');
            const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
            yield index_1.InscriptionSubject.create({
                inscriptionId: inscription.id,
                subjectId: structure.subject.id
            });
            yield agent
                .delete(`/api/inscriptions/${inscription.id}/subjects/${structure.subject.id}`)
                .expect(200);
            const deleted = yield index_1.InscriptionSubject.findOne({
                where: { inscriptionId: inscription.id, subjectId: structure.subject.id }
            });
            expect(deleted).toBeNull();
        }));
    });
});
