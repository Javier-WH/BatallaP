import {
  GradeCalculationService,
} from '@/services/gradeCalculationService';
import { MIN_FINAL_GRADE } from '@/services/gradeEvaluationService';

describe('GradeCalculationService — pure functions', () => {
  describe('calculateAccumulatedTermScore', () => {
    it('retorna roundFinalGrade del score del term', () => {
      const termGrades = [
        { termId: 1, score: 14.5 },
        { termId: 2, score: 9 },
      ];
      expect(GradeCalculationService.calculateAccumulatedTermScore(1, termGrades)).toBe(15);
      expect(GradeCalculationService.calculateAccumulatedTermScore(2, termGrades)).toBe(9);
    });

    it('retorna MIN_FINAL_GRADE (1) cuando el term no existe', () => {
      const termGrades = [{ termId: 1, score: 10 }];
      expect(GradeCalculationService.calculateAccumulatedTermScore(99, termGrades)).toBe(MIN_FINAL_GRADE);
    });

    it('retorna MIN_FINAL_GRADE (1) cuando el score es 0', () => {
      const termGrades = [{ termId: 1, score: 0 }];
      expect(GradeCalculationService.calculateAccumulatedTermScore(1, termGrades)).toBe(MIN_FINAL_GRADE);
    });
  });

  describe('calculateFinalTermScore', () => {
    it('retorna null cuando councilDone=false', () => {
      const termGrades = [{ termId: 1, score: 15 }];
      expect(GradeCalculationService.calculateFinalTermScore(1, termGrades, false)).toBeNull();
    });

    it('retorna el score cuando councilDone=true', () => {
      const termGrades = [{ termId: 1, score: 14.5 }];
      expect(GradeCalculationService.calculateFinalTermScore(1, termGrades, true)).toBe(15);
    });
  });

  describe('calculateFinalScore', () => {
    it('usa SubjectFinalGrade directo para transferencia', () => {
      const result = GradeCalculationService.calculateFinalScore(
        [{ termId: 1, finalScore: 5 }],
        { finalScore: 18, gradeType: 'transferencia' },
      );
      expect(result).toBe(18);
    });

    it('usa SubjectFinalGrade directo para equivalencia', () => {
      const result = GradeCalculationService.calculateFinalScore(
        [{ termId: 1, finalScore: 5 }],
        { finalScore: 12, gradeType: 'equivalencia' },
      );
      expect(result).toBe(12);
    });

    it('aplica MIN_FINAL_GRADE a transferencia con score 0', () => {
      const result = GradeCalculationService.calculateFinalScore(
        [],
        { finalScore: 0, gradeType: 'transferencia' },
      );
      expect(result).toBe(MIN_FINAL_GRADE);
    });

    it('retorna null para transferencia sin finalScore', () => {
      const result = GradeCalculationService.calculateFinalScore(
        [],
        { finalScore: null, gradeType: 'transferencia' },
      );
      expect(result).toBeNull();
    });

    it('usa SubjectFinalGrade directo cuando isClosedPeriod=true', () => {
      const result = GradeCalculationService.calculateFinalScore(
        [{ termId: 1, finalScore: 5 }],
        { finalScore: 14, gradeType: 'regular' },
        { isClosedPeriod: true },
      );
      expect(result).toBe(14);
    });

    it('usa SubjectFinalGrade cuando todos los lapsos están done', () => {
      const result = GradeCalculationService.calculateFinalScore(
        [
          { termId: 1, finalScore: 10 },
          { termId: 2, finalScore: 12 },
        ],
        { finalScore: 14, gradeType: 'regular' },
      );
      expect(result).toBe(14);
    });

    it('promedia los lapsos done cuando no todos están done', () => {
      const result = GradeCalculationService.calculateFinalScore(
        [
          { termId: 1, finalScore: 10 },
          { termId: 2, finalScore: null },
        ],
        null,
      );
      expect(result).toBe(10);
    });

    it('promedia múltiples lapsos done', () => {
      const result = GradeCalculationService.calculateFinalScore(
        [
          { termId: 1, finalScore: 10 },
          { termId: 2, finalScore: 14 },
          { termId: 3, finalScore: null },
        ],
        null,
      );
      expect(result).toBe(12); // (10 + 14) / 2 = 12
    });

    it('retorna null cuando ningún lapso está done', () => {
      const result = GradeCalculationService.calculateFinalScore(
        [
          { termId: 1, finalScore: null },
          { termId: 2, finalScore: null },
        ],
        null,
      );
      expect(result).toBeNull();
    });

    it('retorna null cuando no hay lapsos', () => {
      const result = GradeCalculationService.calculateFinalScore([], null);
      expect(result).toBeNull();
    });
  });

  describe('calculateGeneralAverage', () => {
    it('mode=final: promedia subjects con includeInAverage=true', () => {
      const subjects = [
        { finalScore: 10, includeInAverage: true },
        { finalScore: 14, includeInAverage: true },
        { finalScore: 20, includeInAverage: false }, // excluida
      ];
      expect(GradeCalculationService.calculateGeneralAverage(subjects, 'final')).toBe(12);
    });

    it('mode=final: aplica MIN_FINAL_GRADE por subject', () => {
      const subjects = [
        { finalScore: 0, includeInAverage: true },
        { finalScore: 14, includeInAverage: true },
      ];
      // (max(1,0) + 14) / 2 = 7.5
      expect(GradeCalculationService.calculateGeneralAverage(subjects, 'final')).toBe(7.5);
    });

    it('mode=final: ignora subjects con finalScore=null', () => {
      const subjects = [
        { finalScore: null, includeInAverage: true },
        { finalScore: 14, includeInAverage: true },
      ];
      expect(GradeCalculationService.calculateGeneralAverage(subjects, 'final')).toBe(14);
    });

    it('mode=final: retorna null si no hay scores', () => {
      const subjects = [
        { finalScore: null, includeInAverage: true },
      ];
      expect(GradeCalculationService.calculateGeneralAverage(subjects, 'final')).toBeNull();
    });

    it('mode=accumulated: promedia los accumulatedScores', () => {
      const scores = [10, 14, 0];
      // max(1,10)=10, max(1,14)=14, max(1,0)=1 → (10+14+1)/3 = 8.33
      expect(GradeCalculationService.calculateGeneralAverage([], 'accumulated', scores)).toBe(8.33);
    });

    it('mode=accumulated: retorna null si no hay scores', () => {
      expect(GradeCalculationService.calculateGeneralAverage([], 'accumulated', [])).toBeNull();
      expect(GradeCalculationService.calculateGeneralAverage([], 'accumulated', undefined)).toBeNull();
    });
  });

  describe('resolveStatus', () => {
    it('retorna "reprobada" para null', () => {
      expect(GradeCalculationService.resolveStatus(null, 10)).toBe('reprobada');
    });

    it('retorna "reprobada" para undefined', () => {
      expect(GradeCalculationService.resolveStatus(undefined as any, 10)).toBe('reprobada');
    });

    it('retorna "aprobada" cuando pasa', () => {
      expect(GradeCalculationService.resolveStatus(10, 10)).toBe('aprobada');
      expect(GradeCalculationService.resolveStatus(15, 10)).toBe('aprobada');
    });

    it('retorna "reprobada" cuando no pasa', () => {
      expect(GradeCalculationService.resolveStatus(9, 10)).toBe('reprobada');
    });
  });

  describe('buildCouncilDoneChecker', () => {
    it('construye un mapa correcto de sections→terms done', () => {
      const checklists = [
        { termId: 1, sectionId: 10, status: 'done' },
        { termId: 2, sectionId: 10, status: 'done' },
        { termId: 1, sectionId: 20, status: 'open' }, // no done
        { termId: 1, sectionId: 30, status: 'done' },
      ];
      const checker = GradeCalculationService.buildCouncilDoneChecker(checklists);

      expect(checker(1, 10)).toBe(true);
      expect(checker(2, 10)).toBe(true);
      expect(checker(1, 20)).toBe(false); // status='open'
      expect(checker(1, 30)).toBe(true);
      expect(checker(99, 10)).toBe(false); // term no existe
      expect(checker(1, 99)).toBe(false); // section no existe
    });

    it('retorna false para listas vacías', () => {
      const checker = GradeCalculationService.buildCouncilDoneChecker([]);
      expect(checker(1, 10)).toBe(false);
    });
  });

  describe('buildTermGradesWithFallback', () => {
    it('usa el stored score cuando > 0', () => {
      const termGrades = [{ termId: 1, score: 15 }];
      const result = GradeCalculationService.buildTermGradesWithFallback(
        termGrades, [], [], [1],
      );
      expect(result).toEqual([{ termId: 1, score: 15 }]);
    });

    it('usa fallback cuando stored es 0', () => {
      const termGrades = [{ termId: 1, score: 0 }];
      const qualifications = [
        { isAbsent: false, score: 14, remedialScore: null, evaluationPlan: { percentage: 100, termId: 1 } },
      ];
      const result = GradeCalculationService.buildTermGradesWithFallback(
        termGrades, qualifications, [], [1],
      );
      expect(result).toEqual([{ termId: 1, score: 14 }]);
    });

    it('usa fallback cuando no hay stored', () => {
      const qualifications = [
        { isAbsent: false, score: 10, remedialScore: null, evaluationPlan: { percentage: 50, termId: 1 } },
        { isAbsent: false, score: 20, remedialScore: null, evaluationPlan: { percentage: 50, termId: 1 } },
      ];
      const result = GradeCalculationService.buildTermGradesWithFallback(
        [], qualifications, [], [1],
      );
      expect(result).toEqual([{ termId: 1, score: 15 }]); // 10*0.5 + 20*0.5 = 15
    });

    it('suma councilPoints al fallback', () => {
      const councilPoints = [{ termId: 1, points: 2 }];
      const result = GradeCalculationService.buildTermGradesWithFallback(
        [], [], councilPoints, [1],
      );
      expect(result).toEqual([{ termId: 1, score: 2 }]);
    });

    it('ignora qualifications con isAbsent=true', () => {
      const qualifications = [
        { isAbsent: true, score: 20, remedialScore: null, evaluationPlan: { percentage: 100, termId: 1 } },
      ];
      const result = GradeCalculationService.buildTermGradesWithFallback(
        [], qualifications, [], [1],
      );
      expect(result).toEqual([{ termId: 1, score: 0 }]);
    });

    it('usa remedialScore cuando > 0', () => {
      const qualifications = [
        { isAbsent: false, score: 5, remedialScore: 12, evaluationPlan: { percentage: 100, termId: 1 } },
      ];
      const result = GradeCalculationService.buildTermGradesWithFallback(
        [], qualifications, [], [1],
      );
      expect(result).toEqual([{ termId: 1, score: 12 }]);
    });

    it('no usa remedialScore cuando es 0 o null', () => {
      const qualifications = [
        { isAbsent: false, score: 10, remedialScore: 0, evaluationPlan: { percentage: 100, termId: 1 } },
      ];
      const result = GradeCalculationService.buildTermGradesWithFallback(
        [], qualifications, [], [1],
      );
      expect(result).toEqual([{ termId: 1, score: 10 }]);
    });
  });
});
