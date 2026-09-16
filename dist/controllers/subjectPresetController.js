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
exports.applyPreset = exports.deletePreset = exports.updatePreset = exports.createPreset = exports.getPreset = exports.listPresets = void 0;
const index_1 = require("../models/index.js");
// GET /api/subject-presets
const listPresets = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const presets = yield index_1.SubjectPreset.findAll({ order: [['isSystem', 'DESC'], ['name', 'ASC']] });
        return res.json(presets);
    }
    catch (error) {
        console.error('[listPresets] Error:', error);
        return res.status(500).json({ message: 'Error al listar presets' });
    }
});
exports.listPresets = listPresets;
// GET /api/subject-presets/:id
const getPreset = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const preset = yield index_1.SubjectPreset.findByPk(req.params.id);
        if (!preset)
            return res.status(404).json({ message: 'Preset no encontrado' });
        return res.json(preset);
    }
    catch (error) {
        console.error('[getPreset] Error:', error);
        return res.status(500).json({ message: 'Error al obtener preset' });
    }
});
exports.getPreset = getPreset;
// POST /api/subject-presets
const createPreset = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, items } = req.body;
        if (!name || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Nombre y items son requeridos' });
        }
        const preset = yield index_1.SubjectPreset.create({ name, description: description || null, items });
        return res.status(201).json(preset);
    }
    catch (error) {
        console.error('[createPreset] Error:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'Ya existe un preset con ese nombre' });
        }
        return res.status(500).json({ message: 'Error al crear preset' });
    }
});
exports.createPreset = createPreset;
// PUT /api/subject-presets/:id
const updatePreset = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const preset = yield index_1.SubjectPreset.findByPk(req.params.id);
        if (!preset)
            return res.status(404).json({ message: 'Preset no encontrado' });
        if (preset.isSystem) {
            return res.status(403).json({ message: 'Los presets del sistema no se pueden editar' });
        }
        const { name, description, items } = req.body;
        yield preset.update({ name, description, items });
        return res.json(preset);
    }
    catch (error) {
        console.error('[updatePreset] Error:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'Ya existe un preset con ese nombre' });
        }
        return res.status(500).json({ message: 'Error al actualizar preset' });
    }
});
exports.updatePreset = updatePreset;
// DELETE /api/subject-presets/:id
const deletePreset = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const preset = yield index_1.SubjectPreset.findByPk(req.params.id);
        if (!preset)
            return res.status(404).json({ message: 'Preset no encontrado' });
        if (preset.isSystem) {
            return res.status(403).json({ message: 'Los presets del sistema no se pueden eliminar' });
        }
        yield preset.destroy();
        return res.json({ message: 'Preset eliminado' });
    }
    catch (error) {
        console.error('[deletePreset] Error:', error);
        return res.status(500).json({ message: 'Error al eliminar preset' });
    }
});
exports.deletePreset = deletePreset;
// POST /api/subject-presets/:id/apply
const applyPreset = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const preset = yield index_1.SubjectPreset.findByPk(req.params.id);
        if (!preset)
            return res.status(404).json({ message: 'Preset no encontrado' });
        const items = preset.items;
        const created = [];
        const skipped = [];
        for (const item of items) {
            const trimmedName = item.name.trim();
            if (!trimmedName)
                continue;
            // Check if subject already exists (case-insensitive, normalized)
            const existing = yield index_1.Subject.findOne({ where: { name: trimmedName } });
            if (existing) {
                skipped.push({ name: trimmedName, reason: 'Ya existe' });
                continue;
            }
            yield index_1.Subject.create({
                name: trimmedName,
                abbreviation: ((_a = item.abbreviation) === null || _a === void 0 ? void 0 : _a.trim()) || null,
            });
            created.push({ name: trimmedName, abbreviation: ((_b = item.abbreviation) === null || _b === void 0 ? void 0 : _b.trim()) || null });
        }
        return res.json({
            message: `Preset aplicado: ${created.length} creadas, ${skipped.length} omitidas`,
            created,
            skipped,
        });
    }
    catch (error) {
        console.error('[applyPreset] Error:', error);
        return res.status(500).json({ message: 'Error al aplicar preset' });
    }
});
exports.applyPreset = applyPreset;
