"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class Term extends sequelize_1.Model {
}
Term.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
    },
    isBlocked: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    openDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    closeDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'school_periods',
            key: 'id',
        },
    },
    order: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    councilCompletedAtOverride: {
        // Calendar date (YYYY-MM-DD) set by Master to override the council
        // completion date of every section in this term. DATEONLY avoids
        // timezone conversions: the stored string is the date shown everywhere.
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'terms',
    indexes: [
        {
            unique: true,
            fields: ['schoolPeriodId', 'order'],
        },
    ],
});
exports.default = Term;
