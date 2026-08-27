import { Request, Response } from 'express';
import sequelize from '@/config/database';
import { Op } from 'sequelize';
import {
  Inscription, Person, Grade, Section, SchoolPeriod,
  Payment, Charge, Fee, SellableItem, ExchangeRate, ExchangeRateType,
} from '@/models/index';

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

    if (inscriptions.length === 0) {
      return res.json({ students: [], monthlyFee: null, feeCurrency: null });
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
    const monthlyFee = await Fee.findOne({
      where: { schoolPeriodId: Number(schoolPeriodId), key: 'mensualidad', active: true },
      include: [{ model: ExchangeRateType, as: 'exchangeRateType' }],
    });

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

      // Group payments by month
      const monthsData: Record<string, { charges: any[]; payments: any[]; totalCharged: number; totalPaid: number }> = {};
      for (const c of studentCharges) {
        if (c.month) {
          if (!monthsData[c.month]) monthsData[c.month] = { charges: [], payments: [], totalCharged: 0, totalPaid: 0 };
          monthsData[c.month].charges.push(c);
          monthsData[c.month].totalCharged += Number(c.amount);
        }
      }
      for (const p of studentPayments) {
        const month = p.month || (p.charge as any)?.month;
        if (month) {
          if (!monthsData[month]) monthsData[month] = { charges: [], payments: [], totalCharged: 0, totalPaid: 0 };
          monthsData[month].payments.push(p);
          monthsData[month].totalPaid += Number(p.amount);
        }
      }

      // Non-monthly charges (items, one-time)
      const nonMonthlyCharges = studentCharges.filter(c => !c.month);
      const nonMonthlyPayments = studentPayments.filter(p => !p.month && !(p.charge as any)?.month);

      return {
        inscriptionId: insc.id,
        personId: person?.id,
        name: `${person?.lastName}, ${person?.firstName}`,
        document: person?.document,
        gradeName: (insc.grade as any)?.name,
        sectionName: (insc.section as any)?.name,
        months: monthsData,
        nonMonthly: {
          charges: nonMonthlyCharges,
          payments: nonMonthlyPayments,
        },
      };
    });

    return res.json({
      students,
      monthlyFee: monthlyFee ? {
        id: monthlyFee.id,
        amount: Number(monthlyFee.amount),
        currency: (monthlyFee as any).exchangeRateType?.currency ?? 'USD',
        currencyName: (monthlyFee as any).exchangeRateType?.name ?? '—',
      } : null,
    });
  } catch (error) {
    console.error('[getLedgerBySection] Error:', error);
    return res.status(500).json({ message: 'Error al obtener ledger' });
  }
};

// ── Create a payment ──

export const createPayment = async (req: Request, res: Response) => {
  try {
    const {
      inscriptionId, schoolPeriodId, feeId, sellableItemId, chargeId,
      month, amount, currency, amountVES, exchangeRate,
      method, reference, bank, paymentDate, notes,
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
    let finalMonth = month ?? null;
    if (!finalMonth) {
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
        { model: Section, as: 'section', attributes: ['id', 'name'] },
        { model: Grade, as: 'grade', attributes: ['id', 'name'] },
      ],
      attributes: ['sectionId', 'gradeId'],
      group: ['sectionId', 'gradeId', 'section.id', 'grade.id'],
    });

    const sections = inscriptions
      .map((i: any) => ({
        sectionId: i.sectionId,
        sectionName: (i.section as any)?.name ?? 'Sin sección',
        gradeId: i.gradeId,
        gradeName: (i.grade as any)?.name ?? '—',
      }))
      .filter((v: any, idx: number, arr: any[]) => arr.findIndex((a: any) => a.gradeId === v.gradeId && a.sectionId === v.sectionId) === idx)
      .filter((s: any) => (s.sectionName || '').toUpperCase() !== 'MATERIA PENDIENTE')
      .sort((a: any, b: any) => a.gradeName.localeCompare(b.gradeName) || a.sectionName.localeCompare(b.sectionName));

    return res.json(sections);
  } catch (error) {
    console.error('[getSectionsForPeriod] Error:', error);
    return res.status(500).json({ message: 'Error al obtener secciones' });
  }
};
