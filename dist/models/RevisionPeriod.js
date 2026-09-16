"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const SchoolPeriod_1 = __importDefault(require("./SchoolPeriod"));
class RevisionPeriod extends sequelize_1.Model {
}
RevisionPeriod.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: SchoolPeriod_1.default,
            key: 'id',
        },
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('pending', 'open', 'completed', 'closed'),
        allowNull: false,
        defaultValue: 'pending',
    },
    maxOpportunities: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
    },
    passingGrade: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 10.0,
    },
    currentOpportunity: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    openedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    completedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    completedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
    },
    closedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    gradesFinalized: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    gradesFinalizedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    gradesFinalizedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
    },
}, {
    sequelize: database_1.default,
    tableName: 'revision_periods',
    indexes: [
        {
            unique: true,
            fields: ['schoolPeriodId'],
        },
    ],
});
exports.default = RevisionPeriod;
