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
describe('Evaluation Endpoints — saveQualification', () => {
    let agent;
    let setup;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        agent = supertest_1.default.agent(app_1.default);
        // Create a teacher user and log in
        const { user, person } = yield (0, testData_1.createTestUser)({ username: 'teacher' });
        const teacherRole = yield (0, testData_1.createTestRole)('Profesor');
        yield index_1.PersonRole.create({ personId: person.id, roleId: teacherRole.id });
        yield agent
            .post('/api/auth/login')
            .send({ username: 'teacher', password: 'password123' });
        // Build full academic structure
        const structure = yield (0, testData_1.createAcademicStructure)();
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
        // Create an evaluation plan
        const evalPlan = yield index_1.EvaluationPlan.create({
            periodGradeSubjectId: structure.periodGradeSubject.id,
            sectionId: structure.section.id,
            termId: term.id,
            description: 'Examen parcial',
            percentage: 25,
            date: new Date('2025-09-15'),
        });
        setup = {
            user,
            person,
            studentPerson,
            structure,
            term,
            inscription,
            insSub,
            evalPlan,
        };
    }));
    it('1. crea una nota nueva y sincroniza SubjectTermGrade', () => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield agent
            .post('/api/evaluation/qualifications')
            .send({
            evaluationPlanId: setup.evalPlan.id,
            inscriptionSubjectId: setup.insSub.id,
            score: 15,
        })
            .expect(200);
        expect(Number(response.body.score)).toBe(15);
        // Qualification persisted
        const q = yield index_1.Qualification.findOne({
            where: { evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id },
        });
        expect(q).not.toBeNull();
        expect(Number(q.score)).toBe(15);
        // SubjectTermGrade synced
        const stg = yield index_1.SubjectTermGrade.findOne({
            where: { inscriptionSubjectId: setup.insSub.id, termId: setup.term.id },
        });
        expect(stg).not.toBeNull();
    }));
    it('2. actualiza una nota existente y registra auditoría', () => __awaiter(void 0, void 0, void 0, function* () {
        // First save: score=15
        yield agent
            .post('/api/evaluation/qualifications')
            .send({
            evaluationPlanId: setup.evalPlan.id,
            inscriptionSubjectId: setup.insSub.id,
            score: 15,
        })
            .expect(200);
        // Second save: score=18 (should update + audit)
        const response = yield agent
            .post('/api/evaluation/qualifications')
            .send({
            evaluationPlanId: setup.evalPlan.id,
            inscriptionSubjectId: setup.insSub.id,
            score: 18,
            comment: 'Corrección de nota',
        })
            .expect(200);
        expect(Number(response.body.score)).toBe(18);
        // Qualification updated
        const q = yield index_1.Qualification.findOne({
            where: { evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id },
        });
        expect(Number(q.score)).toBe(18);
        // Audit record created with previousScore=15, newScore=18
        const audits = yield index_1.GradeChangeLog.findAll({
            where: { entityType: 'qualification', entityId: q.id },
        });
        expect(audits.length).toBeGreaterThanOrEqual(1);
        const lastAudit = audits[audits.length - 1];
        expect(Number(lastAudit.previousScore)).toBe(15);
        expect(Number(lastAudit.newScore)).toBe(18);
        expect(lastAudit.reason).toBe('Corrección de nota');
    }));
    it('3. rechaza guardar cuando el lapso está bloqueado', () => __awaiter(void 0, void 0, void 0, function* () {
        // Block the term
        yield setup.term.update({ isBlocked: true });
        const response = yield agent
            .post('/api/evaluation/qualifications')
            .send({
            evaluationPlanId: setup.evalPlan.id,
            inscriptionSubjectId: setup.insSub.id,
            score: 10,
        })
            .expect(403);
        expect(response.body.message).toContain('bloqueado o el consejo de curso está completado');
        // No qualification should have been persisted
        const q = yield index_1.Qualification.findOne({
            where: { evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id },
        });
        expect(q).toBeNull();
    }));
    it('4. guarda nota con isAbsent=true', () => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield agent
            .post('/api/evaluation/qualifications')
            .send({
            evaluationPlanId: setup.evalPlan.id,
            inscriptionSubjectId: setup.insSub.id,
            score: 0,
            isAbsent: true,
        })
            .expect(200);
        expect(response.body.isAbsent).toBe(true);
        const q = yield index_1.Qualification.findOne({
            where: { evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id },
        });
        expect(q).not.toBeNull();
        expect(q.isAbsent).toBe(true);
    }));
    it('5. sin sesión activa no registra auditoría al guardar', () => __awaiter(void 0, void 0, void 0, function* () {
        // Use a fresh agent without login.
        // The system has no global auth middleware yet (see AGENTS.md), so the
        // endpoint still processes the request, but without a session user the
        // audit record is skipped. We verify that no audit is created.
        const unauthAgent = supertest_1.default.agent(app_1.default);
        const response = yield unauthAgent
            .post('/api/evaluation/qualifications')
            .send({
            evaluationPlanId: setup.evalPlan.id,
            inscriptionSubjectId: setup.insSub.id,
            score: 12,
        });
        // The endpoint processes the request (200) because there is no global
        // auth middleware. The key assertion is that no audit row is created.
        expect(response.status).toBe(200);
        const q = yield index_1.Qualification.findOne({
            where: { evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id },
        });
        expect(q).not.toBeNull();
        const audits = yield index_1.GradeChangeLog.findAll({
            where: { entityType: 'qualification', entityId: q.id },
        });
        expect(audits.length).toBe(0);
    }));
});
describe('Evaluation Endpoints — timer semantics (saveQualification)', () => {
    let agent;
    let setup;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        agent = supertest_1.default.agent(app_1.default);
        const { user, person } = yield (0, testData_1.createTestUser)({ username: 'teacher' });
        const teacherRole = yield (0, testData_1.createTestRole)('Profesor');
        yield index_1.PersonRole.create({ personId: person.id, roleId: teacherRole.id });
        yield agent
            .post('/api/auth/login')
            .send({ username: 'teacher', password: 'password123' });
        const structure = yield (0, testData_1.createAcademicStructure)();
        const term = yield (0, testData_1.createTestTerm)(structure.period.id, { name: 'Primer Lapso', order: 1 });
        const { person: studentPerson } = yield (0, testData_1.createTestUser)({
            username: 'student1',
            firstName: 'Estudiante',
            lastName: 'Prueba',
        });
        const alumnoRole = yield (0, testData_1.createTestRole)('Alumno');
        yield index_1.PersonRole.create({ personId: studentPerson.id, roleId: alumnoRole.id });
        const inscription = yield (0, testData_1.createTestInscription)(studentPerson.id, structure.period.id, structure.grade.id, structure.section.id);
        const insSub = yield index_1.InscriptionSubject.create({
            inscriptionId: inscription.id,
            subjectId: structure.subject.id,
            schoolPeriodId: structure.period.id,
            gradeId: structure.grade.id,
            sectionId: structure.section.id,
        });
        const evalPlan = yield index_1.EvaluationPlan.create({
            periodGradeSubjectId: structure.periodGradeSubject.id,
            sectionId: structure.section.id,
            termId: term.id,
            description: 'Examen parcial',
            percentage: 25,
            date: new Date('2025-09-15'),
        });
        setup = { user, person, studentPerson, structure, term, inscription, insSub, evalPlan };
    }));
    const getQualification = () => __awaiter(void 0, void 0, void 0, function* () {
        return index_1.Qualification.findOne({
            where: { evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id },
        });
    });
    it('1. la primera nota fija scoreSetAt', () => __awaiter(void 0, void 0, void 0, function* () {
        yield agent
            .post('/api/evaluation/qualifications')
            .send({
            evaluationPlanId: setup.evalPlan.id,
            inscriptionSubjectId: setup.insSub.id,
            score: 15,
        })
            .expect(200);
        const q = yield getQualification();
        expect(q).not.toBeNull();
        expect(q.scoreSetAt).not.toBeNull();
    }));
    it('2. editar la nota NO resetea el timer', () => __awaiter(void 0, void 0, void 0, function* () {
        yield agent
            .post('/api/evaluation/qualifications')
            .send({ evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id, score: 15 })
            .expect(200);
        const first = yield getQualification();
        const firstTimer = new Date(first.scoreSetAt).getTime();
        // Small delay so a reset would produce a different timestamp
        yield new Promise((r) => setTimeout(r, 50));
        yield agent
            .post('/api/evaluation/qualifications')
            .send({
            evaluationPlanId: setup.evalPlan.id,
            inscriptionSubjectId: setup.insSub.id,
            score: 18,
            comment: 'Corrección',
        })
            .expect(200);
        const second = yield getQualification();
        expect(Number(second.score)).toBe(18);
        expect(new Date(second.scoreSetAt).getTime()).toBe(firstTimer);
    }));
    it('3. el timer remedial es independiente del regular', () => __awaiter(void 0, void 0, void 0, function* () {
        yield agent
            .post('/api/evaluation/qualifications')
            .send({ evaluationPlanId: setup.evalPlan.id, inscriptionSubjectId: setup.insSub.id, score: 5 })
            .expect(200);
        const first = yield getQualification();
        const scoreSetAt = new Date(first.scoreSetAt).getTime();
        expect(first.remedialScoreSetAt).toBeNull();
        yield new Promise((r) => setTimeout(r, 50));
        yield agent
            .post('/api/evaluation/qualifications')
            .send({
            evaluationPlanId: setup.evalPlan.id,
            inscriptionSubjectId: setup.insSub.id,
            score: 5,
            remedialScore: 8,
        })
            .expect(200);
        const second = yield getQualification();
        // Regular timer untouched; remedial timer started independently
        expect(new Date(second.scoreSetAt).getTime()).toBe(scoreSetAt);
        expect(second.remedialScoreSetAt).not.toBeNull();
    }));
    it('4. NP → mismo valor numérico registra auditoría con previousStatus NP', () => __awaiter(void 0, void 0, void 0, function* () {
        // First save: absent with score 20 in DB
        yield agent
            .post('/api/evaluation/qualifications')
            .send({
            evaluationPlanId: setup.evalPlan.id,
            inscriptionSubjectId: setup.insSub.id,
            score: 20,
            isAbsent: true,
        })
            .expect(200);
        // Second save: same numeric score but isAbsent=false (NP removal)
        yield agent
            .post('/api/evaluation/qualifications')
            .send({
            evaluationPlanId: setup.evalPlan.id,
            inscriptionSubjectId: setup.insSub.id,
            score: 20,
            isAbsent: false,
            comment: 'El estudiante presentó la evaluación',
        })
            .expect(200);
        const q = yield getQualification();
        expect(q.isAbsent).toBe(false);
        expect(Number(q.score)).toBe(20);
        const audits = yield index_1.GradeChangeLog.findAll({
            where: { entityType: 'qualification', entityId: q.id },
        });
        expect(audits.length).toBeGreaterThanOrEqual(1);
        const lastAudit = audits[audits.length - 1];
        expect(lastAudit.previousStatus).toBe('NP');
        expect(lastAudit.previousScore).toBeNull();
        expect(Number(lastAudit.newScore)).toBe(20);
    }));
});
