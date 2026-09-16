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
// Optional abbreviation fields for SubjectGroup. Used in different document types:
// - bulletinAbbreviation: shown in student report cards (boletines)
// - longAbbreviation: used in final summaries (long version)
// - shortAbbreviation: used in final summaries (short version)
// When null, the group's normal name is used as fallback.
function up(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        yield queryInterface.addColumn('subject_groups', 'bulletinAbbreviation', {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        });
        yield queryInterface.addColumn('subject_groups', 'longAbbreviation', {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        });
        yield queryInterface.addColumn('subject_groups', 'shortAbbreviation', {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        });
    });
}
function down(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        yield queryInterface.removeColumn('subject_groups', 'bulletinAbbreviation');
        yield queryInterface.removeColumn('subject_groups', 'longAbbreviation');
        yield queryInterface.removeColumn('subject_groups', 'shortAbbreviation');
    });
}
