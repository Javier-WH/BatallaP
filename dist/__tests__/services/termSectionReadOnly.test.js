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
const termSectionClosureService_1 = require("../../services/termSectionClosureService.js");
const index_1 = require("../../models/index.js");
const testData_1 = require("../helpers/testData");
describe('TermSectionClosureService.isSectionReadOnly', () => {
    it('retorna true cuando el term está globalmente bloqueado', () => __awaiter(void 0, void 0, void 0, function* () {
        const structure = yield (0, testData_1.createAcademicStructure)();
        const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: true });
        const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
        expect(result).toBe(true);
    }));
    it('retorna true cuando existe TermSectionClosure aunque el term esté abierto', () => __awaiter(void 0, void 0, void 0, function* () {
        const structure = yield (0, testData_1.createAcademicStructure)();
        const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
        yield index_1.TermSectionClosure.create({
            termId: term.id,
            sectionId: structure.section.id,
            gradeId: structure.grade.id,
            closedAt: new Date(),
        });
        const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
        expect(result).toBe(true);
    }));
    it('retorna true cuando el consejo de curso está completado aunque el lapso esté desbloqueado', () => __awaiter(void 0, void 0, void 0, function* () {
        const structure = yield (0, testData_1.createAcademicStructure)();
        const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
        yield index_1.CouncilChecklist.create({
            schoolPeriodId: structure.period.id,
            gradeId: structure.grade.id,
            sectionId: structure.section.id,
            termId: term.id,
            status: 'done',
        });
        const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
        expect(result).toBe(true);
    }));
    it('retorna false cuando el consejo existe pero no está done', () => __awaiter(void 0, void 0, void 0, function* () {
        const structure = yield (0, testData_1.createAcademicStructure)();
        const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
        yield index_1.CouncilChecklist.create({
            schoolPeriodId: structure.period.id,
            gradeId: structure.grade.id,
            sectionId: structure.section.id,
            termId: term.id,
            status: 'open',
        });
        const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
        expect(result).toBe(false);
    }));
    it('retorna false cuando el consejo estaba done y se desmarca (dinámico)', () => __awaiter(void 0, void 0, void 0, function* () {
        const structure = yield (0, testData_1.createAcademicStructure)();
        const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
        const checklist = yield index_1.CouncilChecklist.create({
            schoolPeriodId: structure.period.id,
            gradeId: structure.grade.id,
            sectionId: structure.section.id,
            termId: term.id,
            status: 'done',
        });
        expect(yield termSectionClosureService_1.TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id)).toBe(true);
        yield checklist.update({ status: 'open', completedAt: null, completedBy: null });
        const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
        expect(result).toBe(false);
    }));
    it('retorna false cuando no hay bloqueo, cierre ni consejo', () => __awaiter(void 0, void 0, void 0, function* () {
        const structure = yield (0, testData_1.createAcademicStructure)();
        const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
        const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
        expect(result).toBe(false);
    }));
    it('el consejo done de OTRA sección no bloquea esta sección', () => __awaiter(void 0, void 0, void 0, function* () {
        const structure = yield (0, testData_1.createAcademicStructure)();
        const other = yield (0, testData_1.createAcademicStructure)({ periodId: structure.period.id });
        const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
        yield index_1.CouncilChecklist.create({
            schoolPeriodId: structure.period.id,
            gradeId: other.grade.id,
            sectionId: other.section.id,
            termId: term.id,
            status: 'done',
        });
        const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
        expect(result).toBe(false);
    }));
    it('REGRESIÓN: misma sección compartida entre grados — consejo done de otro grado NO bloquea (scope por gradeId)', () => __awaiter(void 0, void 0, void 0, function* () {
        // Real-world scenario: the same section row (e.g. "SECCIÓN B") is reused
        // across grades. Council done for Sección B/5to año must not lock Sección B/1er año.
        const structure = yield (0, testData_1.createAcademicStructure)(); // section B + grade 1
        const otherGrade = yield (0, testData_1.createTestGrade)({ name: 'Quinto año' });
        const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
        // Council done for the SAME section but a DIFFERENT grade
        yield index_1.CouncilChecklist.create({
            schoolPeriodId: structure.period.id,
            gradeId: otherGrade.id,
            sectionId: structure.section.id,
            termId: term.id,
            status: 'done',
        });
        const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, structure.grade.id);
        expect(result).toBe(false);
        // ...and the grade whose council IS done stays read-only
        const resultOther = yield termSectionClosureService_1.TermSectionClosureService.isSectionReadOnly(term.id, structure.section.id, otherGrade.id);
        expect(resultOther).toBe(true);
    }));
    it('el consejo done de OTRO lapso no bloquea este lapso', () => __awaiter(void 0, void 0, void 0, function* () {
        const structure = yield (0, testData_1.createAcademicStructure)();
        const term1 = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 1, isBlocked: false });
        const term2 = yield (0, testData_1.createTestTerm)(structure.period.id, { order: 2, isBlocked: false });
        yield index_1.CouncilChecklist.create({
            schoolPeriodId: structure.period.id,
            gradeId: structure.grade.id,
            sectionId: structure.section.id,
            termId: term1.id,
            status: 'done',
        });
        const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionReadOnly(term2.id, structure.section.id, structure.grade.id);
        expect(result).toBe(false);
    }));
    it('retorna false cuando el term no existe', () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionReadOnly(99999, 1, 1);
        expect(result).toBe(false);
    }));
});
