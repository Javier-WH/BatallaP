import { AcademicContextError, assertRequestedContext, AcademicContext } from '@/services/academicContextService';

const context: AcademicContext = {
  schoolPeriodId: 2,
  gradeId: 4,
  sectionId: 1,
  subjectId: 7,
  termId: 5,
  date: new Date('2026-01-10'),
  evaluationPlanId: 11,
  inscriptionId: 23,
  inscriptionSubjectId: 31,
};

describe('academicContextService', () => {
  it('accepts a matching academic context', () => {
    expect(() => assertRequestedContext(context, {
      schoolPeriodId: 2,
      gradeId: 4,
      sectionId: 1,
      subjectId: 7,
      termId: 5,
    })).not.toThrow();
  });

  it.each([
    ['schoolPeriodId', { schoolPeriodId: 1 }],
    ['gradeId', { gradeId: 3 }],
    ['sectionId', { sectionId: 2 }],
    ['subjectId', { subjectId: 8 }],
    ['termId', { termId: 4 }],
  ])('rejects a mismatched %s', (_field, requested) => {
    expect(() => assertRequestedContext(context, requested)).toThrow(AcademicContextError);
  });

  it('accepts a null section only when the resolved context also has no section', () => {
    expect(() => assertRequestedContext({ ...context, sectionId: null }, { sectionId: null })).not.toThrow();
    expect(() => assertRequestedContext(context, { sectionId: null })).toThrow(AcademicContextError);
  });
});
