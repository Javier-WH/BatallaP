"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gradeEvaluationService_1 = require("../../services/gradeEvaluationService.js");
describe('gradeEvaluationService — pure functions', () => {
    describe('roundGrade', () => {
        it('redondea al entero más cercano', () => {
            expect((0, gradeEvaluationService_1.roundGrade)(14.5)).toBe(15);
            expect((0, gradeEvaluationService_1.roundGrade)(14.4)).toBe(14);
            expect((0, gradeEvaluationService_1.roundGrade)(10)).toBe(10);
            expect((0, gradeEvaluationService_1.roundGrade)(20)).toBe(20);
            expect((0, gradeEvaluationService_1.roundGrade)(0)).toBe(0);
        });
        it('corrige errores de precisión flotante', () => {
            // toFixed(2) rounds to 2 decimals first, then Math.round rounds to integer
            expect((0, gradeEvaluationService_1.roundGrade)(15.499999999999998)).toBe(16); // toFixed(2) → "15.50" → 15.5 → round → 16
            expect((0, gradeEvaluationService_1.roundGrade)(15.444999999999998)).toBe(15); // toFixed(2) → "15.44" → 15.44 → round → 15
            expect((0, gradeEvaluationService_1.roundGrade)(9.444999999999998)).toBe(9); // toFixed(2) → "9.44" → 9.44 → round → 9
        });
        it('redondea .5 hacia arriba', () => {
            expect((0, gradeEvaluationService_1.roundGrade)(9.5)).toBe(10);
            expect((0, gradeEvaluationService_1.roundGrade)(9.49)).toBe(9);
            expect((0, gradeEvaluationService_1.roundGrade)(9.50)).toBe(10);
        });
        it('maneja valores negativos', () => {
            expect((0, gradeEvaluationService_1.roundGrade)(-5)).toBe(-5);
            expect((0, gradeEvaluationService_1.roundGrade)(-0.5)).toBe(-0); // Math.round(-0.5) = -0 in JS
        });
    });
    describe('roundFinalGrade', () => {
        it('aplica Math.max(MIN_FINAL_GRADE, roundGrade(score))', () => {
            expect((0, gradeEvaluationService_1.roundFinalGrade)(14.5)).toBe(15);
            expect((0, gradeEvaluationService_1.roundFinalGrade)(0)).toBe(gradeEvaluationService_1.MIN_FINAL_GRADE);
            expect((0, gradeEvaluationService_1.roundFinalGrade)(-5)).toBe(gradeEvaluationService_1.MIN_FINAL_GRADE);
        });
        it('MIN_FINAL_GRADE es 1', () => {
            expect(gradeEvaluationService_1.MIN_FINAL_GRADE).toBe(1);
        });
        it('no altera valores válidos', () => {
            expect((0, gradeEvaluationService_1.roundFinalGrade)(10)).toBe(10);
            expect((0, gradeEvaluationService_1.roundFinalGrade)(20)).toBe(20);
            expect((0, gradeEvaluationService_1.roundFinalGrade)(1)).toBe(1);
        });
    });
    describe('isPassingGrade', () => {
        it('true cuando el redondeo alcanza el passing grade', () => {
            expect((0, gradeEvaluationService_1.isPassingGrade)(10, 10)).toBe(true);
            expect((0, gradeEvaluationService_1.isPassingGrade)(9.5, 10)).toBe(true); // redondea a 10
            expect((0, gradeEvaluationService_1.isPassingGrade)(15, 10)).toBe(true);
        });
        it('false cuando el redondeo no alcanza', () => {
            expect((0, gradeEvaluationService_1.isPassingGrade)(9, 10)).toBe(false);
            expect((0, gradeEvaluationService_1.isPassingGrade)(9.4, 10)).toBe(false);
            expect((0, gradeEvaluationService_1.isPassingGrade)(0, 10)).toBe(false);
        });
        it('funciona con passing grade distinto de 10', () => {
            expect((0, gradeEvaluationService_1.isPassingGrade)(12, 12)).toBe(true);
            expect((0, gradeEvaluationService_1.isPassingGrade)(11.5, 12)).toBe(true); // redondea a 12
            expect((0, gradeEvaluationService_1.isPassingGrade)(11.4, 12)).toBe(false);
        });
    });
    describe('resolveGradeStatus', () => {
        it('retorna "aprobada" cuando pasa', () => {
            expect((0, gradeEvaluationService_1.resolveGradeStatus)(10, 10)).toBe('aprobada');
            expect((0, gradeEvaluationService_1.resolveGradeStatus)(15, 10)).toBe('aprobada');
            expect((0, gradeEvaluationService_1.resolveGradeStatus)(9.5, 10)).toBe('aprobada');
        });
        it('retorna "reprobada" cuando no pasa', () => {
            expect((0, gradeEvaluationService_1.resolveGradeStatus)(9, 10)).toBe('reprobada');
            expect((0, gradeEvaluationService_1.resolveGradeStatus)(0, 10)).toBe('reprobada');
            expect((0, gradeEvaluationService_1.resolveGradeStatus)(9.4, 10)).toBe('reprobada');
        });
    });
});
