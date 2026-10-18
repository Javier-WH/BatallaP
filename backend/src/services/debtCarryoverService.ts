/**
 * debtCarryoverService — inherits unpaid debts when a student moves to a new
 * inscription (period closure).
 *
 * Every charge with a pending balance is re-created on the new inscription as
 * a manual debt of its ORIGINAL period (`schoolPeriodId` unchanged, so chained
 * closures keep pointing at the year the debt belongs to), with the unpaid
 * amount only. It then behaves like any prior-period debt: it shows inside the
 * entry-month cell, is ordered first and blocks later payments.
 *
 * The old charge is retired (nothing paid) or reduced to what was already paid
 * (partially paid), so the old ledger keeps the history and nothing is owed twice.
 */
import { Transaction } from 'sequelize';
import sequelize from '@/config/database';
import { Charge, Inscription } from '@/models/index';
import { pendingByCharge } from '@/services/paymentAllocationService';

const EPS = 0.005;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CarryoverResult {
  carried: number;
  byCurrency: Record<string, number>;
}

export async function carryOverDebts(
  fromInscriptionId: number,
  toInscriptionId: number,
  options: { transaction?: Transaction } = {},
): Promise<CarryoverResult> {
  const { transaction } = options;
  const result: CarryoverResult = { carried: 0, byCurrency: {} };
  if (fromInscriptionId === toInscriptionId) return result;

  const pending = (await pendingByCharge(fromInscriptionId, transaction)).filter(p => p.remaining > EPS);
  if (pending.length === 0) return result;

  for (const { charge, net, remaining } of pending) {
    await Charge.create({
      inscriptionId: toInscriptionId,
      schoolPeriodId: charge.schoolPeriodId,
      feeId: charge.feeId,
      sellableItemId: charge.sellableItemId,
      type: charge.type,
      month: charge.month,
      description: charge.description,
      amount: remaining,
      currency: charge.currency,
      amountVES: null,
      dueDate: charge.dueDate,
      active: true,
      source: 'manual',
      scheduleKey: null,
    }, { transaction });

    if (remaining >= net - EPS) {
      // Nothing paid: retire it. Dropping the schedule identity keeps any later
      // generation from reactivating it next to the inherited copy.
      await charge.update({ active: false, source: 'manual', scheduleKey: null }, { transaction });
    } else {
      // Partially paid: the old charge keeps only the settled part.
      await charge.update({ amount: round2(Number(charge.amount) * ((net - remaining) / net)) }, { transaction });
    }
    result.carried++;
    result.byCurrency[charge.currency] = round2((result.byCurrency[charge.currency] ?? 0) + remaining);
  }

  // Documents held for debt stay held on the inscription that now carries it.
  const from = await Inscription.findByPk(fromInscriptionId, { attributes: ['id', 'papersHold'], transaction });
  if (from && (from as any).papersHold) {
    await Inscription.update({ papersHold: true } as any, { where: { id: toInscriptionId }, transaction });
  }
  return result;
}

/** Closure flows must never fail because of debts: errors are logged and the old debt stays where it was. */
export async function safeCarryOverDebts(
  fromInscriptionId: number,
  toInscriptionId: number,
  transaction?: Transaction,
): Promise<CarryoverResult | null> {
  // Savepoint inside the closure transaction: a failure rolls back only the carryover.
  const sp = await sequelize.transaction(transaction ? { transaction } : {});
  try {
    const res = await carryOverDebts(fromInscriptionId, toInscriptionId, { transaction: sp });
    await sp.commit();
    return res;
  } catch (error) {
    await sp.rollback().catch(() => undefined);
    console.error('[debtCarryoverService] No se pudieron heredar las deudas', fromInscriptionId, '→', toInscriptionId, error);
    return null;
  }
}
