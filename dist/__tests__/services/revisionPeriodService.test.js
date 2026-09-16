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
const revisionPeriodService_1 = require("../../services/revisionPeriodService.js");
const index_1 = require("../../models/index.js");
const testData_1 = require("../helpers/testData");
const setupPeriodForRevision = (username) => __awaiter(void 0, void 0, void 0, function* () {
    const structure = yield (0, testData_1.createAcademicStructure)();
    const term1 = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 1, isBlocked: true });
    const term2 = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 2, isBlocked: true });
    // Close all sections for both terms
    yield index_1.TermSectionClosure.create({
        termId: term1.id, sectionId: structure.section.id, gradeId: structure.grade.id, closedAt: new Date(),
    });
    yield index_1.TermSectionClosure.create({
        termId: term2.id, sectionId: structure.section.id, gradeId: structure.grade.id, closedAt: new Date(),
    });
    // Mark council checklist as done
    yield index_1.CouncilChecklist.create({
        schoolPeriodId: structure.period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
        termId: term1.id, status: 'done',
    });
    yield index_1.CouncilChecklist.create({
        schoolPeriodId: structure.period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
        termId: term2.id, status: 'done',
    });
    // Make the period active
    yield structure.period.update({ status: 'activo' });
    const { person } = yield (0, testData_1.createTestUser)({ username });
    const inscription = yield (0, testData_1.createTestInscription)(person.id, structure.period.id, structure.grade.id, structure.section.id);
    const insSub = yield index_1.InscriptionSubject.create({
        inscriptionId: inscription.id,
        subjectId: structure.subject.id,
        schoolPeriodId: structure.period.id,
        gradeId: structure.grade.id,
        sectionId: structure.section.id,
    });
    return { structure, term1, term2, person, inscription, insSub };
});
describe('RevisionPeriodService', () => {
    describe('getOrCreate', () => {
        it('crea un RevisionPeriod si no existe', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const rp = yield revisionPeriodService_1.RevisionPeriodService.getOrCreate(structure.period.id);
            expect(rp).toBeDefined();
            expect(rp.schoolPeriodId).toBe(structure.period.id);
            expect(rp.status).toBe('pending');
        }));
        it('retorna existente si ya existe', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const rp1 = yield revisionPeriodService_1.RevisionPeriodService.getOrCreate(structure.period.id);
            const rp2 = yield revisionPeriodService_1.RevisionPeriodService.getOrCreate(structure.period.id);
            expect(rp1.id).toBe(rp2.id);
        }));
    });
    describe('getSummary', () => {
        it('retorna summary con councilStatus y termsStatus', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term1 = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 1, isBlocked: true });
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: structure.period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
                termId: term1.id, status: 'done',
            });
            const summary = yield revisionPeriodService_1.RevisionPeriodService.getSummary(structure.period.id);
            expect(summary.councilStatus.totalChecklists).toBe(1);
            expect(summary.councilStatus.doneChecklists).toBe(1);
            expect(summary.councilStatus.allDone).toBe(true);
            expect(summary.termsStatus.totalTerms).toBe(1);
            expect(summary.termsStatus.blockedTerms).toBe(1);
        }));
        it('allDone=false cuando no todos los checklists están done', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term1 = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 1 });
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: structure.period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
                termId: term1.id, status: 'open',
            });
            const summary = yield revisionPeriodService_1.RevisionPeriodService.getSummary(structure.period.id);
            expect(summary.councilStatus.allDone).toBe(false);
        }));
    });
    describe('openRevisionPeriod', () => {
        it('abre el período de revisión y crea revisions para materias reprobadas', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, term1, term2, inscription, insSub } = yield setupPeriodForRevision('rev1');
            yield (0, testData_1.createTestSetting)('passing_grade', '10');
            // Create failing term grades
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term1.id, score: 5 });
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term2.id, score: 5 });
            const result = yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            expect(result.revisionPeriod.status).toBe('open');
            expect(result.revisionsCreated).toBe(1);
            const revisions = yield index_1.InscriptionSubjectRevision.count({
                where: { revisionPeriodId: result.revisionPeriod.id },
            });
            expect(revisions).toBe(1);
        }));
        it('rechaza si el período no está activo', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            yield structure.period.update({ status: 'historico' });
            yield expect(revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id))
                .rejects.toThrow('no está activo');
        }));
        it('rechaza si no todos los lapsos están cerrados', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            yield (0, testData_1.createTestTerm)(structure.period.id, { order: 1, isBlocked: false });
            yield structure.period.update({ status: 'activo' });
            yield expect(revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id))
                .rejects.toThrow('Todos los lapsos deben tener todas sus secciones cerradas');
        }));
        it('rechaza si no hay consejos de curso', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            yield (0, testData_1.createTestTerm)(structure.period.id, { order: 1, isBlocked: true });
            yield structure.period.update({ status: 'activo' });
            yield expect(revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id))
                .rejects.toThrow('No hay consejos de curso registrados');
        }));
        it('rechaza si ya está abierto', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure } = yield setupPeriodForRevision('rev2');
            yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            yield expect(revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id))
                .rejects.toThrow('ya está abierto');
        }));
    });
    describe('lockRevisionPeriod', () => {
        it('cierra el período de revisión', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure } = yield setupPeriodForRevision('rev3');
            yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            const rp = yield revisionPeriodService_1.RevisionPeriodService.lockRevisionPeriod(structure.period.id);
            expect(rp.status).toBe('closed');
        }));
        it('es idempotente si ya está closed', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure } = yield setupPeriodForRevision('rev4');
            yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            yield revisionPeriodService_1.RevisionPeriodService.lockRevisionPeriod(structure.period.id);
            const rp = yield revisionPeriodService_1.RevisionPeriodService.lockRevisionPeriod(structure.period.id);
            expect(rp.status).toBe('closed');
        }));
        it('rechaza si está pending', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            yield index_1.RevisionPeriod.create({ schoolPeriodId: structure.period.id });
            yield expect(revisionPeriodService_1.RevisionPeriodService.lockRevisionPeriod(structure.period.id))
                .rejects.toThrow('no ha sido abierto');
        }));
    });
    describe('reopenRevisionPeriod', () => {
        it('reabre el período cerrado', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure } = yield setupPeriodForRevision('rev5');
            yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            yield revisionPeriodService_1.RevisionPeriodService.lockRevisionPeriod(structure.period.id);
            const rp = yield revisionPeriodService_1.RevisionPeriodService.reopenRevisionPeriod(structure.period.id);
            expect(rp.status).toBe('open');
        }));
        it('es idempotente si ya está open', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure } = yield setupPeriodForRevision('rev6');
            yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            const rp = yield revisionPeriodService_1.RevisionPeriodService.reopenRevisionPeriod(structure.period.id);
            expect(rp.status).toBe('open');
        }));
        it('rechaza si está pending', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            yield index_1.RevisionPeriod.create({ schoolPeriodId: structure.period.id });
            yield expect(revisionPeriodService_1.RevisionPeriodService.reopenRevisionPeriod(structure.period.id))
                .rejects.toThrow('no ha sido abierto');
        }));
    });
    describe('updateMaxOpportunities', () => {
        it('actualiza el maxOpportunities', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure } = yield setupPeriodForRevision('rev7');
            yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            const rp = yield revisionPeriodService_1.RevisionPeriodService.updateMaxOpportunities(structure.period.id, 5);
            expect(rp.maxOpportunities).toBe(5);
        }));
        it('rechaza valores no enteros', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure } = yield setupPeriodForRevision('rev8');
            yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            yield expect(revisionPeriodService_1.RevisionPeriodService.updateMaxOpportunities(structure.period.id, 2.5))
                .rejects.toThrow('entero mayor o igual a 1');
        }));
        it('rechaza valores < 1', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure } = yield setupPeriodForRevision('rev9');
            yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            yield expect(revisionPeriodService_1.RevisionPeriodService.updateMaxOpportunities(structure.period.id, 0))
                .rejects.toThrow('entero mayor o igual a 1');
        }));
        it('elimina revisions con opportunity > nuevo max', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, insSub } = yield setupPeriodForRevision('rev10');
            yield (0, testData_1.createTestSetting)('passing_grade', '10');
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (yield index_1.Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 1 } })).id, score: 5 });
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (yield index_1.Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 2 } })).id, score: 5 });
            const { revisionPeriod } = yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            // Create a revision at opportunity 3
            yield index_1.InscriptionSubjectRevision.create({
                revisionPeriodId: revisionPeriod.id, inscriptionSubjectId: insSub.id,
                opportunity: 3, status: 'pending',
            });
            yield revisionPeriodService_1.RevisionPeriodService.updateMaxOpportunities(structure.period.id, 2);
            const count = yield index_1.InscriptionSubjectRevision.count({
                where: { revisionPeriodId: revisionPeriod.id, opportunity: 3 },
            });
            expect(count).toBe(0);
        }));
    });
    describe('advanceOpportunity', () => {
        it('avanza currentOpportunity en 1', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure } = yield setupPeriodForRevision('rev11');
            yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            const rp = yield revisionPeriodService_1.RevisionPeriodService.advanceOpportunity(structure.period.id);
            expect(rp.currentOpportunity).toBe(2);
        }));
        it('marca pending como NP (isAbsent=true, score=0)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, insSub } = yield setupPeriodForRevision('rev12');
            yield (0, testData_1.createTestSetting)('passing_grade', '10');
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (yield index_1.Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 1 } })).id, score: 5 });
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (yield index_1.Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 2 } })).id, score: 5 });
            const { revisionPeriod } = yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            yield revisionPeriodService_1.RevisionPeriodService.advanceOpportunity(structure.period.id);
            const rev = yield index_1.InscriptionSubjectRevision.findOne({
                where: { revisionPeriodId: revisionPeriod.id, opportunity: 1 },
            });
            expect(rev.isAbsent).toBe(true);
            expect(rev.score).toBe(0);
            expect(rev.status).toBe('failed');
        }));
        it('rechaza si ya está en la última oportunidad', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure } = yield setupPeriodForRevision('rev13');
            yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            yield revisionPeriodService_1.RevisionPeriodService.updateMaxOpportunities(structure.period.id, 1);
            yield expect(revisionPeriodService_1.RevisionPeriodService.advanceOpportunity(structure.period.id))
                .rejects.toThrow('Ya está en la última oportunidad');
        }));
        it('rechaza si no está open', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            yield index_1.RevisionPeriod.create({ schoolPeriodId: structure.period.id });
            yield expect(revisionPeriodService_1.RevisionPeriodService.advanceOpportunity(structure.period.id))
                .rejects.toThrow('no está abierto');
        }));
    });
    describe('setOpportunity', () => {
        it('setea currentOpportunity a un valor específico', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure } = yield setupPeriodForRevision('rev14');
            yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            yield revisionPeriodService_1.RevisionPeriodService.updateMaxOpportunities(structure.period.id, 5);
            const rp = yield revisionPeriodService_1.RevisionPeriodService.setOpportunity(structure.period.id, 3);
            expect(rp.currentOpportunity).toBe(3);
        }));
        it('marca oportunidades saltadas como NP', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, insSub } = yield setupPeriodForRevision('rev15');
            yield (0, testData_1.createTestSetting)('passing_grade', '10');
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (yield index_1.Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 1 } })).id, score: 5 });
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (yield index_1.Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 2 } })).id, score: 5 });
            const { revisionPeriod } = yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            yield revisionPeriodService_1.RevisionPeriodService.updateMaxOpportunities(structure.period.id, 5);
            yield revisionPeriodService_1.RevisionPeriodService.setOpportunity(structure.period.id, 3);
            const skipped = yield index_1.InscriptionSubjectRevision.findAll({
                where: { revisionPeriodId: revisionPeriod.id, opportunity: 1 },
            });
            expect(skipped[0].isAbsent).toBe(true);
            expect(skipped[0].score).toBe(0);
        }));
        it('rechaza valores fuera de rango', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure } = yield setupPeriodForRevision('rev16');
            yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            yield expect(revisionPeriodService_1.RevisionPeriodService.setOpportunity(structure.period.id, 0))
                .rejects.toThrow('entre 1 y');
            yield expect(revisionPeriodService_1.RevisionPeriodService.setOpportunity(structure.period.id, 99))
                .rejects.toThrow('entre 1 y');
        }));
    });
    describe('resetRevisionPeriod', () => {
        it('elimina todas las revisions y resetea a pending', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, insSub } = yield setupPeriodForRevision('rev17');
            yield (0, testData_1.createTestSetting)('passing_grade', '10');
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (yield index_1.Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 1 } })).id, score: 5 });
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: (yield index_1.Term.findOne({ where: { schoolPeriodId: structure.period.id, order: 2 } })).id, score: 5 });
            const { revisionPeriod } = yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            const result = yield revisionPeriodService_1.RevisionPeriodService.resetRevisionPeriod(structure.period.id);
            expect(result.revisionPeriod.status).toBe('pending');
            expect(result.deleted).toBeGreaterThan(0);
            const count = yield index_1.InscriptionSubjectRevision.count({
                where: { revisionPeriodId: revisionPeriod.id },
            });
            expect(count).toBe(0);
        }));
        it('rechaza si no existe el período de revisión', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            yield expect(revisionPeriodService_1.RevisionPeriodService.resetRevisionPeriod(structure.period.id))
                .rejects.toThrow('No existe un período de revisión');
        }));
    });
    describe('recalculateRevisionPeriod', () => {
        it('rechaza si no está open', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            yield index_1.RevisionPeriod.create({ schoolPeriodId: structure.period.id });
            yield expect(revisionPeriodService_1.RevisionPeriodService.recalculateRevisionPeriod(structure.period.id))
                .rejects.toThrow('debe estar abierto');
        }));
        it('elimina pending de materias ahora aprobadas', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, insSub, term1, term2 } = yield setupPeriodForRevision('rev18');
            yield (0, testData_1.createTestSetting)('passing_grade', '10');
            // Initially failing
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term1.id, score: 5 });
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term2.id, score: 5 });
            const { revisionPeriod } = yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            // Now the student passes — update term grades
            yield index_1.SubjectTermGrade.update({ score: 14 }, {
                where: { inscriptionSubjectId: insSub.id, termId: term1.id },
            });
            yield index_1.SubjectTermGrade.update({ score: 14 }, {
                where: { inscriptionSubjectId: insSub.id, termId: term2.id },
            });
            const result = yield revisionPeriodService_1.RevisionPeriodService.recalculateRevisionPeriod(structure.period.id);
            expect(result.removed).toBe(1);
            expect(result.created).toBe(0);
        }));
        it('crea pending para nuevas materias reprobadas', () => __awaiter(void 0, void 0, void 0, function* () {
            const { structure, insSub, term1, term2 } = yield setupPeriodForRevision('rev19');
            yield (0, testData_1.createTestSetting)('passing_grade', '10');
            // Initially passing
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term1.id, score: 14 });
            yield index_1.SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term2.id, score: 14 });
            const { revisionPeriod } = yield revisionPeriodService_1.RevisionPeriodService.openRevisionPeriod(structure.period.id);
            // Now the student fails — update term grades
            yield index_1.SubjectTermGrade.update({ score: 5 }, {
                where: { inscriptionSubjectId: insSub.id, termId: term1.id },
            });
            yield index_1.SubjectTermGrade.update({ score: 5 }, {
                where: { inscriptionSubjectId: insSub.id, termId: term2.id },
            });
            const result = yield revisionPeriodService_1.RevisionPeriodService.recalculateRevisionPeriod(structure.period.id);
            expect(result.created).toBe(1);
            expect(result.removed).toBe(0);
        }));
    });
});
