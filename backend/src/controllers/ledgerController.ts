import { Request, Response } from 'express';
import sequelize from '@/config/database';
import { Op, Transaction, UniqueConstraintError } from 'sequelize';
import {
  Inscription, Person, Grade, Section, SchoolPeriod,
  Payment, PaymentAllocation, PaymentAuditLog, Charge, Fee, SellableItem, ExchangeRate, ExchangeRateType,
  InscriptionDiscount, DiscountReason,
} from '@/models/index';
import { DISCOUNT_KINDS, DISCOUNT_SCOPES } from '@/models/InscriptionDiscount';
import { appliesAtPar, buildDedupeKey, normalizePaymentFields } from '@/services/paymentRulesService';
import { distributePayment, checkTargetOrder, AllocationPart, AllocationTarget } from '@/services/paymentAllocationService';
import { applyDiscountsToCharges, DiscountRule } from '@/services/discountService';
import { getBillingMonths, monthCodeFromDate } from '@/services/billingCalendarService';
import { pickEffective } from '@/services/feeResolverService';
import { generateChargesForInscription } from '@/services/chargeScheduleService';
import {
  clearPapersHoldIfSettled, inscriptionDebtSummary, loadDebtBuckets, makeRateResolver,
  orderBuckets, paymentBucketMonth, paymentDebtPeriodId, paymentInCurrency, paymentToVES,
} from '@/services/debtBalanceService';

// ── Ledger: list students by section with their charges & payments ──

/**
 * Inscriptions of students who are withdrawn — i.e. their LATEST inscription
 * has `withdrawnAt` set. A student who withdrew in an older period and later
 * re-enrolled (latest inscription active) is NOT returned: they already show
 * up in their section. Used by the "Sin sección" group of the ledger and by
 * the withdrawn-student search.
 */
async function loadWithdrawnInscriptions(): Promise<any[]> {
  const withdrawnIds = await Inscription.findAll({
    where: { withdrawnAt: { [Op.ne]: null } },
    attributes: ['personId'],
  });
  const personIds = [...new Set(withdrawnIds.map((i: any) => i.personId))];
  if (personIds.length === 0) return [];

  const all = await Inscription.findAll({
    where: { personId: personIds as any },
    include: [
      { model: Person, as: 'student', attributes: ['id', 'firstName', 'lastName', 'documentType', 'document'] },
      { model: Grade, as: 'grade', attributes: ['id', 'name', 'order'] },
      { model: Section, as: 'section', attributes: ['id', 'name', 'isMateriaPendiente'] },
      { model: SchoolPeriod, as: 'period', attributes: ['id', 'period', 'name', 'startYear', 'endYear'] },
    ],
    order: [['id', 'ASC']],
  });

  const latest = new Map<number, any>();
  for (const ins of all as any[]) {
    const cur = latest.get(ins.personId);
    if (!cur || ins.id > cur.id) latest.set(ins.personId, ins);
  }
  return [...latest.values()].filter(i => i.withdrawnAt != null);
}

/** Whether a month-less bucket still has unpaid charges (per currency). */
const enrollmentHasDebt = (b: { byCurrency: Record<string, { charged: number; paid: number }> }): boolean =>
  Object.values(b.byCurrency).some(v => v.charged - v.paid > 0.005);

