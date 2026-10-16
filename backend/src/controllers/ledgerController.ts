import { Request, Response } from 'express';
import sequelize from '@/config/database';
import { Op } from 'sequelize';
import {
  Inscription, Person, Grade, Section, SchoolPeriod,
  Payment, Charge, Fee, SellableItem, ExchangeRate, ExchangeRateType,
  InscriptionDiscount, DiscountReason,
} from '@/models/index';
import { DISCOUNT_KINDS, DISCOUNT_SCOPES } from '@/models/InscriptionDiscount';
import { applyDiscountsToCharges, DiscountRule } from '@/services/discountService';
import { getBillingMonths, monthCodeFromDate } from '@/services/billingCalendarService';
import { pickEffective } from '@/services/feeResolverService';
import { generateChargesForInscription } from '@/services/chargeScheduleService';
import {
  clearPapersHoldIfSettled, inscriptionDebtSummary, loadDebtBuckets, makeRateResolver,
  orderBuckets, paymentBucketMonth, paymentDebtPeriodId, paymentInCurrency,
} from '@/services/debtBalanceService';

// ── Ledger: list students by section with their charges & payments ──

export const getLedgerBySection = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, gradeId, sectionId } = req.params;

    // Get all inscriptions for this grade+section+period, with student info
    const inscriptions = await Inscription.findAll({
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
        grossCharged: number; totalDiscount: number; totalCharged: number; totalPaid: number;
        totalChargedVES: number; totalPaidVES: number;
      };
      const emptyBucket = (): Bucket => ({
        charges: [], payments: [], currency: null,
        grossCharged: 0, totalDiscount: 0, totalCharged: 0, totalPaid: 0,
        totalChargedVES: 0, totalPaidVES: 0,
      });
      const addCharge = async (b: Bucket, c: any) => {
        b.charges.push(c);
        if (!b.currency) b.currency = c.currency;
        const net = c.amount - c.discountAmount;
        b.grossCharged += c.amount;
        b.totalDiscount += c.discountAmount;
        b.totalCharged += net;
        const rate = c.currency === 'VES' ? 1 : await resolver.vesPerUnit(c.currency, new Date());
        b.totalChargedVES += rate != null ? net * rate : net;
      };
      const addPayment = async (b: Bucket, p: any) => {
        b.payments.push(p);
        if (!b.currency) b.currency = p.currency;
        // Payments count in the debt's currency: stored equivalent, or the
        // payment-date rate conversion (Bs. → USD/EUR of the debt).
        const v = await paymentInCurrency(p, b.currency!, resolver);
        if (v != null) b.totalPaid += v;
        b.totalPaidVES += p.amountVES != null
          ? Number(p.amountVES)
          : (await resolver.vesPerUnit(p.currency, p.paymentDate) ?? 1) * Number(p.amount);
      };
      const roundBucket = (b: Bucket): Bucket => ({
        ...b,
        grossCharged: Math.round(b.grossCharged * 100) / 100,
        totalDiscount: Math.round(b.totalDiscount * 100) / 100,
        totalCharged: Math.round(b.totalCharged * 100) / 100,
        totalPaid: Math.round(b.totalPaid * 100) / 100,
        totalChargedVES: Math.round(b.totalChargedVES * 100) / 100,
        totalPaidVES: Math.round(b.totalPaidVES * 100) / 100,
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

      for (const c of discountedCharges) {
        const g = groupFor(c.schoolPeriodId);
        await addCharge(c.month ? monthBucketFor(g, c.month) : flatBucketFor(g, c.type), c);
      }
      // Month-less payments: a payment linked to a charge follows that charge's
      // bucket; otherwise it covers enrollment debt first (the older one), then
      // extraordinary debts.
      for (const p of studentPayments) {
        const g = groupFor(paymentDebtPeriodId(p));
        const m = paymentBucketMonth(p);
        let bucket: Bucket;
        if (m) {
          bucket = monthBucketFor(g, m);
        } else {
          const linkType = (p as any).charge?.type;
          bucket = linkType ? flatBucketFor(g, linkType)
            : flatBucketFor(g, g.enrollment.totalCharged - g.enrollment.totalPaid > 0.005 ? null : 'otro');
        }
        await addPayment(bucket, p);
      }
      // A single month-less payment may exceed the remaining enrollment debt —
      // its overflow actually covers extraordinary debts, so shift the display
      // totals accordingly (the payment row stays under enrollment).
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
      };
      rebalanceOverflow(viewedGroup);
      priorMap.forEach(rebalanceOverflow);
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

    return res.json({
      students,
      months,
      monthlyFee,
      monthlyFeeByMonth,
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
      method, reference, bank, paymentDate, notes, nonMonthly,
    } = req.body;

    if (!inscriptionId || !schoolPeriodId || amount === undefined || !currency) {
      return res.status(400).json({ message: 'inscriptionId, schoolPeriodId, amount y currency son requeridos' });
    }

    const payDate = paymentDate ? new Date(paymentDate) : new Date();
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

    // Validate the debt period if one was given
    const finalDebtPeriodId = debtPeriodId ? Number(debtPeriodId) : null;
    if (finalDebtPeriodId && !(await SchoolPeriod.findByPk(finalDebtPeriodId))) {
      return res.status(400).json({ message: 'El período de la deuda no existe' });
    }

    // A payment linked to a specific charge inherits that charge's debt
    // period/month/currency — the caller may not know them.
    let linkedCharge: Charge | null = null;
    if (chargeId) {
      linkedCharge = await Charge.findByPk(Number(chargeId));
      if (!linkedCharge || linkedCharge.inscriptionId !== Number(inscriptionId)) {
        return res.status(400).json({ message: 'La deuda indicada no pertenece a esta inscripción' });
      }
    }

    // If no month specified, auto-distribute to the oldest month bucket with
    // outstanding debt. Debts are grouped by (charge's schoolPeriodId, month):
    // earlier periods settle first, and within a period months follow its own
    // billing calendar. Balances are netted in VES so a payment in bolívares
    // counts correctly against a USD/EUR debt. Inactive charges are ignored.
    // nonMonthly: the payment settles enrollment / one-time debts, so it must
    // not be assigned to a month.
    let finalMonth = month ?? null;
    let finalDebtPeriod = finalDebtPeriodId;
    if (linkedCharge) {
      finalDebtPeriod = linkedCharge.schoolPeriodId;
      if (!finalMonth) finalMonth = linkedCharge.month;
    } else if (!finalMonth && !nonMonthly) {
      const buckets = await loadDebtBuckets(Number(inscriptionId));
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

    // Express the payment in the currency of the debt bucket it settles, using
    // the rate in force on the payment date (e.g. Bs. 30k → ~USD 100).
    let equivalent: number | null = null;
    let equivalentCurrency: string | null = null;
    const targetCharges = linkedCharge ? [linkedCharge] : await Charge.findAll({
      where: {
        inscriptionId: Number(inscriptionId),
        active: true,
        schoolPeriodId: finalDebtPeriod ?? Number(schoolPeriodId),
        ...(finalMonth ? { month: finalMonth } : nonMonthly ? { month: null } : {}),
      },
      order: [['id', 'ASC']],
    });
    const bucketCurrency = targetCharges[0]?.currency;
    if (bucketCurrency) {
      equivalentCurrency = bucketCurrency;
      const probe = { currency, amount: Number(amount), amountVES: finalAmountVES, paymentDate: payDate } as Payment;
      if (currency === bucketCurrency) {
        equivalent = Number(amount);
      } else {
        const v = await paymentInCurrency(probe, bucketCurrency, resolver);
        equivalent = v != null ? Math.round(v * 100) / 100 : null;
      }
    }

    const payment = await Payment.create({
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
      method: method ?? 'efectivo',
      reference: reference ?? null,
      bank: bank ?? null,
      paymentDate: payDate,
      notes: notes ?? null,
    });

    // A settled debt lifts the document hold of a withdrawn student.
    await clearPapersHoldIfSettled(Number(inscriptionId));

    return res.status(201).json(payment);
  } catch (error) {
    console.error('[createPayment] Error:', error);
    return res.status(500).json({ message: 'Error al registrar pago' });
  }
};

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

export const deletePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findByPk(Number(id));
    if (!payment) return res.status(404).json({ message: 'Pago no encontrado' });
    const inscriptionId = payment.inscriptionId;
    await payment.destroy();
    // Deleting a payment may reopen a debt — the hold only lifts automatically.
    await clearPapersHoldIfSettled(inscriptionId);
    return res.json({ message: 'Pago eliminado' });
  } catch (error) {
    console.error('[deletePayment] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar pago' });
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
      .filter((s: any) => !s.isMateriaPendiente)
      .sort((a: any, b: any) =>
        a.gradeOrder - b.gradeOrder
        || a.gradeName.localeCompare(b.gradeName, 'es')
        || a.sectionName.localeCompare(b.sectionName, 'es'))
      .map(({ isMateriaPendiente, gradeOrder, ...rest }) => rest);

    return res.json(sections);
  } catch (error) {
    console.error('[getSectionsForPeriod] Error:', error);
    return res.status(500).json({ message: 'Error al obtener secciones' });
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
