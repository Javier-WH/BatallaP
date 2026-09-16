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
exports.applyStructurePreset = exports.deleteStructurePreset = exports.createStructurePreset = exports.listStructurePresets = void 0;
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
// GET /api/structure-presets
const listStructurePresets = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const presets = yield index_1.StructurePreset.findAll({ order: [['isSystem', 'DESC'], ['name', 'ASC']] });
        return res.json(presets);
    }
    catch (error) {
        console.error('[listStructurePresets] Error:', error);
        return res.status(500).json({ message: 'Error al listar presets de estructura' });
    }
});
exports.listStructurePresets = listStructurePresets;
// POST /api/structure-presets
const createStructurePreset = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, grades } = req.body;
        if (!name || !Array.isArray(grades) || grades.length === 0) {
            return res.status(400).json({ message: 'Nombre y grados son requeridos' });
        }
        const preset = yield index_1.StructurePreset.create({ name, description: description || null, grades });
        return res.status(201).json(preset);
    }
    catch (error) {
        console.error('[createStructurePreset] Error:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'Ya existe un preset con ese nombre' });
        }
        return res.status(500).json({ message: 'Error al crear preset' });
    }
});
exports.createStructurePreset = createStructurePreset;
// DELETE /api/structure-presets/:id
const deleteStructurePreset = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const preset = yield index_1.StructurePreset.findByPk(req.params.id);
        if (!preset)
            return res.status(404).json({ message: 'Preset no encontrado' });
        if (preset.isSystem) {
            return res.status(403).json({ message: 'Los presets del sistema no se pueden eliminar' });
        }
        yield preset.destroy();
        return res.json({ message: 'Preset eliminado' });
    }
    catch (error) {
        console.error('[deleteStructurePreset] Error:', error);
        return res.status(500).json({ message: 'Error al eliminar preset' });
    }
});
exports.deleteStructurePreset = deleteStructurePreset;
// POST /api/structure-presets/:id/apply
const applyStructurePreset = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const preset = yield index_1.StructurePreset.findByPk(req.params.id);
        if (!preset) {
            yield t.rollback();
            return res.status(404).json({ message: 'Preset no encontrado' });
        }
        const { schoolPeriodId } = req.body;
        if (!schoolPeriodId) {
            yield t.rollback();
            return res.status(400).json({ message: 'schoolPeriodId es requerido' });
        }
        const period = yield index_1.SchoolPeriod.findByPk(schoolPeriodId, { transaction: t });
        if (!period) {
            yield t.rollback();
            return res.status(404).json({ message: 'Período no encontrado' });
        }
        const gradesData = preset.grades;
        const allSections = yield index_1.Section.findAll({ transaction: t });
        const results = [];
        for (const gradeData of gradesData) {
            const gradeName = gradeData.name.toUpperCase().trim();
            // Find or create grade in catalog
            let grade = yield index_1.Grade.findOne({ where: { name: gradeName }, transaction: t });
            if (!grade) {
                grade = yield index_1.Grade.create({ name: gradeName, isDiversified: false }, { transaction: t });
            }
            // Check if grade is already linked to this period
            let periodGrade = yield index_1.PeriodGrade.findOne({
                where: { schoolPeriodId, gradeId: grade.id },
                transaction: t,
            });
            const gradeCreated = !periodGrade;
            if (!periodGrade) {
                periodGrade = yield index_1.PeriodGrade.create({
                    schoolPeriodId,
                    gradeId: grade.id,
                    specializationId: null,
                }, { transaction: t });
            }
            // Link subjects to this grade
            let subjectsLinked = 0;
            let subjectsSkipped = 0;
            let order = 1;
            for (const subjData of gradeData.subjects) {
                // Find subject by name in catalog (normalized to uppercase)
                const subjectName = subjData.name.toUpperCase().trim();
                const subject = yield index_1.Subject.findOne({ where: { name: subjectName }, transaction: t });
                if (!subject) {
                    subjectsSkipped++;
                    continue;
                }
                // Check if already linked
                const existing = yield index_1.PeriodGradeSubject.findOne({
                    where: { periodGradeId: periodGrade.id, subjectId: subject.id },
                    transaction: t,
                });
                if (existing) {
                    subjectsSkipped++;
                    continue;
                }
                yield index_1.PeriodGradeSubject.create({
                    periodGradeId: periodGrade.id,
                    subjectId: subject.id,
                    order,
                }, { transaction: t });
                subjectsLinked++;
                order++;
            }
            // Link all sections from catalog to this grade
            let sectionsLinked = 0;
            for (const section of allSections) {
                const existingSection = yield index_1.PeriodGradeSection.findOne({
                    where: { periodGradeId: periodGrade.id, sectionId: section.id },
                    transaction: t,
                });
                if (!existingSection) {
                    yield index_1.PeriodGradeSection.create({
                        periodGradeId: periodGrade.id,
                        sectionId: section.id,
                    }, { transaction: t });
                    sectionsLinked++;
                }
            }
            results.push({
                grade: gradeData.name,
                created: gradeCreated,
                subjectsLinked,
                subjectsSkipped,
                sectionsLinked,
            });
        }
        yield t.commit();
        return res.json({
            message: 'Preset de estructura aplicado',
            results,
        });
    }
    catch (error) {
        yield t.rollback();
        console.error('[applyStructurePreset] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al aplicar preset de estructura' });
    }
});
exports.applyStructurePreset = applyStructurePreset;
