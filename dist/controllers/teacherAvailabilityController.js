"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.saveTeacherAvailability = exports.getTeacherAvailability = exports.getAllAvailability = exports.saveMyAvailability = exports.getMyAvailability = void 0;
const models_1 = require("../models/index.js");
// GET /api/teacher-availability — returns the current user's availability as a map
// Response: { "Lunes|m1": "available", "Lunes|m2": "busy", ... }
const getMyAvailability = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const personId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.personId;
        if (!personId)
            return res.status(400).json({ message: 'No hay persona asociada' });
        const rows = yield models_1.TeacherAvailability.findAll({ where: { personId } });
        const map = {};
        rows.forEach(r => {
            map[`${r.day}|${r.periodId}`] = r.status;
        });
        return res.json(map);
    }
    catch (error) {
        console.error('[getMyAvailability] Error:', error);
        return res.status(500).json({ message: 'Error al obtener disponibilidad' });
    }
});
exports.getMyAvailability = getMyAvailability;
// POST /api/teacher-availability — saves the full availability map (replaces all)
// Body: { availability: { "Lunes|m1": "available", ... } }
const saveMyAvailability = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const personId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.personId;
        if (!personId)
            return res.status(400).json({ message: 'No hay persona asociada' });
        const { availability } = req.body;
        if (!availability || typeof availability !== 'object') {
            return res.status(400).json({ message: 'availability es requerido' });
        }
        // Delete existing rows and insert new ones
        yield models_1.TeacherAvailability.destroy({ where: { personId } });
        const rows = [];
        for (const [key, status] of Object.entries(availability)) {
            const [day, periodId] = key.split('|');
            if (day && periodId && status) {
                rows.push({ personId, day, periodId, status });
            }
        }
        if (rows.length > 0) {
            yield models_1.TeacherAvailability.bulkCreate(rows);
        }
        return res.json({ message: 'Disponibilidad guardada', count: rows.length });
    }
    catch (error) {
        console.error('[saveMyAvailability] Error:', error);
        return res.status(500).json({ message: 'Error al guardar disponibilidad' });
    }
});
exports.saveMyAvailability = saveMyAvailability;
// GET /api/teacher-availability/all — returns availability for all teachers (for Control de Estudios)
// Response: [{ personId, firstName, lastName, availability: {...} }, ...]
const getAllAvailability = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { Person } = yield Promise.resolve().then(() => __importStar(require('../models/index.js')));
        const teachers = yield Person.findAll({
            include: [
                { association: 'roles', where: { name: 'Profesor' }, required: true },
                { association: 'availability' },
            ],
        });
        const result = teachers.map((t) => {
            const map = {};
            (t.availability || []).forEach((r) => {
                map[`${r.day}|${r.periodId}`] = r.status;
            });
            return {
                personId: t.id,
                firstName: t.firstName,
                lastName: t.lastName,
                availability: map,
            };
        });
        return res.json(result);
    }
    catch (error) {
        console.error('[getAllAvailability] Error:', error);
        return res.status(500).json({ message: 'Error al obtener disponibilidad de profesores' });
    }
});
exports.getAllAvailability = getAllAvailability;
// GET /api/teacher-availability/:personId — returns a specific teacher's availability
const getTeacherAvailability = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const personId = Number(req.params.personId);
        const rows = yield models_1.TeacherAvailability.findAll({ where: { personId } });
        const map = {};
        rows.forEach(r => {
            map[`${r.day}|${r.periodId}`] = r.status;
        });
        return res.json(map);
    }
    catch (error) {
        console.error('[getTeacherAvailability] Error:', error);
        return res.status(500).json({ message: 'Error al obtener disponibilidad' });
    }
});
exports.getTeacherAvailability = getTeacherAvailability;
// POST /api/teacher-availability/:personId — saves a specific teacher's availability (for Control de Estudios)
// Body: { availability: { "Lunes|m1": "available", ... } }
const saveTeacherAvailability = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const personId = Number(req.params.personId);
        const { availability } = req.body;
        if (!availability || typeof availability !== 'object') {
            return res.status(400).json({ message: 'availability es requerido' });
        }
        yield models_1.TeacherAvailability.destroy({ where: { personId } });
        const rows = [];
        for (const [key, status] of Object.entries(availability)) {
            const [day, periodId] = key.split('|');
            if (day && periodId && status) {
                rows.push({ personId, day, periodId, status });
            }
        }
        if (rows.length > 0) {
            yield models_1.TeacherAvailability.bulkCreate(rows);
        }
        return res.json({ message: 'Disponibilidad guardada', count: rows.length });
    }
    catch (error) {
        console.error('[saveTeacherAvailability] Error:', error);
        return res.status(500).json({ message: 'Error al guardar disponibilidad' });
    }
});
exports.saveTeacherAvailability = saveTeacherAvailability;
