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
exports.getPreviewOutcomes = exports.executeClosure = exports.validateClosure = exports.upsertChecklistEntry = exports.listChecklistEntries = exports.getChecklistEntry = exports.getClosureStatus = void 0;
const periodClosureService_1 = require("../services/periodClosureService.js");
const periodClosureExecutor_1 = require("../services/periodClosureExecutor.js");
const periodClosurePreview_1 = require("../services/periodClosurePreview.js");
const getClosureStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodId } = req.params;
        const parsedId = Number(periodId);
        if (!parsedId || Number.isNaN(parsedId)) {
            return res.status(400).json({ message: 'periodId inválido' });
        }
        const status = yield periodClosureService_1.PeriodClosureService.getStatus(parsedId);
        return res.json(status);
    }
    catch (error) {
        console.error('Error getting closure status', error);
        return res.status(500).json({ message: 'Error al obtener estado del cierre' });
    }
});
exports.getClosureStatus = getClosureStatus;
const getChecklistEntry = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodId } = req.params;
        const parsedId = Number(periodId);
        if (!parsedId || Number.isNaN(parsedId)) {
            return res.status(400).json({ message: 'periodId inválido' });
        }
        const { gradeId, sectionId, termId } = req.query;
        if (!gradeId || !sectionId || !termId) {
            return res.status(400).json({ message: 'gradeId, sectionId y termId son requeridos' });
        }
        const entry = yield periodClosureService_1.PeriodClosureService.getChecklistEntry({
            schoolPeriodId: parsedId,
            gradeId: Number(gradeId),
            sectionId: Number(sectionId),
            termId: Number(termId),
        });
        return res.json(entry);
    }
    catch (error) {
        console.error('Error getting council checklist entry', error);
        return res.status(500).json({ message: 'Error al obtener checklist del consejo' });
    }
});
exports.getChecklistEntry = getChecklistEntry;
const listChecklistEntries = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodId } = req.params;
        const parsedId = Number(periodId);
        if (!parsedId || Number.isNaN(parsedId)) {
            return res.status(400).json({ message: 'periodId inválido' });
        }
        const { termId } = req.query;
        if (!termId) {
            return res.status(400).json({ message: 'termId es requerido' });
        }
        const entries = yield periodClosureService_1.PeriodClosureService.listChecklistEntries({
            schoolPeriodId: parsedId,
            termId: Number(termId),
        });
        return res.json(entries);
    }
    catch (error) {
        console.error('Error listing council checklist entries', error);
        return res.status(500).json({ message: 'Error al listar checklist del consejo' });
    }
});
exports.listChecklistEntries = listChecklistEntries;
const upsertChecklistEntry = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { periodId } = req.params;
        const parsedId = Number(periodId);
        if (!parsedId || Number.isNaN(parsedId)) {
            return res.status(400).json({ message: 'periodId inválido' });
        }
        const { gradeId, sectionId, termId, status } = req.body;
        if (!gradeId || !sectionId || !termId || !status) {
            return res.status(400).json({ message: 'gradeId, sectionId, termId y status son requeridos' });
        }
        const sessionUserId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id;
        const entry = yield periodClosureService_1.PeriodClosureService.upsertChecklistEntry({
            schoolPeriodId: parsedId,
            gradeId,
            sectionId,
            termId,
            status,
            completedBy: sessionUserId
        });
        return res.json(entry);
    }
    catch (error) {
        console.error('Error updating council checklist', error);
        return res.status(500).json({ message: 'Error al actualizar checklist del consejo' });
    }
});
exports.upsertChecklistEntry = upsertChecklistEntry;
const validateClosure = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodId } = req.params;
        const parsedId = Number(periodId);
        if (!parsedId || Number.isNaN(parsedId)) {
            return res.status(400).json({ message: 'periodId inválido' });
        }
        const validation = yield periodClosureExecutor_1.PeriodClosureExecutor.validateClosure(parsedId);
        return res.json(validation);
    }
    catch (error) {
        console.error('Error validating closure', error);
        return res.status(500).json({ message: 'Error al validar el cierre del periodo' });
    }
});
exports.validateClosure = validateClosure;
const executeClosure = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { periodId } = req.params;
        const parsedId = Number(periodId);
        if (!parsedId || Number.isNaN(parsedId)) {
            return res.status(400).json({ message: 'periodId inválido' });
        }
        const sessionUserId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id;
        const result = yield periodClosureExecutor_1.PeriodClosureExecutor.executeClosure(parsedId, sessionUserId);
        if (!result.success) {
            return res.status(400).json({
                message: 'No se pudo completar el cierre del periodo',
                errors: result.errors,
                log: result.log
            });
        }
        return res.json(result);
    }
    catch (error) {
        console.error('Error executing closure', error);
        return res.status(500).json({ message: 'Error al ejecutar el cierre del periodo' });
    }
});
exports.executeClosure = executeClosure;
const getPreviewOutcomes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodId } = req.params;
        const parsedId = Number(periodId);
        if (!parsedId || Number.isNaN(parsedId)) {
            return res.status(400).json({ message: 'periodId inválido' });
        }
        const preview = yield periodClosurePreview_1.PeriodClosurePreview.calculatePreview(parsedId);
        return res.json(preview);
    }
    catch (error) {
        console.error('Error calculating preview', error);
        return res.status(500).json({ message: 'Error al calcular vista previa' });
    }
});
exports.getPreviewOutcomes = getPreviewOutcomes;
