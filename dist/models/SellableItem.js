"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class SellableItem extends sequelize_1.Model {
}
SellableItem.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: false,
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
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
    category: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
    },
    active: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'sellable_items',
    indexes: [
        { fields: ['active'] },
        { fields: ['category'] },
    ],
});
exports.default = SellableItem;