export const getLedgerBySection = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, gradeId, sectionId } = req.params;

    // "Sin sección" (sectionId=null): withdrawn students of this grade — their
    // latest inscription is withdrawn, from ANY period (old debts included).
    let inscriptions: any[];
    if (sectionId === 'null' || sectionId === '0') {
      const withdrawn = await loadWithdrawnInscriptions();
      inscriptions = withdrawn.filter((i: any) => i.gradeId === Number(gradeId));
      inscriptions.sort((a: any, b: any) =>
        (a.student?.lastName ?? '').localeCompare(b.student?.lastName ?? '', 'es')
        || (a.student?.firstName ?? '').localeCompare(b.student?.firstName ?? '', 'es'));
    } else {
      // Get all inscriptions for this grade+section+period, with student info
      inscriptions = await Inscription.findAll({
        where: {
          schoolPeriodId: Number(schoolPeriodId),
          gradeId: Number(gradeId),
          sectionId: Number(sectionId),
        },
        include: [
          { model: Person, as: 'student', attributes: ['id', 'firstName', 'lastName', 'documentType', 'document'] },
          { model: Grade, as: 'grade', attributes: ['id', 'name'] },
          { model: Section, as: 'section', attributes: ['id', 'name'] },
        ],
        order: [
          [{ model: Person, as: 'student' }, 'lastName', 'ASC'],
          [{ model: Person, as: 'student' }, 'firstName', 'ASC'],
        ],
      });
    }

    const period = await SchoolPeriod.findByPk(Number(schoolPeriodId), {
      attributes: ['id', 'billingStartMonth', 'billingEndMonth'],
    });
    const months = getBillingMonths(period ?? {});

    if (inscriptions.length === 0) {
      return res.json({ students: [], monthlyFee: null, feeCurrency: null, months });
    }

    const inscriptionIds = inscriptions.map((i: any) => i.id);

    // Get all charges for these inscriptions
    const charges = await Charge.findAll({
      where: { inscriptionId: { [Op.in]: inscriptionIds }, active: true },
      include: [
        { model: Fee, as: 'fee', attributes: ['id', 'name', 'amount', 'key'] },
        { model: SellableItem, as: 'sellableItem', attributes: ['id', 'name', 'amount'] },
      ],
    });

    // Get all payments for these inscriptions
    const payments = await Payment.findAll({
      where: { inscriptionId: { [Op.in]: inscriptionIds } },
      include: [
        { model: Charge, as: 'charge', attributes: ['id', 'month', 'type'] },
        { model: Person, as: 'registeredBy', attributes: ['id', 'firstName', 'lastName'] },
        {
          model: PaymentAllocation, as: 'allocations',
          include: [{ model: Charge, as: 'charge', attributes: ['id', 'month', 'type', 'currency', 'schoolPeriodId', 'description'] }],
        },
      ],
    });

    // Get the monthly fee for this period (to know the expected amount per month)
    const monthlyFees = await Fee.findAll({
      where: { schoolPeriodId: Number(schoolPeriodId), key: 'mensualidad', active: true },
      include: [{ model: ExchangeRateType, as: 'exchangeRateType' }],
    });
    const feeView = (f: any) => ({
      id: f.id,
      amount: Number(f.amount),
      currency: f.exchangeRateType?.currency ?? 'USD',
      currencyName: f.exchangeRateType?.name ?? '—',
    });
    const monthlyFeeByMonth: Record<string, ReturnType<typeof feeView> | null> = {};
    for (const m of months) {
      const f = pickEffective(monthlyFees as any[], m, period ?? {});
      monthlyFeeByMonth[m] = f ? feeView(f) : null;
    }
    // Headline fee: the one in force for the current month (or the first billed month).
    const currentCode = monthCodeFromDate(new Date());
    const monthlyFee = monthlyFeeByMonth[months.includes(currentCode) ? currentCode : months[0]] ?? null;

    // Discount rules of these inscriptions (applied below, when reading)
    const discountRows = await InscriptionDiscount.findAll({
      where: { inscriptionId: { [Op.in]: inscriptionIds }, active: true },
      include: [{ model: DiscountReason, as: 'reason', attributes: ['id', 'name'] }],
      order: [['id', 'ASC']],
    });
    const discountsByInscription: Record<number, any[]> = {};
    for (const d of discountRows) {
      if (!discountsByInscription[d.inscriptionId]) discountsByInscription[d.inscriptionId] = [];
      discountsByInscription[d.inscriptionId].push(d);
    }

    // Group charges & payments by inscriptionId
    const chargesByInscription: Record<number, any[]> = {};
    const paymentsByInscription: Record<number, any[]> = {};
    for (const c of charges) {
      const key = c.inscriptionId;
      if (!chargesByInscription[key]) chargesByInscription[key] = [];
      chargesByInscription[key].push(c);
    }
    for (const p of payments) {
      const key = p.inscriptionId;
      if (!paymentsByInscription[key]) paymentsByInscription[key] = [];
      paymentsByInscription[key].push(p);
    }

    // Debt periods: a charge may belong to a period other than the viewed one
    // (prior-year debts). Resolve every period referenced by charges/payments.
    const debtPeriodIds = [...new Set<number>([
      ...charges.map(c => c.schoolPeriodId),
      ...payments.map(p => paymentDebtPeriodId(p)),
      ...payments.flatMap((p: any) => (p.allocations ?? []).map((a: any) => a.charge?.schoolPeriodId).filter(Boolean)),
    ])];
    const debtPeriods = await SchoolPeriod.findAll({ where: { id: { [Op.in]: debtPeriodIds } } });
    const debtPeriodById = new Map(debtPeriods.map(p => [p.id, p]));
    const resolver = makeRateResolver();

    // Build student list
    const students = await Promise.all(inscriptions.map(async (insc: any) => {
      const person = insc.student as any;
      const studentCharges = chargesByInscription[insc.id] || [];
      const studentPayments = paymentsByInscription[insc.id] || [];

      // Discounts are rules evaluated here: totalCharged is NET, gross and discount are exposed too
      const rules: DiscountRule[] = (discountsByInscription[insc.id] || []).map((d: any) => ({
        id: d.id, kind: d.kind, value: Number(d.value), appliesTo: d.appliesTo,
        fromMonth: d.fromMonth, toMonth: d.toMonth, active: d.active,
      }));
      const { charges: discountedCharges } = applyDiscountsToCharges(
        studentCharges.map((c: any) => ({ ...c.toJSON(), amount: Number(c.amount) })),
        rules,
        period ?? {}
      );

      type Bucket = {
        charges: any[]; payments: any[]; currency: string | null;
        /** Charged / paid per debt currency: a cell can mix them (EUR enrollment + USD uniform). */
        byCurrency: Record<string, { charged: number; paid: number }>;
        grossCharged: number; totalDiscount: number; totalCharged: number; totalPaid: number;
        totalChargedVES: number; totalPaidVES: number;
      };
      const emptyBucket = (): Bucket => ({
        charges: [], payments: [], currency: null, byCurrency: {},
        grossCharged: 0, totalDiscount: 0, totalCharged: 0, totalPaid: 0,
        totalChargedVES: 0, totalPaidVES: 0,
      });
      const addCharge = async (b: Bucket, c: any) => {
        b.charges.push(c);
        if (!b.currency) b.currency = c.currency;
        const net = c.amount - c.discountAmount;
        b.grossCharged += c.amount;
        b.totalDiscount += c.discountAmount;
        const t = (b.byCurrency[c.currency] ??= { charged: 0, paid: 0 });
        t.charged += net;
        const rate = c.currency === 'VES' ? 1 : await resolver.vesPerUnit(c.currency, new Date());
        b.totalChargedVES += rate != null ? net * rate : net;
      };
      const addPayment = async (b: Bucket, p: any) => {
        if (!b.payments.includes(p)) b.payments.push(p);
        if (!b.currency) b.currency = p.currency;
        const v = await paymentInCurrency(p, b.currency!, resolver);
        if (v != null) (b.byCurrency[b.currency!] ??= { charged: 0, paid: 0 }).paid += v;
        b.totalPaidVES += await paymentToVES(p, resolver);
      };
      // An allocation credits the charge's bucket in the charge's own currency.
      const addAllocation = (b: Bucket, p: any, a: any) => {
        if (!b.payments.includes(p)) b.payments.push(p);
        if (!b.currency) b.currency = a.charge.currency;
        (b.byCurrency[a.charge.currency] ??= { charged: 0, paid: 0 }).paid += Number(a.amount);
        b.totalPaidVES += Number(a.amountVES);
      };
      // Total in the bucket's display currency: exact when the cell holds one
      // currency, converted through bolívares when it mixes several.
      const settleTotals = async (b: Bucket) => {
        const currencies = Object.keys(b.byCurrency);
        if (currencies.length <= 1) {
          const t = b.byCurrency[b.currency!] ?? { charged: 0, paid: 0 };
          b.totalCharged = t.charged;
          b.totalPaid = t.paid;
        } else {
          const rate = (await resolver.vesPerUnit(b.currency!, new Date())) || 1;
          b.totalCharged = b.totalChargedVES / rate;
          b.totalPaid = b.totalPaidVES / rate;
        }
        for (const v of Object.values(b.byCurrency)) {
          v.charged = Math.round(v.charged * 100) / 100;
          v.paid = Math.round(v.paid * 100) / 100;
        }
      };
      const roundBucket = (b: Bucket): Bucket => ({
        ...b,
        grossCharged: Math.round(b.grossCharged * 100) / 100,
        totalDiscount: Math.round(b.totalDiscount * 100) / 100,
        totalCharged: Math.round(b.totalCharged * 100) / 100,
        totalPaid: Math.round(b.totalPaid * 100) / 100,
        totalChargedVES: Math.round(b.totalChargedVES * 100) / 100,
        totalPaidVES: Math.round(b.totalPaidVES * 100) / 100,
        byCurrency: Object.fromEntries(Object.entries(b.byCurrency).map(([k, v]) => [
          k, { charged: Math.round(v.charged * 100) / 100, paid: Math.round(v.paid * 100) / 100 },
        ])),
      });

      // Group by debt period + month. Charges/payments whose period differs
      // from the viewed one go to `priorPeriods`. Month-less debts split into
      // `enrollment` (plan items — shown inside the entry month's cell) and
      // `other` (extraordinary 'otro' charges — shown in the "Otros" column).
      const viewedPeriodId = Number(schoolPeriodId);
      type PeriodGroup = { months: Record<string, Bucket>; enrollment: Bucket; other: Bucket };
      const viewedGroup: PeriodGroup = { months: {}, enrollment: emptyBucket(), other: emptyBucket() };
      const priorMap = new Map<number, PeriodGroup & { periodId: number; periodName: string; startYear: number | null }>();
      const groupFor = (pid: number): PeriodGroup => {
        if (pid === viewedPeriodId) return viewedGroup;
        let g = priorMap.get(pid);
        if (!g) {
          const per = debtPeriodById.get(pid);
          g = { periodId: pid, periodName: per?.name ?? per?.period ?? `Período ${pid}`, startYear: per?.startYear ?? null, months: {}, enrollment: emptyBucket(), other: emptyBucket() };
          priorMap.set(pid, g);
        }
        return g;
      };
      const monthBucketFor = (g: PeriodGroup, month: string): Bucket => {
        if (!g.months[month]) g.months[month] = emptyBucket();
        return g.months[month];
      };
      // Month-less bucket: extraordinary charges ('otro') → other; everything
      // else (plan items, matrícula, gastos, items) → enrollment.
      const flatBucketFor = (g: PeriodGroup, type?: string | null): Bucket =>
        type === 'otro' ? g.other : g.enrollment;
      const bucketForCharge = (g: PeriodGroup, c: { month?: string | null; type?: string | null }): Bucket =>
        c.month ? monthBucketFor(g, c.month) : flatBucketFor(g, c.type);

      for (const c of discountedCharges) {
        await addCharge(bucketForCharge(groupFor(c.schoolPeriodId), c), c);
      }
      // Payments with allocations count through each part (in each debt's
      // currency). Payments without allocations (registered before allocations
      // existed) count as a whole in their month — or in enrollment/other.
      for (const p of studentPayments as any[]) {
        if (p.allocations?.length) {
          for (const a of p.allocations) {
            if (!a.charge) continue;
            addAllocation(bucketForCharge(groupFor(a.charge.schoolPeriodId), a.charge), p, a);
          }
        } else {
          const g = groupFor(paymentDebtPeriodId(p));
          const m = paymentBucketMonth(p);
          const bucket: Bucket = m ? monthBucketFor(g, m)
            : flatBucketFor(g, (p as any).charge?.type
              ?? (enrollmentHasDebt(g.enrollment) ? null : 'otro'));
          await addPayment(bucket, p);
        }
      }
      // A legacy month-less payment may exceed the remaining enrollment debt —
      // its overflow covers extraordinary debts, so shift the display totals.
      const rebalanceOverflow = (g: PeriodGroup) => {
        const move = Math.min(
          Math.max(g.enrollment.totalPaid - g.enrollment.totalCharged, 0),
          Math.max(g.other.totalCharged - g.other.totalPaid, 0),
        );
        const moveVES = Math.min(
          Math.max(g.enrollment.totalPaidVES - g.enrollment.totalChargedVES, 0),
          Math.max(g.other.totalChargedVES - g.other.totalPaidVES, 0),
        );
        g.enrollment.totalPaid -= move; g.other.totalPaid += move;
        g.enrollment.totalPaidVES -= moveVES; g.other.totalPaidVES += moveVES;
        if (move > 0 && g.enrollment.currency && g.other.currency === g.enrollment.currency) {
          const e = g.enrollment.byCurrency[g.enrollment.currency];
          const o = (g.other.byCurrency[g.other.currency] ??= { charged: 0, paid: 0 });
          if (e) e.paid -= move;
          o.paid += move;
        }
      };
      rebalanceOverflow(viewedGroup);
      priorMap.forEach(rebalanceOverflow);
      await settleTotals(viewedGroup.enrollment);
      await settleTotals(viewedGroup.other);
      for (const m of Object.values(viewedGroup.months)) await settleTotals(m);
      for (const g of priorMap.values()) {
        await settleTotals(g.enrollment);
        await settleTotals(g.other);
        for (const m of Object.values(g.months)) await settleTotals(m);
      }
      for (const m of Object.keys(viewedGroup.months)) viewedGroup.months[m] = roundBucket(viewedGroup.months[m]);
      const priorPeriods = [...priorMap.values()]
        .sort((a, b) => (a.startYear ?? 9999) - (b.startYear ?? 9999))
        .map(g => {
          const per = debtPeriodById.get(g.periodId);
          return {
            periodId: g.periodId,
            periodName: g.periodName,
            periodCode: per?.period ?? null,
            billingMonths: getBillingMonths(per ?? {}) as string[],
            months: Object.fromEntries(Object.entries(g.months).map(([m, b]) => [m, roundBucket(b)])),
            enrollment: roundBucket(g.enrollment),
            other: roundBucket(g.other),
          };
        });

      return {
        inscriptionId: insc.id,
        personId: person?.id,
        name: `${person?.lastName}, ${person?.firstName}`,
        document: person?.document,
        rosterNumber: insc.rosterNumber ?? null,
        entryMonth: insc.entryMonth ?? null,
        gradeName: (insc.grade as any)?.name,
        sectionName: (insc.section as any)?.name,
        months: viewedGroup.months,
        enrollment: roundBucket(viewedGroup.enrollment),
        other: roundBucket(viewedGroup.other),
        priorPeriods,
        discounts: (discountsByInscription[insc.id] || []).map((d: any) => ({
          id: d.id,
          reasonId: d.reasonId,
          reasonName: d.reason?.name ?? '—',
          kind: d.kind,
          value: Number(d.value),
          appliesTo: d.appliesTo,
          fromMonth: d.fromMonth,
          toMonth: d.toMonth,
          note: d.note,
        })),
      };
    }));

    // Canonical roster order: rosterNumber ASC (NULLs last), name as tiebreak.
    students.sort((a, b) => {
      const ra = a.rosterNumber;
      const rb = b.rosterNumber;
      if (ra != null && rb != null && ra !== rb) return ra - rb;
      if (ra != null && rb == null) return -1;
      if (ra == null && rb != null) return 1;
      return a.name.localeCompare(b.name, 'es') || a.inscriptionId - b.inscriptionId;
    });

    // Section totals per debt currency: what has been paid and what is still owed.
    // Pending never goes negative per bucket (an overpaid month does not offset another).
    const byCurrency: Record<string, { charged: number; paid: number; pending: number }> = {};
    const addBucket = (b: { currency: string | null; totalCharged: number; totalPaid: number; byCurrency?: Record<string, { charged: number; paid: number }> } | null | undefined) => {
      if (!b) return;
      // Per debt currency when the bucket knows it (mixed cells keep each currency separate).
      const parts = b.byCurrency && Object.keys(b.byCurrency).length
        ? Object.entries(b.byCurrency)
        : b.currency ? [[b.currency, { charged: b.totalCharged, paid: b.totalPaid }]] : [];
      for (const [cur, v] of parts as [string, { charged: number; paid: number }][]) {
        const t = byCurrency[cur] ?? (byCurrency[cur] = { charged: 0, paid: 0, pending: 0 });
        t.charged += v.charged;
        t.paid += v.paid;
        t.pending += Math.max(v.charged - v.paid, 0);
      }
    };
    for (const s of students) {
      Object.values(s.months).forEach(addBucket);
      addBucket(s.enrollment);
      addBucket(s.other);
      for (const g of s.priorPeriods) {
        Object.values(g.months).forEach(addBucket);
        addBucket(g.enrollment);
        addBucket(g.other);
      }
    }
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const totals = Object.fromEntries(Object.entries(byCurrency).map(([cur, t]) => [
      cur, { charged: round2(t.charged), paid: round2(t.paid), pending: round2(t.pending) },
    ]));

    return res.json({
      students,
      months,
      monthlyFee,
      monthlyFeeByMonth,
      totals,
    });
  } catch (error) {
    console.error('[getLedgerBySection] Error:', error);
    return res.status(500).json({ message: 'Error al obtener ledger' });
  }
};

