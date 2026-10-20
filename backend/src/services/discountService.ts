/**
 * discountService — discounts and scholarships applied when the ledger is read.
 *
 * A discount is a RULE attached to an inscription (percent or fixed amount,
 * scope, optional from/to month), not a stored negative charge: percentages
 * therefore follow the fee amounts automatically when a new fee version
 * arrives. Rules stack; the total discount of a charge never exceeds its amount.
 *
 * Scope: 'mensualidad' | 'matricula' | 'todo'.
 *   - 'matricula' ("Solo inscripción") = the whole ENROLLMENT PACKAGE: the
 *     month-less matrícula, gastos administrativos and the entry-month
 *     mensualidad that comes bundled with the enrollment plan. A FIXED amount
 *     there is one total spread over the package in that order (a 70 discount
 *     on a 55 matrícula takes 55 from it and 15 from the next charge).
 *     A percent applies to each package charge.
 *   - 'todo' = monthly + enrollment + admin fees, rule applied to every charge.
 * Sellable items and extraordinary debts are never discounted.
 * One-time charges (no month) are discounted only by rules valid from the start.
 */
import { BillingWindow, getBillingMonths } from '@/services/billingCalendarService';

export type DiscountKind = 'percent' | 'fixed';
export type DiscountScope = 'mensualidad' | 'matricula' | 'todo';

export interface DiscountRule {
  id: number;
  kind: DiscountKind;
  value: number;
  appliesTo: DiscountScope;
  fromMonth: string | null;
  toMonth: string | null;
  active: boolean;
}

export interface DiscountableCharge {
  id: number;
  type: string;
  month: string | null;
  amount: number;
  currency?: string;
  schoolPeriodId?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const DISCOUNTABLE_TYPES = ['mensualidad', 'matricula', 'gastos_administrativos'];

/** Enrollment package order: the month-less plan charges, matrícula first. */
const PACKAGE_ORDER: Record<string, number> = { matricula: 0, gastos_administrativos: 1, mensualidad: 2 };
const isPackageCharge = (c: { type: string; month: string | null }) => !c.month && c.type in PACKAGE_ORDER;

const scopeMatches = (scope: DiscountScope, charge: { type: string; month: string | null }) => {
  if (scope === 'todo') return DISCOUNTABLE_TYPES.includes(charge.type);
  if (scope === 'matricula') return isPackageCharge(charge);
  return scope === charge.type;
};

/** A fixed "Solo inscripción" rule is a single pool shared by the package, not a per-charge amount. */
const isPooledRule = (r: DiscountRule) => r.kind === 'fixed' && r.appliesTo === 'matricula';

const windowMatches = (rule: DiscountRule, month: string | null, window: BillingWindow) => {
  if (!month) return rule.fromMonth == null; // one-time charge: only discounts valid from the start
  const months = getBillingMonths(window) as string[];
  const idx = months.indexOf(month);
  if (idx < 0) return false;
  const from = rule.fromMonth ? Math.max(months.indexOf(rule.fromMonth), 0) : 0;
  const to = rule.toMonth ? months.indexOf(rule.toMonth) : months.length - 1;
  return idx >= from && idx <= (to < 0 ? months.length - 1 : to);
};

export function discountForCharge(charge: DiscountableCharge, rules: DiscountRule[], window: BillingWindow): number {
  const amount = Number(charge.amount);
  let total = 0;
  for (const rule of rules) {
    if (!rule.active || !scopeMatches(rule.appliesTo, charge) || !windowMatches(rule, charge.month, window)) continue;
    total += rule.kind === 'percent' ? (amount * Number(rule.value)) / 100 : Math.min(Number(rule.value), amount);
  }
  return round2(Math.min(total, amount));
}

/**
 * Annotates every charge with its discount. Fixed "Solo inscripción" rules are
 * pooled: the amount is spread over the package charges of `poolPeriodId`
 * (all periods when omitted) that share the currency of the first one.
 * Pooled rules fill whatever room the other rules left on each charge.
 */
export function applyDiscountsToCharges<T extends DiscountableCharge>(
  charges: T[],
  rules: DiscountRule[],
  window: BillingWindow,
  options: { poolPeriodId?: number } = {}
): { charges: Array<T & { discountAmount: number }>; grossCharged: number; totalDiscount: number; netCharged: number } {
  const perCharge = rules.filter(r => !isPooledRule(r));
  const annotated = charges.map(c => ({ ...c, discountAmount: discountForCharge(c, perCharge, window) }));

  for (const rule of rules.filter(r => r.active && isPooledRule(r))) {
    if (!windowMatches(rule, null, window)) continue;
    const pkg = annotated
      .filter(c => isPackageCharge(c) && (options.poolPeriodId == null || c.schoolPeriodId === options.poolPeriodId))
      .sort((a, b) => (PACKAGE_ORDER[a.type] - PACKAGE_ORDER[b.type]) || (a.id - b.id));
    if (pkg.length === 0) continue;
    const currency = pkg[0].currency;
    let left = Number(rule.value);
    for (const c of pkg) {
      if (left <= 0) break;
      if (c.currency !== currency) continue;
      const take = Math.min(left, Number(c.amount) - c.discountAmount);
      if (take <= 0) continue;
      c.discountAmount = round2(c.discountAmount + take);
      left -= take;
    }
  }

  const gross = annotated.reduce((sum, c) => sum + Number(c.amount), 0);
  const discount = annotated.reduce((sum, c) => sum + c.discountAmount, 0);
  return {
    charges: annotated,
    grossCharged: round2(gross),
    totalDiscount: round2(discount),
    netCharged: round2(gross - discount),
  };
}
