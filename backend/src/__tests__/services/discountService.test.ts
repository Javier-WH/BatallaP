import { discountForCharge, applyDiscountsToCharges, DiscountRule } from '@/services/discountService';

const window = { billingStartMonth: 9, billingEndMonth: 8 };
const rule = (over: Partial<DiscountRule> = {}): DiscountRule => ({
  id: 1, kind: 'percent', value: 10, appliesTo: 'todo', fromMonth: null, toMonth: null, active: true, ...over,
});
const monthly = (month: string, amount = 100) => ({ id: 1, type: 'mensualidad', month, amount });
const enrollment = (amount = 100) => ({ id: 2, type: 'matricula', month: null, amount });

describe('discountForCharge', () => {
  it('percent discount on a charge', () => {
    expect(discountForCharge(monthly('Oct', 55), [rule({ value: 50 })], window)).toBe(27.5);
  });

  it('fixed discount is capped at the charge amount', () => {
    expect(discountForCharge(monthly('Oct', 55), [rule({ kind: 'fixed', value: 10 })], window)).toBe(10);
    expect(discountForCharge(monthly('Oct', 5), [rule({ kind: 'fixed', value: 10 })], window)).toBe(5);
  });

  it('respects the appliesTo scope', () => {
    const onlyMonthly = rule({ appliesTo: 'mensualidad' });
    expect(discountForCharge(monthly('Oct'), [onlyMonthly], window)).toBe(10);
    expect(discountForCharge(enrollment(), [onlyMonthly], window)).toBe(0);

    const onlyEnrollment = rule({ appliesTo: 'matricula' });
    expect(discountForCharge(enrollment(), [onlyEnrollment], window)).toBe(10);
    expect(discountForCharge(monthly('Oct'), [onlyEnrollment], window)).toBe(0);
  });

  it("'todo' covers monthly, enrollment and admin fees but not sellable items or extraordinary debts", () => {
    const all = rule();
    expect(discountForCharge({ id: 3, type: 'gastos_administrativos', month: null, amount: 100 }, [all], window)).toBe(10);
    expect(discountForCharge({ id: 4, type: 'item', month: null, amount: 100 }, [all], window)).toBe(0);
    expect(discountForCharge({ id: 5, type: 'otro', month: null, amount: 100 }, [all], window)).toBe(0);
  });

  it('applies only within the from/to month window (calendar order)', () => {
    const r = rule({ fromMonth: 'Jan', toMonth: 'Mar' });
    expect(discountForCharge(monthly('Dec'), [r], window)).toBe(0);
    expect(discountForCharge(monthly('Jan'), [r], window)).toBe(10);
    expect(discountForCharge(monthly('Mar'), [r], window)).toBe(10);
    expect(discountForCharge(monthly('Apr'), [r], window)).toBe(0);
  });

  it('open-ended windows: only fromMonth / only toMonth', () => {
    expect(discountForCharge(monthly('Aug'), [rule({ fromMonth: 'Mar' })], window)).toBe(10);
    expect(discountForCharge(monthly('Feb'), [rule({ fromMonth: 'Mar' })], window)).toBe(0);
    expect(discountForCharge(monthly('Oct'), [rule({ toMonth: 'Dec' })], window)).toBe(10);
    expect(discountForCharge(monthly('Jan'), [rule({ toMonth: 'Dec' })], window)).toBe(0);
  });

  it('one-time charges are discounted only by rules with no fromMonth (valid from the start)', () => {
    expect(discountForCharge(enrollment(), [rule({ fromMonth: null })], window)).toBe(10);
    expect(discountForCharge(enrollment(), [rule({ fromMonth: 'Mar' })], window)).toBe(0);
  });

  it('stacks several rules but never exceeds the charge amount', () => {
    const rules = [rule({ id: 1, value: 10 }), rule({ id: 2, kind: 'fixed', value: 15 })];
    expect(discountForCharge(monthly('Oct', 100), rules, window)).toBe(25);
    const big = [rule({ id: 1, value: 80 }), rule({ id: 2, value: 80 })];
    expect(discountForCharge(monthly('Oct', 100), big, window)).toBe(100);
  });

  it('ignores inactive rules', () => {
    expect(discountForCharge(monthly('Oct'), [rule({ active: false })], window)).toBe(0);
  });

  it('rounds to cents', () => {
    expect(discountForCharge(monthly('Oct', 33.33), [rule({ value: 10 })], window)).toBe(3.33);
  });
});