// ── Change the entry month of an inscription and generate the debts it now owes ──

export const updateEntryMonth = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const inscription = await Inscription.findByPk(Number(req.params.id), { transaction: t });
    if (!inscription) {
      await t.rollback();
      return res.status(404).json({ message: 'Inscripción no encontrada' });
    }
    const period = await SchoolPeriod.findByPk(inscription.schoolPeriodId, { transaction: t });
    const { entryMonth } = req.body ?? {};
    if (!period || !getBillingMonths(period).includes(entryMonth)) {
      await t.rollback();
      return res.status(400).json({ message: 'El mes de ingreso no pertenece al calendario de cobro del período' });
    }
    await inscription.update({ entryMonth }, { transaction: t });
    // Only adds what is missing: existing debts (and their payments) are never removed.
    const result = await generateChargesForInscription(inscription.id, { transaction: t });
    await t.commit();
    return res.json({ entryMonth, generated: result.created + result.reactivated, warnings: result.warnings });
  } catch (error) {
    await t.rollback();
    console.error('[updateEntryMonth] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar el mes de ingreso' });
  }
};

// ── Discounts / scholarships of an inscription ──

const discountView = (d: any) => ({
  id: d.id,
  inscriptionId: d.inscriptionId,
  reasonId: d.reasonId,
  reason: d.reason ? { id: d.reason.id, name: d.reason.name } : undefined,
  kind: d.kind,
  value: Number(d.value),
  appliesTo: d.appliesTo,
  fromMonth: d.fromMonth,
  toMonth: d.toMonth,
  note: d.note,
  active: d.active,
  createdAt: d.createdAt,
});

