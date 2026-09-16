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
const subjectOrderService_1 = require("../services/subjectOrderService.js");
const index_1 = require("../models/index.js");
describe('subjectOrderService', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });
    describe('getSubjectOrderMap', () => {
        it('should return empty map if periodGradeId is null', () => __awaiter(void 0, void 0, void 0, function* () {
            const map = yield (0, subjectOrderService_1.getSubjectOrderMap)(null);
            expect(map.size).toBe(0);
        }));
        it('should return empty map if periodGradeId is undefined', () => __awaiter(void 0, void 0, void 0, function* () {
            const map = yield (0, subjectOrderService_1.getSubjectOrderMap)(undefined);
            expect(map.size).toBe(0);
        }));
        it('should return map with subjectId -> order mapping', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockRows = [
                { subjectId: 1, order: 1 },
                { subjectId: 2, order: 2 },
                { subjectId: 3, order: 3 },
            ];
            jest.spyOn(index_1.PeriodGradeSubject, 'findAll').mockResolvedValue(mockRows);
            const map = yield (0, subjectOrderService_1.getSubjectOrderMap)(100);
            expect(map.size).toBe(3);
            expect(map.get(1)).toBe(1);
            expect(map.get(2)).toBe(2);
            expect(map.get(3)).toBe(3);
        }));
        it('should skip rows where order is null', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockRows = [
                { subjectId: 1, order: 1 },
                { subjectId: 2, order: null },
                { subjectId: 3, order: 3 },
            ];
            jest.spyOn(index_1.PeriodGradeSubject, 'findAll').mockResolvedValue(mockRows);
            const map = yield (0, subjectOrderService_1.getSubjectOrderMap)(100);
            expect(map.size).toBe(2);
            expect(map.has(1)).toBe(true);
            expect(map.has(2)).toBe(false);
            expect(map.has(3)).toBe(true);
        }));
    });
    describe('getSubjectOrderMapByGradeAndPeriod', () => {
        it('should return empty map if gradeId is null', () => __awaiter(void 0, void 0, void 0, function* () {
            const map = yield (0, subjectOrderService_1.getSubjectOrderMapByGradeAndPeriod)(null, 1);
            expect(map.size).toBe(0);
        }));
        it('should return empty map if schoolPeriodId is null', () => __awaiter(void 0, void 0, void 0, function* () {
            const map = yield (0, subjectOrderService_1.getSubjectOrderMapByGradeAndPeriod)(1, null);
            expect(map.size).toBe(0);
        }));
        it('should fetch PeriodGrade and call getSubjectOrderMap', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockPg = { id: 100 };
            jest.spyOn(index_1.PeriodGrade, 'findOne').mockResolvedValue(mockPg);
            jest.spyOn(index_1.PeriodGradeSubject, 'findAll').mockResolvedValue([
                { subjectId: 1, order: 1 },
            ]);
            const map = yield (0, subjectOrderService_1.getSubjectOrderMapByGradeAndPeriod)(5, 10);
            expect(index_1.PeriodGrade.findOne).toHaveBeenCalledWith({
                where: { gradeId: 5, schoolPeriodId: 10 },
                attributes: ['id'],
                transaction: undefined,
            });
            expect(index_1.PeriodGradeSubject.findAll).toHaveBeenCalled();
            expect(map.size).toBe(1);
        }));
        it('should return empty map if PeriodGrade not found', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(index_1.PeriodGrade, 'findOne').mockResolvedValue(null);
            const map = yield (0, subjectOrderService_1.getSubjectOrderMapByGradeAndPeriod)(5, 10);
            expect(map.size).toBe(0);
        }));
    });
    describe('sortSubjectsByOrder', () => {
        const items = [
            { id: 1, name: 'Matemáticas' },
            { id: 2, name: 'Física' },
            { id: 3, name: 'Química' },
            { id: 4, name: 'Biología' },
        ];
        it('should sort by order map when available', () => {
            const orderMap = new Map([
                [3, 1],
                [1, 2],
                [4, 3],
                [2, 4],
            ]);
            const sorted = (0, subjectOrderService_1.sortSubjectsByOrder)(items, (item) => item.id, (item) => item.name, orderMap);
            expect(sorted.map((s) => s.id)).toEqual([3, 1, 4, 2]);
        });
        it('should fallback to alphabetical when order is not in map', () => {
            const orderMap = new Map([
                [1, 1],
                [3, 2],
            ]);
            const sorted = (0, subjectOrderService_1.sortSubjectsByOrder)(items, (item) => item.id, (item) => item.name, orderMap);
            expect(sorted[0].id).toBe(1);
            expect(sorted[1].id).toBe(3);
            // Items 2 and 4 should be alphabetically after
            expect(sorted[2].name).toBe('Biología');
            expect(sorted[3].name).toBe('Física');
        });
        it('should fallback to alphabetical when orderMap is empty', () => {
            const orderMap = new Map();
            const sorted = (0, subjectOrderService_1.sortSubjectsByOrder)(items, (item) => item.id, (item) => item.name, orderMap);
            expect(sorted.map((s) => s.name)).toEqual([
                'Biología',
                'Física',
                'Matemáticas',
                'Química',
            ]);
        });
        it('should handle null subjectId gracefully', () => {
            const itemsWithNull = [
                { id: null, name: 'Unknown' },
                { id: 2, name: 'Física' },
            ];
            const orderMap = new Map([[2, 1]]);
            const sorted = (0, subjectOrderService_1.sortSubjectsByOrder)(itemsWithNull, (item) => item.id, (item) => item.name, orderMap);
            expect(sorted[0].id).toBe(2);
            expect(sorted[1].id).toBe(null);
        });
    });
    describe('sortSubjectsWithPendingAtEnd', () => {
        const items = [
            { id: 1, name: 'Matemáticas', pending: false },
            { id: 2, name: 'Física', pending: true },
            { id: 3, name: 'Química', pending: false },
            { id: 4, name: 'Biología', pending: true },
        ];
        it('should put pending items at the end', () => {
            const orderMap = new Map([
                [1, 1],
                [3, 2],
            ]);
            const sorted = (0, subjectOrderService_1.sortSubjectsWithPendingAtEnd)(items, (item) => item.id, (item) => item.name, (item) => !!item.pending, orderMap);
            expect(sorted[0].id).toBe(1);
            expect(sorted[1].id).toBe(3);
            expect(sorted[2].pending).toBe(true);
            expect(sorted[3].pending).toBe(true);
        });
        it('should sort pending items alphabetically', () => {
            const orderMap = new Map();
            const sorted = (0, subjectOrderService_1.sortSubjectsWithPendingAtEnd)(items, (item) => item.id, (item) => item.name, (item) => !!item.pending, orderMap);
            // Non-pending first (alphabetically)
            expect(sorted[0].name).toBe('Matemáticas');
            expect(sorted[1].name).toBe('Química');
            // Pending after (alphabetically)
            expect(sorted[2].name).toBe('Biología');
            expect(sorted[3].name).toBe('Física');
        });
        it('should handle empty items array', () => {
            const orderMap = new Map();
            const sorted = (0, subjectOrderService_1.sortSubjectsWithPendingAtEnd)([], (item) => item.id, (item) => item.name, (item) => false, orderMap);
            expect(sorted).toEqual([]);
        });
    });
});
