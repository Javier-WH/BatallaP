import {
  roundGrade,
  roundFinalGrade,
  MIN_FINAL_GRADE,
  isPassingGrade,
  resolveGradeStatus,
} from '@/services/gradeEvaluationService';

describe('gradeEvaluationService — pure functions', () => {
  describe('roundGrade', () => {
    it('redondea al entero más cercano', () => {
      expect(roundGrade(14.5)).toBe(15);
      expect(roundGrade(14.4)).toBe(14);
      expect(roundGrade(10)).toBe(10);
      expect(roundGrade(20)).toBe(20);
      expect(roundGrade(0)).toBe(0);
    });

    it('corrige errores de precisión flotante', () => {
      // toFixed(2) rounds to 2 decimals first, then Math.round rounds to integer
      expect(roundGrade(15.499999999999998)).toBe(16); // toFixed(2) → "15.50" → 15.5 → round → 16
      expect(roundGrade(15.444999999999998)).toBe(15); // toFixed(2) → "15.44" → 15.44 → round → 15
      expect(roundGrade(9.444999999999998)).toBe(9); // toFixed(2) → "9.44" → 9.44 → round → 9
    });

    it('redondea .5 hacia arriba', () => {
      expect(roundGrade(9.5)).toBe(10);
      expect(roundGrade(9.49)).toBe(9);
      expect(roundGrade(9.50)).toBe(10);
    });

    it('maneja valores negativos', () => {
      expect(roundGrade(-5)).toBe(-5);
      expect(roundGrade(-0.5)).toBe(-0); // Math.round(-0.5) = -0 in JS
    });
  });

  describe('roundFinalGrade', () => {
    it('aplica Math.max(MIN_FINAL_GRADE, roundGrade(score))', () => {
      expect(roundFinalGrade(14.5)).toBe(15);
      expect(roundFinalGrade(0)).toBe(MIN_FINAL_GRADE);
      expect(roundFinalGrade(-5)).toBe(MIN_FINAL_GRADE);
    });

    it('MIN_FINAL_GRADE es 1', () => {
      expect(MIN_FINAL_GRADE).toBe(1);
    });

    it('no altera valores válidos', () => {
      expect(roundFinalGrade(10)).toBe(10);
      expect(roundFinalGrade(20)).toBe(20);
      expect(roundFinalGrade(1)).toBe(1);
    });
  });

  describe('isPassingGrade', () => {
    it('true cuando el redondeo alcanza el passing grade', () => {
      expect(isPassingGrade(10, 10)).toBe(true);
      expect(isPassingGrade(9.5, 10)).toBe(true); // redondea a 10
      expect(isPassingGrade(15, 10)).toBe(true);
    });

    it('false cuando el redondeo no alcanza', () => {
      expect(isPassingGrade(9, 10)).toBe(false);
      expect(isPassingGrade(9.4, 10)).toBe(false);
      expect(isPassingGrade(0, 10)).toBe(false);
    });

    it('funciona con passing grade distinto de 10', () => {
      expect(isPassingGrade(12, 12)).toBe(true);
      expect(isPassingGrade(11.5, 12)).toBe(true); // redondea a 12
      expect(isPassingGrade(11.4, 12)).toBe(false);
    });
  });

  describe('resolveGradeStatus', () => {
    it('retorna "aprobada" cuando pasa', () => {
      expect(resolveGradeStatus(10, 10)).toBe('aprobada');
      expect(resolveGradeStatus(15, 10)).toBe('aprobada');
      expect(resolveGradeStatus(9.5, 10)).toBe('aprobada');
    });

    it('retorna "reprobada" cuando no pasa', () => {
      expect(resolveGradeStatus(9, 10)).toBe('reprobada');
      expect(resolveGradeStatus(0, 10)).toBe('reprobada');
      expect(resolveGradeStatus(9.4, 10)).toBe('reprobada');
    });
  });
});