/** Validates a discount payload against the period billing window; returns an error message or null. */
const validateDiscount = async (
  data: { reasonId: any; kind: any; value: any; appliesTo: any; fromMonth?: any; toMonth?: any },
  period: SchoolPeriod | null
): Promise<string | null> => {
  const months = getBillingMonths(period ?? {}) as string[];
  const value = Number(data.value);
  if (!DISCOUNT_KINDS.includes(data.kind)) return 'Tipo de descuento inválido';
  if (!Number.isFinite(value) || value <= 0) return 'El valor del descuento debe ser mayor a 0';
  if (data.kind === 'percent' && value > 100) return 'El porcentaje no puede superar 100';
  if (!DISCOUNT_SCOPES.includes(data.appliesTo)) return 'El descuento solo aplica a mensualidad, matrícula o todo';
  if (data.fromMonth && !months.includes(data.fromMonth)) return 'El mes inicial no pertenece al calendario de cobro';
  if (data.toMonth && !months.includes(data.toMonth)) return 'El mes final no pertenece al calendario de cobro';
  if (data.fromMonth && data.toMonth && months.indexOf(data.fromMonth) > months.indexOf(data.toMonth)) {
    return 'El mes inicial no puede ser posterior al mes final';
  }
  const reason = await DiscountReason.findByPk(Number(data.reasonId));
  if (!reason || !reason.active) return 'Motivo de descuento inválido o inactivo';
  return null;
};

export const listInscriptionDiscounts = async (req: Request, res: Response) => {
  try {
    const rows = await InscriptionDiscount.findAll({
      where: { inscriptionId: Number(req.params.id) },
      include: [{ model: DiscountReason, as: 'reason', attributes: ['id', 'name'] }],
      order: [['id', 'ASC']],
    });
    return res.json(rows.map(discountView));
  } catch (error) {
    console.error('[listInscriptionDiscounts] Error:', error);
    return res.status(500).json({ message: 'Error al listar descuentos' });
  }
};

export const createInscriptionDiscount = async (req: Request, res: Response) => {
  try {
    const inscription = await Inscription.findByPk(Number(req.params.id));
    if (!inscription) return res.status(404).json({ message: 'Inscripción no encontrada' });
    const period = await SchoolPeriod.findByPk(inscription.schoolPeriodId);
    const { reasonId, kind, value, appliesTo = 'todo', fromMonth, toMonth, note } = req.body ?? {};
    const error = await validateDiscount({ reasonId, kind, value, appliesTo, fromMonth, toMonth }, period);
    if (error) return res.status(400).json({ message: error });

    const created = await InscriptionDiscount.create({
      inscriptionId: inscription.id,
      reasonId: Number(reasonId),
      kind,
      value: Number(value),
      appliesTo,
      fromMonth: fromMonth || null,
      toMonth: toMonth || null,
      note: note || null,
      active: true,
      createdByPersonId: (req.session as any)?.user?.personId ?? null,
    });
    return res.status(201).json(discountView(created));
  } catch (error) {
    console.error('[createInscriptionDiscount] Error:', error);
    return res.status(500).json({ message: 'Error al crear el descuento' });
  }
};

export const updateInscriptionDiscount = async (req: Request, res: Response) => {
  try {
    const discount = await InscriptionDiscount.findByPk(Number(req.params.id));
    if (!discount) return res.status(404).json({ message: 'Descuento no encontrado' });
    const inscription = await Inscription.findByPk(discount.inscriptionId);
    const period = inscription ? await SchoolPeriod.findByPk(inscription.schoolPeriodId) : null;
    const body = req.body ?? {};
    const merged = {
      reasonId: body.reasonId ?? discount.reasonId,
      kind: body.kind ?? discount.kind,
      value: body.value ?? discount.value,
      appliesTo: body.appliesTo ?? discount.appliesTo,
      fromMonth: body.fromMonth !== undefined ? body.fromMonth : discount.fromMonth,
      toMonth: body.toMonth !== undefined ? body.toMonth : discount.toMonth,
    };
    const error = await validateDiscount(merged, period);
    if (error) return res.status(400).json({ message: error });

    await discount.update({
      ...merged,
      reasonId: Number(merged.reasonId),
      value: Number(merged.value),
      fromMonth: merged.fromMonth || null,
      toMonth: merged.toMonth || null,
      note: body.note !== undefined ? body.note || null : discount.note,
      active: body.active ?? discount.active,
    });
    return res.json(discountView(discount));
  } catch (error) {
    console.error('[updateInscriptionDiscount] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar el descuento' });
  }
};

export const deleteInscriptionDiscount = async (req: Request, res: Response) => {
  try {
    const discount = await InscriptionDiscount.findByPk(Number(req.params.id));
    if (!discount) return res.status(404).json({ message: 'Descuento no encontrado' });
    await discount.destroy();
    return res.json({ message: 'Descuento eliminado' });
  } catch (error) {
    console.error('[deleteInscriptionDiscount] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar el descuento' });
  }
};

// ── Create a payment ──

