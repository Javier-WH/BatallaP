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
exports.unassignCertifiedTemplate = exports.assignCertifiedTemplate = exports.listCertifiedTemplateAssignments = exports.unassignTemplateFromGrade = exports.assignTemplateToGrade = exports.listTemplateAssignments = exports.getTemplateForGrade = exports.deleteTemplate = exports.uploadTemplate = exports.listTemplates = void 0;
const fs_1 = __importDefault(require("fs"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const sequelize_1 = require("sequelize");
const index_1 = require("../models/index.js");
const templatesDir = path_1.default.join(__dirname, '../../templates');
function templateAssignmentKey(gradeId) {
    // Templates are assigned strictly per grade (year). All sections of the
    // same grade share the same template.
    return `template_assignment:grade:${gradeId}`;
}
// Certified grades templates are assigned per "period" category.
// Two options: "pre2018" (students who started before 2018) and "actual".
function certifiedTemplateKey(periodKey) {
    return `certified_template_assignment:period:${periodKey}`;
}
const CERTIFIED_PERIOD_KEYS = ['pre2018', 'actual'];
function ensureTemplatesDir() {
    if (!fs_1.default.existsSync(templatesDir)) {
        fs_1.default.mkdirSync(templatesDir, { recursive: true });
    }
}
function safeTemplatePath(name) {
    if (!name || typeof name !== 'string')
        return null;
    // Prevent path traversal: only allow filename without directory separators
    const base = path_1.default.basename(name);
    if (!base || base.includes('..'))
        return null;
    const ext = path_1.default.extname(base).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls')
        return null;
    return path_1.default.join(templatesDir, base);
}
const listTemplates = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        ensureTemplatesDir();
        const files = yield promises_1.default.readdir(templatesDir);
        const templates = files
            .filter(f => f.toLowerCase().endsWith('.xlsx') || f.toLowerCase().endsWith('.xls'))
            .map(f => {
            const fullPath = path_1.default.join(templatesDir, f);
            const stat = fs_1.default.statSync(fullPath);
            return {
                name: f,
                size: stat.size,
                updatedAt: stat.mtime.toISOString(),
            };
        })
            .sort((a, b) => a.name.localeCompare(b.name));
        res.json(templates);
    }
    catch (error) {
        console.error('[listTemplates] Error:', error);
        res.status(500).json({ message: 'Error al listar las plantillas' });
    }
});
exports.listTemplates = listTemplates;
const uploadTemplate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        ensureTemplatesDir();
        if (!req.file) {
            return res.status(400).json({ message: 'No se ha enviado ningún archivo' });
        }
        res.json({
            message: 'Plantilla subida exitosamente',
            name: req.file.filename,
            size: req.file.size,
        });
    }
    catch (error) {
        console.error('[uploadTemplate] Error:', error);
        res.status(500).json({ message: 'Error al subir la plantilla' });
    }
});
exports.uploadTemplate = uploadTemplate;
const deleteTemplate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name } = req.params;
        const targetPath = safeTemplatePath(name);
        if (!targetPath) {
            return res.status(400).json({ message: 'Nombre de plantilla inválido' });
        }
        if (!fs_1.default.existsSync(targetPath)) {
            return res.status(404).json({ message: 'La plantilla no existe' });
        }
        yield promises_1.default.unlink(targetPath);
        res.json({ message: 'Plantilla eliminada exitosamente' });
    }
    catch (error) {
        console.error('[deleteTemplate] Error:', error);
        res.status(500).json({ message: 'Error al eliminar la plantilla' });
    }
});
exports.deleteTemplate = deleteTemplate;
// Returns the template assigned to a given grade, or null if none.
// Templates are strictly per-grade (all sections share the same template).
const getTemplateForGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gradeId } = req.params;
        if (!gradeId) {
            return res.status(400).json({ message: 'gradeId es requerido' });
        }
        const setting = yield index_1.Setting.findOne({ where: { key: templateAssignmentKey(gradeId) } });
        if (!setting) {
            return res.json({ gradeId: Number(gradeId), templateName: null });
        }
        const targetPath = safeTemplatePath(setting.value);
        if (!targetPath || !fs_1.default.existsSync(targetPath)) {
            return res.json({ gradeId: Number(gradeId), templateName: null });
        }
        res.json({ gradeId: Number(gradeId), templateName: setting.value });
    }
    catch (error) {
        console.error('[getTemplateForGrade] Error:', error);
        res.status(500).json({ message: 'Error al obtener la plantilla del grado' });
    }
});
exports.getTemplateForGrade = getTemplateForGrade;
// Returns all template assignments keyed by `${gradeId}`.
const listTemplateAssignments = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const settings = yield index_1.Setting.findAll({
            where: { key: { [sequelize_1.Op.like]: 'template_assignment:grade:%' } },
        });
        const assignments = {};
        for (const s of settings) {
            // Skip any legacy per-section keys (they contain ":section:")
            if (s.key.includes(':section:'))
                continue;
            // Strip the full prefix so the key is just the gradeId (e.g. "5").
            const key = s.key.replace('template_assignment:grade:', '');
            const targetPath = safeTemplatePath(s.value);
            if (targetPath && fs_1.default.existsSync(targetPath)) {
                assignments[key] = s.value;
            }
        }
        res.json(assignments);
    }
    catch (error) {
        console.error('[listTemplateAssignments] Error:', error);
        res.status(500).json({ message: 'Error al listar las asignaciones de plantillas' });
    }
});
exports.listTemplateAssignments = listTemplateAssignments;
// Assigns a template to a grade. Body: { gradeId, templateName }.
const assignTemplateToGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gradeId, templateName } = req.body;
        if (!gradeId || !templateName) {
            return res.status(400).json({ message: 'gradeId y templateName son requeridos' });
        }
        const targetPath = safeTemplatePath(templateName);
        if (!targetPath || !fs_1.default.existsSync(targetPath)) {
            return res.status(404).json({ message: 'La plantilla no existe' });
        }
        yield index_1.Setting.upsert({
            key: templateAssignmentKey(gradeId),
            value: templateName,
        });
        res.json({ gradeId: Number(gradeId), templateName });
    }
    catch (error) {
        console.error('[assignTemplateToGrade] Error:', error);
        res.status(500).json({ message: 'Error al asignar la plantilla' });
    }
});
exports.assignTemplateToGrade = assignTemplateToGrade;
// Removes a template assignment for a grade.
const unassignTemplateFromGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gradeId } = req.params;
        if (!gradeId) {
            return res.status(400).json({ message: 'gradeId es requerido' });
        }
        yield index_1.Setting.destroy({ where: { key: templateAssignmentKey(gradeId) } });
        res.json({ gradeId: Number(gradeId), templateName: null });
    }
    catch (error) {
        console.error('[unassignTemplateFromGrade] Error:', error);
        res.status(500).json({ message: 'Error al desasignar la plantilla' });
    }
});
exports.unassignTemplateFromGrade = unassignTemplateFromGrade;
// ── Certified grades template assignments (per period category) ────────
// Returns all certified template assignments keyed by period key.
const listCertifiedTemplateAssignments = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const settings = yield index_1.Setting.findAll({
            where: { key: { [sequelize_1.Op.like]: 'certified_template_assignment:period:%' } },
        });
        const assignments = {};
        for (const s of settings) {
            const key = s.key.replace('certified_template_assignment:period:', '');
            const targetPath = safeTemplatePath(s.value);
            if (targetPath && fs_1.default.existsSync(targetPath)) {
                assignments[key] = s.value;
            }
        }
        res.json(assignments);
    }
    catch (error) {
        console.error('[listCertifiedTemplateAssignments] Error:', error);
        res.status(500).json({ message: 'Error al listar las asignaciones de plantillas certificadas' });
    }
});
exports.listCertifiedTemplateAssignments = listCertifiedTemplateAssignments;
// Assigns a template to a certified period category. Body: { periodKey, templateName }.
const assignCertifiedTemplate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodKey, templateName } = req.body;
        if (!periodKey || !CERTIFIED_PERIOD_KEYS.includes(periodKey)) {
            return res.status(400).json({ message: 'periodKey debe ser "pre2018" o "actual"' });
        }
        if (!templateName) {
            return res.status(400).json({ message: 'templateName es requerido' });
        }
        const targetPath = safeTemplatePath(templateName);
        if (!targetPath || !fs_1.default.existsSync(targetPath)) {
            return res.status(404).json({ message: 'La plantilla no existe' });
        }
        yield index_1.Setting.upsert({
            key: certifiedTemplateKey(periodKey),
            value: templateName,
        });
        res.json({ periodKey, templateName });
    }
    catch (error) {
        console.error('[assignCertifiedTemplate] Error:', error);
        res.status(500).json({ message: 'Error al asignar la plantilla certificada' });
    }
});
exports.assignCertifiedTemplate = assignCertifiedTemplate;
// Removes a certified template assignment for a period category.
const unassignCertifiedTemplate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodKey } = req.params;
        if (!periodKey || !CERTIFIED_PERIOD_KEYS.includes(periodKey)) {
            return res.status(400).json({ message: 'periodKey debe ser "pre2018" o "actual"' });
        }
        yield index_1.Setting.destroy({ where: { key: certifiedTemplateKey(periodKey) } });
        res.json({ periodKey, templateName: null });
    }
    catch (error) {
        console.error('[unassignCertifiedTemplate] Error:', error);
        res.status(500).json({ message: 'Error al desasignar la plantilla certificada' });
    }
});
exports.unassignCertifiedTemplate = unassignCertifiedTemplate;
