import { Request, Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '@/config/database';
import {
  ExchangeRateType,
  ExchangeRate,
  Fee,
  SellableItem,
  EnrollmentPlan,
  EnrollmentPlanItem,
  SchoolPeriod,
} from '@/models/index';

// ─────────────────────────────────────────────────────────────
// Exchange Rate Types
// ─────────────────────────────────────────────────────────────

export const listExchangeRateTypes = async (_req: Request, res: Response) => {
  try {
    const types = await ExchangeRateType.findAll({
      order: [['isDefault', 'DESC'], ['name', 'ASC']],
    });
    return res.json(types);
  } catch (error) {
    console.error('[listExchangeRateTypes] Error:', error);
    return res.status(500).json({ message: 'Error al listar tipos de cambio' });
  }
};

export const createExchangeRateType = async (req: Request, res: Response) => {
  try {
    const { code, name, currency, isDefault, active } = req.body;
    if (!code || !name || !currency) {
      return res.status(400).json({ message: 'code, name y currency son requeridos' });
    }
    const t = await sequelize.transaction();
    try {
      if (isDefault) {
        await ExchangeRateType.update({ isDefault: false }, { where: {}, transaction: t });
      }
      const type = await ExchangeRateType.create(
        { code, name, currency, isDefault: !!isDefault, active: active !== false },
        { transaction: t }
      );
      await t.commit();
      return res.status(201).json(type);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    console.error('[createExchangeRateType] Error:', error);
    return res.status(500).json({ message: 'Error al crear tipo de cambio' });
  }
};

export const updateExchangeRateType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, name, currency, isDefault, active } = req.body;
    const type = await ExchangeRateType.findByPk(Number(id));
    if (!type) return res.status(404).json({ message: 'Tipo de cambio no encontrado' });

    const t = await sequelize.transaction();
    try {
      if (isDefault) {
        await ExchangeRateType.update({ isDefault: false }, { where: {}, transaction: t });
      }
      await type.update(
        {
          code: code ?? type.code,
          name: name ?? type.name,
          currency: currency ?? type.currency,
          isDefault: isDefault ?? type.isDefault,
          active: active ?? type.active,
        },
        { transaction: t }
      );
      await t.commit();
      return res.json(type);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    console.error('[updateExchangeRateType] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar tipo de cambio' });
  }
};

export const deleteExchangeRateType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const type = await ExchangeRateType.findByPk(Number(id));
    if (!type) return res.status(404).json({ message: 'Tipo de cambio no encontrado' });
    if (type.isDefault) {
      return res.status(400).json({ message: 'No se puede eliminar el tipo de cambio por defecto' });
    }
    await type.destroy();
    return res.json({ message: 'Tipo de cambio eliminado' });
  } catch (error) {
    console.error('[deleteExchangeRateType] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar tipo de cambio' });
  }
};

// ─────────────────────────────────────────────────────────────
// Exchange Rates (historical)
// ─────────────────────────────────────────────────────────────

export const listExchangeRates = async (req: Request, res: Response) => {
  try {
    const { typeId, from, to, latest } = req.query;
    const where: any = {};
    if (typeId) where.exchangeRateTypeId = Number(typeId);
    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = String(from);
      if (to) where.date[Op.lte] = String(to);
    }

    if (latest === 'true' || latest === '1') {
      // Return the most recent rate per type
      const types = await ExchangeRateType.findAll({ where: { active: true } });
      const latestRates: any[] = [];
      for (const t of types) {
        const rate = await ExchangeRate.findOne({
          where: { exchangeRateTypeId: t.id },
          order: [['date', 'DESC']],
        });
        if (rate) latestRates.push({ ...rate.toJSON(), type: t });
      }
      return res.json(latestRates);
    }

    const rates = await ExchangeRate.findAll({
      where,
      include: [{ model: ExchangeRateType, as: 'type' }],
      order: [['date', 'DESC']],
    });
    return res.json(rates);
  } catch (error) {
    console.error('[listExchangeRates] Error:', error);
    return res.status(500).json({ message: 'Error al listar tipos de cambio' });
  }
};