describe("'Solo inscripción' covers the whole enrollment package", () => {
  const pkg = () => [
    { id: 1, type: 'mensualidad', month: null, amount: 55, currency: 'EUR', schoolPeriodId: 1 },
    { id: 2, type: 'matricula', month: null, amount: 55, currency: 'EUR', schoolPeriodId: 1 },
    { id: 3, type: 'gastos_administrativos', month: null, amount: 55, currency: 'EUR', schoolPeriodId: 1 },
    { id: 4, type: 'mensualidad', month: 'Oct', amount: 55, currency: 'USD', schoolPeriodId: 1 },
    { id: 5, type: 'item', month: null, amount: 20, currency: 'USD', schoolPeriodId: 1 },
  ];
  const byId = (res: ReturnType<typeof applyDiscountsToCharges>) => Object.fromEntries(res.charges.map(c => [c.id, c.discountAmount]));

  it('a fixed amount is one total spread matrícula → gastos → entry mensualidad', () => {
    const res = applyDiscountsToCharges(pkg(), [rule({ kind: 'fixed', value: 70, appliesTo: 'matricula' })], window);
    expect(byId(res)).toEqual({ 1: 0, 2: 55, 3: 15, 4: 0, 5: 0 });
    expect(res.totalDiscount).toBe(70);
  });

  it('a fixed amount larger than the package is capped at the package total', () => {
    const res = applyDiscountsToCharges(pkg(), [rule({ kind: 'fixed', value: 500, appliesTo: 'matricula' })], window);
    expect(res.totalDiscount).toBe(165);
    expect(byId(res)[4]).toBe(0);
  });

  it('a percent applies to every package charge, not to monthly installments or items', () => {
    const res = applyDiscountsToCharges(pkg(), [rule({ value: 10, appliesTo: 'matricula' })], window);
    expect(byId(res)).toEqual({ 1: 5.5, 2: 5.5, 3: 5.5, 4: 0, 5: 0 });
  });

  it('only pools charges of the inscription period and of the first charge currency', () => {
    const charges = [
      ...pkg(),
      { id: 6, type: 'matricula', month: null, amount: 55, currency: 'EUR', schoolPeriodId: 0 },
      { id: 7, type: 'gastos_administrativos', month: null, amount: 30, currency: 'USD', schoolPeriodId: 1 },
    ];
    const res = applyDiscountsToCharges(charges, [rule({ kind: 'fixed', value: 200, appliesTo: 'matricula' })], window, { poolPeriodId: 1 });
    const d = byId(res);
    expect(d[6]).toBe(0); // other period untouched
    expect(d[7]).toBe(0); // other currency untouched
    expect(d[2] + d[3] + d[1]).toBe(165);
  });

  it('fills only the room left by other rules', () => {
    const res = applyDiscountsToCharges(pkg(), [
      rule({ id: 1, value: 100, appliesTo: 'matricula' }),
      rule({ id: 2, kind: 'fixed', value: 60, appliesTo: 'matricula' }),
    ], window);
    // percent 100 already wipes every package charge — the pool finds no room
    expect(res.totalDiscount).toBe(165);
  });
});

describe('applyDiscountsToCharges', () => {
  it('annotates each charge with its discount and returns totals', () => {
    const charges = [monthly('Oct', 100), monthly('Nov', 100), enrollment(200)];
    const res = applyDiscountsToCharges(charges, [rule({ value: 10 })], window);
    expect(res.charges.map(c => c.discountAmount)).toEqual([10, 10, 20]);
    expect(res.totalDiscount).toBe(40);
    expect(res.grossCharged).toBe(400);
    expect(res.netCharged).toBe(360);
  });
});
