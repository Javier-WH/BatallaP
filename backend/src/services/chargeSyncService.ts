/**
 * chargeSyncService — period-wide generation / synchronization of debts.
 *
 * Backs the "Generar / actualizar deudas" button of the payments config:
 *  - generate: scheduled debts missing for inscriptions of the period
 *    (including those that never had any);
 *  - sync: scheduled debts whose amount no longer matches the costs in force
 *    (e.g. a new fee version) are updated, unless they are already fully paid.
 *
 * Optionally (`retireObsolete`) the plan package is reconciled the other way too: scheduled
 * plan debts (`plan:*`) that the plan in force no longer includes are retired, unless they
 * already received payments or deliveries (those are kept and reported).
 *
 * Manual debts (`source = 'manual'`) are never touched. Materia Pendiente
 * sections and withdrawn inscriptions are skipped.
 */
import { Op, Transaction } from 'sequelize';
import { Charge, ChargeDelivery, Inscription, Payment, PaymentAllocation, SchoolPeriod, Section } from '@/models/index';
import { resolveEntryMonth } from '@/services/billingCalendarService';
import { buildPeriodSchedule, studentPlanOf, ScheduledChargeEntry } from '@/services/chargeScheduleService';

type PlanEntry = { inscriptionId: number; entry: ScheduledChargeEntry };

export interface ChargeSyncPlan {
  schoolPeriodId: number;
  create: PlanEntry[];
  reactivate: Array<PlanEntry & { chargeId: number }>;
  update: Array<PlanEntry & { chargeId: number; previousAmount: number }>;
  /** Plan debts the plan in force no longer includes and that can be retired (no payments/deliveries). */
  retire: Array<{ inscriptionId: number; chargeId: number; description: string | null; amount: number; currency: string }>;
  /** Obsolete plan debts that already have payments/deliveries and are therefore kept. */
  keptObsolete: number;
  skippedPaid: number;
  excludedMateriaPendiente: number;
  warnings: Array<{ message: string; count: number }>;
}