export const createPayment = async (req: Request, res: Response) => {
  try {
    const {
      inscriptionId, schoolPeriodId, feeId, sellableItemId, chargeId,
      month, debtPeriodId, amount, currency, amountVES, exchangeRate,
      method, reference, bank, account, paymentDate, notes, nonMonthly,
      clientRequestId, allowDuplicate, scope,
    } = req.body;

    if (!inscriptionId || !schoolPeriodId || amount === undefined || !currency) {
      return res.status(400).json({ message: 'inscriptionId, schoolPeriodId, amount y currency son requeridos' });
    }

    // Idempotency: the same form submission (double click, retry) returns the payment already created.
    if (clientRequestId) {
      const existing = await Payment.findOne({ where: { clientRequestId: String(clientRequestId) } });
      if (existing) return res.status(200).json(existing);
    }

    // Method-specific fields (bank / account / last-4 reference / notes)
    const fields = normalizePaymentFields({ method, currency, amount: Number(amount), bank, account, reference, notes });

    // A plain date means that calendar day (stored at noon UTC so every timezone shows the same day).
    const isPlainDate = typeof paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(paymentDate);
    const payDate = isPlainDate ? new Date(`${paymentDate}T12:00:00Z`) : paymentDate ? new Date(paymentDate) : new Date();
    if (isNaN(payDate.getTime())) return res.status(400).json({ message: 'Fecha de pago inválida' });
    const dayStr = payDate.toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
    if (dayStr > tomorrow) return res.status(400).json({ message: 'La fecha del pago no puede ser futura' });

    // Duplicate protection: same operation (bank/account + reference + amount + currency + day) or,
    // for payments without reference, the same student/method/amount registered in the last 10 minutes.
    const dedupeKey = allowDuplicate ? null : buildDedupeKey(fields, currency, Number(amount), dayStr);
    if (!allowDuplicate) {
      const duplicate = await findDuplicatePayment({
        dedupeKey, inscriptionId: Number(inscriptionId), method: fields.method, currency, amount: Number(amount), payDate,
      });
      if (duplicate) return res.status(409).json(duplicateResponse(duplicate));
    }
    const resolver = makeRateResolver();

    // If VES payment, try to get the exchange rate automatically if not provided
    let finalAmountVES = amountVES ?? null;
    let finalExchangeRate = exchangeRate ?? null;
    if (currency === 'VES' && finalAmountVES === null) {
      finalAmountVES = Number(amount);
      finalExchangeRate = 1;
    } else if (currency !== 'VES' && finalAmountVES === null && finalExchangeRate === null) {
      const rate = await resolver.vesPerUnit(currency, payDate);
      if (rate != null) {
        finalExchangeRate = rate;
        finalAmountVES = Number(amount) * rate;
      }
    }

    const { finalMonth, finalDebtPeriod, equivalent, equivalentCurrency, atPar } = await allocatePayment({
      inscriptionId: Number(inscriptionId), schoolPeriodId: Number(schoolPeriodId), chargeId: chargeId ? Number(chargeId) : null,
      // "__other" is the UI pseudo-month of month-less debts (enrollment and others): it means "no month".
      month: month === '__other' ? null : (month ?? null),
      debtPeriodId: debtPeriodId ? Number(debtPeriodId) : null,
      nonMonthly: !!nonMonthly || month === '__other',
      currency, amount: Number(amount), amountVES: finalAmountVES, payDate, resolver,
    });

    // Debts are settled strictly in order: a targeted payment may only go to the
    // first outstanding debt (a future month/charge is rejected while earlier
    // debts remain unpaid). Auto payments always start at the oldest debt.
    // `scope: 'item'` is the direct-purchase exception: it goes straight to the
    // sellable-item debts, optionally starting at a chosen item charge.
    const target = paymentTargetFor({
      chargeId: chargeId ? Number(chargeId) : null,
      month, nonMonthly: !!nonMonthly,
      periodId: finalDebtPeriod ?? Number(schoolPeriodId),
      scope,
    });
    if (scope === 'item') {
      const itemCharge = chargeId ? await Charge.findByPk(Number(chargeId)) : null;
      if (!itemCharge || itemCharge.inscriptionId !== Number(inscriptionId) || itemCharge.type !== 'item') {
        return res.status(400).json({ message: 'Seleccione un item vendible pendiente del estudiante' });
      }
    }
    const order = await checkTargetOrder(Number(inscriptionId), target);
    if (!order.ok) {
      return res.status(400).json({
        code: 'OUT_OF_ORDER_PAYMENT',
        message: `Los pagos deben seguir el orden de las deudas. Primero debe saldar: ${order.blocking.map(b => `${b.description} (${b.amount.toFixed(2)} ${b.currency})`).join(', ')}.`,
        blocking: order.blocking,
      });
    }

    const t = await sequelize.transaction();
    let payment: Payment;
    let parts: AllocationPart[] = [];
    try {
    payment = await Payment.create({
      inscriptionId: Number(inscriptionId),
      schoolPeriodId: Number(schoolPeriodId),
      feeId: feeId ?? null,
      sellableItemId: sellableItemId ?? null,
      chargeId: chargeId ?? null,
      month: finalMonth,
      debtPeriodId: finalDebtPeriod,
      amount: Number(amount),
      currency,
      amountVES: finalAmountVES,
      exchangeRate: finalExchangeRate,
      equivalent,
      equivalentCurrency,
      atPar,
      method: fields.method,
      reference: fields.reference,
      bank: fields.bank,
      account: fields.account,
      registeredByPersonId: (req.session as any)?.user?.personId ?? null,
      clientRequestId: clientRequestId ? String(clientRequestId) : null,
      dedupeKey,
      paymentDate: payDate,
      notes: fields.notes,
    }, { transaction: t });

    // Split the payment across the outstanding debts, each in its own currency.
    parts = await distributePayment(payment, target, { transaction: t });
    if (parts.length) await applyDistribution(payment, parts, t);
    await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }

    // A settled debt lifts the document hold of a withdrawn student.
    await clearPapersHoldIfSettled(Number(inscriptionId));

    // The breakdown tells the UI exactly which debts the payment settled.
    const allocCharges = parts.length
      ? await Charge.findAll({ where: { id: { [Op.in]: parts.map(x => x.chargeId) } }, attributes: ['id', 'description', 'type', 'month'] })
      : [];
    const chargeById = new Map(allocCharges.map(c => [c.id, c]));
    return res.status(201).json({
      ...payment.toJSON(),
      allocations: parts.map(x => ({
        chargeId: x.chargeId, amount: x.amount, currency: x.currency,
        month: x.month, periodId: x.periodId, atPar: x.atPar,
        description: chargeById.get(x.chargeId)?.description ?? null,
        type: chargeById.get(x.chargeId)?.type ?? null,
      })),
    });
  } catch (error: any) {
    if (error instanceof UniqueConstraintError) {
      // Lost a race against an identical submission: report it like a detected duplicate.
      const conditions: any[] = [];
      if (req.body?.clientRequestId) conditions.push({ clientRequestId: String(req.body.clientRequestId) });
      if ((error as any).fields?.dedupeKey) conditions.push({ dedupeKey: (error as any).fields.dedupeKey });
      const dup = conditions.length ? await Payment.findOne({ where: { [Op.or]: conditions } }) : null;
      if (dup && dup.clientRequestId && dup.clientRequestId === req.body?.clientRequestId) return res.status(200).json(dup);
      return res.status(409).json(dup
        ? duplicateResponse(await describeDuplicate(dup))
        : { code: 'DUPLICATE_PAYMENT', message: 'Este pago ya fue registrado' });
    }
    if (error?.status === 400) return res.status(400).json({ message: error.message });
    console.error('[createPayment] Error:', error);
    return res.status(500).json({ message: 'Error al registrar pago' });
  }
};

// ── Payment allocation ──

export interface PaymentAssignment {
  finalMonth: string | null;
  finalDebtPeriod: number | null;
  equivalent: number | null;
  equivalentCurrency: string | null;
  /** Credited 1:1 (USD/USDT against a EUR debt, period setting `usdAtPar`). */
  atPar: boolean;
}

/**
 * Decides which debt bucket a payment settles and expresses it in that
 * bucket's currency at the payment-date rate (e.g. Bs. 30k → ~USD 100).
 *
 * Without a month the payment goes to the oldest month bucket with outstanding
 * debt: earlier periods first, then each period's own billing calendar,
 * balances netted in VES, inactive charges ignored. `nonMonthly` payments
 * settle enrollment / one-time debts and are never assigned to a month.
 * A payment linked to a charge inherits that charge's period/month/currency.
 * Throws an Error with `status = 400` for inconsistent input.
 */
