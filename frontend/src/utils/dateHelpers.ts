import dayjs, { Dayjs } from 'dayjs';

/**
 * Parse a "YYYY-MM-DD" date string as a local date (not UTC).
 *
 * dayjs("2010-05-15") interprets the string as UTC midnight, which shifts the
 * date back by one day in negative timezones. By appending "T00:00:00" we force
 * dayjs to interpret it as local time, preserving the correct day.
 *
 * Use this for any date-only field coming from the backend (birthdate, hireDate, etc.).
 */
export function parseDateLocal(date: string | null | undefined): Dayjs | null {
  if (!date) return null;
  // If already includes time, parse as-is
  if (typeof date === 'string' && date.includes('T')) {
    return dayjs(date);
  }
  return dayjs(date + 'T00:00:00');
}
