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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateGradeColor = exports.updateSectionColor = exports.removeSectionFromGrade = exports.addSectionToGrade = exports.removeGradeFromPeriod = exports.addGradeToPeriod = exports.getPeriodGradeSubject = exports.removeSubjectFromGrade = exports.updateSubjectWeeklyBlocks = exports.toggleSubjectNotRepairable = exports.toggleSubjectIncludeInAverage = exports.updateSubjectOrderForGrade = exports.addSubjectToGrade = exports.getPeriodStructure = exports.deleteSubjectGroup = exports.updateSubjectGroup = exports.createSubjectGroup = exports.getSubjectGroups = exports.deleteSubject = exports.updateSubject = exports.createSubject = exports.getSubjects = exports.deleteSection = exports.updateSection = exports.createSection = exports.getSections = exports.deleteGrade = exports.updateGradeOrder = exports.updateGrade = exports.createGrade = exports.getGrades = exports.deletePeriod = exports.updatePeriod = exports.togglePeriodActive = exports.createPeriod = exports.ensurePreinscriptionPeriod = exports.getPreinscriptionPeriod = exports.getActivePeriod = exports.deleteSpecialization = exports.updateSpecialization = exports.createSpecialization = exports.getSpecializations = exports.getStudentPeriodOutcomes = exports.getPeriods = void 0;
const sequelize_1 = require("sequelize");
const index_1 = require("../models/index.js");
const database_1 = __importDefault(require("../config/database.js"));
const periodOutcomeService_1 = require("../services/periodOutcomeService.js");
const SchoolPeriodService = __importStar(require("../services/schoolPeriodService.js"));
// --- School Periods ---
const getPeriods = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const periods = yield index_1.SchoolPeriod.findAll({
            where: { status: { [sequelize_1.Op.ne]: 'externo' } },
            order: [['startYear', 'DESC'], ['endYear', 'DESC']]
        });
        res.json(periods);
    }
    catch (error) {
        res.status(500).json({ error: 'Error fetching periods' });
    }
});
exports.getPeriods = getPeriods;
const getStudentPeriodOutcomes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodId } = req.params;
        const outcomes = yield periodOutcomeService_1.PeriodOutcomeService.getOutcomesForPeriod(Number(periodId));
        res.json(outcomes);
    }
    catch (error) {
        console.error('Error fetching student period outcomes:', error);
        res.status(500).json({ error: 'Error fetching student period outcomes' });
    }
});
exports.getStudentPeriodOutcomes = getStudentPeriodOutcomes;
// Specializations
const getSpecializations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const specializations = yield index_1.Specialization.findAll();
    res.json(specializations);
});
exports.getSpecializations = getSpecializations;
const createSpecialization = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name } = req.body;
    const specialization = yield index_1.Specialization.create({ name });
    res.json(specialization);
});
exports.createSpecialization = createSpecialization;
const updateSpecialization = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name } = req.body;
        yield index_1.Specialization.update({ name }, { where: { id } });
        res.json({ message: 'Specialization updated' });
    }
    catch (error) {
        res.status(500).json({ error: 'Error updating specialization' });
    }
});
exports.updateSpecialization = updateSpecialization;
const deleteSpecialization = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        // Check if any PeriodGrade is using this specialization
        const inUseCount = yield index_1.PeriodGrade.count({ where: { specializationId: id } });
        if (inUseCount > 0) {
            return res.status(400).json({ error: 'No se puede eliminar la especialización porque está siendo utilizada por uno o más grados' });
        }
        yield index_1.Specialization.destroy({ where: { id } });
        res.json({ message: 'Specialization deleted' });
    }
    catch (error) {
        res.status(400).json({ error: 'No se puede eliminar porque está en uso' });
    }
});
exports.deleteSpecialization = deleteSpecialization;
const getActivePeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const period = yield SchoolPeriodService.getActivePeriod();
        res.json(period);
    }
    catch (error) {
        res.status(500).json({ error: 'Error fetching active period' });
    }
});
exports.getActivePeriod = getActivePeriod;
const getPreinscriptionPeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const period = yield SchoolPeriodService.getPreinscriptionPeriod();
        res.json(period);
    }
    catch (error) {
        res.status(500).json({ error: 'Error fetching preinscription period' });
    }
});
exports.getPreinscriptionPeriod = getPreinscriptionPeriod;
/**
 * Guarantee that the school year following the active one exists and is flagged
 * as 'preinscripcion'. Uses the same `ensureNextPreinscriptionPeriod` function
 * that the system uses when activating a period or creating a new one.
 *
 * Returns the preinscription period (created or already existing). Requires an
 * active period to exist, otherwise returns 400.
 */