async function allocatePayment(args: {
  inscriptionId: number; schoolPeriodId: number; chargeId?: number | null; month?: string | null;
  debtPeriodId?: number | null; nonMonthly?: boolean; currency: string; amount: number;
  amountVES: number | null; payDate: Date; resolver: ReturnType<typeof makeRateResolver>;
}): Promise<PaymentAssignment> {
  const fail = (message: string) => Object.assign(new Error(message), { status: 400 });
  const { inscriptionId, schoolPeriodId, currency, amount, payDate, resolver } = args;

  const finalDebtPeriodId = args.debtPeriodId ? Number(args.debtPeriodId) : null;
  if (finalDebtPeriodId && !(await SchoolPeriod.findByPk(finalDebtPeriodId))) {
    throw fail('El período de la deuda no existe');
  }

  let linkedCharge: Charge | null = null;
  if (args.chargeId) {
    linkedCharge = await Charge.findByPk(Number(args.chargeId));
    if (!linkedCharge || linkedCharge.inscriptionId !== inscriptionId) {
      throw fail('La deuda indicada no pertenece a esta inscripción');
    }
  }

  let finalMonth = args.month ?? null;
  let finalDebtPeriod = finalDebtPeriodId;
  if (linkedCharge) {
    finalDebtPeriod = linkedCharge.schoolPeriodId;
    if (!finalMonth) finalMonth = linkedCharge.month;
  } else if (!finalMonth && !args.nonMonthly) {
    const buckets = await loadDebtBuckets(inscriptionId);
    const periodIds = [...new Set(buckets.map(b => b.periodId))];
    const periods = await SchoolPeriod.findAll({ where: { id: { [Op.in]: periodIds } } });
    const ordered = orderBuckets(buckets, new Map(periods.map(p => [p.id, p])));
    const target = ordered.find(b => b.month !== null && b.chargedVES - b.paidVES > 0.005);
    if (target) {
      finalMonth = target.month;
      finalDebtPeriod = target.periodId;
    } else {
      // No monthly debt anywhere — assign to the current month of the viewed period
      finalMonth = monthCodeFromDate(new Date());
      finalDebtPeriod = finalDebtPeriodId ?? null;
    }
  }

  let equivalent: number | null = null;
  let equivalentCurrency: string | null = null;
  const targetCharges = linkedCharge ? [linkedCharge] : await Charge.findAll({
    where: {
      inscriptionId,
      active: true,
      schoolPeriodId: finalDebtPeriod ?? schoolPeriodId,
      ...(finalMonth ? { month: finalMonth } : args.nonMonthly ? { month: null } : {}),
    },
    order: [['id', 'ASC']],
  });
  const bucketCurrency = targetCharges[0]?.currency;
  let atPar = false;
  if (bucketCurrency) {
    equivalentCurrency = bucketCurrency;
    const debtPeriod = await SchoolPeriod.findByPk(finalDebtPeriod ?? schoolPeriodId, { attributes: ['id', 'usdAtPar'] });
    atPar = appliesAtPar(currency, bucketCurrency, !!debtPeriod?.usdAtPar);
    if (currency === bucketCurrency || atPar) {
      equivalent = Number(amount);
    } else {
      const probe = { currency, amount: Number(amount), amountVES: args.amountVES, paymentDate: payDate } as Payment;
      const v = await paymentInCurrency(probe, bucketCurrency, resolver);
      equivalent = v != null ? Math.round(v * 100) / 100 : null;
    }
  }
  return { finalMonth, finalDebtPeriod, equivalent, equivalentCurrency, atPar };
}

// ── Payment distribution over debts ──

/** Writes the distribution's summary back onto the payment's compatibility fields. */
async function applyDistribution(payment: Payment, parts: AllocationPart[], transaction?: Transaction) {
  const currencies = [...new Set(parts.map(x => x.currency))];
  const periods = [...new Set(parts.map(x => x.periodId))];
  const months = [...new Set(parts.map(x => x.month))];
  await payment.update({
    chargeId: parts.length === 1 ? parts[0].chargeId : null,
    month: months.length === 1 ? months[0] : null,
    debtPeriodId: periods.length === 1 ? periods[0] : payment.schoolPeriodId,
    equivalent: currencies.length === 1 ? Math.round(parts.reduce((sum, x) => sum + x.amount, 0) * 100) / 100 : null,
    equivalentCurrency: currencies.length === 1 ? currencies[0] : null,
    atPar: parts.some(x => x.atPar),
  }, { transaction });
}

/** The debts a payment targets: a sellable item, academic debts only, an explicit
 * charge, a month's bucket, month-less debts, or every debt (auto). */
function paymentTargetFor(args: {
  chargeId?: number | null; month?: string | null; nonMonthly?: boolean;
  periodId: number; scope?: string;
}): AllocationTarget {
  if (args.scope === 'item') return { kind: 'item', chargeId: args.chargeId ? Number(args.chargeId) : undefined };
  if (args.scope === 'tuition') return { kind: 'tuition' };
  if (args.chargeId) return { kind: 'charge', chargeId: Number(args.chargeId) };
  if (args.month && args.month !== '__other') return { kind: 'month', periodId: args.periodId, month: args.month };
  if (args.nonMonthly || args.month === '__other') return { kind: 'oneTime', periodId: args.periodId };
  return { kind: 'auto' };
}

// ── Duplicate payment detection ──

interface DuplicateInfo {
  id: number; studentName: string; registeredBy: string | null; paymentDate: Date; createdAt: Date;
  amount: number; currency: string; method: string; reference: string | null;
}

async function describeDuplicate(p: Payment): Promise<DuplicateInfo> {
  const [ins, who] = await Promise.all([
    Inscription.findByPk(p.inscriptionId, { include: [{ model: Person, as: 'student', attributes: ['firstName', 'lastName'] }] }),
    p.registeredByPersonId ? Person.findByPk(p.registeredByPersonId, { attributes: ['firstName', 'lastName'] }) : null,
  ]);
  const st = (ins as any)?.student;
  return {
    id: p.id,
    studentName: st ? `${st.lastName}, ${st.firstName}` : '—',
    registeredBy: who ? `${who.lastName}, ${who.firstName}` : null,
    paymentDate: p.paymentDate,
    createdAt: p.createdAt,
    amount: Number(p.amount),
    currency: p.currency,
    method: p.method,
    reference: p.reference,
  };
}

const duplicateResponse = (d: DuplicateInfo) => ({
  code: 'DUPLICATE_PAYMENT',
  message: 'Este pago parece estar duplicado',
  duplicate: d,
});

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

