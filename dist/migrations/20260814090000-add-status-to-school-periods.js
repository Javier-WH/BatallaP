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
const STATUSES = ['preinscripcion', 'activo', 'historico', 'externo'];
function up(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        const sequelize = queryInterface.sequelize;
        yield queryInterface.addColumn('school_periods', 'status', {
            type: sequelize_1.DataTypes.ENUM(...STATUSES),
            allowNull: false,
            defaultValue: 'historico',
        });
        // Backfill from the legacy boolean flags
        yield sequelize.query(`UPDATE school_periods SET status = 'externo' WHERE isExternal = 1`);
        yield sequelize.query(`UPDATE school_periods SET status = 'activo' WHERE isActive = 1 AND isExternal = 0`);
        // The non-external period right after the active one becomes the preinscription period
        const rows = yield sequelize.query(`SELECT next.id AS id
       FROM school_periods AS next
       JOIN school_periods AS current ON current.status = 'activo'
      WHERE next.isExternal = 0
        AND next.startYear = current.startYear + 1
      LIMIT 1`, { type: sequelize_1.QueryTypes.SELECT });
        if (rows.length > 0) {
            yield sequelize.query(`UPDATE school_periods SET status = 'preinscripcion' WHERE id = ${Number(rows[0].id)}`);
        }
        yield queryInterface.addIndex('school_periods', ['status']);
        yield queryInterface.removeColumn('school_periods', 'isActive');
        yield queryInterface.removeColumn('school_periods', 'isExternal');
    });
}
function down(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        const sequelize = queryInterface.sequelize;
        yield queryInterface.addColumn('school_periods', 'isActive', {
            type: sequelize_1.DataTypes.BOOLEAN,
            defaultValue: false,
        });
        yield queryInterface.addColumn('school_periods', 'isExternal', {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });
        yield sequelize.query(`UPDATE school_periods SET isActive = 1 WHERE status = 'activo'`);
        yield sequelize.query(`UPDATE school_periods SET isExternal = 1 WHERE status = 'externo'`);
        yield queryInterface.removeIndex('school_periods', ['status']);
        yield queryInterface.removeColumn('school_periods', 'status');
    });
}
