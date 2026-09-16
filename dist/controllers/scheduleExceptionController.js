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
exports.deleteException = exports.updateException = exports.createException = exports.listExceptions = void 0;
const models_1 = require("../models/index.js");
// GET /api/schedule-exceptions
const listExceptions = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const exceptions = yield models_1.ScheduleException.findAll({
            include: [{ model: models_1.Subject, as: 'subject', attributes: ['id', 'name', 'color'] }],
        });
        return res.json(exceptions);
    }
    catch (error) {
        console.error('[listExceptions] Error:', error);
        return res.status(500).json({ message: 'Error al listar excepciones' });
    }
});
exports.listExceptions = listExceptions;
// POST /api/schedule-exceptions
const createException = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { subjectId, allowConsecutiveBlocks, weeklyBlocks, maxHoursPerDay } = req.body;
        if (!subjectId)
            return res.status(400).json({ message: 'subjectId es requerido' });
        // Upsert: if exception for this subject already exists, update it
        const [exc, created] = yield models_1.ScheduleException.findOrCreate({
            where: { subjectId },
            defaults: {
                subjectId,
                allowConsecutiveBlocks: allowConsecutiveBlocks !== null && allowConsecutiveBlocks !== void 0 ? allowConsecutiveBlocks : null,
                weeklyBlocks: weeklyBlocks !== null && weeklyBlocks !== void 0 ? weeklyBlocks : null,
                maxHoursPerDay: maxHoursPerDay !== null && maxHoursPerDay !== void 0 ? maxHoursPerDay : null,
            },
        });
        if (!created) {
            exc.allowConsecutiveBlocks = allowConsecutiveBlocks !== null && allowConsecutiveBlocks !== void 0 ? allowConsecutiveBlocks : null;
            exc.weeklyBlocks = weeklyBlocks !== null && weeklyBlocks !== void 0 ? weeklyBlocks : null;
            exc.maxHoursPerDay = maxHoursPerDay !== null && maxHoursPerDay !== void 0 ? maxHoursPerDay : null;
            yield exc.save();
        }
        return res.status(created ? 201 : 200).json(exc);
    }
    catch (error) {
        console.error('[createException] Error:', error);
        return res.status(500).json({ message: 'Error al crear excepción' });
    }
});
exports.createException = createException;
// PUT /api/schedule-exceptions/:id
const updateException = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { allowConsecutiveBlocks, weeklyBlocks, maxHoursPerDay } = req.body;
        const exc = yield models_1.ScheduleException.findByPk(Number(id));
        if (!exc)
            return res.status(404).json({ message: 'Excepción no encontrada' });
        exc.allowConsecutiveBlocks = allowConsecutiveBlocks !== null && allowConsecutiveBlocks !== void 0 ? allowConsecutiveBlocks : null;
        exc.weeklyBlocks = weeklyBlocks !== null && weeklyBlocks !== void 0 ? weeklyBlocks : null;
        exc.maxHoursPerDay = maxHoursPerDay !== null && maxHoursPerDay !== void 0 ? maxHoursPerDay : null;
        yield exc.save();
        return res.json(exc);
    }
    catch (error) {
        console.error('[updateException] Error:', error);
        return res.status(500).json({ message: 'Error al actualizar excepción' });
    }
});
exports.updateException = updateException;
// DELETE /api/schedule-exceptions/:id
const deleteException = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield models_1.ScheduleException.destroy({ where: { id: Number(id) } });
        return res.json({ message: 'Excepción eliminada' });
    }
    catch (error) {
        console.error('[deleteException] Error:', error);
        return res.status(500).json({ message: 'Error al eliminar excepción' });
    }
});
exports.deleteException = deleteException;
