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
// Consolidates per-section template assignments into per-grade assignments.
//
// Before this migration, templates could be assigned per (grade, section) or
// per grade. Now templates are strictly per-grade (all sections share the
// same template). This migration:
//  1. For each legacy per-section assignment, if no per-grade assignment
//     exists for that grade, promote the section assignment to a per-grade
//     assignment (first section wins).
//  2. Deletes all remaining per-section assignment keys.
function up(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        const [sectionRows] = yield queryInterface.sequelize.query(`
    SELECT \`key\`, \`value\` FROM settings
    WHERE \`key\` LIKE 'template_assignment:grade:%:section:%'
  `);
        // Extract gradeId from each section key and pick the first per grade.
        const gradeToValue = new Map();
        for (const row of sectionRows) {
            // key format: template_assignment:grade:<gradeId>:section:<sectionId>
            const match = row.key.match(/^template_assignment:grade:(\d+):section:\d+$/);
            if (!match)
                continue;
            const gradeId = Number(match[1]);
            if (!gradeToValue.has(gradeId)) {
                gradeToValue.set(gradeId, row.value);
            }
        }
        // Promote to per-grade where no per-grade assignment exists.
        for (const [gradeId, value] of gradeToValue) {
            const gradeKey = `template_assignment:grade:${gradeId}`;
            const [existing] = yield queryInterface.sequelize.query(`SELECT \`key\` FROM settings WHERE \`key\` = ?`, { replacements: [gradeKey] });
            if (existing.length === 0) {
                yield queryInterface.sequelize.query(`INSERT INTO settings (\`key\`, \`value\`, \`createdAt\`, \`updatedAt\`) VALUES (?, ?, NOW(), NOW())`, { replacements: [gradeKey, value] });
            }
        }
        // Delete all legacy per-section assignment keys.
        yield queryInterface.sequelize.query(`
    DELETE FROM settings
    WHERE \`key\` LIKE 'template_assignment:grade:%:section:%'
  `);
    });
}
function down(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        // No-op: per-section assignments cannot be reconstructed from per-grade ones.
        // The per-grade assignments remain as-is.
    });
}
