import {
  getBillingMonths,
  monthCodeFromDate,
  resolveEntryMonth,
  chargeableMonthsFrom,
  compareBillingMonths,
  entryMonthForDate,
} from '@/services/billingCalendarService';

describe('billingCalendarService', () => {
  const period = { billingStartMonth: 9, billingEndMonth: 8 };

  it('lists the 12 months Sep→Aug by default', () => {
    expect(getBillingMonths(period)).toEqual([
      'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug',
    ]);
  });

  it('supports a custom window (Oct→Jul)', () => {
    expect(getBillingMonths({ billingStartMonth: 10, billingEndMonth: 7 })).toEqual([
      'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul',
    ]);
  });

  it('falls back to Sep→Aug when the period has no configuration', () => {
    expect(getBillingMonths({})).toHaveLength(12);
    expect(getBillingMonths({})[0]).toBe('Sep');
  });

  it('maps a date to its month code', () => {
    expect(monthCodeFromDate(new Date(2026, 0, 15))).toBe('Jan');
    expect(monthCodeFromDate(new Date(2026, 8, 1))).toBe('Sep');
  });

  it('clamps the entry month into the billing window', () => {
    expect(resolveEntryMonth(period, 'Jan')).toBe('Jan');
    // Before the window start (e.g. enrolling in July for a Sep→Aug period) → first month
    expect(resolveEntryMonth({ billingStartMonth: 9, billingEndMonth: 6 }, 'Jul')).toBe('Sep');
    expect(resolveEntryMonth(period, null)).toBe('Sep');
    expect(resolveEntryMonth(period, undefined)).toBe('Sep');
  });

  it('computes monthly charges: Sep start → 11 months (first covered by enrollment)', () => {
    const months = chargeableMonthsFrom(period, 'Sep');
    expect(months).toHaveLength(11);
    expect(months[0]).toBe('Oct');
    expect(months[months.length - 1]).toBe('Aug');
  });

  it('computes monthly charges: Jan start → 7 months', () => {
    const months = chargeableMonthsFrom(period, 'Jan');
    expect(months).toEqual(['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']);
  });

  it('entering in the last month yields no monthly charges', () => {
    expect(chargeableMonthsFrom(period, 'Aug')).toEqual([]);
  });

  describe('entryMonthForDate', () => {
    const p = { startYear: 2026, endYear: 2027, billingStartMonth: 9, billingEndMonth: 8 };

    it('uses the month of the date when it falls inside the window', () => {
      expect(entryMonthForDate(p, new Date(2027, 0, 20))).toBe('Jan');
      expect(entryMonthForDate(p, new Date(2026, 8, 1))).toBe('Sep');
    });

    it('a date before the period starts (e.g. July, promotion at closure) enters at the first month', () => {
      expect(entryMonthForDate(p, new Date(2026, 6, 10))).toBe('Sep');
    });

    it('a date after the window ends enters at the last month (no monthly charges)', () => {
      expect(entryMonthForDate(p, new Date(2027, 9, 5))).toBe('Aug');
    });

    it('handles non-wrapping windows (Jan→Jun, all in the end year)', () => {
      const q = { startYear: 2026, endYear: 2027, billingStartMonth: 1, billingEndMonth: 6 };
      expect(entryMonthForDate(q, new Date(2027, 2, 1))).toBe('Mar');
      expect(entryMonthForDate(q, new Date(2026, 10, 1))).toBe('Jan');
    });
  });

  it('compares months in billing-calendar order', () => {
    expect(compareBillingMonths(period, 'Sep', 'Jan')).toBeLessThan(0);
    expect(compareBillingMonths(period, 'Aug', 'Sep')).toBeGreaterThan(0);
    expect(compareBillingMonths(period, 'Mar', 'Mar')).toBe(0);
  });
});
