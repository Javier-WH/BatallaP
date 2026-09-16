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
const councilDateResolver_1 = require("../../services/councilDateResolver.js");
const index_1 = require("../../models/index.js");
const testData_1 = require("../helpers/testData");
describe('councilDateResolver', () => {
    describe('formatDateInCaracas', () => {
        it('formatea un Date a YYYY-MM-DD en America/Caracas', () => {
            // 2026-07-16T02:30:00Z == 2026-07-15 22:30 en Caracas (UTC-4)
            const date = new Date('2026-07-16T02:30:00Z');
            expect((0, councilDateResolver_1.formatDateInCaracas)(date)).toBe('2026-07-15');
        });
        it('no desplaza el día cuando el instante es mediodía Caracas', () => {
            const date = new Date('2026-07-15T16:30:00Z'); // 12:30 Caracas
            expect((0, councilDateResolver_1.formatDateInCaracas)(date)).toBe('2026-07-15');
        });
        it('acepta strings YYYY-MM-DD sin modificarlos', () => {
            expect((0, councilDateResolver_1.formatDateInCaracas)('2026-07-15')).toBe('2026-07-15');
        });
        it('retorna null para valores vacíos', () => {
            expect((0, councilDateResolver_1.formatDateInCaracas)(null)).toBeNull();
            expect((0, councilDateResolver_1.formatDateInCaracas)(undefined)).toBeNull();
            expect((0, councilDateResolver_1.formatDateInCaracas)('')).toBeNull();
        });
    });
    describe('resolveCouncilDate', () => {
        it('usa el override del lapso cuando está marcado (aunque exista checklist)', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term = yield (0, testData_1.createTestTerm)(period.id, { order: 1 });
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            yield term.update({ councilCompletedAtOverride: '2026-07-15' });
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                termId: term.id,
                status: 'done',
                completedAt: new Date('2026-09-10T12:00:00Z'),
            });
            const result = yield (0, councilDateResolver_1.resolveCouncilDate)({
                schoolPeriodId: period.id,
                sectionId: structure.section.id,
            });
            expect(result).toBe('2026-07-15');
        }));
        it('usa completedAt del checklist del último lapso cuando no hay override', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term1 = yield (0, testData_1.createTestTerm)(period.id, { order: 1 });
            const term2 = yield (0, testData_1.createTestTerm)(period.id, { order: 2 });
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            // Checklist done en el primer lapso (no debe usarse)
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                termId: term1.id,
                status: 'done',
                completedAt: new Date('2026-05-01T12:00:00Z'),
            });
            // Checklist done en el último lapso con fecha en julio
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                termId: term2.id,
                status: 'done',
                completedAt: new Date('2026-07-15T19:30:00Z'), // 15:30 Caracas
            });
            const result = yield (0, councilDateResolver_1.resolveCouncilDate)({
                schoolPeriodId: period.id,
                sectionId: structure.section.id,
            });
            expect(result).toBe('2026-07-15');
        }));
        it('retorna null cuando no hay override ni checklist done', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            yield (0, testData_1.createTestTerm)(period.id, { order: 1 });
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            const result = yield (0, councilDateResolver_1.resolveCouncilDate)({
                schoolPeriodId: period.id,
                sectionId: structure.section.id,
            });
            expect(result).toBeNull();
        }));
        it('retorna null cuando el checklist existe pero no está done', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term = yield (0, testData_1.createTestTerm)(period.id, { order: 1 });
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                termId: term.id,
                status: 'open',
            });
            const result = yield (0, councilDateResolver_1.resolveCouncilDate)({
                schoolPeriodId: period.id,
                sectionId: structure.section.id,
            });
            expect(result).toBeNull();
        }));
        it('usa el lapso con mayor order como último lapso', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term1 = yield (0, testData_1.createTestTerm)(period.id, { order: 1 });
            const term2 = yield (0, testData_1.createTestTerm)(period.id, { order: 2 });
            const term3 = yield (0, testData_1.createTestTerm)(period.id, { order: 3 });
            const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            yield term1.update({ councilCompletedAtOverride: '2026-01-10' });
            yield term2.update({ councilCompletedAtOverride: '2026-04-10' });
            yield term3.update({ councilCompletedAtOverride: '2026-07-10' });
            const result = yield (0, councilDateResolver_1.resolveCouncilDate)({
                schoolPeriodId: period.id,
                sectionId: structure.section.id,
            });
            expect(result).toBe('2026-07-10');
        }));
        it('respeta termId explícito cuando se provee', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term1 = yield (0, testData_1.createTestTerm)(period.id, { order: 1 });
            const term2 = yield (0, testData_1.createTestTerm)(period.id, { order: 2 });
            yield term2.update({ councilCompletedAtOverride: '2026-07-10' });
            const result = yield (0, councilDateResolver_1.resolveCouncilDate)({
                schoolPeriodId: period.id,
                termId: term1.id,
            });
            expect(result).toBeNull();
        }));
        it('retorna null cuando el período no tiene lapsos', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const result = yield (0, councilDateResolver_1.resolveCouncilDate)({
                schoolPeriodId: period.id,
            });
            expect(result).toBeNull();
        }));
        it('el override aplica a todas las secciones del lapso', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term = yield (0, testData_1.createTestTerm)(period.id, { order: 1 });
            const s1 = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            const s2 = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            yield term.update({ councilCompletedAtOverride: '2026-07-20' });
            const r1 = yield (0, councilDateResolver_1.resolveCouncilDate)({
                schoolPeriodId: period.id,
                sectionId: s1.section.id,
            });
            const r2 = yield (0, councilDateResolver_1.resolveCouncilDate)({
                schoolPeriodId: period.id,
                sectionId: s2.section.id,
            });
            expect(r1).toBe('2026-07-20');
            expect(r2).toBe('2026-07-20');
        }));
        it('sin override, secciones sin checklist caen al fallback null aunque otras secciones tengan checklist', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term = yield (0, testData_1.createTestTerm)(period.id, { order: 1 });
            const s1 = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            const s2 = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
            yield index_1.CouncilChecklist.create({
                schoolPeriodId: period.id,
                gradeId: s1.grade.id,
                sectionId: s1.section.id,
                termId: term.id,
                status: 'done',
                completedAt: new Date('2026-07-15T19:30:00Z'),
            });
            const withChecklist = yield (0, councilDateResolver_1.resolveCouncilDate)({
                schoolPeriodId: period.id,
                sectionId: s1.section.id,
            });
            const withoutChecklist = yield (0, councilDateResolver_1.resolveCouncilDate)({
                schoolPeriodId: period.id,
                sectionId: s2.section.id,
            });
            expect(withChecklist).toBe('2026-07-15');
            expect(withoutChecklist).toBeNull();
        }));
        it('no consulta Terms de otros períodos', () => __awaiter(void 0, void 0, void 0, function* () {
            const periodA = yield (0, testData_1.createTestPeriod)();
            const periodB = yield (0, testData_1.createTestPeriod)();
            const termA = yield (0, testData_1.createTestTerm)(periodA.id, { order: 1 });
            yield (0, testData_1.createTestTerm)(periodB.id, { order: 1 });
            yield termA.update({ councilCompletedAtOverride: '2026-07-15' });
            const resultForB = yield (0, councilDateResolver_1.resolveCouncilDate)({ schoolPeriodId: periodB.id });
            expect(resultForB).toBeNull();
            const resultForA = yield (0, councilDateResolver_1.resolveCouncilDate)({ schoolPeriodId: periodA.id });
            expect(resultForA).toBe('2026-07-15');
        }));
        it('usa Term.findOne con order DESC internamente (último lapso aunque orders no sean consecutivos)', () => __awaiter(void 0, void 0, void 0, function* () {
            const period = yield (0, testData_1.createTestPeriod)();
            const term1 = yield (0, testData_1.createTestTerm)(period.id, { order: 1 });
            const term5 = yield (0, testData_1.createTestTerm)(period.id, { order: 5 });
            yield term5.update({ councilCompletedAtOverride: '2026-07-15' });
            void term1;
            const result = yield (0, councilDateResolver_1.resolveCouncilDate)({ schoolPeriodId: period.id });
            expect(result).toBe('2026-07-15');
        }));
    });
});
