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
exports.default = {
    up(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            // MySQL ALTER COLUMN to add new ENUM values. Order matters: existing values
            // must be listed first so MySQL keeps the current column definition.
            yield queryInterface.sequelize.query(`ALTER TABLE \`student_guardians\` MODIFY COLUMN \`relationship\` ENUM('mother','father','sibling','grandparent','uncle_aunt','representative') NOT NULL`);
        });
    },
    down(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            // Revert: first set any rows with new values back to 'representative'
            yield queryInterface.sequelize.query(`UPDATE \`student_guardians\` SET \`relationship\` = 'representative' WHERE \`relationship\` IN ('sibling','grandparent','uncle_aunt')`);
            yield queryInterface.sequelize.query(`ALTER TABLE \`student_guardians\` MODIFY COLUMN \`relationship\` ENUM('mother','father','representative') NOT NULL`);
        });
    }
};
