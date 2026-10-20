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
  DiscountReason,
} from '@/models/index';
import { scrapeBcvRates } from '@/services/bcvScraperService';
import { getBillingMonths, compareBillingMonths } from '@/services/billingCalendarService';
import { resolveFee } from '@/services/feeResolverService';
import { planPeriodChargeSync, summarizeChargeSyncPlan, applyChargeSyncPlan } from '@/services/chargeSyncService';

// Validates (or defaults) the effective month of a fee/plan against the period's billing window.
const resolveEffectiveMonth = async (schoolPeriodId: number, requested?: string | null): Promise<{ month?: string; error?: string }> => {
  const period = await SchoolPeriod.findByPk(schoolPeriodId);
  if (!period) return { error: 'Período no encontrado' };
  const months = getBillingMonths(period) as string[];
  if (!requested) return { month: months[0] };
  if (!months.includes(requested)) return { error: 'El mes de vigencia no pertenece al calendario de cobro del período' };
  return { month: requested };
};

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

// Scrape BCV rates (USD + EUR) and upsert them for today
export const fetchBcvRates = async (_req: Request, res: Response) => {
  try {
    const result = await scrapeBcvRates();
    if (result.success) {
      return res.json(result);
    }
    return res.status(502).json(result);
  } catch (error: any) {
    console.error('[fetchBcvRates] Error:', error);
    return res.status(500).json({ message: 'Error al obtener tasas del BCV' });
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
    // Versions of the same cost follow the period's billing-calendar order.
    const windows = new Map<number, any>();
    for (const f of fees as any[]) windows.set(f.schoolPeriodId, f.schoolPeriod);
    const periods = await SchoolPeriod.findAll({ where: { id: [...windows.keys()] } });
    const periodById = new Map(periods.map(p => [p.id, p]));
    (fees as any[]).sort((a, b) =>
      b.schoolPeriodId - a.schoolPeriodId
      || a.key.localeCompare(b.key)
      || compareBillingMonths(periodById.get(a.schoolPeriodId) ?? {}, a.effectiveMonth, b.effectiveMonth));
    return res.json(fees);
  } catch (error) {
    console.error('[listFees] Error:', error);
    return res.status(500).json({ message: 'Error al listar costos' });
  }
};

export const upsertFee = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, key, name, amount, exchangeRateTypeId, active, effectiveMonth } = req.body;
    if (!schoolPeriodId || !key || !name || amount === undefined || !exchangeRateTypeId) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }
    const eff = await resolveEffectiveMonth(Number(schoolPeriodId), effectiveMonth);
    if (eff.error) return res.status(400).json({ message: eff.error });
    const [fee, created] = await Fee.findOrCreate({
      where: { schoolPeriodId: Number(schoolPeriodId), key, effectiveMonth: eff.month },
      defaults: {
        schoolPeriodId: Number(schoolPeriodId),
        key,
        effectiveMonth: eff.month!,
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
// Billing calendar (months billed by a school period)
// ─────────────────────────────────────────────────────────────

export const updateBillingCalendar = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId } = req.params;
    const start = Number(req.body.billingStartMonth);
    const end = Number(req.body.billingEndMonth);
    const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= 12;
    if (!valid(start) || !valid(end)) {
      return res.status(400).json({ message: 'Los meses de inicio y fin deben estar entre 1 y 12' });
    }
    const period = await SchoolPeriod.findByPk(Number(schoolPeriodId));
    if (!period) return res.status(404).json({ message: 'Período no encontrado' });
    await period.update({ billingStartMonth: start, billingEndMonth: end });
    return res.json({
      schoolPeriodId: period.id,
      billingStartMonth: start,
      billingEndMonth: end,
      months: getBillingMonths({ billingStartMonth: start, billingEndMonth: end }),
    });
  } catch (error) {
    console.error('[updateBillingCalendar] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar el calendario de cobro' });
  }
};

// ─────────────────────────────────────────────────────────────
// USD at par (settle EUR debts with dollars 1:1)
// ─────────────────────────────────────────────────────────────

/**
 * PUT /payments/par-settlement/:schoolPeriodId  body { usdAtPar: boolean }
 * When on, payments in USD or USDT (cash, Zelle, Zinli, Binance…) settle EUR
 * debts of that period at face value (40 USD settle 40 EUR). Payments in
 * bolívares are always converted at the payment-date rate. Only affects
 * payments registered from now on.
 */
export const updateParSettlement = async (req: Request, res: Response) => {
  try {
    if (typeof req.body?.usdAtPar !== 'boolean') {
      return res.status(400).json({ message: 'usdAtPar debe ser verdadero o falso' });
    }
    const period = await SchoolPeriod.findByPk(Number(req.params.schoolPeriodId));
    if (!period) return res.status(404).json({ message: 'Período no encontrado' });
    await period.update({ usdAtPar: req.body.usdAtPar });
    return res.json({ schoolPeriodId: period.id, usdAtPar: period.usdAtPar });
  } catch (error) {
    console.error('[updateParSettlement] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar la configuración de divisa a la par' });
  }
};

