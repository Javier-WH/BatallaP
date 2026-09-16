"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const PeriodGrade_1 = __importDefault(require("./PeriodGrade"));
const Subject_1 = __importDefault(require("./Subject"));
class PeriodGradeSubject extends sequelize_1.Model {
}
PeriodGradeSubject.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    periodGradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: PeriodGrade_1.default, key: 'id' },
        allowNull: false
    },
    subjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Subject_1.default, key: 'id' },
        allowNull: false
    },
    order: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
    },
    active: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    includeInAverage: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    notRepairable: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    weeklyBlocks: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
    },
}, {
    sequelize: database_1.default,
    tableName: 'period_grade_subjects',
    defaultScope: {
        where: { active: true },
    },
    indexes: [
        {
            unique: true,
            fields: ['periodGradeId', 'subjectId']
        }
    ]
});
exports.default = PeriodGradeSubject;