async function findDuplicatePayment(args: {
  dedupeKey: string | null; inscriptionId: number; method: string; currency: string; amount: number; payDate: Date;
}): Promise<DuplicateInfo | null> {
  if (args.dedupeKey) {
    const byKey = await Payment.findOne({ where: { dedupeKey: args.dedupeKey } });
    if (byKey) return describeDuplicate(byKey);
    // A distinct reference proves a distinct operation: skip the time-window heuristic.
    return null;
  }
  const recent = await Payment.findOne({
    where: {
      inscriptionId: args.inscriptionId,
      method: args.method,
      currency: args.currency,
      amount: args.amount,
      paymentDate: {
        [Op.gte]: new Date(`${args.payDate.toISOString().slice(0, 10)}T00:00:00Z`),
        [Op.lte]: new Date(`${args.payDate.toISOString().slice(0, 10)}T23:59:59.999Z`),
      },
      createdAt: { [Op.gte]: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    } as any,
  });
  return recent ? describeDuplicate(recent) : null;
}

// ── Create a charge (debt) ──

export const createCharge = async (req: Request, res: Response) => {
  try {
    const {
      inscriptionId, schoolPeriodId, feeId, sellableItemId,
      type, month, description, amount, currency, amountVES, dueDate,
    } = req.body;

    if (!inscriptionId || !schoolPeriodId || !type || !description || amount === undefined || !currency) {
      return res.status(400).json({ message: 'inscriptionId, schoolPeriodId, type, description, amount y currency son requeridos' });
    }

    // The charge's period is the period the debt belongs to — it may differ
    // from the inscription's period (e.g. a fee owed from last year).
    const debtPeriod = await SchoolPeriod.findByPk(Number(schoolPeriodId));
    if (!debtPeriod) {
      return res.status(400).json({ message: 'El período de la deuda no existe' });
    }
    if (month && !getBillingMonths(debtPeriod).includes(month)) {
      return res.status(400).json({ message: 'El mes no pertenece al calendario de cobro de ese período' });
    }

    // Auto-calculate amountVES if not provided
    let finalAmountVES = amountVES ?? null;
    if (currency !== 'VES' && finalAmountVES === null) {
      const rateType = await ExchangeRateType.findOne({ where: { currency } });
      if (rateType) {
        const rate = await ExchangeRate.findOne({
          where: { exchangeRateTypeId: rateType.id, date: { [Op.lte]: new Date().toISOString().slice(0, 10) } },
          order: [['date', 'DESC']],
        });
        if (rate) {
          finalAmountVES = Number(amount) * Number(rate.rate);
        }
      }
    }

    const charge = await Charge.create({
      inscriptionId: Number(inscriptionId),
      schoolPeriodId: Number(schoolPeriodId),
      feeId: feeId ?? null,
      sellableItemId: sellableItemId ?? null,
      type,
      month: month ?? null,
      description,
      amount: Number(amount),
      currency,
      amountVES: finalAmountVES,
      dueDate: dueDate ? new Date(dueDate) : null,
      active: true,
    });

    return res.status(201).json(charge);
  } catch (error) {
    console.error('[createCharge] Error:', error);
    return res.status(500).json({ message: 'Error al crear deuda' });
  }
};

// ── Bulk create charges (e.g. generate monthly charges for all students in a section) ──

export const bulkCreateCharges = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { charges } = req.body; // array of charge objects
    if (!Array.isArray(charges) || charges.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Se requiere un array de charges' });
    }
    const periodIds = [...new Set(charges.map(c => Number(c.schoolPeriodId)).filter(Boolean))];
    const debtPeriods = await SchoolPeriod.findAll({ where: { id: { [Op.in]: periodIds } }, transaction: t });
    if (debtPeriods.length !== periodIds.length) {
      await t.rollback();
      return res.status(400).json({ message: 'Algún período de la deuda no existe' });
    }

    const created = await Charge.bulkCreate(charges.map(c => ({
      inscriptionId: Number(c.inscriptionId),
      schoolPeriodId: Number(c.schoolPeriodId),
      feeId: c.feeId ?? null,
      sellableItemId: c.sellableItemId ?? null,
      type: c.type,
      month: c.month ?? null,
      description: c.description,
      amount: Number(c.amount),
      currency: c.currency,
      amountVES: c.amountVES ?? null,
      dueDate: c.dueDate ? new Date(c.dueDate) : null,
      active: true,
    })), { transaction: t });

    await t.commit();
    return res.status(201).json({ created: created.length });
  } catch (error) {
    await t.rollback();
    console.error('[bulkCreateCharges] Error:', error);
    return res.status(500).json({ message: 'Error al crear deudas masivamente' });
  }
};

// ── Delete a payment ──

const correctionReason = (value: unknown): string | null => {
  const reason = String(value ?? '').trim();
  return reason.length >= 3 ? reason.slice(0, 500) : null;
};

/**
 * DELETE /payments/:id  body { reason } — removes a payment entered by mistake.
 * The reason is mandatory and the payment is kept as a snapshot in the audit trail.
 */
export const deletePayment = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const payment = await Payment.findByPk(Number(req.params.id), { transaction: t });
    if (!payment) {
      await t.rollback();
      return res.status(404).json({ message: 'Pago no encontrado' });
    }
    const reason = correctionReason(req.body?.reason);
    if (!reason) {
      await t.rollback();
      return res.status(400).json({ message: 'Indique el motivo de la eliminación' });
    }
    const inscriptionId = payment.inscriptionId;
    await PaymentAuditLog.create({
      paymentId: payment.id,
      action: 'deleted',
      fromInscriptionId: inscriptionId,
      performedByPersonId: (req.session as any)?.user?.personId ?? null,
      reason,
      snapshot: JSON.stringify(payment.toJSON()),
    }, { transaction: t });
    await PaymentAllocation.destroy({ where: { paymentId: payment.id }, transaction: t });
    await payment.destroy({ transaction: t });
    await t.commit();
    // Deleting a payment may reopen a debt — the hold only lifts automatically.
    await clearPapersHoldIfSettled(inscriptionId);
    return res.json({ message: 'Pago eliminado' });
  } catch (error) {
    await t.rollback();
    console.error('[deletePayment] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar pago' });
  }
};

/**
 * POST /payments/:id/move  body { toInscriptionId, reason } — a payment charged to the wrong
 * student goes to the right one. The payment keeps its id, date, registrar and operation data;
 * it is re-allocated to the destination's oldest outstanding debt. Both students must belong
 * to the same school period.
 */
export const movePayment = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const payment = await Payment.findByPk(Number(req.params.id), { transaction: t });
    if (!payment) {
      await t.rollback();
      return res.status(404).json({ message: 'Pago no encontrado' });
    }
    const reason = correctionReason(req.body?.reason);
    if (!reason) {
      await t.rollback();
      return res.status(400).json({ message: 'Indique el motivo del cambio de estudiante' });
    }
    const toInscriptionId = Number(req.body?.toInscriptionId);
    const target = toInscriptionId ? await Inscription.findByPk(toInscriptionId, { transaction: t }) : null;
    if (!target) {
      await t.rollback();
      return res.status(400).json({ message: 'Seleccione el estudiante destino' });
    }
    if (target.id === payment.inscriptionId) {
      await t.rollback();
      return res.status(400).json({ message: 'El pago ya pertenece a ese estudiante' });
    }
    if (target.schoolPeriodId !== payment.schoolPeriodId) {
      await t.rollback();
      return res.status(400).json({ message: 'El estudiante destino debe ser del mismo período escolar' });
    }

    const fromInscriptionId = payment.inscriptionId;
    const snapshot = JSON.stringify(payment.toJSON());

    // The old allocations belonged to the previous student's debts: clear them and distribute again.
    await payment.update({ inscriptionId: target.id, chargeId: null, month: null, debtPeriodId: null, equivalent: null, equivalentCurrency: null, atPar: false }, { transaction: t });
    await PaymentAllocation.destroy({ where: { paymentId: payment.id }, transaction: t });
    const parts = await distributePayment(payment, { kind: 'auto' }, { transaction: t });
    if (parts.length) {
      await applyDistribution(payment, parts, t);
    } else {
      const alloc = await allocatePayment({
        inscriptionId: target.id,
        schoolPeriodId: payment.schoolPeriodId,
        currency: payment.currency,
        amount: Number(payment.amount),
        amountVES: payment.amountVES != null ? Number(payment.amountVES) : null,
        payDate: payment.paymentDate,
        resolver: makeRateResolver(t),
      });
      await payment.update({
        month: alloc.finalMonth,
        debtPeriodId: alloc.finalDebtPeriod,
        equivalent: alloc.equivalent,
        equivalentCurrency: alloc.equivalentCurrency,
        atPar: alloc.atPar,
      }, { transaction: t });
    }

    await PaymentAuditLog.create({
      paymentId: payment.id,
      action: 'moved',
      fromInscriptionId,
      toInscriptionId: target.id,
      performedByPersonId: (req.session as any)?.user?.personId ?? null,
      reason,
      snapshot,
    }, { transaction: t });
    await t.commit();

    await clearPapersHoldIfSettled(target.id);
    await clearPapersHoldIfSettled(fromInscriptionId);
    return res.json(payment);
  } catch (error: any) {
    await t.rollback();
    if (error?.status === 400) return res.status(400).json({ message: error.message });
    console.error('[movePayment] Error:', error);
    return res.status(500).json({ message: 'Error al cambiar el pago de estudiante' });
  }
};