const ensurePreinscriptionPeriod = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const transaction = yield database_1.default.transaction();
    try {
        const activePeriod = yield SchoolPeriodService.getActivePeriod(transaction);
        if (!activePeriod) {
            yield transaction.rollback();
            return res.status(400).json({
                error: 'No hay un período escolar activo desde el cual crear el de preinscripción.',
            });
        }
        const preinscription = yield SchoolPeriodService.ensureNextPreinscriptionPeriod(activePeriod, transaction);
        yield transaction.commit();
        res.status(200).json(preinscription);
    }
    catch (error) {
        yield transaction.rollback();
        console.error('[ensurePreinscriptionPeriod] Error:', error);
        res.status(500).json({ error: 'Error al crear el período de preinscripción' });
    }
});
exports.ensurePreinscriptionPeriod = ensurePreinscriptionPeriod;
const createPeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const transaction = yield database_1.default.transaction();
    try {
        const { period, name } = req.body;
        if (!period || !name) {
            yield transaction.rollback();
            return res.status(400).json({ error: 'Period and name are required' });
        }
        // Expected format: YYYY-YYYY
        const match = /^([0-9]{4})-([0-9]{4})$/.exec(period);
        if (!match) {
            yield transaction.rollback();
            return res.status(400).json({ error: 'Period must have format YYYY-YYYY (e.g. 2025-2026)' });
        }
        const startYear = parseInt(match[1], 10);
        const endYear = parseInt(match[2], 10);
        if (!(endYear > startYear)) {
            yield transaction.rollback();
            return res.status(400).json({ error: 'End year must be greater than start year' });
        }
        const currentActivePeriod = yield SchoolPeriodService.getActivePeriod(transaction);
        // Without an active period the new one takes over. Otherwise, the school year
        // right after the active one becomes the preinscription period; anything else
        // is stored as historical. We never auto-switch the active period here.
        let status = 'historico';
        if (!currentActivePeriod) {
            status = 'activo';
        }
        else if (startYear === currentActivePeriod.startYear + 1) {
            const existingPreinscription = yield SchoolPeriodService.getPreinscriptionPeriod(transaction);
            if (!existingPreinscription)
                status = 'preinscripcion';
        }
        // Create the new period
        const created = yield index_1.SchoolPeriod.create({
            period,
            name,
            startYear,
            endYear,
            status,
        }, { transaction });
        // Find the most recent previous period to copy structure from (exclude external periods)
        const previousPeriod = yield index_1.SchoolPeriod.findOne({
            where: { id: { [sequelize_1.Op.ne]: created.id }, status: { [sequelize_1.Op.ne]: 'externo' } },
            order: [['startYear', 'DESC'], ['endYear', 'DESC']],
            transaction
        });
        if (previousPeriod) {
            yield SchoolPeriodService.clonePeriodStructure(previousPeriod.id, created.id, transaction);
        }
        // A brand new active period must always have its preinscription counterpart
        if (status === 'activo') {
            yield SchoolPeriodService.ensureNextPreinscriptionPeriod(created, transaction);
        }
        yield transaction.commit();
        res.status(201).json(created);
    }
    catch (error) {
        yield transaction.rollback();
        const err = error;
        if ((err === null || err === void 0 ? void 0 : err.name) === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: 'Period already exists' });
        }
        console.error('Error creating period:', error);
        res.status(500).json({ error: 'Error creating period' });
    }
});
exports.createPeriod = createPeriod;
const togglePeriodActive = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const period = yield SchoolPeriodService.activatePeriod(Number(id));
        res.json({ message: 'Period activated successfully', period });
    }
    catch (error) {
        console.error('[togglePeriodActive] Error:', error);
        res.status(500).json({ error: 'Error toggling period' });
    }
});
exports.togglePeriodActive = togglePeriodActive;
const updatePeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { period, name } = req.body;
        if (!period || !name) {
            return res.status(400).json({ error: 'Period and name are required' });
        }
        const match = /^([0-9]{4})-([0-9]{4})$/.exec(period);
        if (!match) {
            return res.status(400).json({ error: 'Period must have format YYYY-YYYY (e.g. 2025-2026)' });
        }
        const startYear = parseInt(match[1], 10);
        const endYear = parseInt(match[2], 10);
        if (!(endYear > startYear)) {
            return res.status(400).json({ error: 'End year must be greater than start year' });
        }
        yield index_1.SchoolPeriod.update({ period, name, startYear, endYear }, { where: { id } });
        res.json({ message: 'Period updated' });
    }
    catch (error) {
        res.status(500).json({ error: 'Error updating period' });
    }
});
exports.updatePeriod = updatePeriod;
// ... existing code ...
const deletePeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const { id } = req.params;
        // 0. Clean up direct SchoolPeriod dependencies
        yield index_1.PeriodClosure.destroy({ where: { schoolPeriodId: id }, transaction: t });
        yield index_1.CouncilChecklist.destroy({ where: { schoolPeriodId: id }, transaction: t });
        yield index_1.PendingSubject.destroy({ where: { originPeriodId: id }, transaction: t });
        // 0.2 Clean up Matriculations (Fix for foreign key constraint)
        const matriculations = yield index_1.Matriculation.findAll({
            where: { schoolPeriodId: id },
            attributes: ['id'],
            transaction: t
        });
        const matriculationIds = matriculations.map(m => m.id);
        if (matriculationIds.length > 0) {
            yield index_1.EnrollmentDocument.destroy({ where: { matriculationId: { [sequelize_1.Op.in]: matriculationIds } }, transaction: t });
            yield index_1.Matriculation.destroy({ where: { id: { [sequelize_1.Op.in]: matriculationIds } }, transaction: t });
        }
        // 0.3 Clean up Terms and linked Evaluation Data
        const terms = yield index_1.Term.findAll({
            where: { schoolPeriodId: id },
            attributes: ['id'],
            transaction: t
        });
        const termIds = terms.map(te => te.id);
        if (termIds.length > 0) {
            // CouncilPoints linked to Terms
            yield index_1.CouncilPoint.destroy({ where: { termId: { [sequelize_1.Op.in]: termIds } }, transaction: t });
            // EvaluationPlans and Qualifications linked to Terms
            const evalPlans = yield index_1.EvaluationPlan.findAll({
                where: { termId: { [sequelize_1.Op.in]: termIds } },
                attributes: ['id'],
                transaction: t
            });
            const evalPlanIds = evalPlans.map(ep => ep.id);
            if (evalPlanIds.length > 0) {
                yield index_1.Qualification.destroy({ where: { evaluationPlanId: { [sequelize_1.Op.in]: evalPlanIds } }, transaction: t });
                yield index_1.EvaluationPlan.destroy({ where: { id: { [sequelize_1.Op.in]: evalPlanIds } }, transaction: t });
            }
            // Finally delete terms
            yield index_1.Term.destroy({ where: { id: { [sequelize_1.Op.in]: termIds } }, transaction: t });
        }
        // 0.1 Clean up Inscriptions and their child dependencies
        const inscriptions = yield index_1.Inscription.findAll({
            where: { schoolPeriodId: id },
            attributes: ['id'],
            transaction: t
        });
        const inscriptionIds = inscriptions.map(i => i.id);
        if (inscriptionIds.length > 0) {
            yield index_1.StudentPeriodOutcome.destroy({ where: { inscriptionId: { [sequelize_1.Op.in]: inscriptionIds } }, transaction: t });
            yield index_1.PendingSubject.destroy({ where: { newInscriptionId: { [sequelize_1.Op.in]: inscriptionIds } }, transaction: t });
            yield index_1.InscriptionSubject.destroy({ where: { inscriptionId: { [sequelize_1.Op.in]: inscriptionIds } }, transaction: t });
            // Finally delete the inscriptions
            yield index_1.Inscription.destroy({ where: { id: { [sequelize_1.Op.in]: inscriptionIds } }, transaction: t });
        }
        // Find all PeriodGrades associated with this period
        const periodGrades = yield index_1.PeriodGrade.findAll({ where: { schoolPeriodId: id }, transaction: t });
        const periodGradeIds = periodGrades.map(pg => pg.id);
        if (periodGradeIds.length > 0) {
            // 1. Delete TeacherAssignments linked to PeriodGradeSubjects of these PeriodGrades
            // First find PeriodGradeSubjects to get their IDs
            const periodGradeSubjects = yield index_1.PeriodGradeSubject.unscoped().findAll({
                where: { periodGradeId: { [sequelize_1.Op.in]: periodGradeIds } },
                transaction: t
            });
            const periodGradeSubjectIds = periodGradeSubjects.map(pgs => pgs.id);
            if (periodGradeSubjectIds.length > 0) {
                yield index_1.TeacherAssignment.destroy({
                    where: { periodGradeSubjectId: { [sequelize_1.Op.in]: periodGradeSubjectIds } },
                    transaction: t
                });
            }
            // 2. Delete PeriodGradeSubjects
            yield index_1.PeriodGradeSubject.destroy({
                where: { periodGradeId: { [sequelize_1.Op.in]: periodGradeIds } },
                transaction: t
            });
            // 3. Delete PeriodGradeSections
            yield index_1.PeriodGradeSection.destroy({
                where: { periodGradeId: { [sequelize_1.Op.in]: periodGradeIds } },
                transaction: t
            });
            // 4. Delete PeriodGrades
            yield index_1.PeriodGrade.destroy({
                where: { id: { [sequelize_1.Op.in]: periodGradeIds } },
                transaction: t
            });
        }
        // 5. Delete the SchoolPeriod
        yield index_1.SchoolPeriod.destroy({ where: { id }, transaction: t });
        yield t.commit();
        res.json({ message: 'Period deleted' });
    }
    catch (error) {
        yield t.rollback();
        console.error('Error deletePeriod:', error);
        res.status(500).json({ error: 'Error al eliminar el periodo escolar, verifique que no posea datos vinculados.' });
    }
});
exports.deletePeriod = deletePeriod;
// --- Catalogs (Grades & Sections) ---
const getGrades = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const grades = yield index_1.Grade.findAll({
        order: [
            ['order', 'ASC'],
            ['name', 'ASC'],
        ],
    });
    res.json(grades);
});
exports.getGrades = getGrades;
const createGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, isDiversified } = req.body;
    const maxOrder = yield index_1.Grade.max('order');
    const nextOrder = Number.isFinite(maxOrder) ? (Number(maxOrder) || 0) + 1 : 1;
    const grade = yield index_1.Grade.create({ name, isDiversified: !!isDiversified, order: nextOrder });
    res.json(grade);
});
exports.createGrade = createGrade;
const updateGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, isDiversified } = req.body;
        yield index_1.Grade.update({ name, isDiversified }, { where: { id } });
        res.json({ message: 'Grade updated' });
    }
    catch (error) {
        res.status(500).json({ error: 'Error updating grade' });
    }
});
exports.updateGrade = updateGrade;
const updateGradeOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { gradeIds } = req.body;
        if (!Array.isArray(gradeIds) || gradeIds.length === 0) {
            return res.status(400).json({ error: 'gradeIds must be a non-empty array' });
        }
        const updates = gradeIds.map((gradeId, index) => index_1.Grade.update({ order: index + 1 }, { where: { id: gradeId } }));
        yield Promise.all(updates);
        res.json({ message: 'Grade order updated' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating grade order' });
    }
});
exports.updateGradeOrder = updateGradeOrder;
const deleteGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield index_1.Grade.destroy({ where: { id } });
        res.json({ message: 'Grade deleted' });
    }
    catch (error) {
        res.status(400).json({ error: 'No se puede eliminar porque está en uso' });
    }
});
exports.deleteGrade = deleteGrade;
const getSections = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const sections = yield index_1.Section.findAll();
    res.json(sections);
});
exports.getSections = getSections;
const createSection = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name } = req.body;
    const section = yield index_1.Section.create({ name });
    res.json(section);
});
exports.createSection = createSection;
const updateSection = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name } = req.body;
        yield index_1.Section.update({ name }, { where: { id } });
        res.json({ message: 'Section updated' });
    }
    catch (error) {
        res.status(500).json({ error: 'Error updating section' });
    }
});
exports.updateSection = updateSection;
const deleteSection = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield index_1.Section.destroy({ where: { id } });
        res.json({ message: 'Section deleted' });
    }
    catch (error) {
        res.status(400).json({ error: 'No se puede eliminar porque está en uso' });
    }
});
exports.deleteSection = deleteSection;
// ... (Grades & Sections) ...
const getSubjects = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const subjects = yield index_1.Subject.findAll({ include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }] });
    res.json(subjects);
});
exports.getSubjects = getSubjects;
const createSubject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, subjectGroupId, usesLiteralGrades, abbreviation, icon, color, allowConsecutiveBlocks, maxHoursPerDay } = req.body;
    const subject = yield index_1.Subject.create({ name, subjectGroupId: subjectGroupId !== null && subjectGroupId !== void 0 ? subjectGroupId : null, usesLiteralGrades: usesLiteralGrades !== null && usesLiteralGrades !== void 0 ? usesLiteralGrades : false, abbreviation: abbreviation !== null && abbreviation !== void 0 ? abbreviation : null, icon: icon !== null && icon !== void 0 ? icon : null, color: color !== null && color !== void 0 ? color : null, allowConsecutiveBlocks: allowConsecutiveBlocks !== null && allowConsecutiveBlocks !== void 0 ? allowConsecutiveBlocks : 0, maxHoursPerDay: maxHoursPerDay !== null && maxHoursPerDay !== void 0 ? maxHoursPerDay : null });
    res.json(subject);
});
exports.createSubject = createSubject;
const updateSubject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, subjectGroupId, usesLiteralGrades, abbreviation, icon, color, allowConsecutiveBlocks, maxHoursPerDay } = req.body;
        yield index_1.Subject.update({ name, subjectGroupId: subjectGroupId !== null && subjectGroupId !== void 0 ? subjectGroupId : null, usesLiteralGrades: usesLiteralGrades !== null && usesLiteralGrades !== void 0 ? usesLiteralGrades : false, abbreviation: abbreviation !== null && abbreviation !== void 0 ? abbreviation : null, icon: icon !== null && icon !== void 0 ? icon : null, color: color !== null && color !== void 0 ? color : null, allowConsecutiveBlocks: allowConsecutiveBlocks !== null && allowConsecutiveBlocks !== void 0 ? allowConsecutiveBlocks : 0, maxHoursPerDay: maxHoursPerDay !== null && maxHoursPerDay !== void 0 ? maxHoursPerDay : null }, { where: { id } });
        res.json({ message: 'Subject updated' });
    }
    catch (error) {
        console.error('[updateSubject] Error:', error);
        res.status(500).json({ error: 'Error updating subject' });
    }
});
exports.updateSubject = updateSubject;
const deleteSubject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield index_1.Subject.destroy({ where: { id } });
        res.json({ message: 'Subject deleted' });
    }
    catch (error) {
        res.status(400).json({ error: 'No se puede eliminar porque está en uso' });
    }
});
exports.deleteSubject = deleteSubject;
// Subject Groups
const getSubjectGroups = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const groups = yield index_1.SubjectGroup.findAll();
    res.json(groups);
});
exports.getSubjectGroups = getSubjectGroups;
const createSubjectGroup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rawName = req.body.name;
        const name = rawName.trim();
        if (!name) {
            return res.status(400).json({ error: 'El nombre del grupo es requerido' });
        }
        const existing = yield index_1.SubjectGroup.findOne({
            where: database_1.default.where(database_1.default.fn('LOWER', database_1.default.col('name')), database_1.default.fn('LOWER', name))
        });
        if (existing) {
            return res.status(400).json({ error: 'Ya existe un grupo de materias con ese nombre' });
        }
        const { bulletinAbbreviation, longAbbreviation, shortAbbreviation } = req.body;
        const group = yield index_1.SubjectGroup.create({
            name,
            bulletinAbbreviation: (bulletinAbbreviation === null || bulletinAbbreviation === void 0 ? void 0 : bulletinAbbreviation.trim()) || null,
            longAbbreviation: (longAbbreviation === null || longAbbreviation === void 0 ? void 0 : longAbbreviation.trim()) || null,
            shortAbbreviation: (shortAbbreviation === null || shortAbbreviation === void 0 ? void 0 : shortAbbreviation.trim()) || null,
        });
        res.json(group);
    }
    catch (error) {
        res.status(500).json({ error: 'Error creando grupo de materias' });
    }
});
exports.createSubjectGroup = createSubjectGroup;
const updateSubjectGroup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const rawName = req.body.name;
        const name = rawName.trim();
        if (!name) {
            return res.status(400).json({ error: 'El nombre del grupo es requerido' });
        }
        const existing = yield index_1.SubjectGroup.findOne({
            where: {
                name,
                id: { [sequelize_1.Op.ne]: id },
            },
        });
        if (existing) {
            return res.status(400).json({ error: 'Ya existe un grupo de materias con ese nombre' });
        }
        const { bulletinAbbreviation, longAbbreviation, shortAbbreviation } = req.body;
        yield index_1.SubjectGroup.update({
            name,
            bulletinAbbreviation: (bulletinAbbreviation === null || bulletinAbbreviation === void 0 ? void 0 : bulletinAbbreviation.trim()) || null,
            longAbbreviation: (longAbbreviation === null || longAbbreviation === void 0 ? void 0 : longAbbreviation.trim()) || null,
            shortAbbreviation: (shortAbbreviation === null || shortAbbreviation === void 0 ? void 0 : shortAbbreviation.trim()) || null,
        }, { where: { id } });
        res.json({ message: 'Subject group updated' });
    }
    catch (error) {
        res.status(500).json({ error: 'Error updating subject group' });
    }
});
exports.updateSubjectGroup = updateSubjectGroup;
const deleteSubjectGroup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield index_1.SubjectGroup.destroy({ where: { id } });
        res.json({ message: 'Subject group deleted' });
    }
    catch (error) {
        res.status(400).json({ error: 'No se puede eliminar porque está en uso' });
    }
});
exports.deleteSubjectGroup = deleteSubjectGroup;
// --- Structure Management ---
const getPeriodStructure = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodId } = req.params;
        let structure = yield index_1.PeriodGrade.findAll({
            where: { schoolPeriodId: periodId },
            include: [
                { model: index_1.Grade, as: 'grade' },
                { model: index_1.Specialization, as: 'specialization' },
                {
                    model: index_1.Section,
                    as: 'sections',
                    through: { attributes: ['id', 'color'] }
                },
                {
                    model: index_1.Subject,
                    as: 'subjects',
                    through: { attributes: ['id', 'order', 'includeInAverage', 'notRepairable', 'weeklyBlocks'], where: { active: true } },
                    include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }]
                }
            ],
            order: [
                // Order subjects within each PeriodGrade by the join-table "order" column
                [{ model: index_1.Subject, as: 'subjects' }, index_1.PeriodGradeSubject, 'order', 'ASC'],
            ],
        });
        // Historical periods may not have a PeriodGrade structure. Expose a
        // read-only virtual structure so report selectors remain usable; the
        // report endpoints then source definitive values from HistoricalGrade.
        if (structure.length === 0) {
            // Prefer the current academic structure for historical periods. This
            // avoids forcing users to recreate every prior year's sections merely to
            // generate reports. Specific historical inscriptions can still override
            // the default roster in the report endpoints.
            const currentPeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
            if (currentPeriod && currentPeriod.id !== Number(periodId)) {
                structure = yield index_1.PeriodGrade.findAll({
                    where: { schoolPeriodId: currentPeriod.id },
                    include: [
                        { model: index_1.Grade, as: 'grade' },
                        { model: index_1.Specialization, as: 'specialization' },
                        { model: index_1.Section, as: 'sections', through: { attributes: ['id', 'color'] } },
                        {
                            model: index_1.Subject,
                            as: 'subjects',
                            through: { attributes: ['id', 'order', 'includeInAverage', 'notRepairable', 'weeklyBlocks'], where: { active: true } },
                            include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }],
                        },
                    ],
                    order: [[{ model: index_1.Subject, as: 'subjects' }, index_1.PeriodGradeSubject, 'order', 'ASC']],
                });
            }
            if (structure.length > 0)
                return res.json(structure);
            const [inscriptions, historicalGrades] = yield Promise.all([
                index_1.Inscription.findAll({
                    where: { schoolPeriodId: periodId },
                    include: [
                        { model: index_1.Grade, as: 'grade' },
                        { model: index_1.Section, as: 'section' },
                    ],
                    attributes: ['id', 'gradeId', 'sectionId'],
                }),
                index_1.HistoricalGrade.findAll({
                    where: { schoolPeriodId: periodId },
                    include: [{ model: index_1.Subject, as: 'subject', include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }] }],
                }),
            ]);
            const byGrade = new Map();
            for (const inscription of inscriptions) {
                const grade = inscription.grade;
                const section = inscription.section;
                if (!grade || !section)
                    continue;
                const entry = byGrade.get(grade.id) || {
                    id: -Number(grade.id),
                    grade,
                    specialization: null,
                    sections: [],
                    subjects: [],
                };
                if (!entry.sections.some((item) => item.id === section.id))
                    entry.sections.push(section);
                byGrade.set(grade.id, entry);
            }
            for (const historical of historicalGrades) {
                const gradeEntry = byGrade.get(historical.gradeId);
                if (!gradeEntry || !historical.subject)
                    continue;
                if (!gradeEntry.subjects.some((subject) => subject.id === historical.subjectId)) {
                    gradeEntry.subjects.push(historical.subject);
                }
            }
            structure = [...byGrade.values()].sort((a, b) => (a.grade.order || 0) - (b.grade.order || 0));
        }
        res.json(structure);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching structure' });
    }
});
exports.getPeriodStructure = getPeriodStructure;
// ... (Grade/Section assignment) ...
const addSubjectToGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodGradeId, subjectId } = req.body;
        // Determine next order for this periodGrade
        const maxExisting = yield index_1.PeriodGradeSubject.max('order', { where: { periodGradeId } });
        const nextOrder = Number.isFinite(maxExisting) ? (Number(maxExisting) || 0) + 1 : 1;
        // Check if a soft-deleted record already exists (reactivate instead of create)
        const existing = yield index_1.PeriodGradeSubject.unscoped().findOne({
            where: { periodGradeId, subjectId },
        });
        let pgs;
        if (existing) {
            yield existing.update({ active: true, order: nextOrder });
            pgs = existing;
        }
        else {
            pgs = yield index_1.PeriodGradeSubject.create({ periodGradeId, subjectId, order: nextOrder });
        }
        // For core subjects (no subjectGroupId), auto-create InscriptionSubject
        // records so existing students get the new subject immediately.
        const subject = yield index_1.Subject.findByPk(subjectId);
        if (subject && !subject.subjectGroupId) {
            const periodGrade = yield index_1.PeriodGrade.findByPk(periodGradeId);
            if (periodGrade) {
                const inscriptions = yield index_1.Inscription.findAll({
                    where: {
                        schoolPeriodId: periodGrade.schoolPeriodId,
                        gradeId: periodGrade.gradeId,
                    },
                    attributes: ['id', 'schoolPeriodId', 'gradeId', 'sectionId'],
                });
                const toCreate = inscriptions.map((ins) => ({
                    inscriptionId: ins.id,
                    subjectId,
                    schoolPeriodId: ins.schoolPeriodId,
                    gradeId: ins.gradeId,
                    sectionId: ins.sectionId,
                }));
                if (toCreate.length > 0) {
                    yield index_1.InscriptionSubject.bulkCreate(toCreate, { ignoreDuplicates: true });
                }
            }
        }
        res.json(pgs);
    }
    catch (error) {
        res.status(500).json({ error: 'Error adding subject' });
    }
});
exports.addSubjectToGrade = addSubjectToGrade;
const updateSubjectOrderForGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodGradeId, subjectIds } = req.body;
        if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
            return res.status(400).json({ error: 'subjectIds must be a non-empty array' });
        }
        // Update order sequentially based on array index
        const updates = subjectIds.map((subjectId, index) => index_1.PeriodGradeSubject.update({ order: index + 1 }, { where: { periodGradeId, subjectId } }));
        yield Promise.all(updates);
        res.json({ message: 'Order updated' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating subject order' });
    }
});
exports.updateSubjectOrderForGrade = updateSubjectOrderForGrade;
const toggleSubjectIncludeInAverage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodGradeId, subjectId, includeInAverage } = req.body;
        const pgs = yield index_1.PeriodGradeSubject.unscoped().findOne({
            where: { periodGradeId, subjectId },
        });
        if (!pgs) {
            return res.status(404).json({ error: 'Materia no vinculada a este grado' });
        }
        yield pgs.update({ includeInAverage });
        res.json({ message: 'Updated', includeInAverage });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating includeInAverage' });
    }
});
exports.toggleSubjectIncludeInAverage = toggleSubjectIncludeInAverage;
const toggleSubjectNotRepairable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodGradeId, subjectId, notRepairable } = req.body;
        const pgs = yield index_1.PeriodGradeSubject.unscoped().findOne({
            where: { periodGradeId, subjectId },
        });
        if (!pgs) {
            return res.status(404).json({ error: 'Materia no vinculada a este grado' });
        }
        yield pgs.update({ notRepairable });
        res.json({ message: 'Updated', notRepairable });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating notRepairable' });
    }
});
exports.toggleSubjectNotRepairable = toggleSubjectNotRepairable;
const updateSubjectWeeklyBlocks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodGradeId, subjectId, weeklyBlocks } = req.body;
        if (!Number.isFinite(weeklyBlocks) || weeklyBlocks < 1 || weeklyBlocks > 20) {
            return res.status(400).json({ error: 'weeklyBlocks debe ser un número entre 1 y 20' });
        }
        const pgs = yield index_1.PeriodGradeSubject.unscoped().findOne({
            where: { periodGradeId, subjectId },
        });
        if (!pgs) {
            return res.status(404).json({ error: 'Materia no vinculada a este grado' });
        }
        yield pgs.update({ weeklyBlocks });
        res.json({ message: 'Updated', weeklyBlocks });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating weeklyBlocks' });
    }
});
exports.updateSubjectWeeklyBlocks = updateSubjectWeeklyBlocks;
const removeSubjectFromGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodGradeId, subjectId } = req.body;
        // Soft-delete: mark as inactive instead of destroying. This preserves
        // InscriptionSubject, EvaluationPlan, TeacherAssignment, and Qualification
        // records for historical data. If the subject is re-added later, all data
        // reappears because the PeriodGradeSubject record is reactivated.
        yield index_1.PeriodGradeSubject.unscoped().update({ active: false }, { where: { periodGradeId, subjectId } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ error: 'Error removing subject' });
    }
});
exports.removeSubjectFromGrade = removeSubjectFromGrade;
const getPeriodGradeSubject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodGradeId, subjectId } = req.params;
        const pgs = yield index_1.PeriodGradeSubject.findOne({
            where: {
                periodGradeId: Number(periodGradeId),
                subjectId: Number(subjectId)
            }
        });
        if (!pgs) {
            return res.status(404).json({ error: 'PeriodGradeSubject not found' });
        }
        res.json(pgs);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching PeriodGradeSubject' });
    }
});
exports.getPeriodGradeSubject = getPeriodGradeSubject;
const addGradeToPeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId, gradeId, specializationId } = req.body;
        const pg = yield index_1.PeriodGrade.create({ schoolPeriodId, gradeId, specializationId: specializationId !== null && specializationId !== void 0 ? specializationId : null });
        res.json(pg);
    }
    catch (error) {
        res.status(500).json({ error: 'Error adding grade to period' });
    }
});
exports.addGradeToPeriod = addGradeToPeriod;
const removeGradeFromPeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params; // PeriodGrade ID
        // Should cascade delete sections? PeriodGradeSection has cascade usually if configured, 
        // strictly sequelize default might restrict. Let's delete manually or rely on DB.
        // For safety/simplicity:
        yield index_1.PeriodGradeSection.destroy({ where: { periodGradeId: id } });
        yield index_1.PeriodGrade.destroy({ where: { id } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ error: 'Error removing grade' });
    }
});
exports.removeGradeFromPeriod = removeGradeFromPeriod;
const addSectionToGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodGradeId, sectionId } = req.body;
        const pgs = yield index_1.PeriodGradeSection.create({ periodGradeId, sectionId });
        res.json(pgs);
    }
    catch (error) {
        res.status(500).json({ error: 'Error adding section' });
    }
});
exports.addSectionToGrade = addSectionToGrade;
const removeSectionFromGrade = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const periodGradeId = Number(req.params.periodGradeId || req.body.periodGradeId);
        const sectionId = Number(req.params.sectionId || req.body.sectionId);
        yield index_1.PeriodGradeSection.destroy({ where: { periodGradeId, sectionId } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ error: 'Error removing section' });
    }
});
exports.removeSectionFromGrade = removeSectionFromGrade;
const updateSectionColor = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodGradeId, sectionId } = req.params;
        const { color } = req.body;
        const pgs = yield index_1.PeriodGradeSection.findOne({ where: { periodGradeId: Number(periodGradeId), sectionId: Number(sectionId) } });
        if (!pgs)
            return res.status(404).json({ error: 'Relación grado-sección no encontrada' });
        pgs.color = color;
        yield pgs.save();
        res.json(pgs);
    }
    catch (error) {
        res.status(500).json({ error: 'Error updating section color' });
    }
});
exports.updateSectionColor = updateSectionColor;
const updateGradeColor = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodGradeId } = req.params;
        const { color } = req.body;
        const pg = yield index_1.PeriodGrade.findByPk(Number(periodGradeId));
        if (!pg)
            return res.status(404).json({ error: 'PeriodGrade no encontrado' });
        pg.color = color;
        yield pg.save();
        res.json(pg);
    }
    catch (error) {
        res.status(500).json({ error: 'Error updating grade color' });
    }
});
exports.updateGradeColor = updateGradeColor;
