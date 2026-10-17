/**
 * chargeScheduleService — turns the configured costs into explicit debts.
 *
 * For an inscription it generates:
 *  - the enrollment plan in force at the entry month (one charge per plan item), and
 *  - one monthly fee per month after the entry month up to the end of the
 *    period's billing window (the entry month is covered by the enrollment).
 *
 * Each fee is the version in force for the month it is charged. Scheduled
 * charges carry `source = 'schedule'` and a `scheduleKey`, which makes
 * generation idempotent and lets later syncs tell them apart from manual debts.
 *
 * The only inscriptions skipped are those of a Materia Pendiente section
 * (the student already has a regular inscription) and withdrawn ones.
 * `escolaridad` is never used to filter.
 */
import { Op, Transaction } from 'sequelize';
import {
  Charge, EnrollmentPlanItem, ExchangeRateType, Fee, Inscription, SchoolPeriod, Section, SellableItem,
} from '@/models/index';
import type { ChargeType } from '@/models/Charge';
import {
  chargeableMonthsFrom, entryMonthForDate, getBillingMonths, resolveEntryMonth, type MonthCode,
} from '@/services/billingCalendarService';
import { resolveEnrollmentPlan, resolveFee } from '@/services/feeResolverService';

export interface ScheduledChargeEntry {
  scheduleKey: string;
  type: ChargeType;
  month: string | null;
  description: string;
  amount: number;
  currency: string;
  feeId: number | null;
  sellableItemId: number | null;
}

export interface ChargeSchedule {
  entries: ScheduledChargeEntry[];
  warnings: string[];
  excludedMateriaPendiente: boolean;
  withdrawn: boolean;
}

export interface GenerateResult {
  created: number;
  reactivated: number;
  skipped: number;
  warnings: string[];
  excludedMateriaPendiente: boolean;
  withdrawn: boolean;
}

const FEE_KEY_TO_TYPE: Record<Fee['key'], ChargeType> = {
  mensualidad: 'mensualidad',
  matricula: 'matricula',
  gastos_administrativos: 'gastos_administrativos',
};

/**
 * Debts every student entering at `entry` owes in the period. It does not depend
 * on the student, so bulk callers can cache it per (period, entry month).
 */
export async function buildPeriodSchedule(
  period: SchoolPeriod,
  entry: MonthCode,
  transaction?: Transaction
): Promise<{ entries: ScheduledChargeEntry[]; warnings: string[] }> {
  const result = { entries: [] as ScheduledChargeEntry[], warnings: [] as string[] };
  const periodId = period.id;

  const types = await ExchangeRateType.findAll({ transaction });
  const currencyOf = (typeId: number) => types.find(t => t.id === typeId)?.currency ?? 'USD';

  // ── Enrollment: the plan in force at the entry month ──
  const plan = await resolveEnrollmentPlan(periodId, entry, transaction);
  if (!plan) {
    result.warnings.push(`No hay plan de inscripción vigente para ${entry}`);
  } else {
    const items = await EnrollmentPlanItem.findAll({
      where: { enrollmentPlanId: plan.id },
      include: [
        { model: Fee, as: 'fee' },
        { model: SellableItem, as: 'sellableItem' },
      ],
      order: [['id', 'ASC']],
      transaction,
    });
    for (const item of items as any[]) {
      const qty = Number(item.quantity ?? 1);
      const suffix = qty > 1 ? ` x${qty}` : '';
      if (item.itemType === 'fee' && item.fee) {
        const fee = (await resolveFee(periodId, item.fee.key, entry, transaction)) ?? item.fee;
        result.entries.push({
          scheduleKey: `plan:fee:${fee.key}`,
          type: FEE_KEY_TO_TYPE[fee.key as Fee['key']],
          month: null,
          description: `${fee.name}${suffix}`,
          amount: Number(fee.amount) * qty,
          currency: currencyOf(fee.exchangeRateTypeId),
          feeId: fee.id,
          sellableItemId: null,
        });
      } else if (item.itemType === 'sellable_item' && item.sellableItem) {
        result.entries.push({
          scheduleKey: `plan:item:${item.sellableItem.id}`,
          type: 'item',
          month: null,
          description: `${item.sellableItem.name}${suffix}`,
          amount: Number(item.sellableItem.amount) * qty,
          currency: currencyOf(item.sellableItem.exchangeRateTypeId),
          feeId: null,
          sellableItemId: item.sellableItem.id,
        });
      }
    }
  }

  // ── Monthly fees: every month after the entry month up to the end of the window ──
  for (const month of chargeableMonthsFrom(period, entry)) {
    const fee = await resolveFee(periodId, 'mensualidad', month, transaction);
    if (!fee) {
      result.warnings.push(`No hay costo de mensualidad vigente para ${month}`);
      continue;
    }
    result.entries.push({
      scheduleKey: `mensualidad:${month}`,
      type: 'mensualidad',
      month,
      description: 'Mensualidad',
      amount: Number(fee.amount),
      currency: currencyOf(fee.exchangeRateTypeId),
      feeId: fee.id,
      sellableItemId: null,
    });
  }

  return result;
}

/** Computes the debts an inscription should have, without writing anything. */
export async function buildChargeSchedule(inscription: Inscription, transaction?: Transaction): Promise<ChargeSchedule> {
  const result: ChargeSchedule = { entries: [], warnings: [], excludedMateriaPendiente: false, withdrawn: false };

  if (inscription.withdrawnAt) {
    result.withdrawn = true;
    return result;
  }
  if (inscription.sectionId) {
    const section = await Section.findByPk(inscription.sectionId, { attributes: ['id', 'isMateriaPendiente'], transaction });
    if (section?.isMateriaPendiente) {
      result.excludedMateriaPendiente = true;
      return result;
    }
  }

  const period = await SchoolPeriod.findByPk(inscription.schoolPeriodId, { transaction });
  if (!period) {
    result.warnings.push('Período escolar no encontrado');
    return result;
  }
  const { entries, warnings } = await buildPeriodSchedule(period, resolveEntryMonth(period, inscription.entryMonth), transaction);
  result.entries = entries;
  result.warnings = warnings;
  return result;
}

