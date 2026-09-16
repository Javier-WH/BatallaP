"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Person_1 = __importDefault(require("./Person"));
const PeriodGradeSubject_1 = __importDefault(require("./PeriodGradeSubject"));
const Section_1 = __importDefault(require("./Section"));
class TeacherAssignment extends sequelize_1.Model {
}
TeacherAssignment.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    teacherId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Person_1.default, key: 'id' },
        allowNull: false
    },
    periodGradeSubjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: PeriodGradeSubject_1.default, key: 'id' },
        allowNull: false
    },
    sectionId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Section_1.default, key: 'id' },
        allowNull: false
    }
}, {
    sequelize: database_1.default,
    tableName: 'teacher_assignments',
    indexes: [
        {
            unique: true,
            fields: ['periodGradeSubjectId', 'sectionId'],
            name: 'unique_subject_section_per_period' // A subject in a section can only have one teacher
        }
    ]
});
exports.default = TeacherAssignment;