/** GET /payments/audit?inscriptionId= — corrections that touched a student's payments. */
export const listPaymentAudit = async (req: Request, res: Response) => {
  try {
    const inscriptionId = Number(req.query.inscriptionId);
    if (!inscriptionId) return res.status(400).json({ message: 'inscriptionId es requerido' });
    const logs = await PaymentAuditLog.findAll({
      where: { [Op.or]: [{ fromInscriptionId: inscriptionId }, { toInscriptionId: inscriptionId }] },
      include: [{ model: Person, as: 'performer', attributes: ['id', 'firstName', 'lastName'] }],
      order: [['createdAt', 'DESC']],
    });
    return res.json(logs.map(l => ({ ...l.toJSON(), snapshot: JSON.parse(l.snapshot) })));
  } catch (error) {
    console.error('[listPaymentAudit] Error:', error);
    return res.status(500).json({ message: 'Error al obtener la auditoría de pagos' });
  }
};

// ── Delete a charge ──

export const deleteCharge = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const charge = await Charge.findByPk(Number(id));
    if (!charge) return res.status(404).json({ message: 'Deuda no encontrada' });
    const inscriptionId = charge.inscriptionId;
    await charge.destroy();
    await clearPapersHoldIfSettled(inscriptionId);
    return res.json({ message: 'Deuda eliminada' });
  } catch (error) {
    console.error('[deleteCharge] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar deuda' });
  }
};

// ── Get available sections for a period (for the dropdown) ──

export const getSectionsForPeriod = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId } = req.params;
    const inscriptions = await Inscription.findAll({
      where: { schoolPeriodId: Number(schoolPeriodId) },
      include: [
        { model: Section, as: 'section', attributes: ['id', 'name', 'isMateriaPendiente'] },
        { model: Grade, as: 'grade', attributes: ['id', 'name', 'order'] },
      ],
      attributes: ['sectionId', 'gradeId'],
      group: ['sectionId', 'gradeId', 'section.id', 'grade.id'],
    });

    const sections = inscriptions
      .map((i: any) => ({
        sectionId: i.sectionId,
        sectionName: (i.section as any)?.name ?? 'Sin sección',
        isMateriaPendiente: (i.section as any)?.isMateriaPendiente === true,
        gradeId: i.gradeId,
        gradeName: (i.grade as any)?.name ?? '—',
        gradeOrder: (i.grade as any)?.order ?? 9999,
      }))
      .filter((v: any, idx: number, arr: any[]) => arr.findIndex((a: any) => a.gradeId === v.gradeId && a.sectionId === v.sectionId) === idx)
      .filter((s: any) => !s.isMateriaPendiente && s.sectionId != null);

    // "Sin sección" groups: withdrawn students (latest inscription withdrawn).
    // A group only appears when at least one of its members still owes money —
    // a debt-free withdrawn group is noise, not work.
    const withdrawn = await loadWithdrawnInscriptions();
    const debtFlags = await Promise.all(withdrawn.map(i => inscriptionDebtSummary(i.id)));
    for (let idx = 0; idx < withdrawn.length; idx++) {
      if (!debtFlags[idx].hasDebt) continue;
      const ins = withdrawn[idx];
      if (sections.some(s => s.gradeId === ins.gradeId && s.sectionId == null)) continue;
      sections.push({
        sectionId: null,
        sectionName: 'Sin sección',
        isMateriaPendiente: false,
        gradeId: ins.gradeId,
        gradeName: ins.grade?.name ?? '—',
        gradeOrder: ins.grade?.order ?? 9999,
      });
    }

    const sorted = sections
      .sort((a: any, b: any) =>
        a.gradeOrder - b.gradeOrder
        || a.gradeName.localeCompare(b.gradeName, 'es')
        || a.sectionName.localeCompare(b.sectionName, 'es'))
      .map(({ isMateriaPendiente, gradeOrder, ...rest }) => rest);

    return res.json(sorted);
  } catch (error) {
    console.error('[getSectionsForPeriod] Error:', error);
    return res.status(500).json({ message: 'Error al obtener secciones' });
  }
};

/**
 * GET /ledger/withdrawn-students?q=
 * Search withdrawn students (latest inscription withdrawn) by name or document.
 * Powers the "add debt to a withdrawn student" flow: each result carries the
 * inscriptionId the charge should be attached to.
 */
export const searchWithdrawnStudents = async (req: Request, res: Response) => {
  try {
    // Accent-insensitive: "diaz" must match "DÍAZ".
    const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const q = fold(String(req.query.q ?? '').trim());
    if (q.length < 2) return res.json([]);

    const withdrawn = await loadWithdrawnInscriptions();
    const results = withdrawn
      .filter((i: any) => {
        const p = i.student ?? {};
        const hay = fold(`${p.lastName ?? ''} ${p.firstName ?? ''} ${p.document ?? ''}`);
        return hay.includes(q);
      })
      .sort((a: any, b: any) =>
        (a.student?.lastName ?? '').localeCompare(b.student?.lastName ?? '', 'es')
        || (a.student?.firstName ?? '').localeCompare(b.student?.firstName ?? '', 'es'))
      .slice(0, 25)
      .map((i: any) => ({
        inscriptionId: i.id,
        personId: i.personId,
        name: `${i.student?.lastName ?? ''}, ${i.student?.firstName ?? ''}`.trim().replace(/^,\s*/, ''),
        document: i.student?.document ?? '',
        documentType: i.student?.documentType ?? '',
        gradeName: i.grade?.name ?? '—',
        periodName: i.period?.name ?? i.period?.period ?? '—',
        withdrawnAt: i.withdrawnAt,
      }));

    return res.json(results);
  } catch (error) {
    console.error('[searchWithdrawnStudents] Error:', error);
    return res.status(500).json({ message: 'Error al buscar estudiantes retirados' });
  }
};

// ── Debt summary of a single inscription (all periods, chronological) ──
// Powers the withdrawal dialog ("what happens with the debt?") and any place
// that needs to know what a student still owes.

export const getInscriptionDebt = async (req: Request, res: Response) => {
  try {
    const inscription = await Inscription.findByPk(Number(req.params.id));
    if (!inscription) return res.status(404).json({ message: 'Inscripción no encontrada' });
    const summary = await inscriptionDebtSummary(inscription.id);
    return res.json({
      inscriptionId: inscription.id,
      withdrawn: !!inscription.withdrawnAt,
      papersHold: (inscription as any).papersHold === true,
      hasDebt: summary.hasDebt,
      totals: summary.totals,
      buckets: summary.buckets.map(b => ({
        periodId: b.periodId,
        periodName: b.periodName,
        month: b.month,
        currency: b.currency,
        charged: Math.round(b.charged * 100) / 100,
        paid: Math.round(b.paid * 100) / 100,
        remaining: Math.round(Math.max(b.charged - b.paid, 0) * 100) / 100,
        // Per debt currency — a bucket can mix them (EUR enrollment + USD uniform).
        byCurrency: Object.fromEntries(Object.entries(b.byCurrency).map(([cur, v]) => [
          cur, { charged: Math.round(v.charged * 100) / 100, paid: Math.round(v.paid * 100) / 100 },
        ])),
        charges: b.charges.map((c: any) => ({ id: c.id, type: c.type, description: c.description, amount: Number(c.amount), currency: c.currency })),
        paymentCount: b.payments.length,
      })),
    });
  } catch (error) {
    console.error('[getInscriptionDebt] Error:', error);
    return res.status(500).json({ message: 'Error al obtener la deuda del estudiante' });
  }
};

// ── Release the document hold of a withdrawn student (manual override) ──

export const releasePapers = async (req: Request, res: Response) => {
  try {
    const inscription = await Inscription.findByPk(Number(req.params.id));
    if (!inscription) return res.status(404).json({ message: 'Inscripción no encontrada' });
    await inscription.update({ papersHold: false } as any);
    return res.json({ papersHold: false });
  } catch (error) {
    console.error('[releasePapers] Error:', error);
    return res.status(500).json({ message: 'Error al liberar los documentos' });
  }
};
