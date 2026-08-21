/**
 * Utility functions for formatting grades with optional rounding.
 * When rounding is enabled: 10.5 → 11, 10.24 → 10.2 (1 decimal)
 * When rounding is disabled: format to 2 decimals (current behavior)
 */

/**
 * Format a grade as a string with optional rounding.
 * @param grade - The grade value to format
 * @param enableRounding - Whether rounding is enabled
 * @returns Formatted grade string
 */
export function formatGrade(grade: number | null | undefined, enableRounding: boolean): string {
  if (grade === null || grade === undefined) {
    return '-';
  }

  const numGrade = Number(grade);

  if (isNaN(numGrade)) {
    return '-';
  }

  return String(Math.round(numGrade));
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
  return String(Math.round(numGrade)).padStart(digits, '0');
}

/**
 * Format a grade as a number with optional rounding.
 * @param grade - The grade value to format
 * @param enableRounding - Whether rounding is enabled
 * @returns Formatted grade number
 */
export function formatGradeValue(grade: number | null | undefined, enableRounding: boolean): number {
  if (grade === null || grade === undefined) {
    return 0;
  }

  const numGrade = Number(grade);

  if (isNaN(numGrade)) {
    return 0;
  }

  return Math.round(numGrade);
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

  return Math.round(numGrade) >= passingGrade;
}
