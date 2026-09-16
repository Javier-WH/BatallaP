"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONVERSION_MODES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
exports.CONVERSION_MODES = ['exchange_rate', 'same_amount'];
class EnrollmentPlan extends sequelize_1.Model {
}
EnrollmentPlan.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'school_periods', key: 'id' },
        onDelete: 'CASCADE',
    },
    targetExchangeRateTypeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'exchange_rate_types', key: 'id' },
    },
    conversionMode: {
        type: sequelize_1.DataTypes.ENUM(...exports.CONVERSION_MODES),
        allowNull: false,
        defaultValue: 'exchange_rate',
    },
    active: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'enrollment_plans',
    indexes: [
        { fields: ['active'] },
    ],
});
exports.default = EnrollmentPlan;
