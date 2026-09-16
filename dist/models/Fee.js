"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEE_KEYS = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
exports.FEE_KEYS = ['mensualidad', 'matricula', 'gastos_administrativos'];
class Fee extends sequelize_1.Model {
}
Fee.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'school_periods', key: 'id' },
        onDelete: 'CASCADE',
    },
    key: {
        type: sequelize_1.DataTypes.ENUM(...exports.FEE_KEYS),
        allowNull: false,
    },
    name: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
    },
    amount: {
        type: sequelize_1.DataTypes.DECIMAL(18, 2),
        allowNull: false,
    },
    exchangeRateTypeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'exchange_rate_types', key: 'id' },
    },
    active: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'fees',
    indexes: [
        { unique: true, fields: ['schoolPeriodId', 'key'], name: 'uq_fees_period_key' },
        { fields: ['active'] },
    ],
});
exports.default = Fee;
