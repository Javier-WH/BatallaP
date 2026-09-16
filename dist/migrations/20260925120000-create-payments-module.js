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
const sequelize_1 = require("sequelize");
exports.default = {
    up(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. exchange_rate_types
            yield queryInterface.createTable('exchange_rate_types', {
                id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
                code: { type: sequelize_1.DataTypes.STRING(30), allowNull: false, unique: true },
                name: { type: sequelize_1.DataTypes.STRING(100), allowNull: false },
                currency: { type: sequelize_1.DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' },
                isDefault: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
                active: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
                createdAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
                updatedAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
            });
            // 2. exchange_rates
            yield queryInterface.createTable('exchange_rates', {
                id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
                exchangeRateTypeId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'exchange_rate_types', key: 'id' },
                    onDelete: 'CASCADE',
                },
                rate: { type: sequelize_1.DataTypes.DECIMAL(18, 4), allowNull: false },
                date: { type: sequelize_1.DataTypes.DATEONLY, allowNull: false },
                createdAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
                updatedAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
            });
            yield queryInterface.addIndex('exchange_rates', {
                unique: true,
                fields: ['exchangeRateTypeId', 'date'],
                name: 'uq_exchange_rate_type_date',
            });
            yield queryInterface.addIndex('exchange_rates', { fields: ['date'] });
            // 3. fees
            yield queryInterface.createTable('fees', {
                id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
                schoolPeriodId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'school_periods', key: 'id' },
                    onDelete: 'CASCADE',
                },
                key: {
                    type: sequelize_1.DataTypes.ENUM('mensualidad', 'matricula', 'gastos_administrativos'),
                    allowNull: false,
                },
                name: { type: sequelize_1.DataTypes.STRING(100), allowNull: false },
                amount: { type: sequelize_1.DataTypes.DECIMAL(18, 2), allowNull: false },
                exchangeRateTypeId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'exchange_rate_types', key: 'id' },
                },
                active: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
                createdAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
                updatedAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
            });
            yield queryInterface.addIndex('fees', {
                unique: true,
                fields: ['schoolPeriodId', 'key'],
                name: 'uq_fees_period_key',
            });
            yield queryInterface.addIndex('fees', { fields: ['active'] });
            // 4. sellable_items
            yield queryInterface.createTable('sellable_items', {
                id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
                name: { type: sequelize_1.DataTypes.STRING(200), allowNull: false },
                description: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
                amount: { type: sequelize_1.DataTypes.DECIMAL(18, 2), allowNull: false },
                exchangeRateTypeId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'exchange_rate_types', key: 'id' },
                },
                category: { type: sequelize_1.DataTypes.STRING(100), allowNull: true },
                active: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
                createdAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
                updatedAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
            });
            yield queryInterface.addIndex('sellable_items', { fields: ['active'] });
            yield queryInterface.addIndex('sellable_items', { fields: ['category'] });
            // 5. enrollment_plans
            yield queryInterface.createTable('enrollment_plans', {
                id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
                name: { type: sequelize_1.DataTypes.STRING(100), allowNull: false },
                description: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
                targetExchangeRateTypeId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'exchange_rate_types', key: 'id' },
                },
                conversionMode: {
                    type: sequelize_1.DataTypes.ENUM('exchange_rate', 'same_amount'),
                    allowNull: false,
                    defaultValue: 'exchange_rate',
                },
                active: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
                createdAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
                updatedAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
            });
            yield queryInterface.addIndex('enrollment_plans', { fields: ['active'] });
            // 6. enrollment_plan_items
            yield queryInterface.createTable('enrollment_plan_items', {
                id: { type: sequelize_1.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
                enrollmentPlanId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'enrollment_plans', key: 'id' },
                    onDelete: 'CASCADE',
                },
                itemType: {
                    type: sequelize_1.DataTypes.ENUM('fee', 'sellable_item'),
                    allowNull: false,
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
                quantity: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
                createdAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
                updatedAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
            });
            yield queryInterface.addIndex('enrollment_plan_items', { fields: ['enrollmentPlanId'] });
            yield queryInterface.addIndex('enrollment_plan_items', { fields: ['feeId'] });
            yield queryInterface.addIndex('enrollment_plan_items', { fields: ['sellableItemId'] });
            // Seed: default exchange rate types (Venezuela)
            yield queryInterface.bulkInsert('exchange_rate_types', [
                { code: 'USD_BCV', name: 'Dólar BCV', currency: 'USD', isDefault: true, active: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'EUR_BCV', name: 'Euro BCV', currency: 'EUR', isDefault: false, active: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'USD_PARALLEL', name: 'Dólar Paralelo', currency: 'USD', isDefault: false, active: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'USD_CASH', name: 'Dólar en Efectivo', currency: 'USD', isDefault: false, active: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'VES', name: 'Bolívar (VES)', currency: 'VES', isDefault: false, active: true, createdAt: new Date(), updatedAt: new Date() },
            ]);
        });
    },
    down(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryInterface.dropTable('enrollment_plan_items');
            yield queryInterface.dropTable('enrollment_plans');
            yield queryInterface.dropTable('sellable_items');
            yield queryInterface.dropTable('fees');
            yield queryInterface.dropTable('exchange_rates');
            yield queryInterface.dropTable('exchange_rate_types');
            // Drop ENUM types created by PostgreSQL (MySQL drops them automatically with the table)
        });
    },
};
