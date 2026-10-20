/**
 * paymentAllocationService — splits one payment across the student's debts.
 *
 * A payment (in any currency) settles debts one by one in chronological order,
 * each debt in ITS OWN currency, at the rate of the payment date:
 *   Bs. 69,000, owing 40 EUR (enrollment) and 30 USD (uniform):
 *     → 40 EUR use Bs. 40,000 (EUR rate), the remaining Bs. 29,000 settle the 30 USD.
 * USD/USDT payments settle EUR debts 1:1 when the period accepts it (`usdAtPar`).
 *
 * Each (payment, charge) part is stored as a `PaymentAllocation` in the
 * charge's currency. Whatever exceeds every targeted debt stays on the last
 * debt as an excess (credit), so no money is lost.
 */
import { Transaction } from 'sequelize';
import { Charge, Payment, PaymentAllocation, SchoolPeriod } from '@/models/index';
import { getBillingMonths } from '@/services/billingCalendarService';
import { appliesAtPar } from '@/services/paymentRulesService';
import {
  loadNetCharges, makeRateResolver, paymentToVES, paymentDebtPeriodId, paymentBucketMonth, type RateResolver,
} from '@/services/debtBalanceService';

export type AllocationTarget =
  | { kind: 'auto' }
  | { kind: 'tuition' }
  | { kind: 'item'; chargeId?: number }
  | { kind: 'charge'; chargeId: number }
  | { kind: 'month'; periodId: number; month: string }
  | { kind: 'oneTime'; periodId: number };

/** Charges outside the academic plan: purchasable items and extraordinary debts. */
const EXTRA_TYPES = new Set(['item', 'otro']);

/** Inside enrollment: matrícula first, then gastos administrativos, then the bundled entry-month mensualidad, then anything else. */
const ENROLLMENT_RANK: Record<string, number> = { matricula: 0, gastos_administrativos: 1, mensualidad: 2 };

/**
 * Debt order inside a period, per the school:
 *   0. Inscripción — everything in the enrollment package (month-less academic debts):
 *      matrícula > gastos administrativos > bundled entry-month mensualidad > other.
 *   1. Sellable items and extraordinary debts ('otro'), by month.
 *   2. Mensualidades not included in the enrollment package, in calendar order.
 * Debts of an earlier school period always come before any current debt.
 */
const tierOf = (c: { month?: string | null; type?: string | null }) => {
  if (EXTRA_TYPES.has(c.type ?? '')) return 1;
  return c.month ? 2 : 0;
};

type SortKey = [number, number, number, number, number];

const cmpKey = (a: SortKey, b: SortKey) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3] || a[4] - b[4];

/**
 * Full debt-order key: [period startYear, tier, enrollment rank, month rank, charge id].
 * Month-less charges rank first inside their tier (the entry-month mensualidad is the
 * earliest installment); a month unknown to the billing calendar ranks last.
 */
const sortKeyOf = (
  c: { schoolPeriodId: number; month?: string | null; type?: string | null; id?: number },
  periodById: Map<number, SchoolPeriod>,
): SortKey => {
  let monthRank = -1;
  if (c.month) {
    const idx = (getBillingMonths(periodById.get(c.schoolPeriodId) ?? {}) as string[]).indexOf(c.month);
    monthRank = idx === -1 ? 99 : idx;
  }
  return [
    periodById.get(c.schoolPeriodId)?.startYear ?? 9999,
    tierOf(c),
    ENROLLMENT_RANK[c.type ?? ''] ?? 2,
    monthRank,
    c.id ?? 0,
  ];
};


