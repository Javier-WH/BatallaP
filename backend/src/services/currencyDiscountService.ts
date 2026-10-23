/**
 * currencyDiscountService — discounts for paying in a given currency.
 *
 * A rule (CurrencyDiscount) belongs to a school period and applies to every
 * payment of that period made in its currency inside its validity window.
 * It never touches the debts themselves: it gives the payment extra purchasing
 * power (a "bonus" credited on top of what was really paid).
 *   - percent p: the debt is settled paying (1 - p) of it. 80 USDT settle 100 USD at 20%.
 *   - fixed v:   every debt the payment settles IN FULL costs v less (v in the debt's
 *                currency); granted once per debt and rule.
 * Rules stack with personal discounts (they act on what is still owed after those).
 */
import { Op, Transaction } from 'sequelize';
import { CurrencyDiscount, PaymentAllocation } from '@/models/index';

export interface ActiveCurrencyDiscount {
  id: number;
  name: string;
  currency: string;
  kind: 'percent' | 'fixed';
  value: number;
}

const EPS = 0.005;

export async function findActiveCurrencyDiscount(
  schoolPeriodId: number,
  currency: string,
  payDate: Date,
  transaction?: Transaction,
): Promise<ActiveCurrencyDiscount | null> {
  const day = payDate.toISOString().slice(0, 10);
  const rows = await CurrencyDiscount.findAll({
    where: {
      schoolPeriodId, currency, active: true,
      [Op.and]: [
        { [Op.or]: [{ validFrom: null }, { validFrom: { [Op.lte]: day } }] },
        { [Op.or]: [{ validTo: null }, { validTo: { [Op.gte]: day } }] },
      ],
    } as any,
    order: [['id', 'ASC']],
    transaction,
  });
  // Overlapping rules are rejected on creation; if legacy data has them, the most generous wins.
  const best = rows.sort((a, b) => Number(b.value) - Number(a.value))[0];
  return best ? { id: best.id, name: best.name, currency: best.currency, kind: best.kind, value: Number(best.value) } : null;
}

/** Charges that already received this fixed rule's bonus (it is granted once per debt). */
export async function chargesWithFixedBonus(
  discountId: number,
  chargeIds: number[],
  excludePaymentId: number,
  transaction?: Transaction,
): Promise<Set<number>> {
  if (chargeIds.length === 0) return new Set();
  const rows = await PaymentAllocation.findAll({
    where: { currencyDiscountId: discountId, chargeId: { [Op.in]: chargeIds }, paymentId: { [Op.ne]: excludePaymentId } } as any,
    attributes: ['chargeId', 'bonus'],
    transaction,
  });
  return new Set(rows.filter(r => Number(r.bonus) > EPS).map(r => r.chargeId));
}

/**
 * What a payment with `units` left does to one charge owing `rem`:
 * `apply` is the credit the charge receives, `used` the payment units spent,
 * `bonus` the part of `apply` granted by the discount. `factor` converts
 * charge units into payment units (1 for the same currency or at par).
 */
export function settleCharge(args: {
  rem: number; units: number; factor: number;
  discount: ActiveCurrencyDiscount | null; fixedAlready: boolean;
}): { apply: number; used: number; bonus: number } {
  const { rem, units, factor, discount, fixedAlready } = args;
  const round2 = (n: number) => Math.round(n * 100) / 100;

  if (discount?.kind === 'fixed' && !fixedAlready) {
    const remEff = Math.max(rem - discount.value, 0);
    const costEff = remEff * factor;
    if (remEff > EPS && units >= costEff - EPS) return { apply: rem, used: costEff, bonus: round2(rem - remEff) };
  }
  const keep = discount?.kind === 'percent' ? 1 - discount.value / 100 : 1;
  const cost = rem * factor * keep;
  if (units >= cost - EPS) return { apply: rem, used: cost, bonus: round2(rem * (1 - keep)) };
  const apply = round2(rem * (units / cost));
  return { apply, used: units, bonus: round2(apply * (1 - keep)) };
}
