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
const periodClosureService_1 = require("../../services/periodClosureService.js");
const index_1 = require("../../models/index.js");
const testData_1 = require("../helpers/testData");
describe('PeriodClosureService', () => {
    describe('getChecklistEntry', () => {
        it('retorna null cuando no existe entry', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term = yield (0, testData_1.createTestTerm)(period.id);
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            const entry = yield periodClosureService_1.PeriodClosureService.getChecklistEntry({
                schoolPeriodId: period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                termId: term.id,
            });
            expect(entry).toBeNull();
        }));
        it('retorna el entry cuando existe', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term = yield (0, testData_1.createTestTerm)(period.id);
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                termId: term.id,
                status: 'done',
            });
            const entry = yield periodClosureService_1.PeriodClosureService.getChecklistEntry({
                schoolPeriodId: period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                termId: term.id,
            });
            expect(entry).not.toBeNull();
            expect(entry.status).toBe('done');
        }));
    });
    describe('listChecklistEntries', () => {
        it('retorna entries del term correcto', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term1 = yield (0, testData_1.createTestTerm)(period.id, { order: 1 });
            const term2 = yield (0, testData_1.createTestTerm)(period.id, { order: 2 });
            const s1 = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            const s2 = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: period.id, gradeId: s1.grade.id, sectionId: s1.section.id,
                termId: term1.id, status: 'done',
            });
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: period.id, gradeId: s2.grade.id, sectionId: s2.section.id,
                termId: term2.id, status: 'open',
            });
            const entries = yield periodClosureService_1.PeriodClosureService.listChecklistEntries({
                schoolPeriodId: period.id,
                termId: term1.id,
            });
            expect(entries).toHaveLength(1);
            expect(entries[0].gradeId).toBe(s1.grade.id);
        }));
        it('retorna vacío si no hay entries', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term = yield (0, testData_1.createTestTerm)(period.id);
            const entries = yield periodClosureService_1.PeriodClosureService.listChecklistEntries({
                schoolPeriodId: period.id,
                termId: term.id,
            });
            expect(entries).toEqual([]);
        }));
    });
    describe('upsertChecklistEntry', () => {
        it('crea nuevo entry si no existe', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term = yield (0, testData_1.createTestTerm)(period.id);
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            const { user } = yield (0, testData_1.createTestUser)({ username: 'tester' });
            const entry = yield periodClosureService_1.PeriodClosureService.upsertChecklistEntry({
                schoolPeriodId: period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                termId: term.id,
                status: 'done',
                completedBy: user.id,
            });
            expect(entry).toBeDefined();
            expect(entry.status).toBe('done');
            expect(entry.completedBy).toBe(user.id);
            expect(entry.completedAt).not.toBeNull();
        }));
        it('actualiza entry existente', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term = yield (0, testData_1.createTestTerm)(period.id);
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            yield periodClosureService_1.PeriodClosureService.upsertChecklistEntry({
                schoolPeriodId: period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                termId: term.id,
                status: 'open',
            });
            const { user } = yield (0, testData_1.createTestUser)({ username: 'tester2' });
            const entry = yield periodClosureService_1.PeriodClosureService.upsertChecklistEntry({
                schoolPeriodId: period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                termId: term.id,
                status: 'done',
                completedBy: user.id,
            });
            expect(entry.status).toBe('done');
            expect(entry.completedAt).not.toBeNull();
        }));
        it('status=open resetea completedAt y completedBy', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term = yield (0, testData_1.createTestTerm)(period.id);
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            const { user } = yield (0, testData_1.createTestUser)({ username: 'tester3' });
            yield periodClosureService_1.PeriodClosureService.upsertChecklistEntry({
                schoolPeriodId: period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                termId: term.id,
                status: 'done',
                completedBy: user.id,
            });
            const entry = yield periodClosureService_1.PeriodClosureService.upsertChecklistEntry({
                schoolPeriodId: period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                termId: term.id,
                status: 'open',
            });
            expect(entry.status).toBe('open');
            expect(entry.completedAt).toBeNull();
            expect(entry.completedBy).toBeNull();
        }));
    });
    describe('maybeAutoTransitionActiveTerm', () => {
        it('no transiciona cuando auto_term_transition está desactivado', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term1 = yield (0, testData_1.createTestTerm)(period.id, { order: 1, isActive: true, isBlocked: true });
            const term2 = yield (0, testData_1.createTestTerm)(period.id, { order: 2, isActive: false });
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            yield (0, testData_1.createTestSetting)('auto_term_transition', 'false');
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
                termId: term1.id, status: 'done',
            });
            yield periodClosureService_1.PeriodClosureService.maybeAutoTransitionActiveTerm(period.id, term1.id);
            const t1 = yield index_1.Term.findByPk(term1.id);
            const t2 = yield index_1.Term.findByPk(term2.id);
            expect(t1.isActive).toBe(true);
            expect(t2.isActive).toBe(false);
        }));
        it('transiciona al siguiente term cuando todos los consejos están done', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term1 = yield (0, testData_1.createTestTerm)(period.id, { order: 1, isActive: true, isBlocked: true });
            const term2 = yield (0, testData_1.createTestTerm)(period.id, { order: 2, isActive: false });
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            yield (0, testData_1.createTestSetting)('auto_term_transition', 'true');
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
                termId: term1.id, status: 'done',
            });
            yield periodClosureService_1.PeriodClosureService.maybeAutoTransitionActiveTerm(period.id, term1.id);
            const t1 = yield index_1.Term.findByPk(term1.id);
            const t2 = yield index_1.Term.findByPk(term2.id);
            expect(t1.isActive).toBe(false);
            expect(t2.isActive).toBe(true);
        }));
        it('no transiciona cuando no todos los consejos están done', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term1 = yield (0, testData_1.createTestTerm)(period.id, { order: 1, isActive: true, isBlocked: true });
            const term2 = yield (0, testData_1.createTestTerm)(period.id, { order: 2, isActive: false });
            const s1 = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            const s2 = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            yield (0, testData_1.createTestSetting)('auto_term_transition', 'true');
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: period.id, gradeId: s1.grade.id, sectionId: s1.section.id,
                termId: term1.id, status: 'done',
            });
            // s2 not done
            yield periodClosureService_1.PeriodClosureService.maybeAutoTransitionActiveTerm(period.id, term1.id);
            const t1 = yield index_1.Term.findByPk(term1.id);
            expect(t1.isActive).toBe(true);
        }));
        it('no transiciona cuando el term no es el activo', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term1 = yield (0, testData_1.createTestTerm)(period.id, { order: 1, isActive: true, isBlocked: true });
            const term2 = yield (0, testData_1.createTestTerm)(period.id, { order: 2, isActive: false });
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            yield (0, testData_1.createTestSetting)('auto_term_transition', 'true');
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
                termId: term2.id, status: 'done',
            });
            // Call with term2.id but term1 is active
            yield periodClosureService_1.PeriodClosureService.maybeAutoTransitionActiveTerm(period.id, term2.id);
            const t1 = yield index_1.Term.findByPk(term1.id);
            expect(t1.isActive).toBe(true);
        }));
        it('EXCLUYE secciones "MATERIA PENDIENTE" del conteo (regresión del bug)', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term1 = yield (0, testData_1.createTestTerm)(period.id, { order: 1, isActive: true, isBlocked: true });
            const term2 = yield (0, testData_1.createTestTerm)(period.id, { order: 2, isActive: false });
            const grade = yield (0, testData_1.createTestGrade)();
            const sectionA = yield (0, testData_1.createTestSection)({ name: 'SECCIÓN A' });
            const sectionPend = yield (0, testData_1.createTestSection)({ name: 'MATERIA PENDIENTE' });
            const pg = yield index_1.PeriodGrade.create({ schoolPeriodId: period.id, gradeId: grade.id });
            yield index_1.PeriodGradeSection.create({ periodGradeId: pg.id, sectionId: sectionA.id });
            yield index_1.PeriodGradeSection.create({ periodGradeId: pg.id, sectionId: sectionPend.id });
            yield (0, testData_1.createTestSetting)('auto_term_transition', 'true');
            // Only mark sectionA as done — sectionPend should be excluded
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: period.id, gradeId: grade.id, sectionId: sectionA.id,
                termId: term1.id, status: 'done',
            });
            yield periodClosureService_1.PeriodClosureService.maybeAutoTransitionActiveTerm(period.id, term1.id);
            const t1 = yield index_1.Term.findByPk(term1.id);
            const t2 = yield index_1.Term.findByPk(term2.id);
            expect(t1.isActive).toBe(false);
            expect(t2.isActive).toBe(true);
        }));
        it('no transiciona cuando no hay siguiente term', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term1 = yield (0, testData_1.createTestTerm)(period.id, { order: 1, isActive: true, isBlocked: true });
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            yield (0, testData_1.createTestSetting)('auto_term_transition', 'true');
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: period.id, gradeId: structure.grade.id, sectionId: structure.section.id,
                termId: term1.id, status: 'done',
            });
            yield periodClosureService_1.PeriodClosureService.maybeAutoTransitionActiveTerm(period.id, term1.id);
            const t1 = yield index_1.Term.findByPk(term1.id);
            expect(t1.isActive).toBe(true); // no next term, stays active
        }));
        it('no transiciona cuando no hay secciones', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term1 = yield (0, testData_1.createTestTerm)(period.id, { order: 1, isActive: true, isBlocked: true });
            const term2 = yield (0, testData_1.createTestTerm)(period.id, { order: 2, isActive: false });
            yield (0, testData_1.createTestSetting)('auto_term_transition', 'true');
            // No sections created
            yield periodClosureService_1.PeriodClosureService.maybeAutoTransitionActiveTerm(period.id, term1.id);
            const t1 = yield index_1.Term.findByPk(term1.id);
            expect(t1.isActive).toBe(true);
        }));
    });
});
