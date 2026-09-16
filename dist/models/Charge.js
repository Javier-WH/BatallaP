"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARGE_TYPES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
exports.CHARGE_TYPES = [
    'mensualidad', 'matricula', 'gastos_administrativos', 'item', 'otro',
];
class Charge extends sequelize_1.Model {
}
Charge.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    inscriptionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'inscriptions', key: 'id' },
        onDelete: 'CASCADE',
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'school_periods', key: 'id' },
    },
    feeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'fees', key: 'id' },
    },
    sellableItemId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'sellable_items', key: 'id' },
    },
    type: {
        type: sequelize_1.DataTypes.ENUM(...exports.CHARGE_TYPES),
        allowNull: false,
    },
    month: {
        type: sequelize_1.DataTypes.STRING(10),
        allowNull: true,
    },
    description: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: false,
    },
    amount: {
        type: sequelize_1.DataTypes.DECIMAL(18, 2),
        allowNull: false,
    },
    currency: {
        type: sequelize_1.DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'USD',
    },
    amountVES: {
        type: sequelize_1.DataTypes.DECIMAL(18, 2),
        allowNull: true,
    },
    dueDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    active: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'charges',
    indexes: [
        { fields: ['inscriptionId'] },
        { fields: ['schoolPeriodId'] },
        { fields: ['month'] },
        { fields: ['type'] },
    ],
});
exports.default = Charge;
