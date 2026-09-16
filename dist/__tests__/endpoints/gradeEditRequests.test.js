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
/* ------------------------------------------------------------------ */
/* Shared setup helpers                                                */
/* ------------------------------------------------------------------ */
function buildBaseSetup() {
    return __awaiter(this, void 0, void 0, function* () {
        const agent = supertest_1.default.agent(app_1.default);
        // Teacher user and login
        const { user, person } = yield (0, testData_1.createTestUser)({ username: 'teacher' });
        const teacherRole = yield (0, testData_1.createTestRole)('Profesor');
        yield index_1.PersonRole.create({ personId: person.id, roleId: teacherRole.id });
        yield agent.post('/api/auth/login').send({ username: 'teacher', password: 'password123' });
        // Academic structure + term
        const structure = yield (0, testData_1.createAcademicStructure)();
        const term = yield (0, testData_1.createTestTerm)(structure.period.id, { name: 'Primer Lapso', order: 1 });
        // Student with inscription + subject
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
        return { agent, user, person, structure, term, studentPerson, inscription, insSub, evalPlan };
    });
}
function createControlEstudiosAgent() {
    return __awaiter(this, void 0, void 0, function* () {
        const agent = supertest_1.default.agent(app_1.default);
        const { user, person } = yield (0, testData_1.createTestUser)({ username: 'control' });
        const role = yield (0, testData_1.createTestRole)('Control de Estudios');
        yield index_1.PersonRole.create({ personId: person.id, roleId: role.id });
        yield agent.post('/api/auth/login').send({ username: user.username, password: 'password123' });
        return { agent, user };
    });
}
function createQualification(evalPlanId_1, insSubId_1) {
    return __awaiter(this, arguments, void 0, function* (evalPlanId, insSubId, overrides = {}) {
        return yield index_1.Qualification.create(Object.assign({ evaluationPlanId: evalPlanId, inscriptionSubjectId: insSubId, score: 15, scoreSetAt: new Date() }, overrides));
    });
}
/* ------------------------------------------------------------------ */
/* POST /api/evaluation/grade-edit-request                             */
/* ------------------------------------------------------------------ */
describe('Grade Edit Requests — POST /grade-edit-request', () => {
    let setup;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        setup = yield buildBaseSetup();
    }));
    it('1. sin sesión activa responde 401', () => __awaiter(void 0, void 0, void 0, function* () {
        const q = yield createQualification(setup.evalPlan.id, setup.insSub.id);
        const unauthAgent = supertest_1.default.agent(app_1.default);
        yield unauthAgent
            .post('/api/evaluation/grade-edit-request')
            .send({ qualificationId: q.id, justification: 'prueba' })
            .expect(401);
    }));
    it('2. rechaza sin justificación (400)', () => __awaiter(void 0, void 0, void 0, function* () {
        const q = yield createQualification(setup.evalPlan.id, setup.insSub.id);
        const response = yield setup.agent
            .post('/api/evaluation/grade-edit-request')
            .send({ qualificationId: q.id, justification: '   ' })
            .expect(400);
        expect(response.body.message).toContain('justificación');
    }));
    it('3. rechaza qualificationId inexistente (404)', () => __awaiter(void 0, void 0, void 0, function* () {
        yield setup.agent
            .post('/api/evaluation/grade-edit-request')
            .send({ qualificationId: 99999, justification: 'prueba' })
            .expect(404);
    }));
    it('4. rechaza solicitud duplicada pendiente (409)', () => __awaiter(void 0, void 0, void 0, function* () {
        const q = yield createQualification(setup.evalPlan.id, setup.insSub.id);
        yield setup.agent
            .post('/api/evaluation/grade-edit-request')
            .send({ qualificationId: q.id, justification: 'primera', requestedScore: 18 })
            .expect(201);
        const response = yield setup.agent
            .post('/api/evaluation/grade-edit-request')
            .send({ qualificationId: q.id, justification: 'segunda', requestedScore: 19 })
            .expect(409);
        expect(response.body.message).toContain('pendiente');
    }));
    it('5. crea la solicitud con currentScore y requestedScore (201)', () => __awaiter(void 0, void 0, void 0, function* () {
        const q = yield createQualification(setup.evalPlan.id, setup.insSub.id);
        const response = yield setup.agent
            .post('/api/evaluation/grade-edit-request')
            .send({
            qualificationId: q.id,
            justification: 'El alumno justificó su inasistencia',
            currentScore: 15,
            requestedScore: 18,
        })
            .expect(201);
        expect(response.body.status).toBe('pending');
        expect(Number(response.body.currentScore)).toBe(15);
        expect(Number(response.body.requestedScore)).toBe(18);
        expect(response.body.qualificationId).toBe(q.id);
        const persisted = yield index_1.QualificationEditRequest.findByPk(response.body.id);
        expect(persisted).not.toBeNull();
        expect(persisted.justification).toBe('El alumno justificó su inasistencia');
    }));
});
/* ------------------------------------------------------------------ */
/* GET pending + count                                                 */
/* ------------------------------------------------------------------ */
describe('Grade Edit Requests — GET pending + count', () => {
    let setup;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        setup = yield buildBaseSetup();
    }));
    it('1. count refleja solo las solicitudes pendientes', () => __awaiter(void 0, void 0, void 0, function* () {
        const before = yield setup.agent.get('/api/evaluation/grade-edit-requests/pending/count');
        expect(before.body.count).toBe(0);
        const q = yield createQualification(setup.evalPlan.id, setup.insSub.id);
        yield setup.agent
            .post('/api/evaluation/grade-edit-request')
            .send({ qualificationId: q.id, justification: 'prueba', requestedScore: 18 })
            .expect(201);
        const after = yield setup.agent.get('/api/evaluation/grade-edit-requests/pending/count');
        expect(after.body.count).toBe(1);
    }));
    it('2. el listado incluye estudiante, materia, plan y solicitante', () => __awaiter(void 0, void 0, void 0, function* () {
        const q = yield createQualification(setup.evalPlan.id, setup.insSub.id);
        yield setup.agent
            .post('/api/evaluation/grade-edit-request')
            .send({ qualificationId: q.id, justification: 'prueba', requestedScore: 18 })
            .expect(201);
        const response = yield setup.agent.get('/api/evaluation/grade-edit-requests/pending').expect(200);
        expect(response.body.length).toBe(1);
        const req = response.body[0];
        expect(req.status).toBe('pending');
        expect(req.qualification.id).toBe(q.id);
        expect(req.qualification.evaluationPlan.description).toBe('Examen parcial');
        expect(req.qualification.inscriptionSubject.subject.name).toBeTruthy();
        expect(req.qualification.inscriptionSubject.inscription.student.firstName.toLowerCase()).toBe('estudiante');
        expect(req.requester.username).toBe('teacher');
    }));
    it('3. las solicitudes revisadas no aparecen en pendientes', () => __awaiter(void 0, void 0, void 0, function* () {
        const q = yield createQualification(setup.evalPlan.id, setup.insSub.id);
        const created = yield setup.agent
            .post('/api/evaluation/grade-edit-request')
            .send({ qualificationId: q.id, justification: 'prueba', requestedScore: 18 });
        const requestId = created.body.id;
        const { agent: controlAgent } = yield createControlEstudiosAgent();
        yield controlAgent
            .put(`/api/evaluation/grade-edit-request/${requestId}/review`)
            .send({ action: 'reject' })
            .expect(200);
        const pending = yield setup.agent.get('/api/evaluation/grade-edit-requests/pending');
        expect(pending.body.length).toBe(0);
        const count = yield setup.agent.get('/api/evaluation/grade-edit-requests/pending/count');
        expect(count.body.count).toBe(0);
    }));
});
/* ------------------------------------------------------------------ */
/* PUT /api/evaluation/grade-edit-request/:id/review                   */
/* ------------------------------------------------------------------ */
describe('Grade Edit Requests — PUT review', () => {
    let setup;
    let controlAgent;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        setup = yield buildBaseSetup();
        controlAgent = (yield createControlEstudiosAgent()).agent;
    }));
    function createPendingRequest() {
        return __awaiter(this, arguments, void 0, function* (qualOverrides = {}, reqOverrides = {}) {
            const q = yield createQualification(setup.evalPlan.id, setup.insSub.id, qualOverrides);
            const res = yield setup.agent
                .post('/api/evaluation/grade-edit-request')
                .send(Object.assign({ qualificationId: q.id, justification: 'La nota debe corregirse', currentScore: 15, requestedScore: 18 }, reqOverrides))
                .expect(201);
            return { q, request: res.body };
        });
    }
    it('1. rechaza a un usuario sin rol autorizado (403)', () => __awaiter(void 0, void 0, void 0, function* () {
        const { request } = yield createPendingRequest();
        yield setup.agent
            .put(`/api/evaluation/grade-edit-request/${request.id}/review`)
            .send({ action: 'approve' })
            .expect(403);
    }));
    it('2. rechaza una acción inválida (400)', () => __awaiter(void 0, void 0, void 0, function* () {
        const { request } = yield createPendingRequest();
        yield controlAgent
            .put(`/api/evaluation/grade-edit-request/${request.id}/review`)
            .send({ action: 'postpone' })
            .expect(400);
    }));
    it('3. rechaza revisar una solicitud ya revisada (400)', () => __awaiter(void 0, void 0, void 0, function* () {
        const { request } = yield createPendingRequest();
        yield controlAgent
            .put(`/api/evaluation/grade-edit-request/${request.id}/review`)
            .send({ action: 'approve' })
            .expect(200);
        yield controlAgent
            .put(`/api/evaluation/grade-edit-request/${request.id}/review`)
            .send({ action: 'reject' })
            .expect(400);
    }));
    it('4. al aprobar aplica la nota solicitada sin resetear el timer y audita', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const { q, request } = yield createPendingRequest();
        const before = yield index_1.Qualification.findByPk(q.id);
        const originalTimer = new Date(before.scoreSetAt).getTime();
        // Delay so a timer reset would be detectable
        yield new Promise((r) => setTimeout(r, 50));
        yield controlAgent
            .put(`/api/evaluation/grade-edit-request/${request.id}/review`)
            .send({ action: 'approve', reviewNote: 'Verificado con el profesor' })
            .expect(200);
        const after = yield index_1.Qualification.findByPk(q.id);
        expect(Number(after.score)).toBe(18);
        expect(after.isAbsent).toBe(false);
        // Timer must NOT be reset by the approval
        expect(new Date(after.scoreSetAt).getTime()).toBe(originalTimer);
        const audits = yield index_1.GradeChangeLog.findAll({
            where: { entityType: 'qualification', entityId: q.id },
        });
        expect(audits.length).toBeGreaterThanOrEqual(1);
        const lastAudit = audits[audits.length - 1];
        expect(lastAudit.reason).toBe('Cambio solicitado por el profesor: La nota debe corregirse');
        expect(lastAudit.metadata).toBeTruthy();
        expect((_a = lastAudit.metadata) === null || _a === void 0 ? void 0 : _a.editRequestId).toBe(request.id);
        expect((_b = lastAudit.metadata) === null || _b === void 0 ? void 0 : _b.reviewNote).toBe('Verificado con el profesor');
    }));
    it('5. al aprobar un NP con el mismo valor numérico aplica y audita previousStatus NP', () => __awaiter(void 0, void 0, void 0, function* () {
        const { q, request } = yield createPendingRequest({ score: 20, isAbsent: true }, { currentScore: null, requestedScore: 20 });
        yield controlAgent
            .put(`/api/evaluation/grade-edit-request/${request.id}/review`)
            .send({ action: 'approve' })
            .expect(200);
        const after = yield index_1.Qualification.findByPk(q.id);
        expect(after.isAbsent).toBe(false);
        expect(Number(after.score)).toBe(20);
        const audits = yield index_1.GradeChangeLog.findAll({
            where: { entityType: 'qualification', entityId: q.id },
        });
        expect(audits.length).toBeGreaterThanOrEqual(1);
        const lastAudit = audits[audits.length - 1];
        expect(lastAudit.previousStatus).toBe('NP');
        expect(lastAudit.previousScore).toBeNull();
        expect(Number(lastAudit.newScore)).toBe(20);
    }));
    it('6. al rechazar no cambia la nota ni audita, y persiste reviewNote', () => __awaiter(void 0, void 0, void 0, function* () {
        const { q, request } = yield createPendingRequest();
        yield controlAgent
            .put(`/api/evaluation/grade-edit-request/${request.id}/review`)
            .send({ action: 'reject', reviewNote: 'Sin evidencia suficiente' })
            .expect(200);
        const after = yield index_1.Qualification.findByPk(q.id);
        expect(Number(after.score)).toBe(15);
        const audits = yield index_1.GradeChangeLog.findAll({
            where: { entityType: 'qualification', entityId: q.id },
        });
        expect(audits.length).toBe(0);
        const reviewed = yield index_1.QualificationEditRequest.findByPk(request.id);
        expect(reviewed.status).toBe('rejected');
        expect(reviewed.reviewNote).toBe('Sin evidencia suficiente');
        expect(reviewed.reviewedBy).not.toBeNull();
    }));
});
/* ------------------------------------------------------------------ */
/* POST /api/evaluation/reset-timer                                    */
/* ------------------------------------------------------------------ */
describe('POST /api/evaluation/reset-timer', () => {
    let setup;
    let controlAgent;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        setup = yield buildBaseSetup();
        controlAgent = (yield createControlEstudiosAgent()).agent;
    }));
    it('1. rechaza a un usuario sin rol autorizado (403)', () => __awaiter(void 0, void 0, void 0, function* () {
        const q = yield createQualification(setup.evalPlan.id, setup.insSub.id);
        yield setup.agent.post('/api/evaluation/reset-timer').send({ qualificationIds: [q.id] }).expect(403);
    }));
    it('2. rechaza sin qualificationIds (400)', () => __awaiter(void 0, void 0, void 0, function* () {
        yield controlAgent.post('/api/evaluation/reset-timer').send({}).expect(400);
        yield controlAgent.post('/api/evaluation/reset-timer').send({ qualificationIds: [] }).expect(400);
    }));
    it("3. por defecto resetea ambos timers", () => __awaiter(void 0, void 0, void 0, function* () {
        const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const q = yield createQualification(setup.evalPlan.id, setup.insSub.id, {
            scoreSetAt: oldDate,
            remedialScoreSetAt: oldDate,
        });
        yield controlAgent
            .post('/api/evaluation/reset-timer')
            .send({ qualificationIds: [q.id] })
            .expect(200);
        const after = yield index_1.Qualification.findByPk(q.id);
        expect(new Date(after.scoreSetAt).getTime()).toBeGreaterThan(Date.now() - 60000);
        expect(new Date(after.remedialScoreSetAt).getTime()).toBeGreaterThan(Date.now() - 60000);
    }));
    it("4. field='score' resetea solo el timer regular", () => __awaiter(void 0, void 0, void 0, function* () {
        const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const q = yield createQualification(setup.evalPlan.id, setup.insSub.id, {
            scoreSetAt: oldDate,
            remedialScoreSetAt: oldDate,
        });
        yield controlAgent
            .post('/api/evaluation/reset-timer')
            .send({ qualificationIds: [q.id], field: 'score' })
            .expect(200);
        const after = yield index_1.Qualification.findByPk(q.id);
        expect(new Date(after.scoreSetAt).getTime()).toBeGreaterThan(Date.now() - 60000);
        expect(new Date(after.remedialScoreSetAt).getTime()).toBe(oldDate.getTime());
    }));
    it("5. field='remedial' resetea solo el timer remedial", () => __awaiter(void 0, void 0, void 0, function* () {
        const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const q = yield createQualification(setup.evalPlan.id, setup.insSub.id, {
            scoreSetAt: oldDate,
            remedialScoreSetAt: oldDate,
        });
        yield controlAgent
            .post('/api/evaluation/reset-timer')
            .send({ qualificationIds: [q.id], field: 'remedial' })
            .expect(200);
        const after = yield index_1.Qualification.findByPk(q.id);
        expect(new Date(after.scoreSetAt).getTime()).toBe(oldDate.getTime());
        expect(new Date(after.remedialScoreSetAt).getTime()).toBeGreaterThan(Date.now() - 60000);
    }));
});
/* ------------------------------------------------------------------ */
/* GET /api/evaluation/students/:assignmentId — timer lock flags       */
/* ------------------------------------------------------------------ */
describe('GET /api/evaluation/students/:assignmentId — timer lock flags', () => {
    let setup;
    let assignment;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        setup = yield buildBaseSetup();
        assignment = yield index_1.TeacherAssignment.create({
            teacherId: setup.person.id,
            periodGradeSubjectId: setup.structure.periodGradeSubject.id,
            sectionId: setup.structure.section.id,
        });
    }));
    function fetchStudents() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield setup.agent
                .get(`/api/evaluation/students/${assignment.id}`)
                .query({ termId: setup.term.id })
                .expect(200);
            return response.body;
        });
    }
    it('1. marca isLockedByTimer cuando el timer venció', () => __awaiter(void 0, void 0, void 0, function* () {
        yield createQualification(setup.evalPlan.id, setup.insSub.id, {
            termId: setup.term.id,
            scoreSetAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h ago, grace default 24h
        });
        const students = yield fetchStudents();
        const quals = students[0].inscriptionSubjects[0].qualifications;
        expect(quals.length).toBe(1);
        expect(quals[0].isLockedByTimer).toBe(true);
        expect(quals[0].isRemedialLockedByTimer).toBe(false);
    }));
    it('2. no bloquea cuando el timer está dentro de la ventana de gracia', () => __awaiter(void 0, void 0, void 0, function* () {
        yield createQualification(setup.evalPlan.id, setup.insSub.id, {
            termId: setup.term.id,
            scoreSetAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
        });
        const students = yield fetchStudents();
        const quals = students[0].inscriptionSubjects[0].qualifications;
        expect(quals[0].isLockedByTimer).toBe(false);
    }));
    it('3. no bloquea cuando no hay timer', () => __awaiter(void 0, void 0, void 0, function* () {
        yield createQualification(setup.evalPlan.id, setup.insSub.id, { termId: setup.term.id, scoreSetAt: null });
        const students = yield fetchStudents();
        const quals = students[0].inscriptionSubjects[0].qualifications;
        expect(quals[0].isLockedByTimer).toBe(false);
    }));
    it('4. respeta el setting grade_edit_grace_hours', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, testData_1.createTestSetting)('grade_edit_grace_hours', '1');
        yield createQualification(setup.evalPlan.id, setup.insSub.id, {
            termId: setup.term.id,
            scoreSetAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago > 1h grace
        });
        const students = yield fetchStudents();
        const quals = students[0].inscriptionSubjects[0].qualifications;
        expect(quals[0].isLockedByTimer).toBe(true);
    }));
    it('5. el timer remedial es independiente del regular', () => __awaiter(void 0, void 0, void 0, function* () {
        yield createQualification(setup.evalPlan.id, setup.insSub.id, {
            termId: setup.term.id,
            score: 5,
            scoreSetAt: new Date(Date.now() - 60 * 60 * 1000), // recent
            remedialScoreSetAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // expired
        });
        const students = yield fetchStudents();
        const quals = students[0].inscriptionSubjects[0].qualifications;
        expect(quals[0].isLockedByTimer).toBe(false);
        expect(quals[0].isRemedialLockedByTimer).toBe(true);
    }));
});
