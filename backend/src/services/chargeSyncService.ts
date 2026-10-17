/**
 * chargeSyncService — period-wide generation / synchronization of debts.
 *
 * Backs the "Generar / actualizar deudas" button of the payments config:
 *  - generate: scheduled debts missing for inscriptions of the period
 *    (including those that never had any);
 *  - sync: scheduled debts whose amount no longer matches the costs in force
 *    (e.g. a new fee version) are updated, unless they are already fully paid.
 *
 * Manual debts (`source = 'manual'`) are never touched. Materia Pendiente
 * sections and withdrawn inscriptions are skipped.
 */
import { Op, Transaction } from 'sequelize';
import { Charge, Inscription, Payment, PaymentAllocation, SchoolPeriod, Section } from '@/models/index';
import { resolveEntryMonth } from '@/services/billingCalendarService';
import { buildPeriodSchedule, ScheduledChargeEntry } from '@/services/chargeScheduleService';

type PlanEntry = { inscriptionId: number; entry: ScheduledChargeEntry };

export interface ChargeSyncPlan {
  schoolPeriodId: number;
  create: PlanEntry[];
  reactivate: Array<PlanEntry & { chargeId: number }>;
  update: Array<PlanEntry & { chargeId: number; previousAmount: number }>;
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
  excludedMateriaPendiente: number;
  warnings: Array<{ message: string; count: number }>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function planPeriodChargeSync(schoolPeriodId: number, transaction?: Transaction): Promise<ChargeSyncPlan> {
  const period = await SchoolPeriod.findByPk(schoolPeriodId, { transaction });
  if (!period) throw new Error('Período no encontrado');

  const plan: ChargeSyncPlan = {
    schoolPeriodId,
    create: [],
    reactivate: [],
    update: [],
    skippedPaid: 0,
    excludedMateriaPendiente: 0,
    warnings: [],
  };

  const inscriptions = await Inscription.findAll({ where: { schoolPeriodId, withdrawnAt: null }, transaction });
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

  const scheduleCache = new Map<string, Awaited<ReturnType<typeof buildPeriodSchedule>>>();
  const warningCounts = new Map<string, number>();

  for (const insc of inscriptions) {
    if (insc.sectionId && mpSectionIds.has(insc.sectionId)) {
      plan.excludedMateriaPendiente++;
      continue;
    }
    const entryMonth = resolveEntryMonth(period, insc.entryMonth);
    if (!scheduleCache.has(entryMonth)) scheduleCache.set(entryMonth, await buildPeriodSchedule(period, entryMonth, transaction));
    const { entries, warnings } = scheduleCache.get(entryMonth)!;
    for (const w of warnings) warningCounts.set(w, (warningCounts.get(w) ?? 0) + 1);

    const existing = scheduledByInscription.get(insc.id);
    for (const entry of entries) {
      const found = existing?.get(entry.scheduleKey);
      if (!found) {
        plan.create.push({ inscriptionId: insc.id, entry });
      } else if (!found.active) {
        plan.reactivate.push({ inscriptionId: insc.id, chargeId: found.id, entry });
      } else if (round2(Number(found.amount)) !== round2(entry.amount) || found.currency !== entry.currency) {
        if (isFullyPaid(found)) plan.skippedPaid++;
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
  const generatedInscriptions = new Set([...plan.create, ...plan.reactivate].map(e => e.inscriptionId));
  return {
    schoolPeriodId: plan.schoolPeriodId,
    generate: {
      inscriptions: generatedInscriptions.size,
      charges: plan.create.length + plan.reactivate.length,
      amountByCurrency,
    },
    sync: { charges: plan.update.length, skippedPaid: plan.skippedPaid, deltaByCurrency },
    excludedMateriaPendiente: plan.excludedMateriaPendiente,
    warnings: plan.warnings,
  };
}

/** Executes the plan inside the given transaction. */
export async function applyChargeSyncPlan(plan: ChargeSyncPlan, transaction: Transaction) {
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
    })), { transaction });
  }
  for (const r of plan.reactivate) {
    await Charge.update({
      active: true,
      feeId: r.entry.feeId,
      sellableItemId: r.entry.sellableItemId,
      description: r.entry.description,
      amount: r.entry.amount,
      currency: r.entry.currency,
    }, { where: { id: r.chargeId }, transaction });
  }
  for (const u of plan.update) {
    await Charge.update({
      feeId: u.entry.feeId,
      amount: u.entry.amount,
      currency: u.entry.currency,
    }, { where: { id: u.chargeId }, transaction });
  }
  return {
    created: plan.create.length,
    reactivated: plan.reactivate.length,
    updated: plan.update.length,
    skippedPaid: plan.skippedPaid,
  };
}
