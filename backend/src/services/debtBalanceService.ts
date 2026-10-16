/**
 * debtBalanceService — shared math for debts across periods and currencies.
 *
 * A Charge belongs to the school period whose debt it represents
 * (`Charge.schoolPeriodId`), which may differ from the period of the
 * inscription it hangs on (e.g. a debt of last year's August registered on the
 * current inscription). Payments carry `debtPeriodId` for the same reason.
 *
 * Amounts are compared in VES (the common denominator): charges and payments
 * store `amountVES`; when missing, the latest exchange rate for their currency
 * at the relevant date is used. For display, a payment is converted into the
 * bucket's currency with the rate in force on the payment date (the stored
 * `equivalent`/`equivalentCurrency` when available).
 */
import { Op, Transaction } from 'sequelize';
import { Charge, ExchangeRate, ExchangeRateType, Inscription, Payment, SchoolPeriod } from '@/models/index';
import { getBillingMonths } from '@/services/billingCalendarService';

// ── Rate resolution ──

export interface RateResolver {
  /** VES per 1 unit of `currency`, latest rate on or before `date`. */
  vesPerUnit: (currency: string, date: string | Date) => Promise<number | null>;
}

/** Builds a cached VES-per-unit resolver (default rate type per currency). */
export function makeRateResolver(transaction?: Transaction): RateResolver {
  const typeByCurrency = new Map<string, number>();
  const rateCache = new Map<string, number | null>();
  const dateStr = (d: string | Date) => (typeof d === 'string' ? d : d.toISOString().slice(0, 10));

  const typeIdFor = async (currency: string): Promise<number | null> => {
    if (!typeByCurrency.has(currency)) {
      const types = await ExchangeRateType.findAll({ where: { currency, active: true }, transaction });
      const preferred = types.find(t => t.isDefault) ?? types[0];
      typeByCurrency.set(currency, preferred ? preferred.id : -1);
    }
    const id = typeByCurrency.get(currency)!;
    return id === -1 ? null : id;
  };

  const vesPerUnit = async (currency: string, date: string | Date): Promise<number | null> => {
    if (currency === 'VES') return 1;
    const key = `${currency}|${dateStr(date)}`;
    if (!rateCache.has(key)) {
      const typeId = await typeIdFor(currency);
      let value: number | null = null;
      if (typeId !== null) {
        const rate = await ExchangeRate.findOne({
          where: { exchangeRateTypeId: typeId, date: { [Op.lte]: dateStr(date) } },
          order: [['date', 'DESC']],
          transaction,
        });
        value = rate ? Number(rate.rate) : null;
      }
      rateCache.set(key, value);
    }
    return rateCache.get(key)!;
  };

  return { vesPerUnit };
}

// ── Amount conversions ──

/** The charge's debt expressed in VES. */
export async function chargeToVES(charge: Charge, resolver: RateResolver, refDate = new Date()): Promise<number> {
  if (charge.amountVES != null) return Number(charge.amountVES);
  const rate = await resolver.vesPerUnit(charge.currency, charge.createdAt ?? refDate);
  return rate != null ? Number(charge.amount) * rate : Number(charge.amount);
}

/** The payment amount expressed in VES. */
export async function paymentToVES(payment: Payment, resolver: RateResolver): Promise<number> {
  if (payment.amountVES != null) return Number(payment.amountVES);
  const rate = await resolver.vesPerUnit(payment.currency, payment.paymentDate);
  return rate != null ? Number(payment.amount) * rate : Number(payment.amount);
}

/**
 * The payment expressed in `currency` (a debt bucket's currency) using the rate
 * in force on the payment date. Returns null when it cannot be converted.
 */
export async function paymentInCurrency(payment: Payment, currency: string, resolver: RateResolver): Promise<number | null> {
  if ((payment as any).equivalentCurrency === currency && (payment as any).equivalent != null) {
    return Number((payment as any).equivalent);
  }
  if (payment.currency === currency) return Number(payment.amount);
  const ves = await paymentToVES(payment, resolver);
  const rate = await resolver.vesPerUnit(currency, payment.paymentDate);
  return rate ? ves / rate : null;
}

// ── Buckets ──

export interface DebtBucket {
  periodId: number;
  periodName: string;
  periodStartYear: number | null;
  month: string | null; // null = one-time debts of that period
  charges: any[];
  payments: any[];
  currency: string;   // display currency (first charge's)
  charged: number;    // in bucket currency
  paid: number;       // in bucket currency
  chargedVES: number;
  paidVES: number;
}

export function paymentDebtPeriodId(payment: Payment): number {
  return (payment as any).debtPeriodId ?? payment.schoolPeriodId;
}

export function paymentBucketMonth(payment: any): string | null {
  return payment.month ?? payment.charge?.month ?? null;
}

/**
 * Loads the active charges and all payments of an inscription and groups them
 * into buckets keyed by (debt period, month). Balances are computed in VES and
 * in the bucket's display currency.
 */
