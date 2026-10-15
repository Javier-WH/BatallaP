export const MONTH_CODES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const MONTH_NAMES: Record<string, string> = {
  Jan: 'Enero', Feb: 'Febrero', Mar: 'Marzo', Apr: 'Abril',
  May: 'Mayo', Jun: 'Junio', Jul: 'Julio', Aug: 'Agosto',
  Sep: 'Septiembre', Oct: 'Octubre', Nov: 'Noviembre', Dec: 'Diciembre',
};

interface BillingWindow {
  billingStartMonth?: number | null;
  billingEndMonth?: number | null;
}

/** Ordered month codes billed by a period (mirrors backend billingCalendarService). */
export function billingMonthsOf(period?: BillingWindow | null): string[] {
  const start = period?.billingStartMonth ?? 9;
  const end = period?.billingEndMonth ?? 8;
  const months: string[] = [];
  let m = start;
  for (let i = 0; i < 12; i++) {
    months.push(MONTH_CODES[m - 1]);
    if (m === end) break;
    m = (m % 12) + 1;
  }
  return months;
}

export const billingMonthOptions = (period?: BillingWindow | null) =>
  billingMonthsOf(period).map(code => ({ value: code, label: MONTH_NAMES[code] }));
