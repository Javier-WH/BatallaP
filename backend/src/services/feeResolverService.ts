/**
 * feeResolverService — resolves which Fee / EnrollmentPlan version is in
 * force for a given month of a school period.
 *
 * Fees and plans are versioned by `effectiveMonth`: the version in force for
 * month M is the active one with the greatest `effectiveMonth` <= M, following
 * the period's billing-calendar order (ties → highest id).
 */
import { Transaction } from 'sequelize';
import { Fee, EnrollmentPlan, SchoolPeriod } from '@/models/index';
import { BillingWindow, getBillingMonths } from '@/services/billingCalendarService';

interface Versioned {
  id: number;
  effectiveMonth: string;
}

export function pickEffective<T extends Versioned>(items: T[], month: string, window: BillingWindow): T | null {
  const months = getBillingMonths(window) as string[];
  const target = months.indexOf(month);
  let best: T | null = null;
  let bestIdx = -1;
  for (const item of items) {
    // A version whose month fell outside the window (window edited later) counts from the first month.
    const idx = Math.max(months.indexOf(item.effectiveMonth), 0);
    if (idx > target) continue;
    if (!best || idx > bestIdx || (idx === bestIdx && item.id > best.id)) {
      best = item;
      bestIdx = idx;
    }
  }
  return best;
}

async function getWindow(schoolPeriodId: number, transaction?: Transaction): Promise<BillingWindow> {
  const period = await SchoolPeriod.findByPk(schoolPeriodId, {
    attributes: ['id', 'billingStartMonth', 'billingEndMonth'],
    transaction,
  });
  return period ?? {};
}

export async function resolveFee(
  schoolPeriodId: number,
  key: Fee['key'],
  month: string,
  transaction?: Transaction
): Promise<Fee | null> {
  const [window, fees] = await Promise.all([
    getWindow(schoolPeriodId, transaction),
    Fee.findAll({ where: { schoolPeriodId, key, active: true }, transaction }),
  ]);
  return pickEffective(fees as (Fee & Versioned)[], month, window);
}

export async function resolveEnrollmentPlan(
  schoolPeriodId: number,
  month: string,
  transaction?: Transaction
): Promise<EnrollmentPlan | null> {
  const [window, plans] = await Promise.all([
    getWindow(schoolPeriodId, transaction),
    EnrollmentPlan.findAll({ where: { schoolPeriodId, active: true }, transaction }),
  ]);
  return pickEffective(plans as (EnrollmentPlan & Versioned)[], month, window);
}