// ─────────────────────────────────────────────────────────────
// Discount reasons (catalog for discounts / scholarships)
// ─────────────────────────────────────────────────────────────

export const listDiscountReasons = async (_req: Request, res: Response) => {
  try {
    return res.json(await DiscountReason.findAll({ order: [['name', 'ASC']] }));
  } catch (error) {
    console.error('[listDiscountReasons] Error:', error);
    return res.status(500).json({ message: 'Error al listar motivos de descuento' });
  }
};

export const createDiscountReason = async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ message: 'El nombre del motivo es requerido' });
    if (await DiscountReason.findOne({ where: { name } })) {
      return res.status(400).json({ message: 'Ya existe un motivo con ese nombre' });
    }
    const reason = await DiscountReason.create({ name, description: req.body?.description || null });
    return res.status(201).json(reason);
  } catch (error) {
    console.error('[createDiscountReason] Error:', error);
    return res.status(500).json({ message: 'Error al crear el motivo' });
  }
};

export const updateDiscountReason = async (req: Request, res: Response) => {
  try {
    const reason = await DiscountReason.findByPk(Number(req.params.id));
    if (!reason) return res.status(404).json({ message: 'Motivo no encontrado' });
    const name = req.body?.name !== undefined ? String(req.body.name).trim() : reason.name;
    if (!name) return res.status(400).json({ message: 'El nombre del motivo es requerido' });
    const duplicate = await DiscountReason.findOne({ where: { name, id: { [Op.ne]: reason.id } } });
    if (duplicate) return res.status(400).json({ message: 'Ya existe un motivo con ese nombre' });
    await reason.update({
      name,
      description: req.body?.description !== undefined ? req.body.description || null : reason.description,
      active: req.body?.active ?? reason.active,
    });
    return res.json(reason);
  } catch (error) {
    console.error('[updateDiscountReason] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar el motivo' });
  }
};

// ─────────────────────────────────────────────────────────────
// Charge generation / sync for a whole period
// ─────────────────────────────────────────────────────────────

// Debts are generated for the present period (or the next one being prepared), never history.
const resolveSyncPeriodId = async (requested?: unknown): Promise<{ id?: number; error?: string }> => {
  const period = requested
    ? await SchoolPeriod.findByPk(Number(requested))
    : await SchoolPeriod.findOne({ where: { status: 'activo' } });
  if (!period) return { error: 'No hay un período escolar activo' };
  if (period.status !== 'activo' && period.status !== 'preinscripcion') {
    return { error: 'Solo se pueden generar deudas del período activo o de preinscripción' };
  }
  return { id: period.id };
};

export const previewChargeSync = async (req: Request, res: Response) => {
  try {
    const target = await resolveSyncPeriodId(req.body?.schoolPeriodId);
    if (target.error) return res.status(400).json({ message: target.error });
    const plan = await planPeriodChargeSync(target.id!);
    return res.json(summarizeChargeSyncPlan(plan));
  } catch (error) {
    console.error('[previewChargeSync] Error:', error);
    return res.status(500).json({ message: 'Error al calcular la vista previa de deudas' });
  }
};

