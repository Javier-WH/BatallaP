"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHOOL_PERIOD_STATUSES = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
exports.SCHOOL_PERIOD_STATUSES = [
    'preinscripcion',
    'activo',
    'historico',
    'externo',
];
class SchoolPeriod extends sequelize_1.Model {
}
SchoolPeriod.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    period: {
        type: sequelize_1.DataTypes.STRING(9),
        allowNull: false,
        unique: true,
    },
    name: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    startYear: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
    },
    endYear: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...exports.SCHOOL_PERIOD_STATUSES),
        allowNull: false,
        defaultValue: 'historico', // Only one 'activo' and one 'preinscripcion' at a time
    },
    isActive: {
        type: sequelize_1.DataTypes.VIRTUAL,
        get() {
            return this.getDataValue('status') === 'activo';
        },
    },
    isExternal: {
        type: sequelize_1.DataTypes.VIRTUAL,
        get() {
            return this.getDataValue('status') === 'externo';
        },
    },
}, {
    sequelize: database_1.default,
    tableName: 'school_periods',
    indexes: [
        {
            unique: true,
            fields: ['period'],
        },
        {
            fields: ['startYear', 'endYear'],
        },
        {
            fields: ['status'],
        },
    ],
});
exports.default = SchoolPeriod;
