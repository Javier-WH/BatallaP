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
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
/**
 * Denormaliza contexto académico (schoolPeriodId, gradeId, sectionId, termId,
 * subjectId, date) directamente en InscriptionSubject, Qualification y
 * SubjectFinalGrade.
 *
 * Todas las columnas se añaden como NULLABLE y se mantienen así: el código
 * las popula al crear registros nuevos, y el backfill llena las filas viejas
 * vía UPDATE + JOIN. No se fuerza NOT NULL para evitar fallos si hay datos
 * huérfanos (InscriptionSubject sin Inscription, Qualification sin
 * EvaluationPlan, etc.).
 *
 * Las columnas nuevas son redundantes con los joins existentes, pero
 * permiten queries directos sin ambigüedad de período/grado/sección/lapso.
 *
 * Esta migración es idempotente: verifica si cada columna/index ya existe
 * antes de crearlo, para poder re-ejecutarse sin errores.
 */
function columnExists(qi, table, column) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const [rows] = yield qi.sequelize.query(`SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, { replacements: [table, column] });
        return Number((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.cnt) > 0;
    });
}
function indexExists(qi, table, indexName) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const [rows] = yield qi.sequelize.query(`SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`, { replacements: [table, indexName] });
        return Number((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.cnt) > 0;
    });
}
function addColumnIfNotExists(qi, table, column, config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield columnExists(qi, table, column)) {
            console.log(`  ⏭️  Column ${table}.${column} already exists, skipping`);
            return;
        }
        yield qi.addColumn(table, column, config);
        console.log(`  ✅ Added ${table}.${column}`);
    });
}
function addIndexIfNotExists(qi, table, fields, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield indexExists(qi, table, options.name)) {
            console.log(`  ⏭️  Index ${options.name} already exists, skipping`);
            return;
        }
        yield qi.addIndex(table, fields, options);
        console.log(`  ✅ Added index ${options.name}`);
    });
}
function up(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        const sequelize = queryInterface.sequelize;
        // ──────────────────────────────────────────────────────────────────────
        // 1. InscriptionSubject: schoolPeriodId, gradeId, sectionId
        // ──────────────────────────────────────────────────────────────────────
        console.log('[migration] Phase 1: InscriptionSubject context columns');
        yield addColumnIfNotExists(queryInterface, 'inscription_subjects', 'schoolPeriodId', {
            type: sequelize_1.DataTypes.INTEGER, allowNull: true,
            comment: 'Denormalizado desde Inscription.schoolPeriodId',
        });
        yield addColumnIfNotExists(queryInterface, 'inscription_subjects', 'gradeId', {
            type: sequelize_1.DataTypes.INTEGER, allowNull: true,
            comment: 'Denormalizado desde Inscription.gradeId',
        });
        yield addColumnIfNotExists(queryInterface, 'inscription_subjects', 'sectionId', {
            type: sequelize_1.DataTypes.INTEGER, allowNull: true,
            comment: 'Denormalizado desde Inscription.sectionId',
        });
        // Backfill desde inscriptions (always run — safe to re-run)
        console.log('[migration] Backfilling inscription_subjects from inscriptions');
        yield sequelize.query(`
    UPDATE inscription_subjects ins
    JOIN inscriptions i ON ins.inscriptionId = i.id
    SET
      ins.schoolPeriodId = i.schoolPeriodId,
      ins.gradeId = i.gradeId,
      ins.sectionId = i.sectionId
    WHERE ins.schoolPeriodId IS NULL OR ins.gradeId IS NULL
  `);
        yield addIndexIfNotExists(queryInterface, 'inscription_subjects', ['schoolPeriodId', 'gradeId', 'subjectId'], { name: 'idx_inscription_subjects_context' });
        // ──────────────────────────────────────────────────────────────────────
        // 2. Qualification: schoolPeriodId, termId, subjectId, gradeId, sectionId, date
        // ──────────────────────────────────────────────────────────────────────
        console.log('[migration] Phase 2: Qualification context columns');
        yield addColumnIfNotExists(queryInterface, 'qualifications', 'schoolPeriodId', {
            type: sequelize_1.DataTypes.INTEGER, allowNull: true,
            comment: 'Denormalizado desde PeriodGrade.schoolPeriodId via EvaluationPlan',
        });
        yield addColumnIfNotExists(queryInterface, 'qualifications', 'termId', {
            type: sequelize_1.DataTypes.INTEGER, allowNull: true,
            comment: 'Denormalizado desde EvaluationPlan.termId',
        });
        yield addColumnIfNotExists(queryInterface, 'qualifications', 'subjectId', {
            type: sequelize_1.DataTypes.INTEGER, allowNull: true,
            comment: 'Denormalizado desde PeriodGradeSubject.subjectId via EvaluationPlan',
        });
        yield addColumnIfNotExists(queryInterface, 'qualifications', 'gradeId', {
            type: sequelize_1.DataTypes.INTEGER, allowNull: true,
            comment: 'Denormalizado desde PeriodGrade.gradeId via EvaluationPlan',
        });
        yield addColumnIfNotExists(queryInterface, 'qualifications', 'sectionId', {
            type: sequelize_1.DataTypes.INTEGER, allowNull: true,
            comment: 'Denormalizado desde EvaluationPlan.sectionId',
        });
        yield addColumnIfNotExists(queryInterface, 'qualifications', 'date', {
            type: sequelize_1.DataTypes.DATEONLY, allowNull: true,
            comment: 'Denormalizado desde EvaluationPlan.date',
        });
        // Backfill desde evaluation_plans + period_grade_subjects + period_grades
        console.log('[migration] Backfilling qualifications from evaluation_plans');
        yield sequelize.query(`
    UPDATE qualifications q
    JOIN evaluation_plans ep ON q.evaluationPlanId = ep.id
    JOIN period_grade_subjects pgs ON ep.periodGradeSubjectId = pgs.id
    JOIN period_grades pg ON pgs.periodGradeId = pg.id
    SET
      q.schoolPeriodId = pg.schoolPeriodId,
      q.termId = ep.termId,
      q.subjectId = pgs.subjectId,
      q.gradeId = pg.gradeId,
      q.sectionId = ep.sectionId,
      q.date = ep.date
    WHERE q.schoolPeriodId IS NULL
  `);
        yield addIndexIfNotExists(queryInterface, 'qualifications', ['schoolPeriodId', 'gradeId', 'subjectId', 'termId'], { name: 'idx_qualifications_context' });
        // ──────────────────────────────────────────────────────────────────────
        // 3. SubjectFinalGrade: schoolPeriodId, subjectId, gradeId, termId
        // ──────────────────────────────────────────────────────────────────────
        console.log('[migration] Phase 3: SubjectFinalGrade context columns');
        yield addColumnIfNotExists(queryInterface, 'subject_final_grades', 'schoolPeriodId', {
            type: sequelize_1.DataTypes.INTEGER, allowNull: true,
            comment: 'Denormalizado desde Inscription.schoolPeriodId via InscriptionSubject',
        });
        yield addColumnIfNotExists(queryInterface, 'subject_final_grades', 'subjectId', {
            type: sequelize_1.DataTypes.INTEGER, allowNull: true,
            comment: 'Denormalizado desde InscriptionSubject.subjectId',
        });
        yield addColumnIfNotExists(queryInterface, 'subject_final_grades', 'gradeId', {
            type: sequelize_1.DataTypes.INTEGER, allowNull: true,
            comment: 'Denormalizado desde Inscription.gradeId via InscriptionSubject',
        });
        yield addColumnIfNotExists(queryInterface, 'subject_final_grades', 'termId', {
            type: sequelize_1.DataTypes.INTEGER, allowNull: true,
            comment: 'Lapso al que pertenece la nota (solo para revisiones; NULL para notas finales regulares)',
        });
        // Backfill desde inscription_subjects + inscriptions
        console.log('[migration] Backfilling subject_final_grades from inscription_subjects');
        yield sequelize.query(`
    UPDATE subject_final_grades sfg
    JOIN inscription_subjects ins ON sfg.inscriptionSubjectId = ins.id
    JOIN inscriptions i ON ins.inscriptionId = i.id
    SET
      sfg.schoolPeriodId = i.schoolPeriodId,
      sfg.subjectId = ins.subjectId,
      sfg.gradeId = i.gradeId
    WHERE sfg.schoolPeriodId IS NULL
  `);
        yield addIndexIfNotExists(queryInterface, 'subject_final_grades', ['schoolPeriodId', 'gradeId', 'subjectId'], { name: 'idx_subject_final_grades_context' });
    });
}
function down(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        // InscriptionSubject
        try {
            yield queryInterface.removeIndex('inscription_subjects', 'idx_inscription_subjects_context');
        }
        catch ( /* ignore */_a) { /* ignore */ }
        yield queryInterface.removeColumn('inscription_subjects', 'schoolPeriodId');
        yield queryInterface.removeColumn('inscription_subjects', 'gradeId');
        yield queryInterface.removeColumn('inscription_subjects', 'sectionId');
        // Qualification
        try {
            yield queryInterface.removeIndex('qualifications', 'idx_qualifications_context');
        }
        catch ( /* ignore */_b) { /* ignore */ }
        yield queryInterface.removeColumn('qualifications', 'schoolPeriodId');
        yield queryInterface.removeColumn('qualifications', 'termId');
        yield queryInterface.removeColumn('qualifications', 'subjectId');
        yield queryInterface.removeColumn('qualifications', 'gradeId');
        yield queryInterface.removeColumn('qualifications', 'sectionId');
        yield queryInterface.removeColumn('qualifications', 'date');
        // SubjectFinalGrade
        try {
            yield queryInterface.removeIndex('subject_final_grades', 'idx_subject_final_grades_context');
        }
        catch ( /* ignore */_c) { /* ignore */ }
        yield queryInterface.removeColumn('subject_final_grades', 'schoolPeriodId');
        yield queryInterface.removeColumn('subject_final_grades', 'subjectId');
        yield queryInterface.removeColumn('subject_final_grades', 'gradeId');
        yield queryInterface.removeColumn('subject_final_grades', 'termId');
    });
}
