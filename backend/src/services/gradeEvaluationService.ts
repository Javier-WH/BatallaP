/**
 * Single source of truth for deciding whether a grade is passing or failing.
 *
 * Grades are always DISPLAYED rounded to the nearest integer (see the frontend
 * helper `utils/gradeFormat.ts`). To keep the UI consistent with the persisted
 * academic status, the pass/fail decision must be taken on the SAME rounded
 * value the user sees: a raw score of 9.5 is shown as "10" and therefore counts
 * as passing when the passing grade is 10.
 */

export type GradeStatus = 'aprobada' | 'reprobada';

/** Rounds a raw score to the value shown in the UI and stored reports. */
export function roundGrade(score: number): number {
  return Math.round(score);
}

/** Minimum allowed final grade. Even if all evaluations are 0, the definitive is at least 1. */
export const MIN_FINAL_GRADE = 1;

/** Rounds a raw score and enforces the minimum final grade (01). */
export function roundFinalGrade(score: number): number {
  return Math.max(MIN_FINAL_GRADE, roundGrade(score));
}

/** True when the rounded score reaches the passing grade. */
export function isPassingGrade(score: number, passingGrade: number): boolean {
  return roundGrade(score) >= passingGrade;
}

/** Resolves the academic status of a score against the passing grade. */
export function resolveGradeStatus(score: number, passingGrade: number): GradeStatus {
  return isPassingGrade(score, passingGrade) ? 'aprobada' : 'reprobada';
}
