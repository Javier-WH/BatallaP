"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_METHODS = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
exports.PAYMENT_METHODS = [
    'pago_movil', 'efectivo', 'transferencia', 'zelle', 'tarjeta', 'otro',
];
class Payment extends sequelize_1.Model {
}
Payment.init({
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
    chargeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'charges', key: 'id' },
    },
    month: {
        type: sequelize_1.DataTypes.STRING(10),
        allowNull: true,
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
    exchangeRate: {
        type: sequelize_1.DataTypes.DECIMAL(18, 6),
        allowNull: true,
    },
    method: {
        type: sequelize_1.DataTypes.ENUM(...exports.PAYMENT_METHODS),
        allowNull: false,
        defaultValue: 'efectivo',
    },
    reference: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
    },
    bank: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
    },
    paymentDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    notes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'payments',
    indexes: [
        { fields: ['inscriptionId'] },
        { fields: ['schoolPeriodId'] },
        { fields: ['chargeId'] },
        { fields: ['month'] },
    ],
});
exports.default = Payment;