export const upsertExchangeRate = async (req: Request, res: Response) => {
  try {
    const { exchangeRateTypeId, rate, date } = req.body;
    if (!exchangeRateTypeId || rate === undefined || !date) {
      return res.status(400).json({ message: 'exchangeRateTypeId, rate y date son requeridos' });
    }
    const [entry, created] = await ExchangeRate.findOrCreate({
      where: { exchangeRateTypeId: Number(exchangeRateTypeId), date: String(date) },
      defaults: { exchangeRateTypeId: Number(exchangeRateTypeId), rate: Number(rate), date: String(date) },
    });
    if (!created) {
      await entry.update({ rate: Number(rate) });
    }
    return res.json(entry);
  } catch (error) {
    console.error('[upsertExchangeRate] Error:', error);
    return res.status(500).json({ message: 'Error al guardar tipo de cambio' });
  }
};

// Get the rate closest to (or on) a specific date for all active types
export const getRatesAtDate = async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const targetDate = date ? String(date) : new Date().toISOString().slice(0, 10);

    const types = await ExchangeRateType.findAll({ where: { active: true } });
    const result: any[] = [];

    for (const t of types) {
      const rate = await ExchangeRate.findOne({
        where: { exchangeRateTypeId: t.id, date: { [Op.lte]: targetDate } },
        order: [['date', 'DESC']],
      });
      result.push({
        typeId: t.id,
        code: t.code,
        name: t.name,
        currency: t.currency,
        rate: rate ? Number(rate.rate) : null,
        date: rate ? rate.date : null,
      });
    }

    return res.json({ date: targetDate, rates: result });
  } catch (error) {
    console.error('[getRatesAtDate] Error:', error);
    return res.status(500).json({ message: 'Error al obtener tipos de cambio' });
  }
};

export const bulkImportExchangeRates = async (req: Request, res: Response) => {
  try {
    const { rates } = req.body; // [{ exchangeRateTypeId, rate, date }, ...]
    if (!Array.isArray(rates)) {
      return res.status(400).json({ message: 'Se espera un array "rates"' });
    }
    const t = await sequelize.transaction();
    let inserted = 0;
    let updated = 0;
    try {
      for (const r of rates) {
        const [entry, created] = await ExchangeRate.findOrCreate({
          where: { exchangeRateTypeId: Number(r.exchangeRateTypeId), date: String(r.date) },
          defaults: { exchangeRateTypeId: Number(r.exchangeRateTypeId), rate: Number(r.rate), date: String(r.date) },
          transaction: t,
        });
        if (!created) {
          await entry.update({ rate: Number(r.rate) }, { transaction: t });
          updated++;
        } else {
          inserted++;
        }
      }
      await t.commit();
      return res.json({ message: 'Importación completa', inserted, updated });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    console.error('[bulkImportExchangeRates] Error:', error);
    return res.status(500).json({ message: 'Error al importar tipos de cambio' });
  }
};

// ─────────────────────────────────────────────────────────────
// Fees (mensualidad, matrícula, gastos admin — por período)
// ─────────────────────────────────────────────────────────────

export const listFees = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId } = req.query;
    const where: any = {};
    if (schoolPeriodId) where.schoolPeriodId = Number(schoolPeriodId);
    const fees = await Fee.findAll({
      where,
      include: [
        { model: ExchangeRateType, as: 'exchangeRateType' },
        { model: SchoolPeriod, as: 'schoolPeriod', attributes: ['id', 'period', 'name'] },
      ],
      order: [['schoolPeriodId', 'DESC'], ['key', 'ASC']],
    });
    return res.json(fees);
  } catch (error) {
    console.error('[listFees] Error:', error);
    return res.status(500).json({ message: 'Error al listar costos' });
  }
};

export const upsertFee = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, key, name, amount, exchangeRateTypeId, active } = req.body;
    if (!schoolPeriodId || !key || !name || amount === undefined || !exchangeRateTypeId) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }
    const [fee, created] = await Fee.findOrCreate({
      where: { schoolPeriodId: Number(schoolPeriodId), key },
      defaults: {
        schoolPeriodId: Number(schoolPeriodId),
        key,
        name,
        amount: Number(amount),
        exchangeRateTypeId: Number(exchangeRateTypeId),
        active: active !== false,
      },
    });
    if (!created) {
      await fee.update({
        name,
        amount: Number(amount),
        exchangeRateTypeId: Number(exchangeRateTypeId),
        active: active !== false,
      });
    }
    return res.json(fee);
  } catch (error) {
    console.error('[upsertFee] Error:', error);
    return res.status(500).json({ message: 'Error al guardar costo' });
  }
};

