import { pickGroupSubjectForTerm } from '@/services/subjectGroupService';
import { GradeCalculationService } from '@/services/gradeCalculationService';

const subject = (subjectId: number, terms: number[]) => ({ subjectId, termGrades: terms.map(termId => ({ termId })) });

describe('pickGroupSubjectForTerm', () => {
  it('prefers the explicit choice of that term', () => {
    const a = subject(1, [1, 2, 3]);
    const b = subject(2, [3]);
    expect(pickGroupSubjectForTerm([a, b], 3, 2, 2)).toBe(b);
  });

  it('falls back to the subject holding a grade for the term when there is no choice row', () => {
    const a = subject(1, [1, 2]);
    const b = subject(2, [3]);
    expect(pickGroupSubjectForTerm([a, b], 1, undefined, 2)).toBe(a);
    expect(pickGroupSubjectForTerm([a, b], 3, undefined, 2)).toBe(b);
  });

  it('among several subjects with a grade, takes the latest chosen', () => {
    const a = subject(1, [1]);
    const b = subject(2, [1]);
    expect(pickGroupSubjectForTerm([a, b], 1, undefined, 2)).toBe(b);
  });

  it('uses the latest choice, then the first row, when nothing has a grade for the term', () => {
    const a = subject(1, []);
    const b = subject(2, []);
    expect(pickGroupSubjectForTerm([a, b], 1, undefined, 2)).toBe(b);
    expect(pickGroupSubjectForTerm([a, b], 1)).toBe(a);
  });

  it('keeps every lapso of a student whose only choice row is the last one (16, 17, 04 → 12, not 04)', () => {
    const only = { subjectId: 41, termGrades: [{ termId: 1, score: 16 }, { termId: 2, score: 17 }, { termId: 3, score: 4 }] };
    const lapsos = [1, 2, 3].map(termId => {
      const chosen = pickGroupSubjectForTerm([only], termId, termId === 3 ? 41 : undefined, 41);
      return { termId, finalScore: chosen?.termGrades?.find(tg => tg.termId === termId)?.score ?? null };
    });
    expect(GradeCalculationService.calculateFinalScore(lapsos, null)).toBe(12);
  });
});
