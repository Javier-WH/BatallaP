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
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCouncilDateOverride = exports.reorderTerms = exports.deleteTerm = exports.updateTerm = exports.createTerm = exports.getTerm = exports.getTerms = void 0;
const sequelize_1 = require("sequelize");
const index_1 = require("../models/index.js");
const getTerms = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId } = req.query;
        let whereClause = {};
        if (schoolPeriodId) {
            whereClause.schoolPeriodId = Number(schoolPeriodId);
        }
        const terms = yield index_1.Term.findAll({
            where: whereClause,
            include: [
                {
                    model: index_1.SchoolPeriod,
                    as: 'schoolPeriod',
                    attributes: ['id', 'name', 'period']
                }
            ],
            order: [['order', 'ASC']]
        });
        res.json(terms);
    }
    catch (error) {
        console.error('Error fetching terms:', error);
        res.status(500).json({ message: 'Error al obtener los lapsos' });
    }
});
exports.getTerms = getTerms;
const getTerm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const term = yield index_1.Term.findByPk(id, {
            include: [
                {
                    model: index_1.SchoolPeriod,
                    as: 'schoolPeriod',
                    attributes: ['id', 'name', 'period']
                }
            ]
        });
        if (!term) {
            return res.status(404).json({ message: 'Lapso no encontrado' });
        }
        res.json(term);
    }
    catch (error) {
        console.error('Error fetching term:', error);
        res.status(500).json({ message: 'Error al obtener el lapso' });
    }
});
exports.getTerm = getTerm;
const createTerm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { name, isBlocked, isActive, openDate, closeDate, schoolPeriodId } = req.body;
        if (!name || !schoolPeriodId) {
            return res.status(400).json({ message: 'Nombre y periodo escolar son requeridos' });
        }
        // Get the highest order for this school period
        const maxOrderResult = yield index_1.Term.max('order', {
            where: { schoolPeriodId }
        });
        const maxOrder = typeof maxOrderResult === 'number' ? maxOrderResult : 0;
        const newOrder = maxOrder + 1;
        const transaction = yield ((_a = index_1.Term.sequelize) === null || _a === void 0 ? void 0 : _a.transaction());
        try {
            // If creating an active term, deactivate the others in the same school period
            if (isActive) {
                yield index_1.Term.update({ isActive: false }, { where: { schoolPeriodId, isActive: true }, transaction });
            }
            const term = yield index_1.Term.create({
                name,
                isBlocked: isBlocked || false,
                isActive: isActive || false,
                openDate: openDate ? new Date(openDate) : undefined,
                closeDate: closeDate ? new Date(closeDate) : undefined,
                schoolPeriodId,
                order: newOrder
            }, { transaction });
            yield (transaction === null || transaction === void 0 ? void 0 : transaction.commit());
            res.status(201).json(term);
        }
        catch (error) {
            yield (transaction === null || transaction === void 0 ? void 0 : transaction.rollback());
            throw error;
        }
    }
    catch (error) {
        console.error('Error creating term:', error);
        res.status(500).json({ message: 'Error al crear el lapso' });
    }
});
exports.createTerm = createTerm;
const updateTerm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const { name, isBlocked, isActive, openDate, closeDate, order } = req.body;
        const term = yield index_1.Term.findByPk(id);
        if (!term) {
            return res.status(404).json({ message: 'Lapso no encontrado' });
        }
        const transaction = yield ((_a = index_1.Term.sequelize) === null || _a === void 0 ? void 0 : _a.transaction());
        try {
            // If activating this term, deactivate the others in the same school period
            if (isActive === true && !term.isActive) {
                yield index_1.Term.update({ isActive: false }, { where: { schoolPeriodId: term.schoolPeriodId, isActive: true, id: { [sequelize_1.Op.ne]: term.id } }, transaction });
            }
            yield term.update({
                name: name || term.name,
                isBlocked: isBlocked !== undefined ? isBlocked : term.isBlocked,
                isActive: isActive !== undefined ? isActive : term.isActive,
                openDate: openDate ? new Date(openDate) : term.openDate,
                closeDate: closeDate ? new Date(closeDate) : term.closeDate,
                order: order || term.order
            }, { transaction });
            yield (transaction === null || transaction === void 0 ? void 0 : transaction.commit());
            res.json(term);
        }
        catch (error) {
            yield (transaction === null || transaction === void 0 ? void 0 : transaction.rollback());
            throw error;
        }
    }
    catch (error) {
        console.error('Error updating term:', error);
        res.status(500).json({ message: 'Error al actualizar el lapso' });
    }
});
exports.updateTerm = updateTerm;
const deleteTerm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const term = yield index_1.Term.findByPk(id);
        if (!term) {
            return res.status(404).json({ message: 'Lapso no encontrado' });
        }
        // Check if term has associated data (evaluations, qualifications, etc.)
        // This is a simplified check - in a real app you'd check for dependencies
        yield term.destroy();
        res.json({ message: 'Lapso eliminado correctamente' });
    }
    catch (error) {
        console.error('Error deleting term:', error);
        res.status(500).json({ message: 'Error al eliminar el lapso' });
    }
});
exports.deleteTerm = deleteTerm;
const reorderTerms = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { schoolPeriodId, termOrders } = req.body;
        if (!schoolPeriodId || !Array.isArray(termOrders)) {
            return res.status(400).json({ message: 'Datos inválidos' });
        }
        // Update orders in transaction
        const transaction = yield ((_a = index_1.Term.sequelize) === null || _a === void 0 ? void 0 : _a.transaction());
        try {
            for (let i = 0; i < termOrders.length; i++) {
                const { id, order } = termOrders[i];
                yield index_1.Term.update({ order }, { where: { id, schoolPeriodId }, transaction });
            }
            yield (transaction === null || transaction === void 0 ? void 0 : transaction.commit());
            res.json({ message: 'Orden de lapsos actualizado correctamente' });
        }
        catch (error) {
            yield (transaction === null || transaction === void 0 ? void 0 : transaction.rollback());
            throw error;
        }
    }
    catch (error) {
        console.error('Error reordering terms:', error);
        res.status(500).json({ message: 'Error al reordenar los lapsos' });
    }
});
exports.reorderTerms = reorderTerms;
/**
 * PUT /terms/:id/council-date-override
 * Master-only. Sets or clears the council completion date override for a
 * term. Body: { councilCompletedAt: 'YYYY-MM-DD' | null }
 */
const setCouncilDateOverride = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const roles = ((_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.roles) || [];
        if (!roles.includes('Master')) {
            return res.status(403).json({ message: 'Solo Master puede ajustar la fecha de completado' });
        }
        const { id } = req.params;
        const { councilCompletedAt } = req.body;
        if (councilCompletedAt !== null && councilCompletedAt !== undefined && councilCompletedAt !== '') {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(councilCompletedAt)) {
                return res.status(400).json({ message: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
            }
            const parsed = new Date(`${councilCompletedAt}T00:00:00`);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).json({ message: 'Fecha inválida' });
            }
        }
        const term = yield index_1.Term.findByPk(id);
        if (!term) {
            return res.status(404).json({ message: 'Lapso no encontrado' });
        }
        yield term.update({
            councilCompletedAtOverride: councilCompletedAt ? councilCompletedAt : null,
        });
        res.json(term);
    }
    catch (error) {
        console.error('Error setting council date override:', error);
        res.status(500).json({ message: 'Error al ajustar la fecha de completado del lapso' });
    }
});
exports.setCouncilDateOverride = setCouncilDateOverride;
