/**
 * billingCalendarService — month calendar used to bill a school period.
 *
 * A period bills the months from `billingStartMonth` to `billingEndMonth`
 * (1–12, wrapping over the new year). Defaults: September → August.
 * Month codes ('Sep', 'Oct', …) are the ones stored in `Charge.month`.
 */

export const MONTH_CODES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export type MonthCode = (typeof MONTH_CODES)[number];

export const DEFAULT_BILLING_START_MONTH = 9;
export const DEFAULT_BILLING_END_MONTH = 8;

export interface BillingWindow {
  billingStartMonth?: number | null;
  billingEndMonth?: number | null;
}

/** Ordered month codes billed by the period (start → end, wrapping the year). */
export function getBillingMonths(period: BillingWindow): MonthCode[] {
  const start = period.billingStartMonth ?? DEFAULT_BILLING_START_MONTH;
  const end = period.billingEndMonth ?? DEFAULT_BILLING_END_MONTH;
  const months: MonthCode[] = [];
  let m = start;
  for (let i = 0; i < 12; i++) {
    months.push(MONTH_CODES[m - 1]);
    if (m === end) break;
    m = (m % 12) + 1;
  }
  return months;
}

export function monthCodeFromDate(date: Date): MonthCode {
  return MONTH_CODES[date.getMonth()];
}

/** Entry month inside the billing window; anything outside (or missing) → first month. */
export function resolveEntryMonth(period: BillingWindow, entry?: string | null): MonthCode {
  const months = getBillingMonths(period);
  return months.includes(entry as MonthCode) ? (entry as MonthCode) : months[0];
}

/**
 * Entry month for a student enrolling on `date`: the month of the date when it
 * falls inside the period's billing window; before the window starts (e.g.
 * promotions created at closure, in July) → first month; after it ends → last.
 */
export function entryMonthForDate(
  period: BillingWindow & { startYear?: number | null; endYear?: number | null },
  date: Date = new Date()
): MonthCode {
  const months = getBillingMonths(period);
  const start = period.billingStartMonth ?? DEFAULT_BILLING_START_MONTH;
  const end = period.billingEndMonth ?? DEFAULT_BILLING_END_MONTH;
  if (period.startYear != null && period.endYear != null) {
    const wraps = start > end;
    const windowStart = new Date(wraps ? period.startYear : period.endYear, start - 1, 1);
    const windowEnd = new Date(period.endYear, end, 0, 23, 59, 59);
    if (date < windowStart) return months[0];
    if (date > windowEnd) return months[months.length - 1];
  }
  return resolveEntryMonth(period, monthCodeFromDate(date));
}

/**
 * Months that get a monthly charge for a student entering in `entryMonth`:
 * every month after the entry month up to the end of the window (the entry
 * month itself is covered by the enrollment fee).
 */
export function chargeableMonthsFrom(period: BillingWindow, entry?: string | null): MonthCode[] {
  const months = getBillingMonths(period);
  return months.slice(months.indexOf(resolveEntryMonth(period, entry)) + 1);
}

/** Sort comparator following the billing calendar order. */
export function compareBillingMonths(period: BillingWindow, a: string, b: string): number {
  const months = getBillingMonths(period) as string[];
  return months.indexOf(a) - months.indexOf(b);
}
