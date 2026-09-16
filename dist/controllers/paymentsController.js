"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateEnrollmentPlan = exports.deleteEnrollmentPlan = exports.updateEnrollmentPlan = exports.createEnrollmentPlan = exports.getEnrollmentPlan = exports.listEnrollmentPlans = exports.deleteSellableItem = exports.updateSellableItem = exports.createSellableItem = exports.listSellableItems = exports.updateFee = exports.upsertFee = exports.listFees = exports.fetchBcvRates = exports.bulkImportExchangeRates = exports.getRatesAtDate = exports.upsertExchangeRate = exports.listExchangeRates = exports.deleteExchangeRateType = exports.updateExchangeRateType = exports.createExchangeRateType = exports.listExchangeRateTypes = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
const bcvScraperService_1 = require("../services/bcvScraperService.js");
// ─────────────────────────────────────────────────────────────
// Exchange Rate Types
// ─────────────────────────────────────────────────────────────
const listExchangeRateTypes = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const types = yield index_1.ExchangeRateType.findAll({
            order: [['isDefault', 'DESC'], ['name', 'ASC']],
        });
        return res.json(types);
    }
    catch (error) {
        console.error('[listExchangeRateTypes] Error:', error);
        return res.status(500).json({ message: 'Error al listar tipos de cambio' });
    }
});
exports.listExchangeRateTypes = listExchangeRateTypes;
const createExchangeRateType = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { code, name, currency, isDefault, active } = req.body;
        if (!code || !name || !currency) {
            return res.status(400).json({ message: 'code, name y currency son requeridos' });
        }
        const t = yield database_1.default.transaction();
        try {
            if (isDefault) {
                yield index_1.ExchangeRateType.update({ isDefault: false }, { where: {}, transaction: t });
            }
            const type = yield index_1.ExchangeRateType.create({ code, name, currency, isDefault: !!isDefault, active: active !== false }, { transaction: t });
            yield t.commit();
            return res.status(201).json(type);
        }
        catch (err) {
            yield t.rollback();
            throw err;
        }
    }
    catch (error) {
        console.error('[createExchangeRateType] Error:', error);
        return res.status(500).json({ message: 'Error al crear tipo de cambio' });
    }
});
exports.createExchangeRateType = createExchangeRateType;
const updateExchangeRateType = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { code, name, currency, isDefault, active } = req.body;
        const type = yield index_1.ExchangeRateType.findByPk(Number(id));
        if (!type)
            return res.status(404).json({ message: 'Tipo de cambio no encontrado' });
        const t = yield database_1.default.transaction();
        try {
            if (isDefault) {
                yield index_1.ExchangeRateType.update({ isDefault: false }, { where: {}, transaction: t });
            }
            yield type.update({
                code: code !== null && code !== void 0 ? code : type.code,
                name: name !== null && name !== void 0 ? name : type.name,
                currency: currency !== null && currency !== void 0 ? currency : type.currency,
                isDefault: isDefault !== null && isDefault !== void 0 ? isDefault : type.isDefault,
                active: active !== null && active !== void 0 ? active : type.active,
            }, { transaction: t });
            yield t.commit();
            return res.json(type);
        }
        catch (err) {
            yield t.rollback();
            throw err;
        }
    }
    catch (error) {
        console.error('[updateExchangeRateType] Error:', error);
        return res.status(500).json({ message: 'Error al actualizar tipo de cambio' });
    }
});
exports.updateExchangeRateType = updateExchangeRateType;
const deleteExchangeRateType = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const type = yield index_1.ExchangeRateType.findByPk(Number(id));
        if (!type)
            return res.status(404).json({ message: 'Tipo de cambio no encontrado' });
        if (type.isDefault) {
            return res.status(400).json({ message: 'No se puede eliminar el tipo de cambio por defecto' });
        }
        yield type.destroy();
        return res.json({ message: 'Tipo de cambio eliminado' });
    }
    catch (error) {
        console.error('[deleteExchangeRateType] Error:', error);
        return res.status(500).json({ message: 'Error al eliminar tipo de cambio' });
    }
});
exports.deleteExchangeRateType = deleteExchangeRateType;
// ─────────────────────────────────────────────────────────────
// Exchange Rates (historical)
// ─────────────────────────────────────────────────────────────
const listExchangeRates = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { typeId, from, to, latest } = req.query;
        const where = {};
        if (typeId)
            where.exchangeRateTypeId = Number(typeId);
        if (from || to) {
            where.date = {};
            if (from)
                where.date[sequelize_1.Op.gte] = String(from);
            if (to)
                where.date[sequelize_1.Op.lte] = String(to);
        }
        if (latest === 'true' || latest === '1') {
            // Return the most recent rate per type
            const types = yield index_1.ExchangeRateType.findAll({ where: { active: true } });
            const latestRates = [];
            for (const t of types) {
                const rate = yield index_1.ExchangeRate.findOne({
                    where: { exchangeRateTypeId: t.id },
                    order: [['date', 'DESC']],
                });
                if (rate)
                    latestRates.push(Object.assign(Object.assign({}, rate.toJSON()), { type: t }));
            }
            return res.json(latestRates);
        }
        const rates = yield index_1.ExchangeRate.findAll({
            where,
            include: [{ model: index_1.ExchangeRateType, as: 'type' }],
            order: [['date', 'DESC']],
        });
        return res.json(rates);
    }
    catch (error) {
        console.error('[listExchangeRates] Error:', error);
        return res.status(500).json({ message: 'Error al listar tipos de cambio' });
    }
});
exports.listExchangeRates = listExchangeRates;
const upsertExchangeRate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { exchangeRateTypeId, rate, date } = req.body;
        if (!exchangeRateTypeId || rate === undefined || !date) {
            return res.status(400).json({ message: 'exchangeRateTypeId, rate y date son requeridos' });
        }
        const [entry, created] = yield index_1.ExchangeRate.findOrCreate({
            where: { exchangeRateTypeId: Number(exchangeRateTypeId), date: String(date) },
            defaults: { exchangeRateTypeId: Number(exchangeRateTypeId), rate: Number(rate), date: String(date) },
        });
        if (!created) {
            yield entry.update({ rate: Number(rate) });
        }
        return res.json(entry);
    }
    catch (error) {
        console.error('[upsertExchangeRate] Error:', error);
        return res.status(500).json({ message: 'Error al guardar tipo de cambio' });
    }
});
exports.upsertExchangeRate = upsertExchangeRate;
// Get the rate closest to (or on) a specific date for all active types
const getRatesAtDate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { date } = req.query;
        const targetDate = date ? String(date) : new Date().toISOString().slice(0, 10);
        const types = yield index_1.ExchangeRateType.findAll({ where: { active: true } });
        const result = [];
        for (const t of types) {
            const rate = yield index_1.ExchangeRate.findOne({
                where: { exchangeRateTypeId: t.id, date: { [sequelize_1.Op.lte]: targetDate } },
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
    }
    catch (error) {
        console.error('[getRatesAtDate] Error:', error);
        return res.status(500).json({ message: 'Error al obtener tipos de cambio' });
    }
});
exports.getRatesAtDate = getRatesAtDate;
const bulkImportExchangeRates = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { rates } = req.body; // [{ exchangeRateTypeId, rate, date }, ...]
        if (!Array.isArray(rates)) {
            return res.status(400).json({ message: 'Se espera un array "rates"' });
        }
        const t = yield database_1.default.transaction();
        let inserted = 0;
        let updated = 0;
        try {
            for (const r of rates) {
                const [entry, created] = yield index_1.ExchangeRate.findOrCreate({
                    where: { exchangeRateTypeId: Number(r.exchangeRateTypeId), date: String(r.date) },
                    defaults: { exchangeRateTypeId: Number(r.exchangeRateTypeId), rate: Number(r.rate), date: String(r.date) },
                    transaction: t,
                });
                if (!created) {
                    yield entry.update({ rate: Number(r.rate) }, { transaction: t });
                    updated++;
                }
                else {
                    inserted++;
                }
            }
            yield t.commit();
            return res.json({ message: 'Importación completa', inserted, updated });
        }
        catch (err) {
            yield t.rollback();
            throw err;
        }
    }
    catch (error) {
        console.error('[bulkImportExchangeRates] Error:', error);
        return res.status(500).json({ message: 'Error al importar tipos de cambio' });
    }
});
exports.bulkImportExchangeRates = bulkImportExchangeRates;
// Scrape BCV rates (USD + EUR) and upsert them for today
const fetchBcvRates = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield (0, bcvScraperService_1.scrapeBcvRates)();
        if (result.success) {
            return res.json(result);
        }
        return res.status(502).json(result);
    }
    catch (error) {
        console.error('[fetchBcvRates] Error:', error);
        return res.status(500).json({ message: 'Error al obtener tasas del BCV' });
    }
});
exports.fetchBcvRates = fetchBcvRates;
// ─────────────────────────────────────────────────────────────
// Fees (mensualidad, matrícula, gastos admin — por período)
// ─────────────────────────────────────────────────────────────
const listFees = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId } = req.query;
        const where = {};
        if (schoolPeriodId)
            where.schoolPeriodId = Number(schoolPeriodId);
        const fees = yield index_1.Fee.findAll({
            where,
            include: [
                { model: index_1.ExchangeRateType, as: 'exchangeRateType' },
                { model: index_1.SchoolPeriod, as: 'schoolPeriod', attributes: ['id', 'period', 'name'] },
            ],
            order: [['schoolPeriodId', 'DESC'], ['key', 'ASC']],
        });
        return res.json(fees);
    }
    catch (error) {
        console.error('[listFees] Error:', error);
        return res.status(500).json({ message: 'Error al listar costos' });
    }
});
exports.listFees = listFees;
const upsertFee = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId, key, name, amount, exchangeRateTypeId, active } = req.body;
        if (!schoolPeriodId || !key || !name || amount === undefined || !exchangeRateTypeId) {
            return res.status(400).json({ message: 'Faltan campos requeridos' });
        }
        const [fee, created] = yield index_1.Fee.findOrCreate({
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
            yield fee.update({
                name,
                amount: Number(amount),
                exchangeRateTypeId: Number(exchangeRateTypeId),
                active: active !== false,
            });
        }
        return res.json(fee);
    }
    catch (error) {
        console.error('[upsertFee] Error:', error);
        return res.status(500).json({ message: 'Error al guardar costo' });
    }
});
exports.upsertFee = upsertFee;
const updateFee = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, amount, exchangeRateTypeId, active } = req.body;
        const fee = yield index_1.Fee.findByPk(Number(id));
        if (!fee)
            return res.status(404).json({ message: 'Costo no encontrado' });
        yield fee.update({
            name: name !== null && name !== void 0 ? name : fee.name,
            amount: amount !== undefined ? Number(amount) : fee.amount,
            exchangeRateTypeId: exchangeRateTypeId !== null && exchangeRateTypeId !== void 0 ? exchangeRateTypeId : fee.exchangeRateTypeId,
            active: active !== null && active !== void 0 ? active : fee.active,
        });
        return res.json(fee);
    }
    catch (error) {
        console.error('[updateFee] Error:', error);
        return res.status(500).json({ message: 'Error al actualizar costo' });
    }
});
exports.updateFee = updateFee;
// ─────────────────────────────────────────────────────────────
// Sellable Items (uniformes, distintivos, etc.)
// ─────────────────────────────────────────────────────────────
const listSellableItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { active, category } = req.query;
        const where = {};
        if (active !== undefined)
            where.active = active === 'true';
        if (category)
            where.category = String(category);
        const items = yield index_1.SellableItem.findAll({
            where,
            include: [{ model: index_1.ExchangeRateType, as: 'exchangeRateType' }],
            order: [['category', 'ASC'], ['name', 'ASC']],
        });
        return res.json(items);
    }
    catch (error) {
        console.error('[listSellableItems] Error:', error);
        return res.status(500).json({ message: 'Error al listar items vendibles' });
    }
});
exports.listSellableItems = listSellableItems;
const createSellableItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, amount, exchangeRateTypeId, category, active } = req.body;
        if (!name || amount === undefined || !exchangeRateTypeId) {
            return res.status(400).json({ message: 'name, amount y exchangeRateTypeId son requeridos' });
        }
        const item = yield index_1.SellableItem.create({
            name,
            description: description !== null && description !== void 0 ? description : null,
            amount: Number(amount),
            exchangeRateTypeId: Number(exchangeRateTypeId),
            category: category !== null && category !== void 0 ? category : null,
            active: active !== false,
        });
        return res.status(201).json(item);
    }
    catch (error) {
        console.error('[createSellableItem] Error:', error);
        return res.status(500).json({ message: 'Error al crear item vendible' });
    }
});
exports.createSellableItem = createSellableItem;
const updateSellableItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, description, amount, exchangeRateTypeId, category, active } = req.body;
        const item = yield index_1.SellableItem.findByPk(Number(id));
        if (!item)
            return res.status(404).json({ message: 'Item no encontrado' });
        yield item.update({
            name: name !== null && name !== void 0 ? name : item.name,
            description: description !== null && description !== void 0 ? description : item.description,
            amount: amount !== undefined ? Number(amount) : item.amount,
            exchangeRateTypeId: exchangeRateTypeId !== null && exchangeRateTypeId !== void 0 ? exchangeRateTypeId : item.exchangeRateTypeId,
            category: category !== null && category !== void 0 ? category : item.category,
            active: active !== null && active !== void 0 ? active : item.active,
        });
        return res.json(item);
    }
    catch (error) {
        console.error('[updateSellableItem] Error:', error);
        return res.status(500).json({ message: 'Error al actualizar item' });
    }
});
exports.updateSellableItem = updateSellableItem;
const deleteSellableItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const item = yield index_1.SellableItem.findByPk(Number(id));
        if (!item)
            return res.status(404).json({ message: 'Item no encontrado' });
        // Soft-delete: deactivate instead of destroying
        yield item.update({ active: false });
        return res.json({ message: 'Item desactivado' });
    }
    catch (error) {
        console.error('[deleteSellableItem] Error:', error);
        return res.status(500).json({ message: 'Error al eliminar item' });
    }
});
exports.deleteSellableItem = deleteSellableItem;
// ─────────────────────────────────────────────────────────────
// Enrollment Plans
// ─────────────────────────────────────────────────────────────
const listEnrollmentPlans = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { active, schoolPeriodId } = req.query;
        const where = {};
        if (active !== undefined)
            where.active = active === 'true';
        if (schoolPeriodId !== undefined)
            where.schoolPeriodId = Number(schoolPeriodId);
        const plans = yield index_1.EnrollmentPlan.findAll({
            where,
            include: [
                { model: index_1.ExchangeRateType, as: 'targetExchangeRateType' },
                { model: index_1.SchoolPeriod, as: 'schoolPeriod' },
                { model: index_1.EnrollmentPlanItem, as: 'items', include: [
                        { model: index_1.Fee, as: 'fee', include: [{ model: index_1.ExchangeRateType, as: 'exchangeRateType' }] },
                        { model: index_1.SellableItem, as: 'sellableItem', include: [{ model: index_1.ExchangeRateType, as: 'exchangeRateType' }] },
                    ] },
            ],
            order: [['name', 'ASC']],
        });
        return res.json(plans);
    }
    catch (error) {
        console.error('[listEnrollmentPlans] Error:', error);
        return res.status(500).json({ message: 'Error al listar planes de inscripción' });
    }
});
exports.listEnrollmentPlans = listEnrollmentPlans;
const getEnrollmentPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const plan = yield index_1.EnrollmentPlan.findByPk(Number(id), {
            include: [
                { model: index_1.ExchangeRateType, as: 'targetExchangeRateType' },
                { model: index_1.SchoolPeriod, as: 'schoolPeriod' },
                { model: index_1.EnrollmentPlanItem, as: 'items', include: [
                        { model: index_1.Fee, as: 'fee', include: [{ model: index_1.ExchangeRateType, as: 'exchangeRateType' }] },
                        { model: index_1.SellableItem, as: 'sellableItem', include: [{ model: index_1.ExchangeRateType, as: 'exchangeRateType' }] },
                    ] },
            ],
        });
        if (!plan)
            return res.status(404).json({ message: 'Plan no encontrado' });
        return res.json(plan);
    }
    catch (error) {
        console.error('[getEnrollmentPlan] Error:', error);
        return res.status(500).json({ message: 'Error al obtener plan' });
    }
});
exports.getEnrollmentPlan = getEnrollmentPlan;
const createEnrollmentPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { name, description, schoolPeriodId, targetExchangeRateTypeId, conversionMode, active, items } = req.body;
        if (!name || !targetExchangeRateTypeId || !schoolPeriodId) {
            return res.status(400).json({ message: 'name, schoolPeriodId y targetExchangeRateTypeId son requeridos' });
        }
        const t = yield database_1.default.transaction();
        try {
            const plan = yield index_1.EnrollmentPlan.create({
                name,
                description: description !== null && description !== void 0 ? description : null,
                schoolPeriodId: Number(schoolPeriodId),
                targetExchangeRateTypeId: Number(targetExchangeRateTypeId),
                conversionMode: conversionMode !== null && conversionMode !== void 0 ? conversionMode : 'exchange_rate',
                active: active !== false,
            }, { transaction: t });
            if (Array.isArray(items)) {
                for (const it of items) {
                    yield index_1.EnrollmentPlanItem.create({
                        enrollmentPlanId: plan.id,
                        itemType: it.itemType,
                        feeId: (_a = it.feeId) !== null && _a !== void 0 ? _a : null,
                        sellableItemId: (_b = it.sellableItemId) !== null && _b !== void 0 ? _b : null,
                        quantity: (_c = it.quantity) !== null && _c !== void 0 ? _c : 1,
                    }, { transaction: t });
                }
            }
            yield t.commit();
            return res.status(201).json(plan);
        }
        catch (err) {
            yield t.rollback();
            throw err;
        }
    }
    catch (error) {
        console.error('[createEnrollmentPlan] Error:', error);
        return res.status(500).json({ message: 'Error al crear plan' });
    }
});
exports.createEnrollmentPlan = createEnrollmentPlan;
const updateEnrollmentPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { id } = req.params;
        const { name, description, schoolPeriodId, targetExchangeRateTypeId, conversionMode, active, items } = req.body;
        const plan = yield index_1.EnrollmentPlan.findByPk(Number(id));
        if (!plan)
            return res.status(404).json({ message: 'Plan no encontrado' });
        const t = yield database_1.default.transaction();
        try {
            yield plan.update({
                name: name !== null && name !== void 0 ? name : plan.name,
                description: description !== null && description !== void 0 ? description : plan.description,
                schoolPeriodId: schoolPeriodId !== null && schoolPeriodId !== void 0 ? schoolPeriodId : plan.schoolPeriodId,
                targetExchangeRateTypeId: targetExchangeRateTypeId !== null && targetExchangeRateTypeId !== void 0 ? targetExchangeRateTypeId : plan.targetExchangeRateTypeId,
                conversionMode: conversionMode !== null && conversionMode !== void 0 ? conversionMode : plan.conversionMode,
                active: active !== null && active !== void 0 ? active : plan.active,
            }, { transaction: t });
            if (Array.isArray(items)) {
                // Replace all items
                yield index_1.EnrollmentPlanItem.destroy({ where: { enrollmentPlanId: plan.id }, transaction: t });
                for (const it of items) {
                    yield index_1.EnrollmentPlanItem.create({
                        enrollmentPlanId: plan.id,
                        itemType: it.itemType,
                        feeId: (_a = it.feeId) !== null && _a !== void 0 ? _a : null,
                        sellableItemId: (_b = it.sellableItemId) !== null && _b !== void 0 ? _b : null,
                        quantity: (_c = it.quantity) !== null && _c !== void 0 ? _c : 1,
                    }, { transaction: t });
                }
            }
            yield t.commit();
            return res.json(plan);
        }
        catch (err) {
            yield t.rollback();
            throw err;
        }
    }
    catch (error) {
        console.error('[updateEnrollmentPlan] Error:', error);
        return res.status(500).json({ message: 'Error al actualizar plan' });
    }
});
exports.updateEnrollmentPlan = updateEnrollmentPlan;
const deleteEnrollmentPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const plan = yield index_1.EnrollmentPlan.findByPk(Number(id));
        if (!plan)
            return res.status(404).json({ message: 'Plan no encontrado' });
        yield plan.update({ active: false });
        return res.json({ message: 'Plan desactivado' });
    }
    catch (error) {
        console.error('[deleteEnrollmentPlan] Error:', error);
        return res.status(500).json({ message: 'Error al eliminar plan' });
    }
});
exports.deleteEnrollmentPlan = deleteEnrollmentPlan;
// ─────────────────────────────────────────────────────────────
// Calculate enrollment plan total
// ─────────────────────────────────────────────────────────────
const calculateEnrollmentPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const { id } = req.params;
        const { date } = req.query; // optional date for historical rate, defaults to today
        const targetDate = date ? String(date) : new Date().toISOString().slice(0, 10);
        const plan = yield index_1.EnrollmentPlan.findByPk(Number(id), {
            include: [
                { model: index_1.ExchangeRateType, as: 'targetExchangeRateType' },
                { model: index_1.SchoolPeriod, as: 'schoolPeriod' },
                { model: index_1.EnrollmentPlanItem, as: 'items', include: [
                        { model: index_1.Fee, as: 'fee', include: [{ model: index_1.ExchangeRateType, as: 'exchangeRateType' }] },
                        { model: index_1.SellableItem, as: 'sellableItem', include: [{ model: index_1.ExchangeRateType, as: 'exchangeRateType' }] },
                    ] },
            ],
        });
        if (!plan)
            return res.status(404).json({ message: 'Plan no encontrado' });
        // Collect all exchangeRateTypeIds needed
        const typeIds = new Set();
        typeIds.add(plan.targetExchangeRateTypeId);
        for (const item of plan.items) {
            const ref = item.itemType === 'fee' ? item.fee : item.sellableItem;
            if (ref)
                typeIds.add(ref.exchangeRateTypeId);
        }
        // Load all ExchangeRateType info (for currency codes/names)
        const allTypes = yield index_1.ExchangeRateType.findAll();
        const typeMap = {};
        for (const t of allTypes)
            typeMap[t.id] = t;
        // Get the rate closest to (or on) targetDate for each type
        // If a rate is missing, we still return the breakdown with raw amounts
        const rates = {};
        const missingRates = [];
        for (const typeId of typeIds) {
            const rate = yield index_1.ExchangeRate.findOne({
                where: { exchangeRateTypeId: typeId, date: { [sequelize_1.Op.lte]: targetDate } },
                order: [['date', 'DESC']],
            });
            if (!rate) {
                rates[typeId] = null;
                missingRates.push(typeId);
            }
            else {
                rates[typeId] = Number(rate.rate);
            }
        }
        // Calculate totals — only in VES when all rates are available
        let totalVES = 0;
        let totalOriginalSum = 0; // sum of all item amounts × quantity (regardless of currency)
        const allRatesAvailable = missingRates.length === 0;
        const breakdown = [];
        for (const item of plan.items) {
            const ref = item.itemType === 'fee' ? item.fee : item.sellableItem;
            if (!ref)
                continue;
            const itemRate = rates[ref.exchangeRateTypeId];
            const itemType = typeMap[ref.exchangeRateTypeId];
            const itemVES = itemRate !== null ? Number(ref.amount) * itemRate * item.quantity : null;
            if (itemVES !== null)
                totalVES += itemVES;
            const original = Number(ref.amount) * item.quantity;
            totalOriginalSum += original;
            breakdown.push({
                itemType: item.itemType,
                name: ref.name,
                amount: Number(ref.amount),
                currency: (_a = itemType === null || itemType === void 0 ? void 0 : itemType.currency) !== null && _a !== void 0 ? _a : '—',
                currencyName: (_b = itemType === null || itemType === void 0 ? void 0 : itemType.name) !== null && _b !== void 0 ? _b : '—',
                exchangeRateTypeId: ref.exchangeRateTypeId,
                rate: itemRate,
                quantity: item.quantity,
                totalVES: itemVES,
                totalOriginal: original,
            });
        }
        const targetType = typeMap[plan.targetExchangeRateTypeId];
        const targetRate = rates[plan.targetExchangeRateTypeId];
        let totalTarget = null;
        if (plan.conversionMode === 'same_amount') {
            // Venezuelan practice: same numeric amount, different currency
            // e.g. items sum to 165 USD → plan total is 165 EUR
            totalTarget = totalOriginalSum;
        }
        else {
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
            targetCurrency: (_c = targetType === null || targetType === void 0 ? void 0 : targetType.currency) !== null && _c !== void 0 ? _c : '—',
            targetCurrencyName: (_d = targetType === null || targetType === void 0 ? void 0 : targetType.name) !== null && _d !== void 0 ? _d : '—',
            targetRate,
            total: totalTarget,
            missingRates: plan.conversionMode === 'exchange_rate' && missingRates.length > 0 ? missingRates : undefined,
        });
    }
    catch (error) {
        console.error('[calculateEnrollmentPlan] Error:', error);
        return res.status(500).json({ message: 'Error al calcular plan' });
    }
});
exports.calculateEnrollmentPlan = calculateEnrollmentPlan;