export const applyChargeSync = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const target = await resolveSyncPeriodId(req.body?.schoolPeriodId);
    if (target.error) {
      await t.rollback();
      return res.status(400).json({ message: target.error });
    }
    const plan = await planPeriodChargeSync(target.id!, t);
    const result = await applyChargeSyncPlan(plan, t);
    await t.commit();
    return res.json({ schoolPeriodId: target.id, ...result, warnings: plan.warnings });
  } catch (error) {
    await t.rollback();
    console.error('[applyChargeSync] Error:', error);
    return res.status(500).json({ message: 'Error al generar las deudas' });
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
    const { name, description, amount, exchangeRateTypeId, category, active, icon } = req.body;
    if (!name || amount === undefined || !exchangeRateTypeId) {
      return res.status(400).json({ message: 'name, amount y exchangeRateTypeId son requeridos' });
    }
    const item = await SellableItem.create({
      name,
      description: description ?? null,
      amount: Number(amount),
      exchangeRateTypeId: Number(exchangeRateTypeId),
      category: category ?? null,
      icon: icon ? String(icon).slice(0, 60) : null,
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
    const { name, description, amount, exchangeRateTypeId, category, active, icon } = req.body;
    const item = await SellableItem.findByPk(Number(id));
    if (!item) return res.status(404).json({ message: 'Item no encontrado' });
    await item.update({
      name: name ?? item.name,
      description: description ?? item.description,
      amount: amount !== undefined ? Number(amount) : item.amount,
      exchangeRateTypeId: exchangeRateTypeId ?? item.exchangeRateTypeId,
      category: category ?? item.category,
      icon: icon !== undefined ? (icon ? String(icon).slice(0, 60) : null) : item.icon,
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

/** PUT /sellable-items/:id/icon — uploaded badge image (multipart `icon`). */
export const uploadSellableItemIcon = async (req: Request, res: Response) => {
  try {
    const item = await SellableItem.findByPk(Number(req.params.id));
    if (!item) return res.status(404).json({ message: 'Item no encontrado' });
    if (!req.file) return res.status(400).json({ message: 'Se requiere una imagen' });
    await item.update({ iconImage: `/uploads/items/${req.file.filename}` });
    return res.json(item);
  } catch (error) {
    console.error('[uploadSellableItemIcon] Error:', error);
    return res.status(500).json({ message: 'Error al subir el icono' });
  }
};

/** DELETE /sellable-items/:id/icon — drop the uploaded image (keeps the Lucide icon). */
export const clearSellableItemIcon = async (req: Request, res: Response) => {
  try {
    const item = await SellableItem.findByPk(Number(req.params.id));
    if (!item) return res.status(404).json({ message: 'Item no encontrado' });
    await item.update({ iconImage: null });
    return res.json(item);
  } catch (error) {
    console.error('[clearSellableItemIcon] Error:', error);
    return res.status(500).json({ message: 'Error al quitar el icono' });
  }
};

// ─────────────────────────────────────────────────────────────
// Enrollment Plans
// ─────────────────────────────────────────────────────────────

export const listEnrollmentPlans = async (req: Request, res: Response) => {
  try {
    const { active, schoolPeriodId } = req.query;
    const where: any = {};
    if (active !== undefined) where.active = active === 'true';
    if (schoolPeriodId !== undefined) where.schoolPeriodId = Number(schoolPeriodId);
    const plans = await EnrollmentPlan.findAll({
      where,
      include: [
        { model: ExchangeRateType, as: 'targetExchangeRateType' },
        { model: SchoolPeriod, as: 'schoolPeriod' },
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
        { model: SchoolPeriod, as: 'schoolPeriod' },
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
    const { name, description, schoolPeriodId, targetExchangeRateTypeId, conversionMode, active, items, effectiveMonth } = req.body;
    if (!name || !targetExchangeRateTypeId || !schoolPeriodId) {
      return res.status(400).json({ message: 'name, schoolPeriodId y targetExchangeRateTypeId son requeridos' });
    }
    const eff = await resolveEffectiveMonth(Number(schoolPeriodId), effectiveMonth);
    if (eff.error) return res.status(400).json({ message: eff.error });
    const t = await sequelize.transaction();
    try {
      const plan = await EnrollmentPlan.create(
        {
          name,
          description: description ?? null,
          schoolPeriodId: Number(schoolPeriodId),
          targetExchangeRateTypeId: Number(targetExchangeRateTypeId),
          conversionMode: conversionMode ?? 'exchange_rate',
          active: active !== false,
          effectiveMonth: eff.month!,
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
    const { name, description, schoolPeriodId, targetExchangeRateTypeId, conversionMode, active, items, effectiveMonth } = req.body;
    const plan = await EnrollmentPlan.findByPk(Number(id));
    if (!plan) return res.status(404).json({ message: 'Plan no encontrado' });
    const eff = await resolveEffectiveMonth(Number(schoolPeriodId ?? plan.schoolPeriodId), effectiveMonth ?? plan.effectiveMonth);
    if (eff.error) return res.status(400).json({ message: eff.error });

    const t = await sequelize.transaction();
    try {
      await plan.update({
        name: name ?? plan.name,
        description: description ?? plan.description,
        schoolPeriodId: schoolPeriodId ?? plan.schoolPeriodId,
        targetExchangeRateTypeId: targetExchangeRateTypeId ?? plan.targetExchangeRateTypeId,
        conversionMode: conversionMode ?? plan.conversionMode,
        active: active ?? plan.active,
        effectiveMonth: eff.month!,
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
    const { date, month } = req.query; // optional date for historical rate (defaults to today); optional month to pick fee versions
    const targetDate = date ? String(date) : new Date().toISOString().slice(0, 10);

    const plan = await EnrollmentPlan.findByPk(Number(id), {
      include: [
        { model: ExchangeRateType, as: 'targetExchangeRateType' },
        { model: SchoolPeriod, as: 'schoolPeriod' },
        { model: EnrollmentPlanItem, as: 'items', include: [
          { model: Fee, as: 'fee', include: [{ model: ExchangeRateType, as: 'exchangeRateType' }] },
          { model: SellableItem, as: 'sellableItem', include: [{ model: ExchangeRateType, as: 'exchangeRateType' }] },
        ] },
      ],
    });
    if (!plan) return res.status(404).json({ message: 'Plan no encontrado' });

    // Fee items point to a specific fee row, but costs are versioned by month:
    // charge the version in force for the requested month (default: the plan's own month).
    const feeMonth = month ? String(month) : plan.effectiveMonth;
    for (const item of (plan as any).items) {
      if (item.itemType !== 'fee' || !item.fee) continue;
      const resolved = await resolveFee(plan.schoolPeriodId, item.fee.key, feeMonth);
      if (resolved) item.fee = resolved;
    }

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
