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

    // Build student list
    const students = inscriptions.map((insc: any) => {
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

      type Bucket = { charges: any[]; payments: any[]; grossCharged: number; totalDiscount: number; totalCharged: number; totalPaid: number };
      const emptyBucket = (): Bucket => ({ charges: [], payments: [], grossCharged: 0, totalDiscount: 0, totalCharged: 0, totalPaid: 0 });
      const addCharge = (b: Bucket, c: any) => {
        b.charges.push(c);
        b.grossCharged += c.amount;
        b.totalDiscount += c.discountAmount;
        b.totalCharged += c.amount - c.discountAmount;
      };
      const roundBucket = (b: Bucket): Bucket => ({
        ...b,
        grossCharged: Math.round(b.grossCharged * 100) / 100,
        totalDiscount: Math.round(b.totalDiscount * 100) / 100,
        totalCharged: Math.round(b.totalCharged * 100) / 100,
        totalPaid: Math.round(b.totalPaid * 100) / 100,
      });

      // Group by month
      const monthsData: Record<string, Bucket> = {};
      const nonMonthly = emptyBucket();
      for (const c of discountedCharges) {
        if (c.month) {
          if (!monthsData[c.month]) monthsData[c.month] = emptyBucket();
          addCharge(monthsData[c.month], c);
        } else {
          addCharge(nonMonthly, c);
        }
      }
      for (const p of studentPayments) {
        const month = p.month || (p.charge as any)?.month;
        if (month) {
          if (!monthsData[month]) monthsData[month] = emptyBucket();
          monthsData[month].payments.push(p);
          monthsData[month].totalPaid += Number(p.amount);
        } else {
          nonMonthly.payments.push(p);
          nonMonthly.totalPaid += Number(p.amount);
        }
      }
      for (const m of Object.keys(monthsData)) monthsData[m] = roundBucket(monthsData[m]);

      return {
        inscriptionId: insc.id,
        personId: person?.id,
        name: `${person?.lastName}, ${person?.firstName}`,
        document: person?.document,
        rosterNumber: insc.rosterNumber ?? null,
        entryMonth: insc.entryMonth ?? null,
        gradeName: (insc.grade as any)?.name,
        sectionName: (insc.section as any)?.name,
        months: monthsData,
        nonMonthly: roundBucket(nonMonthly),
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
    });

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
      month, amount, currency, amountVES, exchangeRate,
      method, reference, bank, paymentDate, notes, nonMonthly,
    } = req.body;

    if (!inscriptionId || !schoolPeriodId || amount === undefined || !currency) {
      return res.status(400).json({ message: 'inscriptionId, schoolPeriodId, amount y currency son requeridos' });
    }

    // If VES payment, try to get the exchange rate automatically if not provided
    let finalAmountVES = amountVES ?? null;
    let finalExchangeRate = exchangeRate ?? null;
    if (currency === 'VES' && finalAmountVES === null) {
      finalAmountVES = Number(amount);
      finalExchangeRate = 1;
    } else if (currency !== 'VES' && finalAmountVES === null && finalExchangeRate === null) {
      // Try to get the rate for this currency
      const rateType = await ExchangeRateType.findOne({ where: { currency } });
      if (rateType) {
        const rate = await ExchangeRate.findOne({
          where: { exchangeRateTypeId: rateType.id, date: { [Op.lte]: new Date().toISOString().slice(0, 10) } },
          order: [['date', 'DESC']],
        });
        if (rate) {
          finalExchangeRate = Number(rate.rate);
          finalAmountVES = Number(amount) * finalExchangeRate;
        }
      }
    }

    // If no month specified, auto-distribute to the first month with outstanding debt
    // nonMonthly: the payment settles enrollment / one-time debts, so it must not be assigned to a month.
    let finalMonth = month ?? null;
    if (!finalMonth && !nonMonthly) {
      // Find charges for this inscription that have a month, ordered by month order
      const existingCharges = await Charge.findAll({
        where: { inscriptionId: Number(inscriptionId), month: { [Op.ne]: null } },
        order: [['id', 'ASC']],
      });
      const existingPayments = await Payment.findAll({
        where: { inscriptionId: Number(inscriptionId), month: { [Op.ne]: null } },
        attributes: ['month', 'amount', 'currency'],
      });
      // Build per-month balance: charged - paid
      const monthBalance: Record<string, number> = {};
      for (const c of existingCharges) {
        const m = (c as any).month;
        if (!monthBalance[m]) monthBalance[m] = 0;
        monthBalance[m] += Number((c as any).amount);
      }
      for (const p of existingPayments) {
        const m = (p as any).month;
        if (!monthBalance[m]) monthBalance[m] = 0;
        monthBalance[m] -= Number((p as any).amount);
      }
      // Find the first month (in MONTHS order) with a positive balance (debt)
      const MONTHS_ORDER = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
      for (const m of MONTHS_ORDER) {
        if (monthBalance[m] && monthBalance[m] > 0) {
          finalMonth = m;
          break;
        }
      }
      // If no month with debt found, assign to the current month
      if (!finalMonth) {
        const now = new Date().getMonth();
        const map = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        finalMonth = map[now];
      }
    }

    const payment = await Payment.create({
      inscriptionId: Number(inscriptionId),
      schoolPeriodId: Number(schoolPeriodId),
      feeId: feeId ?? null,
      sellableItemId: sellableItemId ?? null,
      chargeId: chargeId ?? null,
      month: finalMonth,
      amount: Number(amount),
      currency,
      amountVES: finalAmountVES,
      exchangeRate: finalExchangeRate,
      method: method ?? 'efectivo',
      reference: reference ?? null,
      bank: bank ?? null,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      notes: notes ?? null,
    });

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
    await payment.destroy();
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
    await charge.destroy();
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