export const updateFee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, amount, exchangeRateTypeId, active } = req.body;
    const fee = await Fee.findByPk(Number(id));
    if (!fee) return res.status(404).json({ message: 'Costo no encontrado' });
    await fee.update({
      name: name ?? fee.name,
      amount: amount !== undefined ? Number(amount) : fee.amount,
      exchangeRateTypeId: exchangeRateTypeId ?? fee.exchangeRateTypeId,
      active: active ?? fee.active,
    });
    return res.json(fee);
  } catch (error) {
    console.error('[updateFee] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar costo' });
  }
};

// ─────────────────────────────────────────────────────────────
// Sellable Items (uniformes, distintivos, etc.)
// ─────────────────────────────────────────────────────────────

export const listSellableItems = async (req: Request, res: Response) => {
  try {
    const { active, category } = req.query;
    const where: any = {};
    if (active !== undefined) where.active = active === 'true';
    if (category) where.category = String(category);
    const items = await SellableItem.findAll({
      where,
      include: [{ model: ExchangeRateType, as: 'exchangeRateType' }],
      order: [['category', 'ASC'], ['name', 'ASC']],
    });
    return res.json(items);
  } catch (error) {
    console.error('[listSellableItems] Error:', error);
    return res.status(500).json({ message: 'Error al listar items vendibles' });
  }
};

export const createSellableItem = async (req: Request, res: Response) => {
  try {
    const { name, description, amount, exchangeRateTypeId, category, active } = req.body;
    if (!name || amount === undefined || !exchangeRateTypeId) {
      return res.status(400).json({ message: 'name, amount y exchangeRateTypeId son requeridos' });
    }
    const item = await SellableItem.create({
      name,
      description: description ?? null,
      amount: Number(amount),
      exchangeRateTypeId: Number(exchangeRateTypeId),
      category: category ?? null,
      active: active !== false,
    });
    return res.status(201).json(item);
  } catch (error) {
    console.error('[createSellableItem] Error:', error);
    return res.status(500).json({ message: 'Error al crear item vendible' });
  }
};

export const updateSellableItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, amount, exchangeRateTypeId, category, active } = req.body;
    const item = await SellableItem.findByPk(Number(id));
    if (!item) return res.status(404).json({ message: 'Item no encontrado' });
    await item.update({
      name: name ?? item.name,
      description: description ?? item.description,
      amount: amount !== undefined ? Number(amount) : item.amount,
      exchangeRateTypeId: exchangeRateTypeId ?? item.exchangeRateTypeId,
      category: category ?? item.category,
      active: active ?? item.active,
    });
    return res.json(item);
  } catch (error) {
    console.error('[updateSellableItem] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar item' });
  }
};

export const deleteSellableItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await SellableItem.findByPk(Number(id));
    if (!item) return res.status(404).json({ message: 'Item no encontrado' });
    // Soft-delete: deactivate instead of destroying
    await item.update({ active: false });
    return res.json({ message: 'Item desactivado' });
  } catch (error) {
    console.error('[deleteSellableItem] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar item' });
  }
};

// ─────────────────────────────────────────────────────────────
// Enrollment Plans
// ─────────────────────────────────────────────────────────────

export const listEnrollmentPlans = async (req: Request, res: Response) => {
  try {
    const { active } = req.query;
    const where: any = {};
    if (active !== undefined) where.active = active === 'true';
    const plans = await EnrollmentPlan.findAll({
      where,
      include: [
        { model: ExchangeRateType, as: 'targetExchangeRateType' },
        { model: EnrollmentPlanItem, as: 'items', include: [
          { model: Fee, as: 'fee', include: [{ model: ExchangeRateType, as: 'exchangeRateType' }] },
          { model: SellableItem, as: 'sellableItem', include: [{ model: ExchangeRateType, as: 'exchangeRateType' }] },
        ] },
      ],
      order: [['name', 'ASC']],
    });
    return res.json(plans);
  } catch (error) {
    console.error('[listEnrollmentPlans] Error:', error);
    return res.status(500).json({ message: 'Error al listar planes de inscripción' });
  }
};

