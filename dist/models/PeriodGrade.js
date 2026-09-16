"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const SchoolPeriod_1 = __importDefault(require("./SchoolPeriod"));
const Grade_1 = __importDefault(require("./Grade"));
const Specialization_1 = __importDefault(require("./Specialization"));
class PeriodGrade extends sequelize_1.Model {
}
PeriodGrade.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: SchoolPeriod_1.default, key: 'id' },
        allowNull: false
    },
    gradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Grade_1.default, key: 'id' },
        allowNull: false
    },
    specializationId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Specialization_1.default, key: 'id' },
        allowNull: true,
    },
    color: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    }
}, {
    sequelize: database_1.default,
    tableName: 'period_grades',
    indexes: [
        {
            unique: true,
            fields: ['schoolPeriodId', 'gradeId', 'specializationId']
        }
    ]
});
exports.default = PeriodGrade;
