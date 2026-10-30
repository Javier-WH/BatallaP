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
import { findActiveCurrencyDiscount, chargesWithFixedBonus, settleCharge, type ActiveCurrencyDiscount } from '@/services/currencyDiscountService';
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
  /** Part of `amount` granted by a currency discount (not paid in cash). */
  bonus: number;
  currencyDiscountId: number | null;
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
  options: {
    transaction?: Transaction;
    /** Place only this many payment units (default: the whole payment). */
    units?: number;
    /** Count the payment's existing allocations as already placed and add to them. */
    keepExisting?: boolean;
    /** Never park an excess on a debt: report it in `out.leftover` instead. */
    noExcess?: boolean;
    out?: { leftover: number };
  } = {}
): Promise<AllocationPart[]> {
  const { transaction } = options;
  const resolver = makeRateResolver(transaction);
  const payDate = payment.paymentDate;
  const rate = async (currency: string) => (await resolver.vesPerUnit(currency, payDate)) ?? 1;

  const ctx = await orderedContext(payment.inscriptionId, options.keepExisting ? -1 : payment.id, transaction);
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
  let units = options.units ?? Number(payment.amount); // left to place, in payment currency
  const parts: AllocationPart[] = [];
  let lastTouched: AllocationPart | null = null;
  const discount = await findActiveCurrencyDiscount(payment.schoolPeriodId, payment.currency, payDate, transaction);
  const fixedGiven = discount?.kind === 'fixed'
    ? await chargesWithFixedBonus(discount.id, ordered.map(o => o.charge.id), options.keepExisting ? -1 : payment.id, transaction)
    : new Set<number>();

  const partFor = async (chargeId: number, atPar: boolean, currency: string, month: string | null, periodId: number): Promise<AllocationPart> => {
    let part = parts.find(p => p.chargeId === chargeId);
    if (!part) {
      part = { chargeId, amount: 0, amountVES: 0, currency, month, periodId, atPar, bonus: 0, currencyDiscountId: null };
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
    const { apply, used, bonus } = settleCharge({ rem, units, factor, discount, fixedAlready: fixedGiven.has(charge.id) });

    const part = await partFor(charge.id, par, charge.currency, charge.month ?? null, charge.schoolPeriodId);
    part.amount += apply;
    part.amountVES += (apply - bonus) * chargeRate;
    if (bonus > EPS && discount) {
      part.bonus += bonus;
      part.currencyDiscountId = discount.id;
      if (discount.kind === 'fixed') fixedGiven.add(charge.id);
    }
    lastTouched = part;
    units -= used;
    remaining.set(charge.id, rem - apply);
  }

  // Whatever is left over exceeds every targeted debt: keep it as an excess on the last touched debt
  // (or on the last debt of the target when nothing was owed).
  if (options.out) options.out.leftover = units > EPS ? units : 0;
  if (units > EPS && !options.noExcess) {
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
    .map(p => ({ ...p, amount: round2(p.amount), amountVES: round2(p.amountVES), bonus: round2(p.bonus) }))
    .filter(p => p.amount > 0);
  if (final.length > 0) {
    const existing = options.keepExisting
      ? await PaymentAllocation.findAll({ where: { paymentId: payment.id, chargeId: final.map(p => p.chargeId) }, transaction })
      : [];
    const fresh = [];
    for (const p of final) {
      const row = existing.find(e => e.chargeId === p.chargeId);
      if (row) {
        await row.update({
          amount: round2(Number(row.amount) + p.amount), amountVES: round2(Number(row.amountVES) + p.amountVES),
          bonus: round2(Number(row.bonus) + p.bonus), currencyDiscountId: p.currencyDiscountId ?? row.currencyDiscountId,
        }, { transaction });
      } else {
        fresh.push({ paymentId: payment.id, chargeId: p.chargeId, amount: p.amount, amountVES: p.amountVES, bonus: p.bonus, currencyDiscountId: p.currencyDiscountId });
      }
    }
    if (fresh.length > 0) await PaymentAllocation.bulkCreate(fresh, { transaction });
  }
  return final;
}

/**
 * After a discount lowers what a charge owes, payments already credited to it
 * may exceed the new net amount. That excess is taken back from the charge
 * (latest payment first) and re-applied, in debt order, to the student's next
 * pending debts. Whatever no debt can absorb stays where it was (a credit).
 */
export async function releaseOverpaidAllocations(inscriptionId: number, transaction?: Transaction): Promise<void> {
  const net = await loadNetCharges(inscriptionId, transaction);
  if (net.length === 0) return;
  const netById = new Map(net.map(n => [n.charge.id, n]));
  const allocs = await PaymentAllocation.findAll({
    where: { chargeId: [...netById.keys()] },
    include: [{ model: Payment, as: 'payment' }],
    transaction,
  }) as any[];
  const byCharge = new Map<number, any[]>();
  for (const a of allocs) (byCharge.get(a.chargeId) ?? byCharge.set(a.chargeId, []).get(a.chargeId)!).push(a);

  const periods = await SchoolPeriod.findAll({ where: { id: [...new Set(net.map(n => n.charge.schoolPeriodId))] }, transaction });
  const periodById = new Map(periods.map(p => [p.id, p]));
  const resolver = makeRateResolver(transaction);

  type Freed = { payment: Payment; units: number; origins: { charge: Charge; chargeAmount: number; ratio: number; units: number; bonus: number; discountId: number | null }[] };
  const freed = new Map<number, Freed>();
  for (const [chargeId, list] of byCharge) {
    const { charge, net: netAmount } = netById.get(chargeId)!;
    let excess = round2(list.reduce((s, a) => s + Number(a.amount), 0) - netAmount);
    if (excess <= EPS) continue;
    list.sort((a, b) => (new Date(b.payment.paymentDate).getTime() - new Date(a.payment.paymentDate).getTime()) || (b.id - a.id));
    for (const a of list) {
      if (excess <= EPS) break;
      const take = Math.min(Number(a.amount), excess);
      const payment: Payment = a.payment;
      const ratio = Number(a.amount) > 0 ? Number(a.amountVES) / Number(a.amount) : 0;
      const par = appliesAtPar(payment.currency, charge.currency, !!periodById.get(charge.schoolPeriodId)?.usdAtPar);
      const payRate = (await resolver.vesPerUnit(payment.currency, payment.paymentDate)) ?? 1;
      const units = payment.currency === charge.currency || par ? take : (take * ratio) / payRate;
      const left = round2(Number(a.amount) - take);
      const bonusTaken = round2(Number(a.bonus) * (take / Number(a.amount)));
      if (left <= EPS) await a.destroy({ transaction });
      else await a.update({ amount: left, amountVES: round2(left * ratio), bonus: round2(Number(a.bonus) - bonusTaken) }, { transaction });
      const f = freed.get(payment.id) ?? { payment, units: 0, origins: [] };
      f.units += units;
      f.origins.push({ charge, chargeAmount: take, ratio, units, bonus: bonusTaken, discountId: a.currencyDiscountId ?? null });
      freed.set(payment.id, f);
      excess = round2(excess - take);
    }
  }

  const ordered = [...freed.values()].sort((a, b) =>
    (new Date(a.payment.paymentDate).getTime() - new Date(b.payment.paymentDate).getTime()) || (a.payment.id - b.payment.id));
  for (const f of ordered) {
    const out = { leftover: 0 };
    await distributePayment(f.payment, { kind: 'auto' }, { transaction, units: f.units, keepExisting: true, noExcess: true, out });
    // No debt could take it: give it back to the charge it came from.
    let back = out.leftover;
    for (const o of f.origins) {
      if (back <= EPS) break;
      const used = Math.min(back, o.units);
      const chargeAmount = round2(o.chargeAmount * (used / o.units));
      const row = await PaymentAllocation.findOne({ where: { paymentId: f.payment.id, chargeId: o.charge.id }, transaction });
      const bonusBack = round2(o.bonus * (used / o.units));
      if (row) await row.update({ amount: round2(Number(row.amount) + chargeAmount), amountVES: round2(Number(row.amountVES) + chargeAmount * o.ratio), bonus: round2(Number(row.bonus) + bonusBack), currencyDiscountId: o.discountId ?? row.currencyDiscountId }, { transaction });
      else await PaymentAllocation.create({ paymentId: f.payment.id, chargeId: o.charge.id, amount: chargeAmount, amountVES: round2(chargeAmount * o.ratio), bonus: bonusBack, currencyDiscountId: o.discountId }, { transaction });
      back -= used;
    }
  }
}

/**
 * Inverse of `releaseOverpaidAllocations`: after a discount is removed or reduced, an academic debt
 * (enrollment package / mensualidad) may owe money while LATER academic debts hold payments.
 * Money is pulled back, starting from the nearest later debt (latest payment first), and re-applied
 * to the earliest pending academic debts. Items and 'otro' debts, and payments registered for a
 * sellable item, are never touched. Money no debt can absorb returns to where it came from.
 */
export async function fillUnderpaidAllocations(inscriptionId: number, transaction?: Transaction): Promise<void> {
  const resolver = makeRateResolver(transaction);
  const skipped = new Set<string>();
  for (let guard = 0; guard < 500; guard++) {
    const ctx = await orderedContext(inscriptionId, -1, transaction);
    if (!ctx) return;
    const academic = ctx.ordered.filter(o => !EXTRA_TYPES.has(o.charge.type ?? ''));
    const gapIdx = academic.findIndex(o => (ctx.remaining.get(o.charge.id) ?? 0) > EPS);
    if (gapIdx === -1) return;
    const donors = academic.slice(gapIdx + 1);
    if (donors.length === 0) return;
    const rank = new Map(donors.map((o, i) => [o.charge.id, i]));
    const allocs = await PaymentAllocation.findAll({
      where: { chargeId: [...rank.keys()] }, include: [{ model: Payment, as: 'payment' }], transaction,
    }) as any[];
    const movable = allocs
      .filter(a => !a.payment.sellableItemId && Number(a.amount) > EPS && !skipped.has(`${a.paymentId}:${a.chargeId}`))
      .sort((a, b) => (rank.get(a.chargeId)! - rank.get(b.chargeId)!)
        || (new Date(b.payment.paymentDate).getTime() - new Date(a.payment.paymentDate).getTime()) || (b.id - a.id));
    const a = movable[0];
    if (!a) return;

    const charge = donors[rank.get(a.chargeId)!].charge;
    const payment: Payment = a.payment;
    const amount = Number(a.amount);
    const ratio = amount > 0 ? Number(a.amountVES) / amount : 0;
    const par = appliesAtPar(payment.currency, charge.currency, !!ctx.periodById.get(charge.schoolPeriodId)?.usdAtPar);
    const payRate = (await resolver.vesPerUnit(payment.currency, payment.paymentDate)) ?? 1;
    const units = payment.currency === charge.currency || par ? amount : (amount * ratio) / payRate;
    const bonus = Number(a.bonus);
    const discountId = a.currencyDiscountId ?? null;
    await a.destroy({ transaction });

    const out = { leftover: 0 };
    await distributePayment(payment, { kind: 'tuition' }, { transaction, units, keepExisting: true, noExcess: true, out });
    if (out.leftover > EPS) {
      // Nothing could take (all of) it: give it back to the charge it came from.
      const used = Math.min(out.leftover, units);
      const chargeAmount = round2(amount * (used / units));
      const bonusBack = round2(bonus * (used / units));
      const row = await PaymentAllocation.findOne({ where: { paymentId: payment.id, chargeId: charge.id }, transaction });
      if (row) await row.update({ amount: round2(Number(row.amount) + chargeAmount), amountVES: round2(Number(row.amountVES) + chargeAmount * ratio), bonus: round2(Number(row.bonus) + bonusBack), currencyDiscountId: discountId ?? row.currencyDiscountId }, { transaction });
      else await PaymentAllocation.create({ paymentId: payment.id, chargeId: charge.id, amount: chargeAmount, amountVES: round2(chargeAmount * ratio), bonus: bonusBack, currencyDiscountId: discountId }, { transaction });
      skipped.add(`${payment.id}:${charge.id}`);
    }
  }
}

/** Re-balances an inscription's payments after a discount changed: spill surplus forward, refill gaps from later debts. */
export async function rebalanceAllocations(inscriptionId: number, transaction?: Transaction): Promise<void> {
  await releaseOverpaidAllocations(inscriptionId, transaction);
  await fillUnderpaidAllocations(inscriptionId, transaction);
}

export interface SharedPortion {
  inscriptionId: number;
  /** Share of the payment, in the payment's own currency. */
  amount: number;
  /** Debts this share would settle (simulation, nothing is stored). */
  allocations: Array<{ chargeId: number; description: string | null; type: string | null; month: string | null; currency: string; amount: number; bonus?: number }>;
}

/**
 * Splits ONE physical payment across several students (siblings of a
 * representative) by priority, without writing anything. Every student's pending
 * debts are merged into a single global order — earlier school period first,
 * then the enrollment package of EVERY student, then items, then monthly fees —
 * so with Bs. for 2 × 165 EUR of enrollment each student gets his enrollment
 * before anyone's tuition. Ties follow the order of `inscriptionIds`.
 * The shares add up to exactly `amount`; any excess stays with the first student.
 */
export async function planSharedPayment(args: {
  inscriptionIds: number[];
  currency: string;
  amount: number;
  payDate: Date;
  /** Period of the payment: where the currency discount is looked up. */
  schoolPeriodId?: number;
  scope?: 'auto' | 'tuition' | 'item';
  transaction?: Transaction;
}): Promise<SharedPortion[]> {
  const { inscriptionIds, currency, payDate, scope, transaction } = args;
  const resolver = makeRateResolver(transaction);
  const rate = async (cur: string) => (await resolver.vesPerUnit(cur, payDate)) ?? 1;
  const payRate = await rate(currency);
  const discount: ActiveCurrencyDiscount | null = args.schoolPeriodId
    ? await findActiveCurrencyDiscount(args.schoolPeriodId, currency, payDate, transaction)
    : null;
  const fixedGiven = new Set<number>();

  type Entry = { insIdx: number; charge: Charge; key: SortKey; rem: number; par: boolean };
  const entries: Entry[] = [];
  for (let insIdx = 0; insIdx < inscriptionIds.length; insIdx++) {
    const ctx = await orderedContext(inscriptionIds[insIdx], -1, transaction);
    if (!ctx) continue;
    for (const { charge } of ctx.ordered) {
      if (scope === 'item' && charge.type !== 'item') continue;
      if (scope === 'tuition' && EXTRA_TYPES.has(charge.type ?? '')) continue;
      const rem = ctx.remaining.get(charge.id) ?? 0;
      if (rem <= EPS) continue;
      entries.push({
        insIdx, charge, rem,
        key: sortKeyOf(charge, ctx.periodById),
        par: appliesAtPar(currency, charge.currency, !!ctx.periodById.get(charge.schoolPeriodId)?.usdAtPar),
      });
    }
  }
  entries.sort((a, b) => cmpKey(a.key, b.key) || a.insIdx - b.insIdx || a.charge.id - b.charge.id);

  const portions: SharedPortion[] = inscriptionIds.map(inscriptionId => ({ inscriptionId, amount: 0, allocations: [] }));
  let units = Number(args.amount);
  for (const e of entries) {
    if (units <= EPS) break;
    const chargeRate = await rate(e.charge.currency);
    const factor = currency === e.charge.currency || e.par ? 1 : chargeRate / payRate;
    if (discount?.kind === 'fixed' && !fixedGiven.has(e.charge.id)) {
      const given = await chargesWithFixedBonus(discount.id, [e.charge.id], -1, transaction);
      if (given.has(e.charge.id)) fixedGiven.add(e.charge.id);
    }
    const { apply, used, bonus } = settleCharge({ rem: e.rem, units, factor, discount, fixedAlready: fixedGiven.has(e.charge.id) });
    if (bonus > EPS && discount?.kind === 'fixed') fixedGiven.add(e.charge.id);
    const p = portions[e.insIdx];
    p.amount += used;
    p.allocations.push({
      chargeId: e.charge.id, description: e.charge.description ?? null, type: e.charge.type ?? null,
      month: e.charge.month ?? null, currency: e.charge.currency, amount: round2(apply), bonus,
    });
    units -= used;
  }
  if (units > EPS) portions[0].amount += units;

  // Round every share to cents and make the last non-empty one absorb the difference.
  for (const p of portions) p.amount = round2(p.amount);
  const diff = round2(Number(args.amount) - portions.reduce((s, p) => s + p.amount, 0));
  if (Math.abs(diff) >= 0.005) {
    const target = [...portions].reverse().find(p => p.amount > 0) ?? portions[0];
    target.amount = round2(target.amount + diff);
  }
  return portions;
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