export const getEnrollmentPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await EnrollmentPlan.findByPk(Number(id), {
      include: [
        { model: ExchangeRateType, as: 'targetExchangeRateType' },
        { model: EnrollmentPlanItem, as: 'items', include: [
          { model: Fee, as: 'fee', include: [{ model: ExchangeRateType, as: 'exchangeRateType' }] },
          { model: SellableItem, as: 'sellableItem', include: [{ model: ExchangeRateType, as: 'exchangeRateType' }] },
        ] },
      ],
    });
    if (!plan) return res.status(404).json({ message: 'Plan no encontrado' });
    return res.json(plan);
  } catch (error) {
    console.error('[getEnrollmentPlan] Error:', error);
    return res.status(500).json({ message: 'Error al obtener plan' });
  }
};

export const createEnrollmentPlan = async (req: Request, res: Response) => {
  try {
    const { name, description, targetExchangeRateTypeId, conversionMode, active, items } = req.body;
    if (!name || !targetExchangeRateTypeId) {
      return res.status(400).json({ message: 'name y targetExchangeRateTypeId son requeridos' });
    }
    const t = await sequelize.transaction();
    try {
      const plan = await EnrollmentPlan.create(
        {
          name,
          description: description ?? null,
          targetExchangeRateTypeId: Number(targetExchangeRateTypeId),
          conversionMode: conversionMode ?? 'exchange_rate',
          active: active !== false,
        },
        { transaction: t }
      );
      if (Array.isArray(items)) {
        for (const it of items) {
          await EnrollmentPlanItem.create({
            enrollmentPlanId: plan.id,
            itemType: it.itemType,
            feeId: it.feeId ?? null,
            sellableItemId: it.sellableItemId ?? null,
            quantity: it.quantity ?? 1,
          }, { transaction: t });
        }
      }
      await t.commit();
      return res.status(201).json(plan);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    console.error('[createEnrollmentPlan] Error:', error);
    return res.status(500).json({ message: 'Error al crear plan' });
  }
};

export const updateEnrollmentPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, targetExchangeRateTypeId, conversionMode, active, items } = req.body;
    const plan = await EnrollmentPlan.findByPk(Number(id));
    if (!plan) return res.status(404).json({ message: 'Plan no encontrado' });

    const t = await sequelize.transaction();
    try {
      await plan.update({
        name: name ?? plan.name,
        description: description ?? plan.description,
        targetExchangeRateTypeId: targetExchangeRateTypeId ?? plan.targetExchangeRateTypeId,
        conversionMode: conversionMode ?? plan.conversionMode,
        active: active ?? plan.active,
      }, { transaction: t });

      if (Array.isArray(items)) {
        // Replace all items
        await EnrollmentPlanItem.destroy({ where: { enrollmentPlanId: plan.id }, transaction: t });
        for (const it of items) {
          await EnrollmentPlanItem.create({
            enrollmentPlanId: plan.id,
            itemType: it.itemType,
            feeId: it.feeId ?? null,
            sellableItemId: it.sellableItemId ?? null,
            quantity: it.quantity ?? 1,
          }, { transaction: t });
        }
      }
      await t.commit();
      return res.json(plan);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    console.error('[updateEnrollmentPlan] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar plan' });
  }
};

export const deleteEnrollmentPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await EnrollmentPlan.findByPk(Number(id));
    if (!plan) return res.status(404).json({ message: 'Plan no encontrado' });
    await plan.update({ active: false });
    return res.json({ message: 'Plan desactivado' });
  } catch (error) {
    console.error('[deleteEnrollmentPlan] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar plan' });
  }
};

// ─────────────────────────────────────────────────────────────
// Calculate enrollment plan total
// ─────────────────────────────────────────────────────────────

