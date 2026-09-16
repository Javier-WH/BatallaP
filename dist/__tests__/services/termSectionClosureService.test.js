"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
describe('TermSectionClosureService', () => {
    describe('isSectionClosed', () => {
        it('retorna true cuando el term está globalmente bloqueado', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: true });
            const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionClosed(term.id, structure.section.id, structure.grade.id);
            expect(result).toBe(true);
        }));
        it('retorna true cuando existe TermSectionClosure', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
            yield index_1.TermSectionClosure.create({
                termId: term.id,
                sectionId: structure.section.id,
                gradeId: structure.grade.id,
                closedAt: new Date(),
            });
            const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionClosed(term.id, structure.section.id, structure.grade.id);
            expect(result).toBe(true);
        }));
        it('retorna false cuando no hay closure y el term no está bloqueado', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
            const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionClosed(term.id, structure.section.id, structure.grade.id);
            expect(result).toBe(false);
        }));
        it('retorna false cuando no hay gradeId y el term no está bloqueado', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
            const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionClosed(term.id, structure.section.id);
            expect(result).toBe(false);
        }));
        it('retorna false cuando el term no existe', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield termSectionClosureService_1.TermSectionClosureService.isSectionClosed(99999, 1, 1);
            expect(result).toBe(false);
        }));
    });
    describe('getClosedSections', () => {
        it('retorna null cuando el term está globalmente bloqueado', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: true });
            const result = yield termSectionClosureService_1.TermSectionClosureService.getClosedSections(term.id);
            expect(result).toBeNull();
        }));
        it('retorna [] cuando no hay closures', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
            const result = yield termSectionClosureService_1.TermSectionClosureService.getClosedSections(term.id);
            expect(result).toEqual([]);
        }));
        it('retorna la lista de sections cerradas', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
            yield index_1.TermSectionClosure.create({
                termId: term.id,
                sectionId: structure.section.id,
                gradeId: structure.grade.id,
                closedAt: new Date(),
            });
            const result = yield termSectionClosureService_1.TermSectionClosureService.getClosedSections(term.id);
            expect(result).toHaveLength(1);
            expect(result[0].sectionId).toBe(structure.section.id);
            expect(result[0].gradeId).toBe(structure.grade.id);
        }));
        it('retorna [] cuando el term no existe', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield termSectionClosureService_1.TermSectionClosureService.getClosedSections(99999);
            expect(result).toEqual([]);
        }));
    });
    describe('closeSection', () => {
        it('crea un registro de cierre', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
            const closure = yield termSectionClosureService_1.TermSectionClosureService.closeSection({
                termId: term.id,
                sectionId: structure.section.id,
                gradeId: structure.grade.id,
            });
            expect(closure).toBeDefined();
            expect(closure.termId).toBe(term.id);
            expect(closure.sectionId).toBe(structure.section.id);
        }));
        it('es idempotente (findOrCreate)', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
            yield termSectionClosureService_1.TermSectionClosureService.closeSection({
                termId: term.id,
                sectionId: structure.section.id,
                gradeId: structure.grade.id,
            });
            yield termSectionClosureService_1.TermSectionClosureService.closeSection({
                termId: term.id,
                sectionId: structure.section.id,
                gradeId: structure.grade.id,
            });
            const count = yield index_1.TermSectionClosure.count({
                where: { termId: term.id, sectionId: structure.section.id, gradeId: structure.grade.id },
            });
            expect(count).toBe(1);
        }));
        it('guarda closedBy cuando se provee', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
            const { user } = yield (0, testData_1.createTestUser)({ username: 'closer' });
            const closure = yield termSectionClosureService_1.TermSectionClosureService.closeSection({
                termId: term.id,
                sectionId: structure.section.id,
                gradeId: structure.grade.id,
                closedBy: user.id,
            });
            expect(closure.closedBy).toBe(user.id);
        }));
    });
    describe('reopenSection', () => {
        it('elimina el registro de cierre', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
            yield termSectionClosureService_1.TermSectionClosureService.closeSection({
                termId: term.id,
                sectionId: structure.section.id,
                gradeId: structure.grade.id,
            });
            yield termSectionClosureService_1.TermSectionClosureService.reopenSection(term.id, structure.section.id, structure.grade.id);
            const count = yield index_1.TermSectionClosure.count({
                where: { termId: term.id, sectionId: structure.section.id, gradeId: structure.grade.id },
            });
            expect(count).toBe(0);
        }));
        it('no falla si no hay registro que eliminar', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
            yield termSectionClosureService_1.TermSectionClosureService.reopenSection(term.id, structure.section.id, structure.grade.id);
            // No error thrown
        }));
    });
    describe('areAllSectionsClosed', () => {
        it('retorna true cuando el term está globalmente bloqueado', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: true });
            const result = yield termSectionClosureService_1.TermSectionClosureService.areAllSectionsClosed(term.id, structure.period.id);
            expect(result).toBe(true);
        }));
        it('retorna true cuando todas las secciones están cerradas', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
            yield index_1.TermSectionClosure.create({
                termId: term.id,
                sectionId: structure.section.id,
                gradeId: structure.grade.id,
                closedAt: new Date(),
            });
            const result = yield termSectionClosureService_1.TermSectionClosureService.areAllSectionsClosed(term.id, structure.period.id);
            expect(result).toBe(true);
        }));
        it('retorna false cuando algunas secciones no están cerradas', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const extraSection = yield (0, testData_1.createTestSection)();
            const { PeriodGradeSection } = yield Promise.resolve().then(() => __importStar(require('../../models/index.js')));
            yield PeriodGradeSection.create({
                periodGradeId: structure.periodGrade.id,
                sectionId: extraSection.id,
            });
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
            // Close only one of two sections
            yield index_1.TermSectionClosure.create({
                termId: term.id,
                sectionId: structure.section.id,
                gradeId: structure.grade.id,
                closedAt: new Date(),
            });
            const result = yield termSectionClosureService_1.TermSectionClosureService.areAllSectionsClosed(term.id, structure.period.id);
            expect(result).toBe(false);
        }));
        it('retorna true cuando no hay secciones (vacuously true)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { createTestPeriod } = yield Promise.resolve().then(() => __importStar(require('../helpers/testData')));
            const period = yield createTestPeriod();
            const term = yield (0, testData_1.createTestTerm)(period.id, { isBlocked: false });
            const result = yield termSectionClosureService_1.TermSectionClosureService.areAllSectionsClosed(term.id, period.id);
            expect(result).toBe(true);
        }));
    });
    describe('areAllTermsFullyClosed', () => {
        it('retorna true cuando todos los terms están bloqueados', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: true, order: 1 });
            yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: true, order: 2 });
            const result = yield termSectionClosureService_1.TermSectionClosureService.areAllTermsFullyClosed(structure.period.id);
            expect(result).toBe(true);
        }));
        it('retorna true cuando no hay terms', () => __awaiter(void 0, void 0, void 0, function* () {
            const { createTestPeriod } = yield Promise.resolve().then(() => __importStar(require('../helpers/testData')));
            const period = yield createTestPeriod();
            const result = yield termSectionClosureService_1.TermSectionClosureService.areAllTermsFullyClosed(period.id);
            expect(result).toBe(true);
        }));
        it('retorna false cuando algún term no tiene todas sus secciones cerradas', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: true, order: 1 });
            yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false, order: 2 });
            const result = yield termSectionClosureService_1.TermSectionClosureService.areAllTermsFullyClosed(structure.period.id);
            expect(result).toBe(false);
        }));
    });
    describe('getClosureStatus', () => {
        it('retorna summary correcto para term bloqueado', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: true });
            const status = yield termSectionClosureService_1.TermSectionClosureService.getClosureStatus(term.id, structure.period.id);
            expect(status.termGloballyBlocked).toBe(true);
            expect(status.allClosed).toBe(true);
            expect(status.closedSections).toBeNull();
        }));
        it('retorna summary correcto para term no bloqueado con secciones cerradas', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
            yield index_1.TermSectionClosure.create({
                termId: term.id,
                sectionId: structure.section.id,
                gradeId: structure.grade.id,
                closedAt: new Date(),
            });
            const status = yield termSectionClosureService_1.TermSectionClosureService.getClosureStatus(term.id, structure.period.id);
            expect(status.termGloballyBlocked).toBe(false);
            expect(status.allClosed).toBe(true);
            expect(status.totalSections).toBe(1);
            expect(status.closedSections).toHaveLength(1);
        }));
        it('retorna allClosed=false cuando no todas están cerradas', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const term = yield (0, testData_1.createTestTerm)(structure.period.id, { isBlocked: false });
            const status = yield termSectionClosureService_1.TermSectionClosureService.getClosureStatus(term.id, structure.period.id);
            expect(status.allClosed).toBe(false);
            expect(status.totalSections).toBe(1);
            expect(status.closedSections).toHaveLength(0);
        }));
        it('retorna vacío cuando el term no existe', () => __awaiter(void 0, void 0, void 0, function* () {
            const status = yield termSectionClosureService_1.TermSectionClosureService.getClosureStatus(99999, 1);
            expect(status.totalSections).toBe(0);
            expect(status.allClosed).toBe(false);
            expect(status.termGloballyBlocked).toBe(false);
        }));
    });
});
