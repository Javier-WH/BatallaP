"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const PeriodGrade_1 = __importDefault(require("./PeriodGrade"));
const Section_1 = __importDefault(require("./Section"));
class PeriodGradeSection extends sequelize_1.Model {
}
PeriodGradeSection.init({
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
    sectionId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Section_1.default, key: 'id' },
        allowNull: false
    },
    color: {
        type: sequelize_1.DataTypes.STRING(7),
        allowNull: false,
        defaultValue: '#ffffff',
    },
}, {
    sequelize: database_1.default,
    tableName: 'period_grade_sections',
    indexes: [
        {
            unique: true,
            fields: ['periodGradeId', 'sectionId']
        }
    ]
});
exports.default = PeriodGradeSection;
