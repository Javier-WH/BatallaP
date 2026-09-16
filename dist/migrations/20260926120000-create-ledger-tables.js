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
        // charges table
        yield queryInterface.createTable('charges', {
            id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
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
                type: sequelize_1.DataTypes.ENUM('mensualidad', 'matricula', 'gastos_administrativos', 'item', 'otro'),
                allowNull: false,
            },
            month: { type: sequelize_1.DataTypes.STRING(10), allowNull: true },
            description: { type: sequelize_1.DataTypes.STRING(200), allowNull: false },
            amount: { type: sequelize_1.DataTypes.DECIMAL(18, 2), allowNull: false },
            currency: { type: sequelize_1.DataTypes.STRING(10), allowNull: false, defaultValue: 'USD' },
            amountVES: { type: sequelize_1.DataTypes.DECIMAL(18, 2), allowNull: true },
            dueDate: { type: sequelize_1.DataTypes.DATE, allowNull: true },
            active: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            createdAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
            updatedAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
        });
        yield queryInterface.addIndex('charges', ['inscriptionId']);
        yield queryInterface.addIndex('charges', ['schoolPeriodId']);
        yield queryInterface.addIndex('charges', ['month']);
        yield queryInterface.addIndex('charges', ['type']);
        // payments table
        yield queryInterface.createTable('payments', {
            id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
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
            month: { type: sequelize_1.DataTypes.STRING(10), allowNull: true },
            amount: { type: sequelize_1.DataTypes.DECIMAL(18, 2), allowNull: false },
            currency: { type: sequelize_1.DataTypes.STRING(10), allowNull: false, defaultValue: 'USD' },
            amountVES: { type: sequelize_1.DataTypes.DECIMAL(18, 2), allowNull: true },
            exchangeRate: { type: sequelize_1.DataTypes.DECIMAL(18, 6), allowNull: true },
            method: {
                type: sequelize_1.DataTypes.ENUM('pago_movil', 'efectivo', 'transferencia', 'zelle', 'tarjeta', 'otro'),
                allowNull: false,
                defaultValue: 'efectivo',
            },
            reference: { type: sequelize_1.DataTypes.STRING(100), allowNull: true },
            bank: { type: sequelize_1.DataTypes.STRING(50), allowNull: true },
            paymentDate: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
            notes: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
            createdAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
            updatedAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
        });
        yield queryInterface.addIndex('payments', ['inscriptionId']);
        yield queryInterface.addIndex('payments', ['schoolPeriodId']);
        yield queryInterface.addIndex('payments', ['chargeId']);
        yield queryInterface.addIndex('payments', ['month']);
    });
}
function down(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        yield queryInterface.dropTable('payments');
        yield queryInterface.dropTable('charges');
    });
}
