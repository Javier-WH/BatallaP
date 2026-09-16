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
exports.exportDiariosHtml = exports.exportDiarios = void 0;
const models_1 = require("../models/index.js");
const diarioService_1 = require("../services/diarioService.js");
const diarioHtmlService_1 = require("../services/diarioHtmlService.js");
// GET /api/diarios/export?schoolPeriodId=X&sectionIds=1,2,3
const exportDiarios = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const schoolPeriodId = Number(req.query.schoolPeriodId);
        const sectionIdsRaw = req.query.sectionIds;
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es requerido' });
        }
        if (!sectionIdsRaw) {
            return res.status(400).json({ message: 'sectionIds es requerido (lista separada por comas)' });
        }
        const sectionIds = sectionIdsRaw
            .split(',')
            .map(s => Number(s.trim()))
            .filter(n => n > 0);
        if (sectionIds.length === 0) {
            return res.status(400).json({ message: 'Debe seleccionar al menos una sección' });
        }
        // Load all settings (key-value pairs)
        const settingsRows = yield models_1.Setting.findAll();
        const settings = {};
        for (const s of settingsRows) {
            settings[s.key] = s.value;
        }
        const buffer = yield (0, diarioService_1.generateDiarios)(schoolPeriodId, sectionIds, settings);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="diarios-de-clases.xlsx"');
        res.send(buffer);
    }
    catch (error) {
        console.error('[exportDiarios] Error:', error);
        res.status(500).json({ message: error.message || 'Error al generar los diarios' });
    }
});
exports.exportDiarios = exportDiarios;
// GET /api/diarios/html?schoolPeriodId=X&sectionIds=1,2,3&weekDate=YYYY-MM-DD
const exportDiariosHtml = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const schoolPeriodId = Number(req.query.schoolPeriodId);
        const sectionIdsRaw = req.query.sectionIds;
        const weekDate = req.query.weekDate;
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es requerido' });
        }
        if (!sectionIdsRaw) {
            return res.status(400).json({ message: 'sectionIds es requerido (lista separada por comas)' });
        }
        const sectionIds = sectionIdsRaw
            .split(',')
            .map(s => Number(s.trim()))
            .filter(n => n > 0);
        if (sectionIds.length === 0) {
            return res.status(400).json({ message: 'Debe seleccionar al menos una sección' });
        }
        // Load all settings (key-value pairs)
        const settingsRows = yield models_1.Setting.findAll();
        const settings = {};
        for (const s of settingsRows) {
            settings[s.key] = s.value;
        }
        const html = yield (0, diarioHtmlService_1.generateDiariosHtml)(schoolPeriodId, sectionIds, settings, weekDate);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    }
    catch (error) {
        console.error('[exportDiariosHtml] Error:', error);
        res.status(500).json({ message: error.message || 'Error al generar los diarios' });
    }
});
exports.exportDiariosHtml = exportDiariosHtml;
