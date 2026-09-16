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
describe('Council Endpoints — saveCouncilPoint & bulkSaveCouncilPoints', () => {
    let agent;
    let setup;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        agent = supertest_1.default.agent(app_1.default);
        // Create a Control de Estudios user (typical role that manages council points)
        const { person } = yield (0, testData_1.createTestUser)({ username: 'control' });
        const controlRole = yield (0, testData_1.createTestRole)('Control de Estudios');
        yield index_1.PersonRole.create({ personId: person.id, roleId: controlRole.id });
        yield agent
            .post('/api/auth/login')
            .send({ username: 'control', password: 'password123' });
        // Build full academic structure with an active period
        const structure = yield (0, testData_1.createAcademicStructure)({ period: { status: 'activo' } });
        const term = yield (0, testData_1.createTestTerm)(structure.period.id, { name: 'Primer Lapso', order: 1 });
        // Create a student person with Alumno role
        const { person: studentPerson } = yield (0, testData_1.createTestUser)({
            username: 'student1',
            firstName: 'Estudiante',
            lastName: 'Prueba',
        });
        const alumnoRole = yield (0, testData_1.createTestRole)('Alumno');
        yield index_1.PersonRole.create({ personId: studentPerson.id, roleId: alumnoRole.id });
        // Create inscription + inscriptionSubject
        const inscription = yield (0, testData_1.createTestInscription)(studentPerson.id, structure.period.id, structure.grade.id, structure.section.id);
        const insSub = yield index_1.InscriptionSubject.create({
            inscriptionId: inscription.id,
            subjectId: structure.subject.id,
            schoolPeriodId: structure.period.id,
            gradeId: structure.grade.id,
            sectionId: structure.section.id,
        });
        // Default council point limits (per-subject=2, total=2)
        yield (0, testData_1.createTestSetting)('council_points_limit', '2');
        yield (0, testData_1.createTestSetting)('council_points_per_subject_limit', '2');
        setup = {
            person,
            studentPerson,
            structure,
            term,
            inscription,
            insSub,
        };
    }));
    it('1. saveCouncilPoint crea puntos y sincroniza SubjectTermGrade', () => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield agent
            .post('/api/council/save')
            .send({
            inscriptionSubjectId: setup.insSub.id,
            termId: setup.term.id,
            points: 1,
        })
            .expect(200);
        expect(Number(response.body.points)).toBe(1);
        // CouncilPoint persisted
        const cp = yield index_1.CouncilPoint.findOne({
            where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
        });
        expect(cp).not.toBeNull();
        expect(Number(cp.points)).toBe(1);
        // SubjectTermGrade synced
        const stg = yield index_1.SubjectTermGrade.findOne({
            where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
        });
        expect(stg).not.toBeNull();
    }));
    it('2. saveCouncilPoint actualiza puntos existentes', () => __awaiter(void 0, void 0, void 0, function* () {
        // First save: points=1
        yield agent
            .post('/api/council/save')
            .send({
            inscriptionSubjectId: setup.insSub.id,
            termId: setup.term.id,
            points: 1,
        })
            .expect(200);
        // Second save: points=2
        const response = yield agent
            .post('/api/council/save')
            .send({
            inscriptionSubjectId: setup.insSub.id,
            termId: setup.term.id,
            points: 2,
        })
            .expect(200);
        expect(Number(response.body.points)).toBe(2);
        // Only one CouncilPoint row, updated
        const cps = yield index_1.CouncilPoint.findAll({
            where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
        });
        expect(cps.length).toBe(1);
        expect(Number(cps[0].points)).toBe(2);
    }));
    it('3. saveCouncilPoint rechaza lapso bloqueado', () => __awaiter(void 0, void 0, void 0, function* () {
        yield setup.term.update({ isBlocked: true });
        const response = yield agent
            .post('/api/council/save')
            .send({
            inscriptionSubjectId: setup.insSub.id,
            termId: setup.term.id,
            points: 1,
        })
            .expect(403);
        expect(response.body.message).toContain('cerrado');
        // No CouncilPoint should have been persisted
        const cp = yield index_1.CouncilPoint.findOne({
            where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
        });
        expect(cp).toBeNull();
    }));
    it('4. bulkSaveCouncilPoints guarda lote correctamente', () => __awaiter(void 0, void 0, void 0, function* () {
        // Create a second subject + inscriptionSubject for the same student
        const structure2 = yield (0, testData_1.createAcademicStructure)({ periodId: setup.structure.period.id });
        const insSub2 = yield index_1.InscriptionSubject.create({
            inscriptionId: setup.inscription.id,
            subjectId: structure2.subject.id,
            schoolPeriodId: setup.structure.period.id,
            gradeId: setup.structure.grade.id,
            sectionId: setup.structure.section.id,
        });
        const response = yield agent
            .post('/api/council/bulk-save')
            .send({
            updates: [
                { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id, points: 1 },
                { inscriptionSubjectId: insSub2.id, termId: setup.term.id, points: 1 },
            ],
        })
            .expect(200);
        expect(response.body.message).toBe('Puntos actualizados correctamente');
        // Both CouncilPoints persisted
        const cp1 = yield index_1.CouncilPoint.findOne({
            where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
        });
        const cp2 = yield index_1.CouncilPoint.findOne({
            where: { inscriptionSubjectId: insSub2.id, termId: setup.term.id },
        });
        expect(cp1).not.toBeNull();
        expect(Number(cp1.points)).toBe(1);
        expect(cp2).not.toBeNull();
        expect(Number(cp2.points)).toBe(1);
        // SubjectTermGrade synced for both
        const stg1 = yield index_1.SubjectTermGrade.findOne({
            where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
        });
        const stg2 = yield index_1.SubjectTermGrade.findOne({
            where: { inscriptionSubjectId: insSub2.id, termId: setup.term.id },
        });
        expect(stg1).not.toBeNull();
        expect(stg2).not.toBeNull();
    }));
    it('5. bulkSaveCouncilPoints rechaza exceso de puntos por materia', () => __awaiter(void 0, void 0, void 0, function* () {
        // per-subject limit is 2 (set in beforeEach); try 3
        const response = yield agent
            .post('/api/council/bulk-save')
            .send({
            updates: [
                { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id, points: 3 },
            ],
        })
            .expect(400);
        expect(response.body.message).toContain('límite de puntos por materia');
        // No CouncilPoint should have been persisted
        const cp = yield index_1.CouncilPoint.findOne({
            where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
        });
        expect(cp).toBeNull();
    }));
});