/** Creates the missing scheduled charges of an inscription (idempotent). */
export async function generateChargesForInscription(
  inscriptionId: number,
  options: { transaction?: Transaction } = {}
): Promise<GenerateResult> {
  const { transaction } = options;
  const inscription = await Inscription.findByPk(inscriptionId, { transaction });
  if (!inscription) throw new Error(`Inscripción ${inscriptionId} no encontrada`);

  const schedule = await buildChargeSchedule(inscription, transaction);
  const result: GenerateResult = {
    created: 0,
    reactivated: 0,
    skipped: 0,
    warnings: schedule.warnings,
    excludedMateriaPendiente: schedule.excludedMateriaPendiente,
    withdrawn: schedule.withdrawn,
  };
  if (schedule.excludedMateriaPendiente || schedule.withdrawn) return result;

  const existing = await Charge.findAll({
    where: { inscriptionId, scheduleKey: { [Op.ne]: null } },
    transaction,
  });
  const byKey = new Map(existing.map(c => [c.scheduleKey as string, c]));

  for (const entry of schedule.entries) {
    const found = byKey.get(entry.scheduleKey);
    if (!found) {
      await Charge.create({
        inscriptionId,
        schoolPeriodId: inscription.schoolPeriodId,
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
        source: 'schedule',
        scheduleKey: entry.scheduleKey,
      }, { transaction });
      result.created++;
    } else if (!found.active) {
      await found.update({
        active: true,
        feeId: entry.feeId,
        sellableItemId: entry.sellableItemId,
        description: entry.description,
        amount: entry.amount,
        currency: entry.currency,
      }, { transaction });
      result.reactivated++;
    } else {
      result.skipped++;
    }
  }
  return result;
}

/**
 * Entry month to store for a new inscription: the explicit one when valid for
 * the period, otherwise the month of `fallbackDate` (the inscription date).
 */
export async function resolveInscriptionEntryMonth(
  schoolPeriodId: number,
  requested: string | null | undefined,
  fallbackDate: Date,
  transaction?: Transaction
): Promise<string | null> {
  const period = await SchoolPeriod.findByPk(schoolPeriodId, { transaction });
  if (!period) return null;
  if (requested && getBillingMonths(period).includes(requested as MonthCode)) return requested;
  return entryMonthForDate(period, fallbackDate);
}

/**
 * Generation for enrollment flows: debts must never block an enrollment, so
 * unexpected failures are logged instead of thrown.
 */
export async function safeGenerateCharges(
  inscriptionId: number,
  transaction?: Transaction
): Promise<GenerateResult | null> {
  try {
    return await generateChargesForInscription(inscriptionId, { transaction });
  } catch (error) {
    console.error('[chargeScheduleService] No se pudieron generar las deudas de la inscripción', inscriptionId, error);
    return null;
  }
}

/**
 * Deactivates the unpaid scheduled charges of an inscription (e.g. on
 * withdrawal). With `untilMonth`, only monthly charges *after* that billing
 * month are deactivated — months up to `untilMonth` and every non-monthly
 * charge (enrollment plan items) stay active, since the student owes the time
 * they were enrolled. Manual debts are never touched.
 */
export async function deactivateUnpaidScheduledCharges(
  inscriptionId: number,
  options: { transaction?: Transaction; untilMonth?: string | null } = {}
): Promise<number> {
  const { transaction, untilMonth } = options;
  const { Payment, PaymentAllocation } = await import('@/models/index');
  const inscription = await Inscription.findByPk(inscriptionId, { transaction });
  const period = inscription ? await SchoolPeriod.findByPk(inscription.schoolPeriodId, { transaction }) : null;
  const months = getBillingMonths(period ?? {}) as string[];
  const untilIdx = untilMonth ? months.indexOf(untilMonth) : -1;

  const charges = await Charge.findAll({
    where: { inscriptionId, source: 'schedule', active: true },
    transaction,
  });
  // A charge is "paid" when it has allocations, or when a legacy payment (one
  // registered before allocations existed) targets it or its month.
  const allocRows = await PaymentAllocation.findAll({
    where: { chargeId: { [Op.in]: charges.map(c => c.id) } },
    attributes: ['chargeId', 'paymentId'],
    transaction,
  });
  const allocatedCharges = new Set(allocRows.map(a => a.chargeId));
  const allocatedPayments = new Set(allocRows.map(a => a.paymentId));
  let deactivated = 0;
  for (const charge of charges) {
    if (untilMonth) {
      // Keep non-monthly debts and months up to untilMonth; cancel only later months.
      if (!charge.month || months.indexOf(charge.month) <= untilIdx) continue;
    }
    let paid = allocatedCharges.has(charge.id) ? 1 : 0;
    if (paid === 0) {
      paid = await Payment.count({
        where: {
          inscriptionId,
          ...(allocatedPayments.size ? { id: { [Op.notIn]: [...allocatedPayments] } } : {}),
          [Op.or]: [
            { chargeId: charge.id },
            ...(charge.month ? [{ month: charge.month, debtPeriodId: charge.schoolPeriodId } as any, { month: charge.month, debtPeriodId: null } as any] : []),
          ],
        },
        transaction,
      });
    }
    if (paid === 0) {
      await charge.update({ active: false }, { transaction });
      deactivated++;
    }
  }
  return deactivated;
}
