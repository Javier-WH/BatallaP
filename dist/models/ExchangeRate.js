"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class ExchangeRate extends sequelize_1.Model {
}
ExchangeRate.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    exchangeRateTypeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'exchange_rate_types', key: 'id' },
        onDelete: 'CASCADE',
    },
    rate: {
        type: sequelize_1.DataTypes.DECIMAL(18, 4),
        allowNull: false,
    },
    date: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: false,
    },
}, {
    sequelize: database_1.default,
    tableName: 'exchange_rates',
    indexes: [
        { unique: true, fields: ['exchangeRateTypeId', 'date'], name: 'uq_exchange_rate_type_date' },
        { fields: ['date'] },
    ],
});
exports.default = ExchangeRate;
