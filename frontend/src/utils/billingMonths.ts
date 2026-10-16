export const MONTH_CODES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const MONTH_FULL: Record<string, string> = {
  Sep: 'Septiembre', Oct: 'Octubre', Nov: 'Noviembre', Dec: 'Diciembre',
  Jan: 'Enero', Feb: 'Febrero', Mar: 'Marzo', Apr: 'Abril',
  May: 'Mayo', Jun: 'Junio', Jul: 'Julio', Aug: 'Agosto',
};

/** Billing months of a period (billingStartMonth→billingEndMonth, wrapping the year; default Sep→Aug). */
export function billingMonthsOf(period: { billingStartMonth?: number | null; billingEndMonth?: number | null } | null | undefined): string[] {
  const start = period?.billingStartMonth ?? 9;
  const end = period?.billingEndMonth ?? 8;
  const out: string[] = [];
  let m = start;
  for (let i = 0; i < 12; i++) {
    out.push(MONTH_CODES[m - 1]);
    if (m === end) break;
    m = (m % 12) + 1;
  }
  return out;
}

export const MONTH_NAMES = MONTH_FULL;

/** Select options for a period's billing months. */
export function billingMonthOptions(period: { billingStartMonth?: number | null; billingEndMonth?: number | null } | null | undefined): { value: string; label: string }[] {
  return billingMonthsOf(period).map(m => ({ value: m, label: MONTH_FULL[m] ?? m }));
}
