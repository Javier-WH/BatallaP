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
exports.getSectionsForPeriod = exports.deleteCharge = exports.deletePayment = exports.bulkCreateCharges = exports.createCharge = exports.createPayment = exports.getLedgerBySection = void 0;
const database_1 = __importDefault(require("../config/database.js"));
const sequelize_1 = require("sequelize");
const index_1 = require("../models/index.js");
// ── Ledger: list students by section with their charges & payments ──
const getLedgerBySection = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const { schoolPeriodId, gradeId, sectionId } = req.params;
        // Get all inscriptions for this grade+section+period, with student info
        const inscriptions = yield index_1.Inscription.findAll({
            where: {
                schoolPeriodId: Number(schoolPeriodId),
                gradeId: Number(gradeId),
                sectionId: Number(sectionId),
            },
            include: [
                { model: index_1.Person, as: 'student', attributes: ['id', 'firstName', 'lastName', 'documentType', 'document'] },
                { model: index_1.Grade, as: 'grade', attributes: ['id', 'name'] },
                { model: index_1.Section, as: 'section', attributes: ['id', 'name'] },
            ],
            order: [
                [{ model: index_1.Person, as: 'student' }, 'lastName', 'ASC'],
                [{ model: index_1.Person, as: 'student' }, 'firstName', 'ASC'],
            ],
        });
        if (inscriptions.length === 0) {
            return res.json({ students: [], monthlyFee: null, feeCurrency: null });
        }
        const inscriptionIds = inscriptions.map((i) => i.id);
        // Get all charges for these inscriptions
        const charges = yield index_1.Charge.findAll({
            where: { inscriptionId: { [sequelize_1.Op.in]: inscriptionIds }, active: true },
            include: [
                { model: index_1.Fee, as: 'fee', attributes: ['id', 'name', 'amount', 'key'] },
                { model: index_1.SellableItem, as: 'sellableItem', attributes: ['id', 'name', 'amount'] },
            ],
        });
        // Get all payments for these inscriptions
        const payments = yield index_1.Payment.findAll({
            where: { inscriptionId: { [sequelize_1.Op.in]: inscriptionIds } },
            include: [
                { model: index_1.Charge, as: 'charge', attributes: ['id', 'month', 'type'] },
            ],
        });
        // Get the monthly fee for this period (to know the expected amount per month)
        const monthlyFee = yield index_1.Fee.findOne({
            where: { schoolPeriodId: Number(schoolPeriodId), key: 'mensualidad', active: true },
            include: [{ model: index_1.ExchangeRateType, as: 'exchangeRateType' }],
        });
        // Group charges & payments by inscriptionId
        const chargesByInscription = {};
        const paymentsByInscription = {};
        for (const c of charges) {
            const key = c.inscriptionId;
            if (!chargesByInscription[key])
                chargesByInscription[key] = [];
            chargesByInscription[key].push(c);
        }
        for (const p of payments) {
            const key = p.inscriptionId;
            if (!paymentsByInscription[key])
                paymentsByInscription[key] = [];
            paymentsByInscription[key].push(p);
        }
        // Build student list
        const students = inscriptions.map((insc) => {
            var _a, _b, _c;
            const person = insc.student;
            const studentCharges = chargesByInscription[insc.id] || [];
            const studentPayments = paymentsByInscription[insc.id] || [];
            // Group payments by month
            const monthsData = {};
            for (const c of studentCharges) {
                if (c.month) {
                    if (!monthsData[c.month])
                        monthsData[c.month] = { charges: [], payments: [], totalCharged: 0, totalPaid: 0 };
                    monthsData[c.month].charges.push(c);
                    monthsData[c.month].totalCharged += Number(c.amount);
                }
            }
            for (const p of studentPayments) {
                const month = p.month || ((_a = p.charge) === null || _a === void 0 ? void 0 : _a.month);
                if (month) {
                    if (!monthsData[month])
                        monthsData[month] = { charges: [], payments: [], totalCharged: 0, totalPaid: 0 };
                    monthsData[month].payments.push(p);
                    monthsData[month].totalPaid += Number(p.amount);
                }
            }
            // Non-monthly charges (items, one-time)
            const nonMonthlyCharges = studentCharges.filter(c => !c.month);
            const nonMonthlyPayments = studentPayments.filter(p => { var _a; return !p.month && !((_a = p.charge) === null || _a === void 0 ? void 0 : _a.month); });
            return {
                inscriptionId: insc.id,
                personId: person === null || person === void 0 ? void 0 : person.id,
                name: `${person === null || person === void 0 ? void 0 : person.lastName}, ${person === null || person === void 0 ? void 0 : person.firstName}`,
                document: person === null || person === void 0 ? void 0 : person.document,
                gradeName: (_b = insc.grade) === null || _b === void 0 ? void 0 : _b.name,
                sectionName: (_c = insc.section) === null || _c === void 0 ? void 0 : _c.name,
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
                currency: (_b = (_a = monthlyFee.exchangeRateType) === null || _a === void 0 ? void 0 : _a.currency) !== null && _b !== void 0 ? _b : 'USD',
                currencyName: (_d = (_c = monthlyFee.exchangeRateType) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : '—',
            } : null,
        });
    }
    catch (error) {
        console.error('[getLedgerBySection] Error:', error);
        return res.status(500).json({ message: 'Error al obtener ledger' });
    }
});
exports.getLedgerBySection = getLedgerBySection;
// ── Create a payment ──
const createPayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { inscriptionId, schoolPeriodId, feeId, sellableItemId, chargeId, month, amount, currency, amountVES, exchangeRate, method, reference, bank, paymentDate, notes, } = req.body;
        if (!inscriptionId || !schoolPeriodId || amount === undefined || !currency) {
            return res.status(400).json({ message: 'inscriptionId, schoolPeriodId, amount y currency son requeridos' });
        }
        // If VES payment, try to get the exchange rate automatically if not provided
        let finalAmountVES = amountVES !== null && amountVES !== void 0 ? amountVES : null;
        let finalExchangeRate = exchangeRate !== null && exchangeRate !== void 0 ? exchangeRate : null;
        if (currency === 'VES' && finalAmountVES === null) {
            finalAmountVES = Number(amount);
            finalExchangeRate = 1;
        }
        else if (currency !== 'VES' && finalAmountVES === null && finalExchangeRate === null) {
            // Try to get the rate for this currency
            const rateType = yield index_1.ExchangeRateType.findOne({ where: { currency } });
            if (rateType) {
                const rate = yield index_1.ExchangeRate.findOne({
                    where: { exchangeRateTypeId: rateType.id, date: { [sequelize_1.Op.lte]: new Date().toISOString().slice(0, 10) } },
                    order: [['date', 'DESC']],
                });
                if (rate) {
                    finalExchangeRate = Number(rate.rate);
                    finalAmountVES = Number(amount) * finalExchangeRate;
                }
            }
        }
        // If no month specified, auto-distribute to the first month with outstanding debt
        let finalMonth = month !== null && month !== void 0 ? month : null;
        if (!finalMonth) {
            // Find charges for this inscription that have a month, ordered by month order
            const existingCharges = yield index_1.Charge.findAll({
                where: { inscriptionId: Number(inscriptionId), month: { [sequelize_1.Op.ne]: null } },
                order: [['id', 'ASC']],
            });
            const existingPayments = yield index_1.Payment.findAll({
                where: { inscriptionId: Number(inscriptionId), month: { [sequelize_1.Op.ne]: null } },
                attributes: ['month', 'amount', 'currency'],
            });
            // Build per-month balance: charged - paid
            const monthBalance = {};
            for (const c of existingCharges) {
                const m = c.month;
                if (!monthBalance[m])
                    monthBalance[m] = 0;
                monthBalance[m] += Number(c.amount);
            }
            for (const p of existingPayments) {
                const m = p.month;
                if (!monthBalance[m])
                    monthBalance[m] = 0;
                monthBalance[m] -= Number(p.amount);
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
        const payment = yield index_1.Payment.create({
            inscriptionId: Number(inscriptionId),
            schoolPeriodId: Number(schoolPeriodId),
            feeId: feeId !== null && feeId !== void 0 ? feeId : null,
            sellableItemId: sellableItemId !== null && sellableItemId !== void 0 ? sellableItemId : null,
            chargeId: chargeId !== null && chargeId !== void 0 ? chargeId : null,
            month: finalMonth,
            amount: Number(amount),
            currency,
            amountVES: finalAmountVES,
            exchangeRate: finalExchangeRate,
            method: method !== null && method !== void 0 ? method : 'efectivo',
            reference: reference !== null && reference !== void 0 ? reference : null,
            bank: bank !== null && bank !== void 0 ? bank : null,
            paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
            notes: notes !== null && notes !== void 0 ? notes : null,
        });
        return res.status(201).json(payment);
    }
    catch (error) {
        console.error('[createPayment] Error:', error);
        return res.status(500).json({ message: 'Error al registrar pago' });
    }
});
exports.createPayment = createPayment;
// ── Create a charge (debt) ──
const createCharge = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { inscriptionId, schoolPeriodId, feeId, sellableItemId, type, month, description, amount, currency, amountVES, dueDate, } = req.body;
        if (!inscriptionId || !schoolPeriodId || !type || !description || amount === undefined || !currency) {
            return res.status(400).json({ message: 'inscriptionId, schoolPeriodId, type, description, amount y currency son requeridos' });
        }
        // Auto-calculate amountVES if not provided
        let finalAmountVES = amountVES !== null && amountVES !== void 0 ? amountVES : null;
        if (currency !== 'VES' && finalAmountVES === null) {
            const rateType = yield index_1.ExchangeRateType.findOne({ where: { currency } });
            if (rateType) {
                const rate = yield index_1.ExchangeRate.findOne({
                    where: { exchangeRateTypeId: rateType.id, date: { [sequelize_1.Op.lte]: new Date().toISOString().slice(0, 10) } },
                    order: [['date', 'DESC']],
                });
                if (rate) {
                    finalAmountVES = Number(amount) * Number(rate.rate);
                }
            }
        }
        const charge = yield index_1.Charge.create({
            inscriptionId: Number(inscriptionId),
            schoolPeriodId: Number(schoolPeriodId),
            feeId: feeId !== null && feeId !== void 0 ? feeId : null,
            sellableItemId: sellableItemId !== null && sellableItemId !== void 0 ? sellableItemId : null,
            type,
            month: month !== null && month !== void 0 ? month : null,
            description,
            amount: Number(amount),
            currency,
            amountVES: finalAmountVES,
            dueDate: dueDate ? new Date(dueDate) : null,
            active: true,
        });
        return res.status(201).json(charge);
    }
    catch (error) {
        console.error('[createCharge] Error:', error);
        return res.status(500).json({ message: 'Error al crear deuda' });
    }
});
exports.createCharge = createCharge;
// ── Bulk create charges (e.g. generate monthly charges for all students in a section) ──
const bulkCreateCharges = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const { charges } = req.body; // array of charge objects
        if (!Array.isArray(charges) || charges.length === 0) {
            yield t.rollback();
            return res.status(400).json({ message: 'Se requiere un array de charges' });
        }
        const created = yield index_1.Charge.bulkCreate(charges.map(c => {
            var _a, _b, _c, _d;
            return ({
                inscriptionId: Number(c.inscriptionId),
                schoolPeriodId: Number(c.schoolPeriodId),
                feeId: (_a = c.feeId) !== null && _a !== void 0 ? _a : null,
                sellableItemId: (_b = c.sellableItemId) !== null && _b !== void 0 ? _b : null,
                type: c.type,
                month: (_c = c.month) !== null && _c !== void 0 ? _c : null,
                description: c.description,
                amount: Number(c.amount),
                currency: c.currency,
                amountVES: (_d = c.amountVES) !== null && _d !== void 0 ? _d : null,
                dueDate: c.dueDate ? new Date(c.dueDate) : null,
                active: true,
            });
        }), { transaction: t });
        yield t.commit();
        return res.status(201).json({ created: created.length });
    }
    catch (error) {
        yield t.rollback();
        console.error('[bulkCreateCharges] Error:', error);
        return res.status(500).json({ message: 'Error al crear deudas masivamente' });
    }
});
exports.bulkCreateCharges = bulkCreateCharges;
// ── Delete a payment ──
const deletePayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const payment = yield index_1.Payment.findByPk(Number(id));
        if (!payment)
            return res.status(404).json({ message: 'Pago no encontrado' });
        yield payment.destroy();
        return res.json({ message: 'Pago eliminado' });
    }
    catch (error) {
        console.error('[deletePayment] Error:', error);
        return res.status(500).json({ message: 'Error al eliminar pago' });
    }
});
exports.deletePayment = deletePayment;
// ── Delete a charge ──
const deleteCharge = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const charge = yield index_1.Charge.findByPk(Number(id));
        if (!charge)
            return res.status(404).json({ message: 'Deuda no encontrada' });
        yield charge.destroy();
        return res.json({ message: 'Deuda eliminada' });
    }
    catch (error) {
        console.error('[deleteCharge] Error:', error);
        return res.status(500).json({ message: 'Error al eliminar deuda' });
    }
});
exports.deleteCharge = deleteCharge;
// ── Get available sections for a period (for the dropdown) ──
const getSectionsForPeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId } = req.params;
        const inscriptions = yield index_1.Inscription.findAll({
            where: { schoolPeriodId: Number(schoolPeriodId) },
            include: [
                { model: index_1.Section, as: 'section', attributes: ['id', 'name'] },
                { model: index_1.Grade, as: 'grade', attributes: ['id', 'name'] },
            ],
            attributes: ['sectionId', 'gradeId'],
            group: ['sectionId', 'gradeId', 'section.id', 'grade.id'],
        });
        const sections = inscriptions
            .map((i) => {
            var _a, _b, _c, _d;
            return ({
                sectionId: i.sectionId,
                sectionName: (_b = (_a = i.section) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : 'Sin sección',
                gradeId: i.gradeId,
                gradeName: (_d = (_c = i.grade) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : '—',
            });
        })
            .filter((v, idx, arr) => arr.findIndex((a) => a.gradeId === v.gradeId && a.sectionId === v.sectionId) === idx)
            .filter((s) => (s.sectionName || '').toUpperCase() !== 'MATERIA PENDIENTE')
            .sort((a, b) => a.gradeName.localeCompare(b.gradeName) || a.sectionName.localeCompare(b.sectionName));
        return res.json(sections);
    }
    catch (error) {
        console.error('[getSectionsForPeriod] Error:', error);
        return res.status(500).json({ message: 'Error al obtener secciones' });
    }
});
exports.getSectionsForPeriod = getSectionsForPeriod;
