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
const periodClosurePreview_1 = require("../../services/periodClosurePreview.js");
describe('Inscription Withdraw/Reactivate — withdrawnAt lifecycle', () => {
    let agent;
    let structure;
    let person;
    let inscription;
    let matriculation;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        agent = supertest_1.default.agent(app_1.default);
        const { person: admin } = yield (0, testData_1.createTestUser)({ username: 'admin' });
        const masterRole = yield (0, testData_1.createTestRole)('Master');
        yield index_1.PersonRole.create({ personId: admin.id, roleId: masterRole.id });
        yield agent
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'password123' });
        structure = yield (0, testData_1.createAcademicStructure)();
        const { person: p } = yield (0, testData_1.createTestUser)({ username: 'student', firstName: 'Test', lastName: 'Student' });
        const alumnoRole = yield (0, testData_1.createTestRole)('Alumno');
        yield index_1.PersonRole.create({ personId: p.id, roleId: alumnoRole.id });
        person = p;
        inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
        matriculation = yield index_1.Matriculation.create({
            schoolPeriodId: structure.period.id,
            gradeId: structure.grade.id,
            sectionId: structure.section.id,
            personId: person.id,
            inscriptionId: inscription.id,
            status: 'completed',
            escolaridad: 'regular',
            hiddenFromControlEstudios: false
        });
    }));
    it('T1: withdraw sets withdrawnAt to a non-null date', () => __awaiter(void 0, void 0, void 0, function* () {
        expect(inscription.withdrawnAt).toBeNull();
        const res = yield agent
            .post(`/api/inscriptions/${inscription.id}/withdraw`)
            .expect(200);
        expect(res.body.message).toContain('retirado');
        const refreshed = yield index_1.Inscription.findByPk(inscription.id);
        expect(refreshed.withdrawnAt).not.toBeNull();
        expect(refreshed.withdrawnAt).toBeInstanceOf(Date);
        const refreshedMat = yield index_1.Matriculation.findOne({ where: { inscriptionId: inscription.id } });
        expect(refreshedMat.status).toBe('withdrawn');
    }));
    it('T2: reactivate resets withdrawnAt to null', () => __awaiter(void 0, void 0, void 0, function* () {
        // First withdraw
        yield agent
            .post(`/api/inscriptions/${inscription.id}/withdraw`)
            .expect(200);
        const withdrawn = yield index_1.Inscription.findByPk(inscription.id);
        expect(withdrawn.withdrawnAt).not.toBeNull();
        // Now reactivate
        const res = yield agent
            .post(`/api/inscriptions/${inscription.id}/reactivate`)
            .send({ sectionId: structure.section.id })
            .expect(200);
        expect(res.body.message).toContain('reactivado');
        const refreshed = yield index_1.Inscription.findByPk(inscription.id);
        expect(refreshed.withdrawnAt).toBeNull();
        expect(refreshed.sectionId).toBe(structure.section.id);
        const refreshedMat = yield index_1.Matriculation.findOne({ where: { inscriptionId: inscription.id } });
        expect(refreshedMat.status).toBe('completed');
    }));
    it('T3: enrollMatriculatedStudent clears withdrawnAt when reusing an existing withdrawn inscription', () => __awaiter(void 0, void 0, void 0, function* () {
        // Mark the inscription as withdrawn directly
        yield inscription.update({ withdrawnAt: new Date() });
        yield matriculation.update({ status: 'withdrawn', sectionId: null });
        const withdrawn = yield index_1.Inscription.findByPk(inscription.id);
        expect(withdrawn.withdrawnAt).not.toBeNull();
        // Re-enroll the student via enrollMatriculatedStudent endpoint
        // This reuses the existing inscription and should clear withdrawnAt
        const res = yield agent
            .post(`/api/matriculations/${matriculation.id}/enroll`)
            .send({
            firstName: 'Test',
            lastName: 'Student',
            documentType: 'Venezolano',
            document: '12345678',
            gender: 'M',
            birthdate: '2000-01-01',
            birthState: 'GUÁRICO',
            birthMunicipality: 'JOSÉ TADEO MONAGAS',
            birthParish: 'Altagracia de Orituco',
            residenceState: 'Guárico',
            residenceMunicipality: 'José Tadeo Monagas',
            residenceParish: 'Altagracia de Orituco',
            mother: {
                firstName: 'Madre',
                lastName: 'Test',
                documentType: 'Venezolano',
                document: '99999999',
                phone: '0000000000',
                email: 'no@email.com',
                residenceState: 'GUÁRICO',
                residenceMunicipality: 'JOSÉ TADEO MONAGAS',
                residenceParish: 'ALTAGRACIA DE ORITUCO',
                address: 'N/A'
            },
            representativeType: 'mother',
            sectionId: structure.section.id,
            escolaridad: 'regular'
        });
        expect(res.status).toBe(200);
        const refreshed = yield index_1.Inscription.findByPk(inscription.id);
        expect(refreshed.withdrawnAt).toBeNull();
        expect(refreshed.sectionId).toBe(structure.section.id);
        const refreshedMat = yield index_1.Matriculation.findOne({ where: { inscriptionId: inscription.id } });
        expect(refreshedMat.status).toBe('completed');
    }));
    it('T4: after reactivate, the student appears in the period closure preview', () => __awaiter(void 0, void 0, void 0, function* () {
        // Withdraw
        yield agent
            .post(`/api/inscriptions/${inscription.id}/withdraw`)
            .expect(200);
        // Preview should NOT include the withdrawn student
        const previewBefore = yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(structure.period.id);
        const foundBefore = previewBefore.some(p => { var _a; return ((_a = p.inscription.student) === null || _a === void 0 ? void 0 : _a.id) === person.id; });
        expect(foundBefore).toBe(false);
        // Reactivate
        yield agent
            .post(`/api/inscriptions/${inscription.id}/reactivate`)
            .send({ sectionId: structure.section.id })
            .expect(200);
        // Preview should now include the reactivated student
        const previewAfter = yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(structure.period.id);
        const foundAfter = previewAfter.some(p => { var _a; return ((_a = p.inscription.student) === null || _a === void 0 ? void 0 : _a.id) === person.id; });
        expect(foundAfter).toBe(true);
    }));
});