export interface ChargeSyncSummary {
  schoolPeriodId: number;
  generate: {
    inscriptions: number;
    charges: number;
    amountByCurrency: Record<string, number>;
  };
  sync: {
    charges: number;
    skippedPaid: number;
    deltaByCurrency: Record<string, number>;
  };
  retire: { charges: number; keptWithPayments: number; amountByCurrency: Record<string, number> };
  excludedMateriaPendiente: number;
  warnings: Array<{ message: string; count: number }>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function planPeriodChargeSync(
  schoolPeriodId: number,
  transaction?: Transaction,
  options: { inscriptionId?: number } = {},
): Promise<ChargeSyncPlan> {
  const period = await SchoolPeriod.findByPk(schoolPeriodId, { transaction });
  if (!period) throw new Error('Período no encontrado');

  const plan: ChargeSyncPlan = {
    schoolPeriodId,
    create: [],
    reactivate: [],
    update: [],
    retire: [],
    keptObsolete: 0,
    skippedPaid: 0,
    excludedMateriaPendiente: 0,
    warnings: [],
  };

  const inscriptions = await Inscription.findAll({
    where: { schoolPeriodId, withdrawnAt: null, ...(options.inscriptionId ? { id: options.inscriptionId } : {}) },
    transaction,
  });
  if (inscriptions.length === 0) return plan;
  const ids = inscriptions.map(i => i.id);

  const mpSections = await Section.findAll({ where: { isMateriaPendiente: true }, attributes: ['id'], transaction });
  const mpSectionIds = new Set(mpSections.map(s => s.id));

  const charges = await Charge.findAll({ where: { inscriptionId: { [Op.in]: ids } }, transaction });
  const payments = await Payment.findAll({
    where: { inscriptionId: { [Op.in]: ids } },
    attributes: ['id', 'inscriptionId', 'month', 'chargeId', 'amount'],
    include: [{ model: PaymentAllocation, as: 'allocations', attributes: ['chargeId', 'amount'] }],
    transaction,
  }) as any[];

  const chargeById = new Map(charges.map(c => [c.id, c]));
  const scheduledByInscription = new Map<number, Map<string, Charge>>();
  const activeMonthTotal = new Map<string, number>(); // `${inscription}|${month}` → charged
  for (const c of charges) {
    if (c.scheduleKey) {
      if (!scheduledByInscription.has(c.inscriptionId)) scheduledByInscription.set(c.inscriptionId, new Map());
      scheduledByInscription.get(c.inscriptionId)!.set(c.scheduleKey, c);
    }
    if (c.active && c.month) {
      const key = `${c.inscriptionId}|${c.month}`;
      activeMonthTotal.set(key, (activeMonthTotal.get(key) ?? 0) + Number(c.amount));
    }
  }
  // Allocations credit each charge in its own currency; payments without
  // allocations (registered before they existed) count via the old month/charge
  // heuristic.
  const paidByMonth = new Map<string, number>();
  const paidByCharge = new Map<number, number>();
  for (const p of payments) {
    if (p.allocations?.length) {
      for (const a of p.allocations) {
        paidByCharge.set(a.chargeId, (paidByCharge.get(a.chargeId) ?? 0) + Number(a.amount));
      }
      continue;
    }
    const amount = Number(p.amount);
    const month = p.month ?? (p.chargeId ? chargeById.get(p.chargeId)?.month : null);
    if (month) {
      const key = `${p.inscriptionId}|${month}`;
      paidByMonth.set(key, (paidByMonth.get(key) ?? 0) + amount);
    }
    if (p.chargeId) paidByCharge.set(p.chargeId, (paidByCharge.get(p.chargeId) ?? 0) + amount);
  }

  const isFullyPaid = (c: Charge): boolean => {
    const paidToCharge = paidByCharge.get(c.id) ?? 0;
    if (paidToCharge > 0) return paidToCharge >= Number(c.amount) - 0.005;
    if (c.month) {
      const paid = paidByMonth.get(`${c.inscriptionId}|${c.month}`) ?? 0;
      return paid > 0 && paid >= (activeMonthTotal.get(`${c.inscriptionId}|${c.month}`) ?? Number(c.amount));
    }
    return false;
  };

  const deliveries = await ChargeDelivery.findAll({
    where: { chargeId: { [Op.in]: charges.map(c => c.id) } }, attributes: ['chargeId'], transaction,
  });
  const deliveredChargeIds = new Set(deliveries.map(d => d.chargeId));

  const scheduleCache = new Map<string, Awaited<ReturnType<typeof buildPeriodSchedule>>>();
  const warningCounts = new Map<string, number>();

  for (const insc of inscriptions) {
    if (insc.sectionId && mpSectionIds.has(insc.sectionId)) {
      plan.excludedMateriaPendiente++;
      continue;
    }
    const entryMonth = resolveEntryMonth(period, insc.entryMonth);
    // Students with an assigned plan get its package instead of the plan in force.
    const assigned = await studentPlanOf(insc, transaction);
    const cacheKey = `${entryMonth}|${assigned?.id ?? ''}`;
    if (!scheduleCache.has(cacheKey)) scheduleCache.set(cacheKey, await buildPeriodSchedule(period, entryMonth, transaction, assigned));
    const { entries, warnings } = scheduleCache.get(cacheKey)!;
    for (const w of warnings) warningCounts.set(w, (warningCounts.get(w) ?? 0) + 1);

    const existing = scheduledByInscription.get(insc.id);
    // Plan package debts the plan in force no longer includes (another plan version has different things).
    const wanted = new Set(entries.map(e => e.scheduleKey));
    for (const [key, found] of existing ?? []) {
      if (!key.startsWith('plan:') || !found.active || wanted.has(key)) continue;
      if ((paidByCharge.get(found.id) ?? 0) > 0 || deliveredChargeIds.has(found.id)) plan.keptObsolete++;
      else plan.retire.push({ inscriptionId: insc.id, chargeId: found.id, description: found.description, amount: Number(found.amount), currency: found.currency });
    }
    for (const entry of entries) {
      const found = existing?.get(entry.scheduleKey);
      if (!found) {
        plan.create.push({ inscriptionId: insc.id, entry });
      } else if (!found.active) {
        plan.reactivate.push({ inscriptionId: insc.id, chargeId: found.id, entry });
      } else if (round2(Number(found.amount)) !== round2(entry.amount) || found.currency !== entry.currency) {
        // Never re-denominate a charge that already received money: its
        // allocations are recorded in the old currency and would misstate.
        const touched = (paidByCharge.get(found.id) ?? 0) > 0
          || !!(found.month && (paidByMonth.get(`${insc.id}|${found.month}`) ?? 0) > 0);
        if (isFullyPaid(found) || (found.currency !== entry.currency && touched)) plan.skippedPaid++;
        else plan.update.push({ inscriptionId: insc.id, chargeId: found.id, entry, previousAmount: Number(found.amount) });
      }
    }
  }

  plan.warnings = [...warningCounts.entries()].map(([message, count]) => ({ message, count }));
  return plan;
}

export function summarizeChargeSyncPlan(plan: ChargeSyncPlan): ChargeSyncSummary {
  const amountByCurrency: Record<string, number> = {};
  const deltaByCurrency: Record<string, number> = {};
  for (const { entry } of [...plan.create, ...plan.reactivate]) {
    amountByCurrency[entry.currency] = round2((amountByCurrency[entry.currency] ?? 0) + entry.amount);
  }
  for (const u of plan.update) {
    deltaByCurrency[u.entry.currency] = round2((deltaByCurrency[u.entry.currency] ?? 0) + (u.entry.amount - u.previousAmount));
  }
  const retireByCurrency: Record<string, number> = {};
  for (const r of plan.retire) retireByCurrency[r.currency] = round2((retireByCurrency[r.currency] ?? 0) + r.amount);
  const generatedInscriptions = new Set([...plan.create, ...plan.reactivate].map(e => e.inscriptionId));
  return {
    schoolPeriodId: plan.schoolPeriodId,
    generate: {
      inscriptions: generatedInscriptions.size,
      charges: plan.create.length + plan.reactivate.length,
      amountByCurrency,
    },
    sync: { charges: plan.update.length, skippedPaid: plan.skippedPaid, deltaByCurrency },
    retire: { charges: plan.retire.length, keptWithPayments: plan.keptObsolete, amountByCurrency: retireByCurrency },
    excludedMateriaPendiente: plan.excludedMateriaPendiente,
    warnings: plan.warnings,
  };
}

/** Executes the plan inside the given transaction. */
export async function applyChargeSyncPlan(
  plan: ChargeSyncPlan,
  transaction: Transaction,
  options: { retireObsolete?: boolean } = {},
) {
  if (plan.create.length > 0) {
    await Charge.bulkCreate(plan.create.map(({ inscriptionId, entry }) => ({
      inscriptionId,
      schoolPeriodId: plan.schoolPeriodId,
      feeId: entry.feeId,
      sellableItemId: entry.sellableItemId,
      type: entry.type,
      month: entry.month,
      description: entry.description,
      amount: entry.amount,
      currency: entry.currency,
      amountVES: null,
      dueDate: null,
      active: true,
      source: 'schedule' as const,
      scheduleKey: entry.scheduleKey,
      quantity: entry.quantity ?? 1,
    })), { transaction });
  }
  for (const r of plan.reactivate) {
    await Charge.update({
      active: true,
      feeId: r.entry.feeId,
      sellableItemId: r.entry.sellableItemId,
      description: r.entry.description,
      quantity: r.entry.quantity ?? 1,
      amount: r.entry.amount,
      currency: r.entry.currency,
    }, { where: { id: r.chargeId }, transaction });
  }
  for (const u of plan.update) {
    await Charge.update({
      feeId: u.entry.feeId,
      description: u.entry.description,
      quantity: u.entry.quantity,
      amount: u.entry.amount,
      currency: u.entry.currency,
    }, { where: { id: u.chargeId }, transaction });
  }
  if (options.retireObsolete && plan.retire.length > 0) {
    await Charge.update({ active: false }, { where: { id: { [Op.in]: plan.retire.map(r => r.chargeId) } }, transaction });
  }
  return {
    retired: options.retireObsolete ? plan.retire.length : 0,
    created: plan.create.length,
    reactivated: plan.reactivate.length,
    updated: plan.update.length,
    skippedPaid: plan.skippedPaid,
  };
}
