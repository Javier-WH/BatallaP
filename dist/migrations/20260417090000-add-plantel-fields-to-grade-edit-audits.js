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
function up(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        yield queryInterface.addColumn('grade_edit_audits', 'previousPlantelId', {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
            comment: 'Plantel asociado a la nota antes de la modificación',
        });
        yield queryInterface.addColumn('grade_edit_audits', 'newPlantelId', {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
            comment: 'Plantel asociado a la nota después de la modificación',
        });
    });
}
function down(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        yield queryInterface.removeColumn('grade_edit_audits', 'previousPlantelId');
        yield queryInterface.removeColumn('grade_edit_audits', 'newPlantelId');
    });
}
