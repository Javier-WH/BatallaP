/**
 * discountService — discounts and scholarships applied when the ledger is read.
 *
 * A discount is a RULE attached to an inscription (percent or fixed amount,
 * scope, optional from/to month), not a stored negative charge: percentages
 * therefore follow the fee amounts automatically when a new fee version
 * arrives. Rules stack; the total discount of a charge never exceeds its amount.
 *
 * Scope: 'mensualidad' | 'matricula' | 'todo' (= monthly + enrollment + admin
 * fees; sellable items and extraordinary debts are never discounted).
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
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const DISCOUNTABLE_TYPES = ['mensualidad', 'matricula', 'gastos_administrativos'];

const scopeMatches = (scope: DiscountScope, type: string) => {
  if (scope === 'todo') return DISCOUNTABLE_TYPES.includes(type);
  return scope === type;
};

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
    if (!rule.active || !scopeMatches(rule.appliesTo, charge.type) || !windowMatches(rule, charge.month, window)) continue;
    total += rule.kind === 'percent' ? (amount * Number(rule.value)) / 100 : Math.min(Number(rule.value), amount);
  }
  return round2(Math.min(total, amount));
}

export function applyDiscountsToCharges<T extends DiscountableCharge>(
  charges: T[],
  rules: DiscountRule[],
  window: BillingWindow
): { charges: Array<T & { discountAmount: number }>; grossCharged: number; totalDiscount: number; netCharged: number } {
  let gross = 0;
  let discount = 0;
  const annotated = charges.map(c => {
    const discountAmount = discountForCharge(c, rules, window);
    gross += Number(c.amount);
    discount += discountAmount;
    return { ...c, discountAmount };
  });
  return {
    charges: annotated,
    grossCharged: round2(gross),
    totalDiscount: round2(discount),
    netCharged: round2(gross - discount),
  };
}
