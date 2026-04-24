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

  if (enableRounding) {
    // Round to 1 decimal using standard rounding (10.5 → 11, 10.24 → 10.2)
    const rounded = Math.round(numGrade * 10) / 10;
    // Format to 1 decimal place
    return rounded.toFixed(1);
  } else {
    // Format to 2 decimals (current behavior)
    return numGrade.toFixed(2);
  }
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

  if (enableRounding) {
    // Round to 1 decimal using standard rounding (10.5 → 11, 10.24 → 10.2)
    return Math.round(numGrade * 10) / 10;
  } else {
    // Return original value
    return numGrade;
  }
}
