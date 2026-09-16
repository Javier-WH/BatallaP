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
        const sequelize = queryInterface.sequelize;
        yield queryInterface.addColumn('terms', 'isActive', {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });
        // Backfill: mark the first term (by order) of the active school period as active
        const activePeriods = yield sequelize.query(`SELECT id FROM school_periods WHERE status = 'activo' LIMIT 1`, { type: sequelize_1.QueryTypes.SELECT });
        if (activePeriods.length > 0) {
            const periodId = activePeriods[0].id;
            const firstTerm = yield sequelize.query(`SELECT id FROM terms WHERE schoolPeriodId = ${periodId} ORDER BY \`order\` ASC LIMIT 1`, { type: sequelize_1.QueryTypes.SELECT });
            if (firstTerm.length > 0) {
                yield sequelize.query(`UPDATE terms SET isActive = 1 WHERE id = ${firstTerm[0].id}`);
            }
        }
    });
}
function down(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        yield queryInterface.removeColumn('terms', 'isActive');
    });
}
