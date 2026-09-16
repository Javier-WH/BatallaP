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
exports.getSettings = exports.updateSetting = exports.getSetting = void 0;
const models_1 = require("../models");
const sequelize_1 = require("sequelize");
const getSetting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { key } = req.params;
        const setting = yield models_1.Setting.findOne({ where: { key } });
        if (!setting) {
            // Return a default value for max_grade if not found
            if (key === 'max_grade') {
                return res.json({ key: 'max_grade', value: '20' });
            }
            // Return a default value for enable_grade_rounding if not found
            if (key === 'enable_grade_rounding') {
                return res.json({ key: 'enable_grade_rounding', value: 'false' });
            }
            return res.status(404).json({ message: 'Configuración no encontrada' });
        }
        res.json(setting);
    }
    catch (error) {
        console.error('Error al obtener configuración:', error);
        res.status(500).json({ message: 'Error al obtener configuración' });
    }
});
exports.getSetting = getSetting;
const updateSetting = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { key } = req.params;
        const { value } = req.body;
        const [setting] = yield models_1.Setting.upsert({
            key,
            value: value.toString()
        }, {
            returning: true
        });
        res.json(setting);
    }
    catch (error) {
        console.error('Error al actualizar configuración:', error);
        res.status(500).json({ message: 'Error al actualizar configuración' });
    }
});
exports.updateSetting = updateSetting;
const getSettings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { keys } = req.query;
        if (!keys) {
            return res.status(400).json({ message: 'Se requieren claves de configuración' });
        }
        const keysArray = (Array.isArray(keys) ? keys : [keys]);
        const settings = yield models_1.Setting.findAll({
            where: {
                key: {
                    [sequelize_1.Op.in]: keysArray
                }
            }
        });
        // Add default values for any missing keys
        const result = keysArray.map(key => {
            const setting = settings.find(s => s.key === key);
            if (!setting) {
                // Return default for max_grade if not found
                if (key === 'max_grade') {
                    return { key: 'max_grade', value: '20' };
                }
                // Return default for enable_grade_rounding if not found
                if (key === 'enable_grade_rounding') {
                    return { key: 'enable_grade_rounding', value: 'false' };
                }
                return { key, value: '' };
            }
            return setting;
        });
        res.json(result);
    }
    catch (error) {
        console.error('Error al obtener configuraciones:', error);
        res.status(500).json({ message: 'Error al obtener configuraciones' });
    }
});
exports.getSettings = getSettings;
