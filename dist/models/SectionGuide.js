"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Person_1 = __importDefault(require("./Person"));
const Grade_1 = __importDefault(require("./Grade"));
const Section_1 = __importDefault(require("./Section"));
const SchoolPeriod_1 = __importDefault(require("./SchoolPeriod"));
class SectionGuide extends sequelize_1.Model {
}
SectionGuide.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    teacherId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Person_1.default, key: 'id' },
    },
    gradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Grade_1.default, key: 'id' },
    },
    sectionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Section_1.default, key: 'id' },
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: SchoolPeriod_1.default, key: 'id' },
    },
}, {
    sequelize: database_1.default,
    tableName: 'section_guides',
    indexes: [
        {
            unique: true,
            fields: ['gradeId', 'sectionId', 'schoolPeriodId'],
            name: 'unique_guide_per_grade_section_period',
        },
    ],
});
exports.default = SectionGuide;