export const calculateEnrollmentPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date } = req.query; // optional date for historical rate, defaults to today
    const targetDate = date ? String(date) : new Date().toISOString().slice(0, 10);

    const plan = await EnrollmentPlan.findByPk(Number(id), {
      include: [
        { model: ExchangeRateType, as: 'targetExchangeRateType' },
        { model: EnrollmentPlanItem, as: 'items', include: [
          { model: Fee, as: 'fee', include: [{ model: ExchangeRateType, as: 'exchangeRateType' }] },
          { model: SellableItem, as: 'sellableItem', include: [{ model: ExchangeRateType, as: 'exchangeRateType' }] },
        ] },
      ],
    });
    if (!plan) return res.status(404).json({ message: 'Plan no encontrado' });

    // Collect all exchangeRateTypeIds needed
    const typeIds = new Set<number>();
    typeIds.add(plan.targetExchangeRateTypeId);
    for (const item of (plan as any).items) {
      const ref = item.itemType === 'fee' ? item.fee : item.sellableItem;
      if (ref) typeIds.add(ref.exchangeRateTypeId);
    }

    // Load all ExchangeRateType info (for currency codes/names)
    const allTypes = await ExchangeRateType.findAll();
    const typeMap: Record<number, any> = {};
    for (const t of allTypes) typeMap[t.id] = t;

    // Get the rate closest to (or on) targetDate for each type
    // If a rate is missing, we still return the breakdown with raw amounts
    const rates: Record<number, number | null> = {};
    const missingRates: number[] = [];
    for (const typeId of typeIds) {
      const rate = await ExchangeRate.findOne({
        where: { exchangeRateTypeId: typeId, date: { [Op.lte]: targetDate } },
        order: [['date', 'DESC']],
      });
      if (!rate) {
        rates[typeId] = null;
        missingRates.push(typeId);
      } else {
        rates[typeId] = Number(rate.rate);
      }
    }

    // Calculate totals — only in VES when all rates are available
    let totalVES: number | null = 0;
    let totalOriginalSum = 0; // sum of all item amounts × quantity (regardless of currency)
    const allRatesAvailable = missingRates.length === 0;
    const breakdown: any[] = [];
    for (const item of (plan as any).items) {
      const ref = item.itemType === 'fee' ? item.fee : item.sellableItem;
      if (!ref) continue;
      const itemRate = rates[ref.exchangeRateTypeId];
      const itemType = typeMap[ref.exchangeRateTypeId];
      const itemVES = itemRate !== null ? Number(ref.amount) * itemRate * item.quantity : null;
      if (itemVES !== null) totalVES += itemVES;
      const original = Number(ref.amount) * item.quantity;
      totalOriginalSum += original;
      breakdown.push({
        itemType: item.itemType,
        name: ref.name,
        amount: Number(ref.amount),
        currency: itemType?.currency ?? '—',
        currencyName: itemType?.name ?? '—',
        exchangeRateTypeId: ref.exchangeRateTypeId,
        rate: itemRate,
        quantity: item.quantity,
        totalVES: itemVES,
        totalOriginal: original,
      });
    }

    const targetType = typeMap[plan.targetExchangeRateTypeId];
    const targetRate = rates[plan.targetExchangeRateTypeId];
    let totalTarget: number | null = null;

    if (plan.conversionMode === 'same_amount') {
      // Venezuelan practice: same numeric amount, different currency
      // e.g. items sum to 165 USD → plan total is 165 EUR
      totalTarget = totalOriginalSum;
    } else {
      // exchange_rate mode: convert through VES
      if (allRatesAvailable && targetRate !== null && targetRate > 0) {
        totalTarget = totalVES / targetRate;
      }
    }

    return res.json({
      planId: plan.id,
      planName: plan.name,
      date: targetDate,
      conversionMode: plan.conversionMode,
      breakdown,
      totalVES: allRatesAvailable ? totalVES : null,
      totalOriginalSum,
      targetExchangeRateTypeId: plan.targetExchangeRateTypeId,
      targetCurrency: targetType?.currency ?? '—',
      targetCurrencyName: targetType?.name ?? '—',
      targetRate,
      total: totalTarget,
      missingRates: plan.conversionMode === 'exchange_rate' && missingRates.length > 0 ? missingRates : undefined,
    });
  } catch (error) {
    console.error('[calculateEnrollmentPlan] Error:', error);
    return res.status(500).json({ message: 'Error al calcular plan' });
  }
};
