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
exports.getSettingByKey = exports.updateSettings = exports.getSettings = void 0;
const models_1 = require("../models");
const getSettings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const settings = yield models_1.Setting.findAll();
        const settingsMap = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        res.json(settingsMap);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener configuraciones' });
    }
});
exports.getSettings = getSettings;
const updateSettings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { settings } = req.body; // Expecting an object { key: value, ... }
        for (const [key, value] of Object.entries(settings)) {
            const [setting, created] = yield models_1.Setting.findOrCreate({
                where: { key },
                defaults: { key, value: String(value) }
            });
            if (!created) {
                yield setting.update({ value: String(value) });
            }
        }
        res.json({ message: 'Configuraciones actualizadas' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar configuraciones' });
    }
});
exports.updateSettings = updateSettings;
const getSettingByKey = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { key } = req.params;
        const setting = yield models_1.Setting.findOne({ where: { key } });
        if (!setting) {
            // Return default value for max_grade if not found
            if (key === 'max_grade') {
                return res.json({ key: 'max_grade', value: '20' });
            }
            // Return default value for enable_grade_rounding if not found
            if (key === 'enable_grade_rounding') {
                return res.json({ key: 'enable_grade_rounding', value: 'false' });
            }
            return res.status(404).json({ message: 'Configuración no encontrada' });
        }
        res.json(setting);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener configuración' });
    }
});
exports.getSettingByKey = getSettingByKey;
