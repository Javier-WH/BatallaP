"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class ClassroomAssignment extends sequelize_1.Model {
}
ClassroomAssignment.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    room: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    targetType: {
        type: sequelize_1.DataTypes.ENUM('section', 'subject', 'group'),
        allowNull: false,
    },
    sectionKey: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    subjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
    },
    gradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'classroom_assignments',
    indexes: [
        { name: 'ca_uniq', unique: true, fields: ['room', 'targetType', 'sectionKey', 'subjectId', 'gradeId'] },
    ],
});
exports.default = ClassroomAssignment;
