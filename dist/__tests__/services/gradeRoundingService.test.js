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
const gradeRoundingService_1 = require("../../services/gradeRoundingService.js");
const testData_1 = require("../helpers/testData");
describe('GradeRoundingService — isRoundingEnabled', () => {
    it('retorna true cuando el setting es "true"', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, testData_1.createTestSetting)('enable_grade_rounding', 'true');
        const result = yield gradeRoundingService_1.GradeRoundingService.isRoundingEnabled();
        expect(result).toBe(true);
    }));
    it('retorna false cuando el setting es "false"', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, testData_1.createTestSetting)('enable_grade_rounding', 'false');
        const result = yield gradeRoundingService_1.GradeRoundingService.isRoundingEnabled();
        expect(result).toBe(false);
    }));
    it('retorna false (default) cuando el setting no existe', () => __awaiter(void 0, void 0, void 0, function* () {
        // No setting created
        const result = yield gradeRoundingService_1.GradeRoundingService.isRoundingEnabled();
        expect(result).toBe(false);
    }));
    it('retorna false cuando el setting tiene un valor distinto de "true"', () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, testData_1.createTestSetting)('enable_grade_rounding', 'yes');
        const result = yield gradeRoundingService_1.GradeRoundingService.isRoundingEnabled();
        expect(result).toBe(false);
    }));
});