export interface AllocationPart {
  chargeId: number;
  /** Credited to the charge, in the charge's currency. */
  amount: number;
  amountVES: number;
  currency: string;
  month: string | null;
  periodId: number;
  atPar: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const EPS = 0.005;

/**
 * Splits `payment` over the matching debts and stores the allocations.
 * Returns an empty list when no debt matches the target (the caller then keeps
 * the payment as a plain month-level record, as before).
 */
export async function distributePayment(
  payment: Payment,
  target: AllocationTarget,
  options: { transaction?: Transaction } = {}
): Promise<AllocationPart[]> {
  const { transaction } = options;
  const resolver = makeRateResolver(transaction);
  const payDate = payment.paymentDate;
  const rate = async (currency: string) => (await resolver.vesPerUnit(currency, payDate)) ?? 1;

  const ctx = await orderedContext(payment.inscriptionId, payment.id, transaction);
  if (!ctx) return [];
  const { ordered: allOrdered, periodById, remaining } = ctx;

  const matches = allOrdered.filter(({ charge: c }) => {
    switch (target.kind) {
      case 'charge': return c.id === target.chargeId;
      case 'item': return c.type === 'item';
      case 'tuition': return !EXTRA_TYPES.has(c.type ?? '');
      case 'month': return c.schoolPeriodId === target.periodId && c.month === target.month;
      case 'oneTime': return c.schoolPeriodId === target.periodId && !c.month;
      default: return true;
    }
  });
  if (matches.length === 0) return [];

  // A chosen item is settled first; any remainder flows to the other items.
  const ordered = target.kind === 'item' && target.chargeId
    ? [...matches].sort((a, b) => (a.charge.id === target.chargeId ? -1 : 0) - (b.charge.id === target.chargeId ? -1 : 0))
    : matches;

  const payRate = await rate(payment.currency);
  let units = Number(payment.amount); // left to place, in payment currency
  const parts: AllocationPart[] = [];
  let lastTouched: AllocationPart | null = null;

  const partFor = async (chargeId: number, atPar: boolean, currency: string, month: string | null, periodId: number): Promise<AllocationPart> => {
    let part = parts.find(p => p.chargeId === chargeId);
    if (!part) {
      part = { chargeId, amount: 0, amountVES: 0, currency, month, periodId, atPar };
      parts.push(part);
    }
    return part;
  };

  for (const { charge } of ordered) {
    if (units <= EPS) break;
    const rem = remaining.get(charge.id) ?? 0;
    if (rem <= EPS) continue;
    const par = appliesAtPar(payment.currency, charge.currency, !!periodById.get(charge.schoolPeriodId)?.usdAtPar);
    const chargeRate = await rate(charge.currency);
    // Payment units needed to settle `rem`: 1:1 for the same currency or at par, else through bolívares.
    const factor = payment.currency === charge.currency || par ? 1 : chargeRate / payRate;
    const cost = rem * factor;
    const applyAll = units >= cost - EPS;
    const apply = applyAll ? rem : round2(rem * (units / cost));
    const used = applyAll ? cost : units;

    const part = await partFor(charge.id, par, charge.currency, charge.month ?? null, charge.schoolPeriodId);
    part.amount += apply;
    part.amountVES += apply * chargeRate;
    lastTouched = part;
    units -= used;
    remaining.set(charge.id, rem - apply);
  }

  // Whatever is left over exceeds every targeted debt: keep it as an excess on the last touched debt
  // (or on the last debt of the target when nothing was owed).
  if (units > EPS) {
    const lastCharge = ordered[ordered.length - 1].charge;
    const part = lastTouched ?? await partFor(
      lastCharge.id,
      appliesAtPar(payment.currency, lastCharge.currency, !!periodById.get(lastCharge.schoolPeriodId)?.usdAtPar),
      lastCharge.currency, lastCharge.month ?? null, lastCharge.schoolPeriodId,
    );
    const charge = ordered.find(o => o.charge.id === part.chargeId)!.charge;
    const chargeRate = await rate(charge.currency);
    const factor = payment.currency === charge.currency || part.atPar ? 1 : chargeRate / payRate;
    const extra = units / factor;
    part.amount += extra;
    part.amountVES += extra * chargeRate;
  }

  const final = parts
    .map(p => ({ ...p, amount: round2(p.amount), amountVES: round2(p.amountVES) }))
    .filter(p => p.amount > 0);
  if (final.length > 0) {
    await PaymentAllocation.bulkCreate(
      final.map(p => ({ paymentId: payment.id, chargeId: p.chargeId, amount: p.amount, amountVES: p.amountVES })),
      { transaction },
    );
  }
  return final;
}

/**
 * Pending amount of each charge in its own currency: net of discounts, minus
 * allocations of other payments, minus legacy (allocation-less) payments of its
 * month, which settle the month's charges oldest first.
 */
async function remainingByCharge(
  inscriptionId: number,
  net: Awaited<ReturnType<typeof loadNetCharges>>,
  excludePaymentId: number,
  resolver: RateResolver,
  transaction?: Transaction,
): Promise<Map<number, number>> {
  const payments = await Payment.findAll({
    where: { inscriptionId },
    include: [
      { model: PaymentAllocation, as: 'allocations', attributes: ['id', 'chargeId', 'amount'] },
      { model: Charge, as: 'charge', attributes: ['id', 'month'] },
    ],
    transaction,
  });

  const allocated = new Map<number, number>();
  const legacyCreditVES = new Map<string, number>();
  for (const p of payments as any[]) {
    if (p.id === excludePaymentId) continue;
    if (p.allocations?.length) {
      for (const a of p.allocations) allocated.set(a.chargeId, (allocated.get(a.chargeId) ?? 0) + Number(a.amount));
    } else {
      const key = `${paymentDebtPeriodId(p)}|${paymentBucketMonth(p) ?? ''}`;
      legacyCreditVES.set(key, (legacyCreditVES.get(key) ?? 0) + await paymentToVES(p, resolver));
    }
  }

  const today = new Date();
  const out = new Map<number, number>();
  for (const { charge, net: netAmount } of net) {
    let rem = netAmount - (allocated.get(charge.id) ?? 0);
    const key = `${charge.schoolPeriodId}|${charge.month ?? ''}`;
    const credit = legacyCreditVES.get(key) ?? 0;
    if (credit > EPS && rem > EPS) {
      const r = (await resolver.vesPerUnit(charge.currency, today)) ?? 1;
      const take = Math.min(credit, rem * r);
      rem -= take / r;
      legacyCreditVES.set(key, credit - take);
    }
    out.set(charge.id, Math.max(round2(rem), 0));
  }
  return out;
}

/** Active charges of an inscription with their net amount and what is still unpaid (each in its own currency). */
export async function pendingByCharge(
  inscriptionId: number,
  transaction?: Transaction,
): Promise<Array<{ charge: Charge; net: number; remaining: number }>> {
  const ctx = await orderedContext(inscriptionId, -1, transaction);
  if (!ctx) return [];
  return ctx.ordered.map(o => ({ charge: o.charge, net: o.net, remaining: ctx.remaining.get(o.charge.id) ?? 0 }));
}

// ── Order enforcement ──

interface OrderedContext {
  /** Every active charge (net of discounts), oldest debt first. */
  ordered: Awaited<ReturnType<typeof loadNetCharges>>;
  periodById: Map<number, SchoolPeriod>;
  remaining: Map<number, number>;
}

/** Debt order: earlier period first; inside a period — enrollment (matrícula > gastos), then items/'otro', then mensualidades. */
async function orderedContext(
  inscriptionId: number,
  excludePaymentId: number,
  transaction?: Transaction,
): Promise<OrderedContext | null> {
  const all = await loadNetCharges(inscriptionId, transaction);
  if (all.length === 0) return null;
  const periodIds = [...new Set(all.map(n => n.charge.schoolPeriodId))];
  const periods = await SchoolPeriod.findAll({ where: { id: periodIds }, transaction });
  const periodById = new Map(periods.map(p => [p.id, p]));
  const resolver = makeRateResolver(transaction);
  const remaining = await remainingByCharge(inscriptionId, all, excludePaymentId, resolver, transaction);

  const ordered = [...all].sort((a, b) => cmpKey(sortKeyOf(a.charge, periodById), sortKeyOf(b.charge, periodById)));
  return { ordered, periodById, remaining };
}

export interface BlockingDebt {
  description: string;
  amount: number;
  currency: string;
}

/**
 * Whether a payment aimed at `target` respects the debt order. A payment may
 * only go to a debt when every earlier debt is already settled — otherwise it
 * returns the unpaid debts that come first (up to 3).
 */
export async function checkTargetOrder(
  inscriptionId: number,
  target: AllocationTarget,
  excludePaymentId = -1,
  transaction?: Transaction,
): Promise<{ ok: boolean; blocking: BlockingDebt[] }> {
  // auto and tuition follow the order by construction; item payments are a direct
  // purchase and may go straight to the item even with other debts pending.
  if (target.kind !== 'charge' && target.kind !== 'month' && target.kind !== 'oneTime') {
    return { ok: true, blocking: [] };
  }
  const ctx = await orderedContext(inscriptionId, excludePaymentId, transaction);
  if (!ctx) return { ok: true, blocking: [] };
  const { ordered, periodById, remaining } = ctx;

  const sortKey = (c: { schoolPeriodId: number; month?: string | null; type?: string | null; id?: number }) => sortKeyOf(c, periodById);

  // The target's position in the order (its earliest matching charge, or its sort key).
  let targetKey: SortKey | null = null;
  if (target.kind === 'charge') {
    const hit = ordered.find(o => o.charge.id === target.chargeId);
    if (!hit) {
      // The target charge does not exist (or is inactive): the caller falls back to a
      // plain record — still ordered, so allow it.
      return { ok: true, blocking: [] };
    }
    // Sellable items may be paid directly, regardless of earlier debts.
    if (hit.charge.type === 'item') return { ok: true, blocking: [] };
    targetKey = sortKey(hit.charge);
  } else {
    const period = periodById.get(target.periodId);
    const startYear = period?.startYear ?? 9999;
    if (target.kind === 'oneTime') {
      const first = ordered.find(o => o.charge.schoolPeriodId === target.periodId && !o.charge.month);
      targetKey = first ? sortKey(first.charge) : [startYear, 0, 0, -1, 0];
    } else {
      const rank = (getBillingMonths(period ?? {}) as string[]).indexOf(target.month);
      targetKey = [startYear, 2, 0, rank === -1 ? 99 : rank, 0];
      const first = ordered.find(o => o.charge.schoolPeriodId === target.periodId && o.charge.month === target.month);
      if (first) targetKey = sortKey(first.charge);
    }
  }

  const blocking: BlockingDebt[] = [];
  for (const { charge } of ordered) {
    const rem = remaining.get(charge.id) ?? 0;
    if (rem <= EPS) continue;
    if (cmpKey(sortKey(charge), targetKey) < 0) {
      blocking.push({ description: charge.description ?? charge.type, amount: round2(rem), currency: charge.currency });
      if (blocking.length >= 3) break;
    } else break; // reached the target's position — earlier ones were all settled
  }
  return { ok: blocking.length === 0, blocking };
}
