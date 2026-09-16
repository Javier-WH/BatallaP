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
// Records which subject (within a SubjectGroup) a student is taking during a
// specific Term. Only applies to grouped subjects (Subject.subjectGroupId != null).
//
// Source of truth for "Música in L1, Danza in L2-L3" without losing L1 notes.
// The data is backfilled by seedChoicesForPeriod() after the table is created.
function up(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        // Guard: table may already exist if created by sequelize.sync() before
        // migrations ran. Skip createTable if so, but still run the backfill.
        const tables = yield queryInterface.showAllTables();
        if (!tables.includes('inscription_group_term_choices')) {
            yield queryInterface.createTable('inscription_group_term_choices', {
                id: {
                    type: sequelize_1.DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                },
                inscriptionId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'inscriptions', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
                subjectGroupId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'subject_groups', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT',
                },
                termId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'terms', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
                subjectId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'subjects', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'RESTRICT',
                },
                createdAt: {
                    type: sequelize_1.DataTypes.DATE,
                    allowNull: false,
                    defaultValue: sequelize_1.DataTypes.NOW,
                },
                updatedAt: {
                    type: sequelize_1.DataTypes.DATE,
                    allowNull: false,
                    defaultValue: sequelize_1.DataTypes.NOW,
                },
            });
            yield queryInterface.addIndex('inscription_group_term_choices', ['inscriptionId', 'subjectGroupId', 'termId'], { unique: true, name: 'inscription_group_term_choices_unique_choice' });
        } // end if (!tables.includes)
        // Backfill: for every existing InscriptionSubject with a subjectGroupId,
        // create a choice record for every term of the inscription's school period.
        // The subject the student is currently enrolled in is the one we assign to
        // all terms (per the agreed migration policy: "asigna la materia actual").
        const [inscriptions] = yield queryInterface.sequelize.query(`
    SELECT i.id AS inscriptionId, i.schoolPeriodId, isub.subjectId, s.subjectGroupId
    FROM inscriptions i
    JOIN inscription_subjects isub ON isub.inscriptionId = i.id
    JOIN subjects s ON s.id = isub.subjectId
    WHERE s.subjectGroupId IS NOT NULL
  `);
        const rows = [];
        for (const ins of inscriptions) {
            const [terms] = yield queryInterface.sequelize.query(`SELECT id FROM terms WHERE schoolPeriodId = ? ORDER BY \`order\` ASC`, { replacements: [ins.schoolPeriodId] });
            for (const term of terms) {
                rows.push({
                    inscriptionId: ins.inscriptionId,
                    subjectGroupId: ins.subjectGroupId,
                    termId: term.id,
                    subjectId: ins.subjectId,
                });
            }
        }
        if (rows.length > 0) {
            // Insert in chunks to avoid MySQL max_allowed_packet issues on large datasets.
            // Include timestamps explicitly because MySQL strict mode rejects NULL on
            // NOT NULL columns without a DEFAULT clause.
            const now = new Date();
            const chunkSize = 500;
            for (let i = 0; i < rows.length; i += chunkSize) {
                const chunk = rows.slice(i, i + chunkSize).map(r => (Object.assign(Object.assign({}, r), { createdAt: now, updatedAt: now })));
                yield queryInterface.bulkInsert('inscription_group_term_choices', chunk);
            }
        }
    });
}
function down(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        yield queryInterface.dropTable('inscription_group_term_choices');
    });
}
