"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Person_1 = __importDefault(require("./Person"));
const Grade_1 = __importDefault(require("./Grade"));
const Subject_1 = __importDefault(require("./Subject"));
const SchoolPeriod_1 = __importDefault(require("./SchoolPeriod"));
const Plantel_1 = __importDefault(require("./Plantel"));
const User_1 = __importDefault(require("./User"));
class HistoricalGrade extends sequelize_1.Model {
}
HistoricalGrade.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    personId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Person_1.default, key: 'id' },
        onDelete: 'CASCADE',
    },
    gradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Grade_1.default, key: 'id' },
    },
    subjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Subject_1.default, key: 'id' },
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: SchoolPeriod_1.default, key: 'id' },
    },
    finalScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('aprobada', 'reprobada'),
        allowNull: false,
        defaultValue: 'reprobada',
    },
    gradeType: {
        type: sequelize_1.DataTypes.ENUM('regular', 'revision', 'materia_pendiente', 'transferencia', 'equivalencia'),
        allowNull: false,
        defaultValue: 'regular',
    },
    plantelId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: Plantel_1.default, key: 'id' },
    },
    date: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: true,
    },
    subjectName: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
    createdBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: User_1.default, key: 'id' },
        onDelete: 'SET NULL',
    },
}, {
    sequelize: database_1.default,
    tableName: 'historical_grades',
    indexes: [
        {
            unique: true,
            fields: ['personId', 'gradeId', 'subjectId'],
            name: 'uq_historical_grades_person_grade_subject',
        },
    ],
});
exports.default = HistoricalGrade;