export async function loadDebtBuckets(
  inscriptionId: number,
  options: { transaction?: Transaction } = {}
): Promise<DebtBucket[]> {
  const { transaction } = options;
  const resolver = makeRateResolver(transaction);

  const charges = await Charge.findAll({ where: { inscriptionId, active: true }, transaction });
  const payments = await Payment.findAll({
    where: { inscriptionId },
    include: [{ model: Charge, as: 'charge', attributes: ['id', 'month'] }],
    transaction,
  });

  const periodIds = [...new Set([
    ...charges.map(c => c.schoolPeriodId),
    ...payments.map(p => paymentDebtPeriodId(p)),
  ])];
  const periods = await SchoolPeriod.findAll({ where: { id: { [Op.in]: periodIds } }, transaction });
  const periodById = new Map(periods.map(p => [p.id, p]));

  const buckets = new Map<string, DebtBucket>();
  const bucketFor = (periodId: number, month: string | null): DebtBucket => {
    const key = `${periodId}|${month ?? ''}`;
    let b = buckets.get(key);
    if (!b) {
      const period = periodById.get(periodId);
      b = {
        periodId,
        periodName: period?.name ?? period?.period ?? `Período ${periodId}`,
        periodStartYear: period?.startYear ?? null,
        month,
        charges: [],
        payments: [],
        currency: 'USD',
        charged: 0, paid: 0, chargedVES: 0, paidVES: 0,
      };
      buckets.set(key, b);
    }
    return b;
  };

  for (const c of charges) {
    const b = bucketFor(c.schoolPeriodId, c.month ?? null);
    b.charges.push(c);
    if (b.charges.length === 1 || c.currency === b.currency) b.currency = b.charges[0].currency;
    b.chargedVES += await chargeToVES(c, resolver);
  }
  for (const b of buckets.values()) b.currency = b.charges[0]?.currency ?? 'USD';

  for (const p of payments) {
    const b = bucketFor(paymentDebtPeriodId(p), paymentBucketMonth(p));
    b.payments.push(p);
    b.paidVES += await paymentToVES(p, resolver);
  }

  // Display totals in the bucket currency
  for (const b of buckets.values()) {
    for (const c of b.charges) {
      if (c.currency === b.currency) {
        b.charged += Number(c.amount);
      } else {
        const ves = await chargeToVES(c, resolver);
        const rate = await resolver.vesPerUnit(b.currency, new Date());
        if (rate) b.charged += ves / rate;
      }
    }
    for (const p of b.payments) {
      const v = await paymentInCurrency(p, b.currency, resolver);
      if (v != null) b.paid += v;
    }
  }

  return [...buckets.values()];
}

/**
 * Chronological order of buckets: earlier periods first (by startYear), and
 * within a period the months follow its billing calendar; the one-time bucket
 * of a period sorts first (enrollment precedes monthly fees).
 */
export function orderBuckets(buckets: DebtBucket[], periodsById: Map<number, SchoolPeriod>): DebtBucket[] {
  const rank = (b: DebtBucket): [number, number] => {
    const period = periodsById.get(b.periodId);
    const months = getBillingMonths(period ?? {});
    const monthIdx = b.month === null ? -1 : (months as string[]).indexOf(b.month);
    return [b.periodStartYear ?? 9999, b.month === null ? -1 : (monthIdx === -1 ? 99 : monthIdx)];
  };
  return [...buckets].sort((a, b) => {
    const [pa, ma] = rank(a);
    const [pb, mb] = rank(b);
    return pa - pb || ma - mb;
  });
}

// ── Debt summary & papers hold ──

export interface InscriptionDebtSummary {
  buckets: DebtBucket[];
  totals: Record<string, { charged: number; paid: number; remaining: number }>;
  outstandingVES: number;
  hasDebt: boolean;
}

export async function inscriptionDebtSummary(
  inscriptionId: number,
  options: { transaction?: Transaction } = {}
): Promise<InscriptionDebtSummary> {
  const buckets = await loadDebtBuckets(inscriptionId, options);
  const periodIds = [...new Set(buckets.map(b => b.periodId))];
  const periods = await SchoolPeriod.findAll({ where: { id: { [Op.in]: periodIds } }, transaction: options.transaction });
  const ordered = orderBuckets(buckets, new Map(periods.map(p => [p.id, p])));

  const totals: InscriptionDebtSummary['totals'] = {};
  let outstandingVES = 0;
  for (const b of ordered) {
    const rem = Math.max(b.charged - b.paid, 0);
    const remVES = Math.max(b.chargedVES - b.paidVES, 0);
    outstandingVES += remVES;
    const t = (totals[b.currency] ??= { charged: 0, paid: 0, remaining: 0 });
    t.charged += b.charged;
    t.paid += b.paid;
    t.remaining += rem;
  }
  for (const t of Object.values(totals)) {
    t.charged = Math.round(t.charged * 100) / 100;
    t.paid = Math.round(t.paid * 100) / 100;
    t.remaining = Math.round(t.remaining * 100) / 100;
  }
  return { buckets: ordered, totals, outstandingVES, hasDebt: outstandingVES > 0.005 };
}

/**
 * Lifts `Inscription.papersHold` once the outstanding debt reaches zero. It
 * never re-applies the hold: an administrator may release it manually while
 * debt remains, and that decision must not be undone by a later payment.
 * The hold is only set at withdrawal time (and via the release endpoint).
 */
export async function clearPapersHoldIfSettled(
  inscriptionId: number,
  options: { transaction?: Transaction } = {}
): Promise<boolean> {
  const inscription = await Inscription.findByPk(inscriptionId, { transaction: options.transaction });
  if (!inscription || !(inscription as any).papersHold) return false;
  const summary = await inscriptionDebtSummary(inscriptionId, options);
  if (!summary.hasDebt) {
    await inscription.update({ papersHold: false } as any, { transaction: options.transaction });
    return false;
  }
  return true;
}
