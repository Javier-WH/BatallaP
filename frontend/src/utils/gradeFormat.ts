/**
 * Utility functions for formatting grades with optional rounding.
 * When rounding is enabled: 10.5 → 11, 10.24 → 10.2 (1 decimal)
 * When rounding is disabled: format to 2 decimals (current behavior)
 *
 * IMPORTANT: All rounding goes through roundGrade() to fix floating-point
 * precision errors (e.g. 15.499999999999998 → 15.5 → 16).
 * Mirrors the backend helper in services/gradeEvaluationService.ts.
 */

/**
 * Round a raw score fixing floating-point precision errors first.
 * e.g. 15.499999999999998 → toFixed(2) → "15.50" → 15.5 → Math.round → 16
 */
export function roundGrade(score: number | string | null | undefined): number {
  if (score === null || score === undefined) return 0;
  const n = Number(score);
  if (isNaN(n)) return 0;
  return Math.round(Number(n.toFixed(2)));
}

/**
 * Format a grade as a string with optional rounding.
 * @param grade - The grade value to format
 * @param enableRounding - Whether rounding is enabled
 * @returns Formatted grade string
 */
export function formatGrade(grade: number | null | undefined, _enableRounding: boolean): string {
  if (grade === null || grade === undefined) {
    return '-';
  }

  const numGrade = Number(grade);

  if (isNaN(numGrade)) {
    return '-';
  }

  return String(roundGrade(numGrade));
}

/**
 * Format a grade as a zero-padded string so it always has the same number of
 * digits as the maximum possible grade (e.g. maxGrade=20 → 2 digits, maxGrade=100 → 3 digits).
 * Minimum padding is 2 digits. A grade of 8 with maxGrade=20 → "08", with maxGrade=100 → "008".
 */
export function formatGradePadded(grade: number | null | undefined, maxGrade: number): string {
  if (grade === null || grade === undefined) {
    return '-';
  }

  const numGrade = Number(grade);

  if (isNaN(numGrade)) {
    return '-';
  }

  const digits = Math.max(2, String(maxGrade).length);
  return String(roundGrade(numGrade)).padStart(digits, '0');
}

/**
 * Format a grade as a number with optional rounding.
 * @param grade - The grade value to format
 * @param enableRounding - Whether rounding is enabled
 * @returns Formatted grade number
 */
export function formatGradeValue(grade: number | null | undefined, _enableRounding: boolean): number {
  if (grade === null || grade === undefined) {
    return 0;
  }

  const numGrade = Number(grade);

  if (isNaN(numGrade)) {
    return 0;
  }

  return roundGrade(numGrade);
}

/**
 * Whether a grade counts as passing. Grades are always displayed rounded, so the
 * pass/fail decision uses the same rounded value the user sees (a raw 9.5 shows
 * as "10" and therefore passes when the passing grade is 10). Mirrors the
 * backend helper `services/gradeEvaluationService.ts`.
 * @param grade - The raw grade value
 * @param passingGrade - The institution's minimum passing grade
 */
export function isPassingGrade(grade: number | null | undefined, passingGrade: number): boolean {
  if (grade === null || grade === undefined) {
    return false;
  }

  const numGrade = Number(grade);

  if (isNaN(numGrade)) {
    return false;
  }

  return roundGrade(numGrade) >= passingGrade;
}
